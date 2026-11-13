// BẦU TRỜI PHÁO HOA — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-bau-troi-phao-hoa.md
// (KHỐI 5–9): quà = pháo theo tầng xu (1–9 tròn 1 màu, 10–99 chùm 3 vòng,
// ≥100 hình tim/sao/chữ + Epic); điểm = xu × 10; tap 20 = +1đ + 1 pháo nhỏ;
// comment +1đ + pháo nhỏ (1/5s); share +1đ (1/30s); follow +5đ + pháo chữ
// tên (1 lần/phiên); cứ 100 pháo = màn pháo lớn 10s + xướng top 3;
// countdown tới giờ G rồi màn đại 15s. Điểm chỉ tăng, không giảm.
// Giới hạn: tối đa 8 pháo mới/giây — pháo nhỏ vượt thì GỘP (x3/x5), hàng
// đợi pháo nhỏ tối đa 20 (rớt cũ nhất, điểm vẫn đủ); pháo quà + pháo chữ
// KHÔNG BAO GIỜ bị gộp/rớt.
// Khác bản thiết kế: KHÔNG chạy server local cổng 3014; quà tra số xu thật
// trong payload (không có bảng quà hardcode — mốc xu chính là bảng);
// pháo vẽ bằng canvas phía overlay, server chỉ giữ sự kiện + đếm.
'use strict';

function createEngine(ctx) {
  const __dirname = ctx.gameDir;
  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const cors = require('cors');
  const { loadJson, saveJson, normVi, parseTikFinityEvent, TapDelta, withTimers, mountTts } = require('../../lib/game-common');
  const timers = withTimers(ctx);
  const DATA_DIR = ctx.dataDir;
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const SESSION_FILE = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const DEFAULT_GIFT_COLORS = {
    'hoa hong': '#FF2D55', 'kinh ram': '#00BFFF', 'heo may man': '#FF69B4',
    'xe hoi': '#FFD700', 'vuong mien': '#BF5AF2',
  };
  const TIER_COLORS = { small: ['#FFD700'], cluster: ['#FFD700', '#FF2D55', '#00BFFF'], shape: ['#FFD700', '#FF2D55', '#FF69B4'] };

  const defaultSettings = {
    tapPerPoint: 20,
    commentPoints: 1,
    sharePoints: 1,
    followPoints: 5,
    giftPointsPerCoin: 10,
    commentCooldownS: 5,
    shareCooldownS: 30,
    maxPerSec: 8,
    smallQueueMax: 20,
    maxConcurrent: 12,
    grandEvery: 100,
    grandShowS: 10,
    finaleS: 15,
    bigShape: 'heart', // heart | star | text
    giftColors: { ...DEFAULT_GIFT_COLORS },
    countdownMessage: 'CHÚC MỪNG NĂM MỚI!',
    bannedWords: [],
    inactivityCleanupMin: 10,
    demoMode: true,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  if (!settings.giftColors || typeof settings.giftColors !== 'object') settings.giftColors = { ...DEFAULT_GIFT_COLORS };
  if (!Array.isArray(settings.bannedWords)) settings.bannedWords = [];
  if (!['heart', 'star', 'text'].includes(settings.bigShape)) settings.bigShape = 'heart';
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      totalFireworks: 0,
      grandShows: 0,
      nextGrandAt: 100,
      grandShow: null, // {milestone, endsAt}
      pendingGrand: 0, // mốc đang chờ (bị dời vì trùng countdown)
      grandDelayedUntil: 0,
      smallPausedUntil: 0,
      countdown: null, // {targetAt, message, active}
      countdownAnnounced: [],
      lastCountdownFireworkAt: 0,
      finaleCount: 0,
      finaleActiveUntil: 0,
      lastFinaleAt: 0,
      players: {}, // uid -> {name, avatar, points, fireworks, tapResidue, lastCommentAt, lastShareAt, followed, online, lastActiveAt, joinedAt}
      smallQueue: [], // pháo nhỏ chờ bắn {kind:'small', name, uid, colors}
      activeFireworks: [], // {id, launchedAt, lifetimeMs}
      recentFireworks: [], // {id, kind, name, giftName, coins, colors, shape, text, multiplier, x, y, at}
      recentComments: [], // {name, text, at}
      stats: { comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, followsBlocked: 0, shares: 0, sharesBlocked: 0, joins: 0, merged: 0, dropped: 0 },
      logs: [],
      webhookCount: 0,
      avatarStats: { total: 0, withAvatar: 0 },
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players || typeof session.players !== 'object') session.players = {};
  if (!session.stats) session.stats = defaultSession().stats;
  if (!Array.isArray(session.smallQueue)) session.smallQueue = [];
  if (!Array.isArray(session.activeFireworks)) session.activeFireworks = [];
  if (!Array.isArray(session.recentFireworks)) session.recentFireworks = [];
  if (!Array.isArray(session.recentComments)) session.recentComments = [];
  if (!session.nextGrandAt) session.nextGrandAt = settings.grandEvery;
  session.grandShow = null;
  session.smallPausedUntil = 0;
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  let dirty = false;
  let fwSeq = 0;
  function saveSession() { saveJson(SESSION_FILE, session); dirty = false; }
  function saveSettings() { saveJson(SETTINGS_FILE, settings); }

  const app = ctx.router;
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(express.text({ type: ['text/plain', 'text/*'], limit: '2mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  const io = ctx.io;
  mountTts(app, DATA_DIR);

  function addLog(text, kind = 'info') {
    session.logs.push({ t: Date.now(), text, kind });
    if (session.logs.length > 200) session.logs = session.logs.slice(-200);
    dirty = true;
  }
  function touchPlayer(ev) {
    const p = session.players[ev.uid] || {
      name: ev.name, avatar: ev.avatar || '', points: 0, fireworks: 0, tapResidue: 0,
      lastCommentAt: 0, lastShareAt: 0, followed: false, online: true,
      lastActiveAt: Date.now(), joinedAt: Date.now(),
    };
    p.name = ev.name;
    if (ev.avatar) p.avatar = ev.avatar;
    p.online = true;
    p.lastActiveAt = Date.now();
    session.players[ev.uid] = p;
    return p;
  }
  function trackAvatar(ev) {
    if (!ev.uid || ev.isDemo) return; // người xem demo không tính vào thống kê avatar thật
    session.avatarStats.total += 1;
    if (ev.avatar) session.avatarStats.withAvatar += 1;
  }
  function containsBanned(text) {
    const t = normVi(text || '');
    if (!t) return false;
    for (const w of settings.bannedWords) {
      const bw = normVi(w);
      if (bw && t.includes(bw)) return true;
    }
    return false;
  }
  function voiceName(name) {
    return containsBanned(name) ? 'một bạn' : name;
  }
  function topList(n) {
    return Object.entries(session.players)
      .map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '', points: p.points, fireworks: p.fireworks, online: p.online }))
      .sort((a, b) => b.points - a.points)
      .slice(0, n);
  }
  function giftColorFor(giftName) {
    const key = normVi(giftName || '');
    return settings.giftColors[key] || null;
  }

  // ---- Pháo hoa: bắn + đếm + mốc màn lớn ----
  function launchFirework(fw, opts) {
    const o = opts || {};
    fwSeq += 1;
    const now = Date.now();
    const item = {
      id: fwSeq,
      kind: fw.kind, // small | cluster | shape | name | merged | grand | finale
      name: fw.name || '',
      giftName: fw.giftName || '',
      coins: fw.coins || 0,
      colors: fw.colors || ['#FFD700'],
      shape: fw.shape || '',
      text: fw.text || '',
      multiplier: fw.multiplier || 1,
      x: 15 + Math.round(Math.random() * 70),
      y: 12 + Math.round(Math.random() * 30),
      at: now,
    };
    session.recentFireworks.push(item);
    if (session.recentFireworks.length > 30) session.recentFireworks = session.recentFireworks.slice(-30);
    const lifetimeMs = (item.kind === 'shape' || item.kind === 'grand' || item.kind === 'finale' || item.kind === 'name') ? 6000 : 4000;
    session.activeFireworks.push({ id: item.id, launchedAt: now, lifetimeMs });
    session.totalFireworks += item.multiplier;
    if (fw.uid && session.players[fw.uid]) session.players[fw.uid].fireworks += item.multiplier;
    io.emit('firework', item);
    if (!o.skipMilestone) checkGrandShow();
    dirty = true;
    return item;
  }
  function checkGrandShow() {
    if (session.totalFireworks < session.nextGrandAt) return;
    const milestone = session.nextGrandAt;
    session.nextGrandAt += settings.grandEvery;
    const now = Date.now();
    if (now < session.finaleActiveUntil) {
      // Trùng màn đại countdown: ưu tiên countdown, màn 100 pháo dời 20s.
      session.pendingGrand = milestone;
      session.grandDelayedUntil = session.finaleActiveUntil + 20000;
      addLog(`🎆 Mốc ${milestone} pháo trùng màn đại countdown — màn lớn dời lại 20s.`, 'grand');
      return;
    }
    startGrandShow(milestone);
  }
  function startGrandShow(milestone) {
    const now = Date.now();
    session.grandShows += 1;
    session.grandShow = { milestone, endsAt: now + settings.grandShowS * 1000 };
    session.smallPausedUntil = now + settings.grandShowS * 1000;
    const top = topList(3);
    addLog(`🎆 MÀN PHÁO LỚN — ${milestone} PHÁO ĐÃ NỔ! Top 3: ${top.map((p, i) => `${i + 1}. ${p.name} ${p.points}đ`).join(' — ') || 'chưa có ai'}`, 'grand');
    io.emit('grand-show', { milestone, top });
    const colors = ['#FFD700', '#FF2D55', '#00BFFF', '#32CD32', '#BF5AF2', '#FF69B4', '#FFFFFF', '#FF8C00'];
    for (let i = 0; i < 12; i += 1) {
      launchFirework({ kind: 'grand', name: '', colors: [colors[i % colors.length], colors[(i + 3) % colors.length]] }, { skipMilestone: true });
    }
    dirty = true;
  }
  function queueSmall(fw) {
    if (session.smallQueue.length >= settings.smallQueueMax) {
      session.smallQueue.shift();
      session.stats.dropped += 1;
      addLog('🗑️ Hàng đợi pháo nhỏ đầy (20) — rớt trái cũ nhất (chỉ visual, điểm vẫn cộng đủ).', 'warn');
    }
    session.smallQueue.push(fw);
    dirty = true;
  }
  function processSmallQueue(now) {
    if (now < session.smallPausedUntil) return;
    session.activeFireworks = session.activeFireworks.filter((f) => now - f.launchedAt < f.lifetimeMs);
    if (!session.smallQueue.length) return;
    const recent = session.activeFireworks.filter((f) => now - f.launchedAt < 1000).length;
    let slots = Math.max(0, settings.maxPerSec - recent);
    if (slots <= 0) return;
    slots = Math.min(slots, Math.max(0, settings.maxConcurrent - session.activeFireworks.length));
    if (slots <= 0) return;
    if (session.smallQueue.length <= slots) {
      const n = Math.min(slots, session.smallQueue.length);
      for (let i = 0; i < n; i += 1) launchFirework(session.smallQueue.shift());
    } else {
      // Gộp: chia hàng đợi thành `slots` nhóm, mỗi nhóm thành 1 pháo (ghi xN).
      const total = session.smallQueue.length;
      let remaining = total;
      for (let g = 0; g < slots; g += 1) {
        const size = Math.ceil(remaining / (slots - g));
        const grp = session.smallQueue.splice(0, size);
        remaining -= size;
        if (grp.length === 1) launchFirework(grp[0]);
        else {
          launchFirework({ kind: 'merged', name: grp[0].name, uid: grp[0].uid, colors: grp[0].colors, multiplier: grp.length });
          session.stats.merged += grp.length - 1;
        }
      }
    }
  }

  function handleIntake(ev) {
    const { uid, name, avatar, kind, coins, giftName, giftId, text } = ev;
    if (kind === 'join') {
      if (!uid) return { ok: false };
      const isNew = !session.players[uid];
      const p = touchPlayer(ev);
      session.stats.joins += 1;
      // Join lần đầu: 0đ + 1 pháo chào mừng mang tên (vào muộn vẫn được chào).
      queueSmall({ kind: 'small', name, uid, colors: ['#FFD700'] });
      addLog(`👋 [${name}] vào bầu trời — pháo chào mừng mang tên ${name}!`, 'join');
      saveSession(); broadcast();
      return { ok: true, isNew };
    }
    if (kind === 'comment') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.comments += 1;
      const now = Date.now();
      if (now - (p.lastCommentAt || 0) < settings.commentCooldownS * 1000) {
        session.stats.commentsBlocked += 1;
        addLog(`⏳ [${name}] bình luận trong thời gian chống spam (${settings.commentCooldownS}s), không cộng điểm, không bắn pháo.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      p.lastCommentAt = now;
      p.points += settings.commentPoints;
      session.recentComments.push({ name, text: (text || '').slice(0, 80), at: now });
      if (session.recentComments.length > 5) session.recentComments = session.recentComments.slice(-5);
      queueSmall({ kind: 'small', name, uid, colors: ['#00BFFF'] });
      addLog(`💬 [${name}] bình luận +${settings.commentPoints}đ, 1 pháo nhỏ.`, 'comment');
      saveSession(); broadcast();
      return { ok: true, points: settings.commentPoints };
    }
    if (kind === 'tap') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      const total = ev.totalLikeCount ?? ev.likeCount ?? null;
      const d = total !== null ? tapDelta.delta(uid, total) : 1;
      if (d <= 0) { saveSession(); broadcast(); return { ok: false, reason: 'no-delta' }; }
      session.stats.taps += d;
      p.tapResidue += d;
      let fired = 0;
      while (p.tapResidue >= settings.tapPerPoint) {
        p.tapResidue -= settings.tapPerPoint;
        p.points += 1;
        fired += 1;
        queueSmall({ kind: 'small', name, uid, colors: ['#32CD32'] });
      }
      if (fired > 0) addLog(`❤️ [${name}] đủ ${settings.tapPerPoint} tap → +${fired}đ, ${fired} pháo nhỏ (dư ${p.tapResidue} tap).`, 'tap');
      saveSession(); broadcast();
      return { ok: true, taps: d, points: fired };
    }
    if (kind === 'share') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.shares += 1;
      const now = Date.now();
      if (now - (p.lastShareAt || 0) < settings.shareCooldownS * 1000) {
        session.stats.sharesBlocked += 1;
        addLog(`⏳ [${name}] share trong thời gian chống spam (30s), không cộng điểm.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      p.lastShareAt = now;
      p.points += settings.sharePoints;
      queueSmall({ kind: 'small', name, uid, colors: ['#FF69B4'] });
      addLog(`🔁 [${name}] chia sẻ live +${settings.sharePoints}đ, 1 pháo nhỏ.`, 'share');
      saveSession(); broadcast();
      return { ok: true, points: settings.sharePoints };
    }
    if (kind === 'follow') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.follows += 1;
      if (p.followed) {
        session.stats.followsBlocked += 1;
        addLog(`➕ [${name}] follow lại — đã tính 1 lần trong phiên này rồi.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'already-followed' };
      }
      p.followed = true;
      p.points += settings.followPoints;
      // Pháo chữ: tên người follow bay lên trời (không bao giờ bị gộp/rớt).
      launchFirework({ kind: 'name', name, uid, text: name.toUpperCase(), colors: ['#FFD700', '#FFFFFF'] });
      addLog(`➕ [${name}] theo dõi kênh +${settings.followPoints}đ — pháo chữ "${name.toUpperCase()}" bay lên trời!`, 'follow');
      io.emit('follow-name', { name: voiceName(name), rawName: name });
      saveSession(); broadcast();
      return { ok: true, points: settings.followPoints };
    }
    if (kind === 'gift') {
      if (!uid) { addLog('⚠️ Quà tặng thiếu ID người dùng, bỏ qua.', 'warn'); saveSession(); broadcast(); return { ok: false }; }
      trackAvatar(ev);
      const p = touchPlayer(ev);
      if (coins === null || isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        // Pháo vẫn nổ ở tầng nhỏ nhất (visual only), 0 điểm.
        launchFirework({ kind: 'small', name, uid, giftName, coins: 0, colors: ['#FFD700'] });
        addLog(`⚠️ [${name}] tặng "${giftName}" nhưng không rõ số xu (giftId: ${giftId || 'không có'}) — +0đ, pháo nhỏ visual only.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const pts = Math.max(1, Math.floor(coins * settings.giftPointsPerCoin));
      p.points += pts;
      const color = giftColorFor(giftName);
      if (coins < 10) {
        launchFirework({ kind: 'small', name, uid, giftName, coins, colors: color ? [color] : TIER_COLORS.small });
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → +${pts}đ, pháo tròn ${color || '#FFD700'}.`, 'gift');
      } else if (coins < 100) {
        launchFirework({ kind: 'cluster', name, uid, giftName, coins, colors: color ? [color, '#FFD700', '#FFFFFF'] : TIER_COLORS.cluster });
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → +${pts}đ, pháo chùm 3 vòng!`, 'gift');
        io.emit('highlight', { name, giftName, coins, points: pts });
      } else {
        const shape = settings.bigShape;
        launchFirework({ kind: 'shape', name, uid, giftName, coins, shape, text: shape === 'text' ? name.toUpperCase() : '', colors: color ? [color, '#FFD700', '#FF69B4'] : TIER_COLORS.shape });
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → +${pts}đ, PHÁO HÌNH ${shape === 'heart' ? 'trái tim ❤️' : shape === 'star' ? 'ngôi sao ⭐' : 'chữ tên'} + Epic!`, 'gift');
        io.emit('epic', { name: voiceName(name), rawName: name, giftName, coins, points: pts, shape });
      }
      saveSession(); broadcast();
      return { ok: true, coins, points: pts };
    }
    addLog(`👁️ [${name}] ${kind} — chỉ log.`, 'info');
    saveSession(); broadcast();
    return { ok: false };
  }

  function tick() {
    const now = Date.now();
    let changed = false;
    const idleMs = settings.inactivityCleanupMin * 60 * 1000;
    for (const p of Object.values(session.players)) {
      if (p.online && now - p.lastActiveAt > idleMs) { p.online = false; changed = true; }
    }
    // Màn lớn hết hạn.
    if (session.grandShow && now >= session.grandShow.endsAt) {
      session.grandShow = null;
      changed = true;
    }
    // Màn lớn bị dời vì trùng countdown: tới lúc thì bắn.
    if (session.pendingGrand && now >= session.grandDelayedUntil) {
      const m = session.pendingGrand;
      session.pendingGrand = 0;
      session.grandDelayedUntil = 0;
      startGrandShow(m);
      changed = true;
    }
    // Countdown.
    const cd = session.countdown;
    if (cd && cd.active) {
      const left = Math.ceil((cd.targetAt - now) / 1000);
      if (left <= 60 && left > 0) {
        if (!cd.announced30 && left <= 30) { cd.announced30 = true; io.emit('countdown-voice', { text: 'Còn 30 giây!' }); changed = true; }
        if (!cd.announced10 && left <= 10) { cd.announced10 = true; io.emit('countdown-voice', { text: 'Còn 10 giây!' }); changed = true; }
        if (now - (session.lastCountdownFireworkAt || 0) >= 10000) {
          session.lastCountdownFireworkAt = now;
          launchFirework({ kind: 'small', name: 'Đếm ngược', colors: ['#FFD700'] });
          changed = true;
        }
      }
      if (now >= cd.targetAt) {
        cd.active = false;
        session.finaleCount += 1;
        session.lastFinaleAt = now;
        session.finaleActiveUntil = now + settings.finaleS * 1000;
        const colors = ['#FFD700', '#FF2D55', '#00BFFF', '#32CD32', '#BF5AF2', '#FF69B4', '#FFFFFF', '#FF8C00'];
        for (let i = 0; i < 20; i += 1) {
          launchFirework({ kind: 'finale', name: '', colors: [colors[i % colors.length], colors[(i + 4) % colors.length]] });
        }
        launchFirework({ kind: 'name', name: '', text: cd.message, colors: ['#FFD700', '#FFFFFF'] });
        addLog(`🎆 TỚI GIỜ G — MÀN PHÁO ĐẠI 15s: "${cd.message}"`, 'finale');
        io.emit('finale', { message: cd.message });
        changed = true;
      }
    }
    processSmallQueue(now);
    if (changed || dirty) { saveSession(); broadcast(); }
  }
  timers.setInterval(tick, 500);

  function statePayload() {
    const cd = session.countdown;
    return {
      proto: 1,
      game: 'bau-troi-phao-hoa',
      totalFireworks: session.totalFireworks,
      grandShows: session.grandShows,
      nextGrandAt: session.nextGrandAt,
      fireworksToGrand: Math.max(0, session.nextGrandAt - session.totalFireworks),
      grandShow: session.grandShow,
      pendingGrand: session.pendingGrand,
      countdown: cd ? { active: !!cd.active, targetAt: cd.targetAt, message: cd.message, secondsLeft: Math.max(0, Math.ceil((cd.targetAt - Date.now()) / 1000)) } : null,
      finaleCount: session.finaleCount,
      finaleActiveUntil: session.finaleActiveUntil,
      top: topList(3),
      top10: topList(10),
      recentFireworks: session.recentFireworks.slice(-12),
      recentComments: session.recentComments.slice(-5),
      viewersOnline: Object.values(session.players).filter((p) => p.online).length,
      smallQueueLength: session.smallQueue.length,
      activeFireworks: session.activeFireworks.length,
      settings,
      logs: session.logs.slice(-60),
      webhookCount: session.webhookCount,
      demoActive: demo.active,
      avatarStats: session.avatarStats,
      avatarWarning: session.avatarStats.total > 0 && session.avatarStats.withAvatar === 0,
      stats: session.stats,
    };
  }
  function broadcast() { io.emit('state-update', statePayload()); }

  // ---------------- API ----------------
  app.post('/api/webhook', (req, res) => {
    session.webhookCount = (session.webhookCount || 0) + 1;
    // Live thật tiếp quản: demo đang chạy thì tự dừng ngay khi event thật đầu tiên tới,
    // đồng thời TẮT HẲN "Chế độ thử" — nếu chỉ dừng demo mà giữ demoMode=true
    // thì mọi event thật sau đó đều bị bỏ qua im lặng (webhook trả demoMode:true).
    if (demo.active) {
      stopDemo('có event thật');
      settings.demoMode = false;
      saveSettings();
    }
    const ev = parseTikFinityEvent(req.body, req.query);
    if (ev.kind === 'other' || !ev.uid) {
      let rawPrev = '';
      try { rawPrev = (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)).slice(0, 300); }
      catch (e) { rawPrev = String(req.body).slice(0, 300); }
      addLog(`🔍 Webhook chưa nhận diện (loại=${ev.kind}): ${rawPrev || '(body trống)'}.`, 'warn');
    }
    if (settings.demoMode) {
      addLog(`🧪 Chế độ thử: bỏ qua sự kiện thật (${ev.kind}) từ [${ev.name}].`, 'info');
      saveSession(); broadcast();
      return res.json({ received: true, demoMode: true });
    }
    const r = handleIntake(ev);
    res.json({ received: true, kind: ev.kind, ok: !!r.ok, taps: r.taps, points: r.points, coins: r.coins, reason: r.reason });
  });

  app.get('/api/state', (req, res) => res.json(statePayload()));

  app.post('/api/settings', (req, res) => {
    const b = req.body || {};
    const num = (k, min, max, dflt) => {
      if (b[k] !== undefined) {
        const n = Number(b[k]);
        settings[k] = Math.min(max, Math.max(min, Number.isFinite(n) ? n : dflt));
      }
    };
    num('tapPerPoint', 1, 1000, 20);
    num('commentPoints', 0, 100, 1);
    num('sharePoints', 0, 100, 1);
    num('followPoints', 0, 100, 5);
    num('giftPointsPerCoin', 1, 100, 10);
    num('commentCooldownS', 1, 60, 5);
    num('shareCooldownS', 1, 300, 30);
    num('maxPerSec', 1, 20, 8);
    num('smallQueueMax', 1, 100, 20);
    num('maxConcurrent', 1, 50, 12);
    num('grandEvery', 1, 10000, 100);
    if (b.grandEvery !== undefined) {
      // Đổi khoảng mốc -> tính lại mốc tiếp theo từ tổng pháo hiện tại.
      session.nextGrandAt = Math.floor(session.totalFireworks / settings.grandEvery) * settings.grandEvery + settings.grandEvery;
    }
    num('grandShowS', 1, 60, 10);
    num('finaleS', 1, 60, 15);
    num('inactivityCleanupMin', 1, 120, 10);
    if (b.bigShape !== undefined && ['heart', 'star', 'text'].includes(b.bigShape)) settings.bigShape = b.bigShape;
    if (b.giftColors !== undefined && typeof b.giftColors === 'object') {
      const gc = {};
      for (const [k, v] of Object.entries(b.giftColors)) {
        const key = normVi(k);
        if (key && typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) gc[key] = v;
      }
      if (Object.keys(gc).length) settings.giftColors = gc;
    }
    if (b.countdownMessage !== undefined) settings.countdownMessage = String(b.countdownMessage).slice(0, 80);
    if (b.bannedWords !== undefined) {
      settings.bannedWords = String(b.bannedWords).split(',').map((w) => w.trim()).filter(Boolean).slice(0, 50);
    }
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    addLog('⚙️ Đã lưu cài đặt bầu trời pháo hoa.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, settings });
  });

  app.post('/api/session/reset', (req, res) => {
    stopDemo();
    session = defaultSession();
    tapDelta.reset();
    addLog('🔄 Đã làm mới phiên: điểm + pháo + lịch sử về trống.', 'system');
    saveSession(); broadcast();
    io.emit('session-reset');
    res.json({ success: true });
  });
  app.post('/api/grand-show/now', (req, res) => {
    startGrandShow(session.totalFireworks);
    res.json({ success: true, milestone: session.totalFireworks });
  });
  app.post('/api/countdown', (req, res) => {
    const targetAt = Number((req.body && req.body.targetAt) || 0);
    const message = String((req.body && req.body.message) || settings.countdownMessage).slice(0, 80);
    if (!targetAt || targetAt <= Date.now()) return res.status(400).json({ success: false, message: 'Giờ G phải ở tương lai.' });
    session.countdown = { targetAt, message, active: true, announced30: false, announced10: false };
    session.lastCountdownFireworkAt = 0;
    addLog(`⏰ Countdown BẬT — giờ G ${new Date(targetAt).toLocaleString('vi-VN')}, thông điệp: "${message}".`, 'system');
    saveSession(); broadcast();
    res.json({ success: true, countdown: session.countdown });
  });
  app.post('/api/countdown/test', (req, res) => {
    const seconds = Math.max(1, Math.floor(Number((req.body && req.body.seconds) || 10)));
    session.countdown = { targetAt: Date.now() + seconds * 1000, message: settings.countdownMessage, active: true, announced30: false, announced10: false };
    session.lastCountdownFireworkAt = 0;
    addLog(`⏰ Countdown TEST ${seconds}s — tới giờ G sẽ bắn màn đại.`, 'system');
    saveSession(); broadcast();
    res.json({ success: true, countdown: session.countdown });
  });
  app.post('/api/countdown/cancel', (req, res) => {
    session.countdown = null;
    addLog('⏰ Countdown đã hủy.', 'system');
    saveSession(); broadcast();
    res.json({ success: true });
  });

  function needDemo(req, res) {
    if (!settings.demoMode) {
      res.status(400).json({ success: false, message: 'Bật chế độ thử trước khi thử.' });
      return false;
    }
    return true;
  }
  const testUid = (p) => `test_${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  function addTapsForTest(uid, name, count) {
    const p = touchPlayer({ uid, name, avatar: '' });
    session.stats.taps += count;
    p.tapResidue += count;
    let fired = 0;
    while (p.tapResidue >= settings.tapPerPoint) {
      p.tapResidue -= settings.tapPerPoint;
      p.points += 1;
      fired += 1;
      queueSmall({ kind: 'small', name, uid, colors: ['#32CD32'] });
    }
    return fired;
  }
  app.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Vào';
    handleIntake({ uid: testUid('join'), name: n, avatar: '', kind: 'join' });
    res.json({ success: true });
  });
  app.post('/api/test/comment', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Bình Luận';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('cmt');
    const t = (req.body && req.body.text) || 'Đẹp quá!';
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'comment', text: t });
    res.json({ success: true, ok: !!r.ok, points: r.points });
  });
  app.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Thả Tim';
    const count = Math.max(1, Math.floor(Number((req.body && req.body.count) || 20)));
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('tap');
    const fired = addTapsForTest(uid, n, count);
    saveSession(); broadcast();
    res.json({ success: true, count, points: fired });
  });
  app.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Quà';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('gift');
    const coins = (req.body && req.body.coins !== undefined) ? Number(req.body.coins) : 10;
    const giftName = String((req.body && req.body.giftName) || 'Quà tặng thử').slice(0, 60);
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'gift', coins: isNaN(coins) ? null : coins, giftName, giftId: 'test' });
    res.json({ success: true, ok: !!r.ok, coins, points: r.points });
  });
  app.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Theo Dõi';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('flw');
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'follow' });
    res.json({ success: true, ok: !!r.ok, points: r.points });
  });
  app.post('/api/test/share', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Chia Sẻ';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('shr');
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'share' });
    res.json({ success: true, ok: !!r.ok, points: r.points });
  });
  app.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const count = Math.min(200, Math.max(1, Math.floor(Number((req.body && req.body.count) || 100))));
    for (let i = 1; i <= count; i += 1) {
      handleIntake({ uid: testUid(`bulk${i}`), name: `Khách ${i}`, avatar: '', kind: 'join' });
    }
    res.json({ success: true, count, viewersOnline: Object.values(session.players).filter((p) => p.online).length });
  });
  app.post('/api/test/set-total', (req, res) => {
    if (!needDemo(req, res)) return;
    const total = Math.max(0, Math.floor(Number((req.body && req.body.total) || 0)));
    session.totalFireworks = total;
    session.nextGrandAt = Math.floor(total / settings.grandEvery) * settings.grandEvery + settings.grandEvery;
    addLog(`🧪 [DEMO] Đặt tổng pháo = ${total} (chỉ có trong chế độ thử — live thật không có nút này).`, 'warn');
    saveSession(); broadcast();
    res.json({ success: true, totalFireworks: session.totalFireworks, nextGrandAt: session.nextGrandAt });
  });
  // ---------------- Demo tự động (xem ~/workspace/overlay-moi/demo-mode-contract.md) ----------------
  const DEMO_CAST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Lan', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_COMMENTS = ['đẹp quá', 'pháo đẹp quá', 'bắn nữa đi', 'tuyệt vời', 'lung linh quá'];
  const DEMO_GIFTS = [[1, 'Hoa hồng'], [5, 'Hoa hồng'], [10, 'Kính râm'], [50, 'Heo may mắn'], [100, 'Vương miện'], [500, 'Du thuyền']];
  const demo = { active: false, timer: null, cast: new Map(), runId: 0 };
  function demoEnsureCast(n) {
    let added = 0;
    for (let i = 0; i < DEMO_CAST_NAMES.length && demo.cast.size < n; i += 1) {
      const name = DEMO_CAST_NAMES[i];
      const uid = `demo_${demo.runId}_${i}`;
      if (demo.cast.has(uid)) continue;
      const m = { uid, name, likeTotal: 0 };
      demo.cast.set(uid, m);
      handleIntake({ uid, name, avatar: '', kind: 'join', isDemo: true });
      // 2 lần tap: lần 1 làm mốc delta, lần 2 +20 tim -> +1đ, 1 pháo nhỏ.
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 1, isDemo: true });
      m.likeTotal = 21;
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 21, isDemo: true });
      handleIntake({ uid, name, avatar: '', kind: 'comment', text: 'đẹp quá', isDemo: true });
      added += 1;
    }
    return added;
  }
  function demoStep() {
    if (!demo.active) return;
    if (demo.cast.size < 8 && Math.random() < 0.12) { demoEnsureCast(demo.cast.size + 1); return; }
    const members = [...demo.cast.values()];
    if (!members.length) { demoEnsureCast(3); return; }
    const m = members[Math.floor(Math.random() * members.length)];
    const roll = Math.random();
    if (roll < 0.30) {
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'comment', text: DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)], isDemo: true });
    } else if (roll < 0.60) {
      m.likeTotal += 20 + Math.floor(Math.random() * 21); // +20..40 tim
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'tap', totalLikeCount: m.likeTotal, isDemo: true });
    } else if (roll < 0.85) {
      const [coins, giftName] = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'gift', coins, giftName, giftId: 'demo', isDemo: true });
    } else if (roll < 0.93) {
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'follow', isDemo: true });
    } else {
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'share', isDemo: true });
    }
  }
  function startDemo() {
    if (!settings.demoMode) return { success: false, message: 'Bật chế độ thử trước khi thử.' };
    if ((session.webhookCount || 0) > 0) return { success: false, message: 'Phòng đang có event thật — không bật được demo.' };
    if (demo.active) return { success: true, demoActive: true };
    demo.runId += 1;
    demo.cast.clear();
    demo.active = true;
    demoEnsureCast(3);
    demo.timer = timers.setInterval(demoStep, 2500);
    addLog('🧪 Demo tự động BẬT — đang mô phỏng khán giả (tự dừng khi có event thật).', 'system');
    saveSession(); broadcast();
    return { success: true, demoActive: true };
  }
  function stopDemo(reason) {
    if (!demo.active) return { success: true, demoActive: false };
    demo.active = false;
    if (demo.timer !== null) { timers.clearInterval(demo.timer); demo.timer = null; }
    addLog(`🧪 Demo tự động TẮT${reason ? ` (${reason})` : ''}.`, 'system');
    saveSession(); broadcast();
    return { success: true, demoActive: false };
  }
  function demoOnce() {
    const steps = [];
    const an = testUid('demo-an');
    const binh = testUid('demo-binh');
    const chi = testUid('demo-chi');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'join' });
    steps.push('1. An join -> 0đ, pháo chào mừng mang tên An');
    addTapsForTest(an, 'An', 20);
    steps.push('2. An tap x20 -> +1đ, 1 pháo nhỏ');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'join' });
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'gift', coins: 1, giftName: 'Hoa hồng', giftId: 'demo' });
    steps.push('3. Bình join + gift 1 xu (Hoa hồng) -> Bình 10đ, pháo tròn đỏ');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'join' });
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'comment', text: 'đẹp quá' });
    steps.push('4. Chi join + comment "đẹp quá" -> Chi 1đ, 1 pháo nhỏ + bong bóng');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'gift', coins: 10, giftName: 'Kính râm', giftId: 'demo' });
    steps.push('5. Chi gift 10 xu -> Chi +100đ, pháo chùm 3 vòng');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'follow' });
    steps.push('6. An follow -> An +5đ, pháo chữ "AN" bay lên trời');
    session.totalFireworks = 99;
    session.nextGrandAt = 100;
    addLog('🧪 [DEMO] Đặt tổng pháo = 99 (chỉ có trong chế độ thử).', 'warn');
    steps.push('7. [TEST] Đặt tổng pháo = 99 -> "Còn 1 pháo tới màn lớn"');
    addTapsForTest(binh, 'Bình', 20);
    steps.push('8. Bình tap x20 -> +1đ, tổng pháo = 100 -> MÀN LỚN 10s + top 3');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'gift', coins: 100, giftName: 'Vương miện', giftId: 'demo' });
    steps.push('9. Chi gift 100 xu -> Chi +1000đ, pháo hình trái tim + Epic');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'share' });
    steps.push('10. An share -> An +1đ, 1 pháo nhỏ');
    session.countdown = { targetAt: Date.now() + 10000, message: settings.countdownMessage, active: true, announced30: false, announced10: false };
    session.lastCountdownFireworkAt = 0;
    steps.push('11. Đặt countdown test 10s -> đếm 10...0 -> MÀN ĐẠI 15s + chữ chúc mừng');
    steps.push('12. Demo xong -> nút "Xóa demo / Làm mới phiên"');
    saveSession(); broadcast();
    return { success: true, steps };
  }
  app.post('/api/test/demo', (req, res) => {
    if (!needDemo(req, res)) return;
    const action = (req.body && req.body.action) || 'once';
    if (action === 'start') return res.json(startDemo());
    if (action === 'stop') return res.json(stopDemo());
    const r = demoOnce();
    return res.json({ success: true, steps: r.steps, demoActive: demo.active });
  });

  io.on('connection', (socket) => {
    socket.emit('state-update', statePayload());
  });

  return {
    type: 'express',
    router: app,
    io,
    destroy() { timers.clearAll(); },
  };
}

module.exports = createEngine;
