// BẾP ĂN TẬP THỂ – NẤU CỖ — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-bep-an-tap-the.md
// (KHỐI 2–6): bình luận thả nguyên liệu (thịt +3 / rau +2 / gia vị +1,
// lửa to +1); 50 tim thổi lửa (nồi +5, lửa to 30s); quà 1 xu = 10 điểm
// mở món đặc biệt (gà 100 / bánh chưng 300 / giò 500 / mâm 1000 xu);
// nồi 300 điểm = chín → dọn cỗ 15s → bốc thăm 10 người → nồi mới.
// Khác bản thiết kế: KHÔNG chạy server local cổng 3011; quà tra số xu thật
// trong payload (không có bảng quà hardcode — payload chính là bảng).
// Tap có 2 bộ đếm độc lập theo bản thiết kế: cứ 20 tap = +1 điểm cá nhân,
// cứ 50 tap = 1 lần thổi lửa (nồi +5, người thổi +1).
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

  // Từ khóa nguyên liệu (đã bỏ dấu) — khớp từ khóa DÀI NHẤT trước, ưu tiên
  // thịt → rau → gia vị. Khớp theo ranh giới từ để "cam ơn" không thành "cá".
  const KEYWORDS = [
    { kw: 'thit bo', cat: 'thit' }, { kw: 'thit ga', cat: 'thit' }, { kw: 'thit lon', cat: 'thit' },
    { kw: 'thit heo', cat: 'thit' }, { kw: 'thit vit', cat: 'thit' }, { kw: 'thit cho', cat: 'thit' },
    { kw: 'thit', cat: 'thit' }, { kw: 'ga', cat: 'thit' }, { kw: 'lon', cat: 'thit' },
    { kw: 'heo', cat: 'thit' }, { kw: 'bo', cat: 'thit' }, { kw: 'vit', cat: 'thit' },
    { kw: 'ngan', cat: 'thit' }, { kw: 'ca', cat: 'thit' }, { kw: 'tom', cat: 'thit' },
    { kw: 'cua', cat: 'thit' }, { kw: 'muc', cat: 'thit' }, { kw: 'oc', cat: 'thit' },
    { kw: 'trung', cat: 'thit' }, { kw: 'xuong', cat: 'thit' }, { kw: 'suon', cat: 'thit' },
    { kw: 'cha', cat: 'thit' }, { kw: 'gio', cat: 'thit' }, { kw: 'nem', cat: 'thit' },
    { kw: 'de', cat: 'thit' },
    { kw: 'bap cai', cat: 'rau' }, { kw: 'ca chua', cat: 'rau' }, { kw: 'hanh la', cat: 'rau' },
    { kw: 'gia do', cat: 'rau' }, { kw: 'rau thom', cat: 'rau' }, { kw: 'xa lach', cat: 'rau' },
    { kw: 'rau muong', cat: 'rau' }, { kw: 'cu cai', cat: 'rau' }, { kw: 'ot chuong', cat: 'rau' },
    { kw: 'ca rot', cat: 'rau' }, { kw: 'rau', cat: 'rau' }, { kw: 'cai', cat: 'rau' },
    { kw: 'ngo', cat: 'rau' }, { kw: 'dua', cat: 'rau' }, { kw: 'bi', cat: 'rau' },
    { kw: 'muop', cat: 'rau' }, { kw: 'khoai', cat: 'rau' }, { kw: 'nam', cat: 'rau' },
    { kw: 'nuoc mam', cat: 'giavi' }, { kw: 'hanh kho', cat: 'giavi' }, { kw: 'bot ngot', cat: 'giavi' },
    { kw: 'dau an', cat: 'giavi' }, { kw: 'la chanh', cat: 'giavi' },
    { kw: 'muoi', cat: 'giavi' }, { kw: 'duong', cat: 'giavi' }, { kw: 'ot', cat: 'giavi' },
    { kw: 'tieu', cat: 'giavi' }, { kw: 'mam', cat: 'giavi' }, { kw: 'gung', cat: 'giavi' },
    { kw: 'toi', cat: 'giavi' }, { kw: 'mo', cat: 'giavi' }, { kw: 'tuong', cat: 'giavi' },
    { kw: 'giam', cat: 'giavi' }, { kw: 'nghe', cat: 'giavi' }, { kw: 'sa', cat: 'giavi' },
    { kw: 'que', cat: 'giavi' }, { kw: 'hoi', cat: 'giavi' },
  ];
  const CAT_ORDER = { thit: 0, rau: 1, giavi: 2 };
  const CAT_POINTS = { thit: 3, rau: 2, giavi: 1 };
  const CAT_ICON = { thit: '🥩', rau: '🥬', giavi: '🧂' };
  const CAT_NAME = { thit: 'Thịt', rau: 'Rau', giavi: 'Gia vị' };
  const SORTED_KEYWORDS = [...KEYWORDS].sort((a, b) =>
    b.kw.length - a.kw.length || CAT_ORDER[a.cat] - CAT_ORDER[b.cat]);
  function classifyIngredient(text) {
    const t = normVi(text);
    if (!t) return { cat: 'giavi', name: 'Gia vị chung', points: 1 };
    const padded = ` ${t} `;
    for (const { kw, cat } of SORTED_KEYWORDS) {
      if (kw.includes(' ')) {
        if (padded.includes(` ${kw} `)) return { cat, name: CAT_NAME[cat], points: CAT_POINTS[cat] };
      } else if (padded.includes(` ${kw} `)) {
        return { cat, name: CAT_NAME[cat], points: CAT_POINTS[cat] };
      }
    }
    return { cat: 'giavi', name: 'Gia vị chung', points: 1 };
  }

  const defaultSettings = {
    potTarget: 300,
    tapPerBlow: 50,
    blowPotPoints: 5,
    tapPersonalPer: 20,
    fireBigS: 30,
    fireBigBonus: 1,
    commentSpamS: 5,
    giftPointPerCoin: 10,
    dishMilestones: [
      { coins: 100, name: 'Gà luộc', icon: '🍗' },
      { coins: 300, name: 'Bánh chưng', icon: '🍙' },
      { coins: 500, name: 'Giò chả', icon: '🍖' },
      { coins: 1000, name: 'Mâm cỗ đầy đủ', icon: '🎉' },
    ],
    serveS: 15,
    resultsS: 10,
    winnersCount: 10,
    followPoints: 10,
    sharePoints: 5,
    inactivityCleanupMin: 10,
    demoMode: true,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  if (!Array.isArray(settings.dishMilestones) || !settings.dishMilestones.length) {
    settings.dishMilestones = defaultSettings.dishMilestones;
  }
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      potNo: 1,
      phase: 'cooking', // cooking | serving | results
      phaseEndsAt: 0,
      pot: { points: 0, counts: { thit: 0, rau: 0, giavi: 0 }, giftCoins: 0, dishesUnlocked: [] },
      players: {}, // uid -> {name, avatar, points, tapResidue20, tapResidue50, lastCommentAt, online, lastActiveAt}
      fireBigUntil: 0,
      winners: [],
      history: [], // {potNo, winners, at}
      stats: { comments: 0, commentsBlocked: 0, taps: 0, blows: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, joins: 0 },
      logs: [],
      webhookCount: 0,
      avatarStats: { total: 0, withAvatar: 0 },
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (session.phase !== 'cooking') { session.phase = 'cooking'; session.phaseEndsAt = 0; }
  if (!session.pot || typeof session.pot !== 'object') session.pot = defaultSession().pot;
  if (!session.players || typeof session.players !== 'object') session.players = {};
  if (!session.stats) session.stats = defaultSession().stats;
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  let dirty = false;
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
      name: ev.name, avatar: ev.avatar || '', points: 0,
      tapResidue20: 0, tapResidue50: 0, lastCommentAt: 0,
      online: true, lastActiveAt: Date.now(),
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
  function fireLevel() {
    return Date.now() < session.fireBigUntil ? 3 : 2;
  }
  function topList() {
    return Object.entries(session.players)
      .map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '', points: p.points, online: p.online }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  }
  function nextDish() {
    const unlocked = session.pot.dishesUnlocked.length;
    return settings.dishMilestones[unlocked] || null;
  }
  function checkDishes() {
    let opened = false;
    let nd = nextDish();
    while (nd && session.pot.giftCoins >= nd.coins) {
      session.pot.dishesUnlocked.push(nd);
      addLog(`🎉 Món đặc biệt đã mở: ${nd.icon} ${nd.name} (đủ ${nd.coins} xu quà)!`, 'dish');
      io.emit('dish', { dish: nd });
      opened = true;
      nd = nextDish();
    }
    return opened;
  }
  function checkPotDone() {
    if (session.phase === 'cooking' && session.pot.points >= settings.potTarget) {
      session.phase = 'serving';
      session.phaseEndsAt = Date.now() + settings.serveS * 1000;
      addLog(`🎉 CỖ ĐÃ CHÍN — dọn cỗ ${settings.serveS}s rồi bốc thăm!`, 'serving');
      io.emit('serving', { potNo: session.potNo });
      return true;
    }
    return false;
  }
  function addTaps(uid, name, count) {
    const p = session.players[uid];
    if (!p || count <= 0) return;
    session.stats.taps += count;
    // Bộ đếm 20 tap: +1 điểm cá nhân.
    p.tapResidue20 += count;
    while (p.tapResidue20 >= settings.tapPersonalPer) {
      p.tapResidue20 -= settings.tapPersonalPer;
      p.points += 1;
    }
    // Bộ đếm 50 tap: thổi lửa (chỉ khi đang nấu).
    p.tapResidue50 += count;
    while (p.tapResidue50 >= settings.tapPerBlow) {
      p.tapResidue50 -= settings.tapPerBlow;
      session.stats.blows += 1;
      p.points += 1;
      session.fireBigUntil = Date.now() + settings.fireBigS * 1000;
      if (session.phase === 'cooking') {
        session.pot.points += settings.blowPotPoints;
        addLog(`🔥 [${name}] thổi lửa! Nồi +${settings.blowPotPoints} điểm, lửa to ${settings.fireBigS}s.`, 'fire');
        checkPotDone();
      } else {
        addLog(`🔥 [${name}] thổi lửa (nồi đang dọn/kết quả nên chỉ +1 điểm cá nhân).`, 'fire');
      }
    }
    dirty = true;
  }

  function handleIntake(ev) {
    const { uid, name, avatar, kind, coins, giftName, giftId, text } = ev;
    if (kind === 'join') {
      if (!uid) return { ok: false };
      touchPlayer(ev);
      session.stats.joins += 1;
      addLog(`👋 [${name}] vào bếp.`, 'join');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.comments += 1;
      const now = Date.now();
      if (now - (p.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        addLog(`⏳ [${name}] bình luận trong thời gian chống spam (${settings.commentSpamS}s), không thả nguyên liệu.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      p.lastCommentAt = now;
      const ing = classifyIngredient(text);
      let pts = ing.points;
      if (fireLevel() === 3) pts += settings.fireBigBonus;
      p.points += pts;
      if (session.phase === 'cooking') {
        session.pot.points += pts;
        session.pot.counts[ing.cat] += 1;
        addLog(`🥘 [${name}] thả ${CAT_ICON[ing.cat]} ${ing.name} +${pts} điểm nấu (${session.pot.points}/${settings.potTarget}).`, 'ingredient');
        checkPotDone();
      } else {
        addLog(`🥘 [${name}] thả ${CAT_ICON[ing.cat]} ${ing.name} +${pts} điểm cá nhân (nồi đang dọn/kết quả, không cộng điểm nồi).`, 'ingredient');
      }
      io.emit('ingredient', { name, cat: ing.cat, points: pts });
      saveSession(); broadcast();
      return { ok: true, cat: ing.cat, points: pts };
    }
    if (kind === 'tap') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchPlayer(ev);
      const total = ev.totalLikeCount ?? ev.likeCount ?? null;
      const d = total !== null ? tapDelta.delta(uid, total) : 1;
      if (d <= 0) { saveSession(); broadcast(); return { ok: false, reason: 'no-delta' }; }
      addTaps(uid, name, d);
      saveSession(); broadcast();
      return { ok: true, taps: d };
    }
    if (kind === 'share') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.shares += 1;
      p.points += settings.sharePoints;
      addLog(`🔁 [${name}] chia sẻ live (+${settings.sharePoints}đ cá nhân).`, 'share');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'follow') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.follows += 1;
      p.points += settings.followPoints;
      addLog(`➕ [${name}] theo dõi kênh (+${settings.followPoints}đ cá nhân).`, 'follow');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'gift') {
      if (!uid) { addLog('⚠️ Quà tặng thiếu ID người dùng, bỏ qua.', 'warn'); saveSession(); broadcast(); return { ok: false }; }
      trackAvatar(ev);
      const p = touchPlayer(ev);
      if (coins === null || isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        addLog(`⚠️ [${name}] tặng "${giftName}" nhưng không rõ số xu (giftId: ${giftId || 'không có'}) — chỉ log, không cộng điểm.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const pts = Math.max(1, Math.floor(coins * settings.giftPointPerCoin));
      p.points += pts;
      if (session.phase === 'cooking') {
        session.pot.points += pts;
        session.pot.giftCoins += coins;
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → +${pts} điểm nấu (${session.pot.points}/${settings.potTarget}), quà tích lũy ${session.pot.giftCoins} xu.`, 'gift');
        checkDishes();
        checkPotDone();
      } else {
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → +${pts} điểm cá nhân (nồi đang dọn/kết quả).`, 'gift');
      }
      saveSession(); broadcast();
      return { ok: true, coins, points: pts };
    }
    addLog(`👁️ [${name}] ${kind} — chỉ log.`, 'info');
    saveSession(); broadcast();
    return { ok: false };
  }

  function drawWinners() {
    const online = Object.entries(session.players)
      .filter(([, p]) => p.online)
      .map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '', points: p.points }));
    // Xáo trộn Fisher-Yates rồi lấy N người đầu.
    for (let i = online.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [online[i], online[j]] = [online[j], online[i]];
    }
    const winners = online.slice(0, settings.winnersCount);
    session.winners = winners;
    session.history.push({ potNo: session.potNo, winners: winners.map((w) => w.name), at: Date.now() });
    if (session.history.length > 20) session.history = session.history.slice(-20);
    addLog(`🎁 Bốc thăm nồi #${session.potNo}: ${winners.map((w) => w.name).join(', ') || 'không có ai trong phòng'}`, 'draw');
    io.emit('draw', { potNo: session.potNo, winners });
    return winners;
  }
  function newPot() {
    session.pot = { points: 0, counts: { thit: 0, rau: 0, giavi: 0 }, giftCoins: 0, dishesUnlocked: [] };
    session.fireBigUntil = 0;
    session.winners = [];
    session.phase = 'cooking';
    session.phaseEndsAt = 0;
    session.potNo += 1;
    addLog(`🍲 Nồi mới #${session.potNo} bắt đầu — bếp đã sôi sẵn!`, 'system');
    saveSession();
    io.emit('new-pot', { potNo: session.potNo });
    broadcast();
  }

  function tick() {
    const now = Date.now();
    let changed = false;
    const idleMs = settings.inactivityCleanupMin * 60 * 1000;
    for (const p of Object.values(session.players)) {
      if (p.online && now - p.lastActiveAt > idleMs) { p.online = false; changed = true; }
    }
    if (session.phase === 'serving' && now >= session.phaseEndsAt) {
      drawWinners();
      session.phase = 'results';
      session.phaseEndsAt = now + settings.resultsS * 1000;
      changed = true;
    } else if (session.phase === 'results' && now >= session.phaseEndsAt) {
      newPot();
      return;
    }
    if (changed || dirty) { saveSession(); broadcast(); }
  }
  timers.setInterval(tick, 1000);

  function statePayload() {
    return {
      proto: 1,
      game: 'bep-an-tap-the',
      potNo: session.potNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      pot: session.pot,
      potTarget: settings.potTarget,
      fireLevel: fireLevel(),
      fireBigUntil: session.fireBigUntil,
      nextDish: nextDish(),
      top: topList(),
      winners: session.winners,
      history: session.history.slice(-5),
      viewersOnline: Object.values(session.players).filter((p) => p.online).length,
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
    // Live thật tiếp quản: demo đang chạy thì tự dừng ngay khi event thật đầu tiên tới.
    if (demo.active) stopDemo('có event thật');
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
    res.json({ received: true, kind: ev.kind, ok: !!r.ok, taps: r.taps, cat: r.cat, points: r.points, coins: r.coins, reason: r.reason });
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
    num('potTarget', 1, 10000, 300);
    num('tapPerBlow', 1, 1000, 50);
    num('blowPotPoints', 0, 100, 5);
    num('tapPersonalPer', 1, 1000, 20);
    num('fireBigS', 1, 300, 30);
    num('fireBigBonus', 0, 10, 1);
    num('commentSpamS', 1, 60, 5);
    num('giftPointPerCoin', 1, 100, 10);
    num('serveS', 1, 120, 15);
    num('resultsS', 1, 120, 10);
    num('winnersCount', 1, 50, 10);
    num('followPoints', 0, 100, 10);
    num('sharePoints', 0, 100, 5);
    num('inactivityCleanupMin', 1, 120, 10);
    if (b.dishMilestones !== undefined && Array.isArray(b.dishMilestones)) {
      const ms = b.dishMilestones
        .map((m) => ({ coins: Math.max(1, Math.floor(Number(m.coins) || 0)), name: String(m.name || '').slice(0, 30), icon: String(m.icon || '🍽️').slice(0, 4) }))
        .filter((m) => m.coins > 0 && m.name)
        .sort((a, b2) => a.coins - b2.coins);
      if (ms.length) settings.dishMilestones = ms;
    }
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    addLog('⚙️ Đã lưu cài đặt bếp ăn.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, settings });
  });

  app.post('/api/session/reset', (req, res) => {
    stopDemo();
    session = defaultSession();
    tapDelta.reset();
    addLog('🔄 Đã làm mới phiên: nồi + điểm + log về trống.', 'system');
    saveSession(); broadcast();
    io.emit('session-reset');
    res.json({ success: true });
  });
  app.post('/api/pot/reset', (req, res) => {
    newPot();
    res.json({ success: true, potNo: session.potNo });
  });

  function needDemo(req, res) {
    if (!settings.demoMode) {
      res.status(400).json({ success: false, message: 'Bật chế độ thử trước khi thử.' });
      return false;
    }
    return true;
  }
  const testUid = (p) => `test_${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  app.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Vào';
    handleIntake({ uid: testUid('join'), name: n, avatar: '', kind: 'join' });
    res.json({ success: true });
  });
  app.post('/api/test/comment', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Bình Luận';
    const t = (req.body && req.body.text) || 'thịt bò';
    const r = handleIntake({ uid: testUid('cmt'), name: n, avatar: '', kind: 'comment', text: t });
    res.json({ success: true, ok: !!r.ok, cat: r.cat, points: r.points });
  });
  app.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Thả Tim';
    const count = Math.max(1, Math.floor(Number((req.body && req.body.count) || 50)));
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('tap');
    touchPlayer({ uid, name: n, avatar: '' });
    addTaps(uid, n, count);
    saveSession(); broadcast();
    res.json({ success: true, count });
  });
  app.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Quà';
    const coins = (req.body && req.body.coins !== undefined) ? Number(req.body.coins) : 10;
    const giftName = String((req.body && req.body.giftName) || 'Quà tặng thử').slice(0, 60);
    const r = handleIntake({ uid: testUid('gift'), name: n, avatar: '', kind: 'gift', coins: isNaN(coins) ? null : coins, giftName, giftId: 'test' });
    res.json({ success: true, ok: !!r.ok, coins });
  });
  app.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Theo Dõi';
    const r = handleIntake({ uid: testUid('flw'), name: n, avatar: '', kind: 'follow' });
    res.json({ success: true, ok: !!r.ok });
  });
  app.post('/api/test/share', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Chia Sẻ';
    const r = handleIntake({ uid: testUid('shr'), name: n, avatar: '', kind: 'share' });
    res.json({ success: true, ok: !!r.ok });
  });
  app.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const count = Math.min(200, Math.max(1, Math.floor(Number((req.body && req.body.count) || 100))));
    for (let i = 1; i <= count; i += 1) {
      handleIntake({ uid: testUid(`bulk${i}`), name: `Khách ${i}`, avatar: '', kind: 'join' });
    }
    res.json({ success: true, count, viewersOnline: Object.values(session.players).filter((p) => p.online).length });
  });
  // ---------------- Demo tự động (xem ~/workspace/overlay-moi/demo-mode-contract.md) ----------------
  const DEMO_CAST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Lan', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_COMMENTS = ['thịt bò', 'thịt gà', 'rau muống', 'rau cải', 'gia vị', 'thịt heo', 'thịt bò ngon quá'];
  const DEMO_GIFTS = [[1, 'Hoa hồng'], [5, 'Hoa hồng'], [10, 'Hoa hồng'], [50, 'Heo may mắn'], [100, 'Heo may mắn']];
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
      // 2 lần tap: lần 1 làm mốc delta, lần 2 +50 tim -> thổi lửa ngay.
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 1, isDemo: true });
      m.likeTotal = 51;
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 51, isDemo: true });
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
    if (roll < 0.35) {
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'comment', text: DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)], isDemo: true });
    } else if (roll < 0.70) {
      m.likeTotal += 10 + Math.floor(Math.random() * 41); // +10..50 tim
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
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'join' }); steps.push('An join');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'comment', text: 'thịt bò' }); steps.push('An comment thịt bò -> +3');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'join' }); steps.push('Bình join');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'gift', coins: 10, giftName: 'Hoa hồng', giftId: 'demo' }); steps.push('Bình gift 10 xu -> +100 điểm nấu');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'follow' }); steps.push('An follow -> +10đ');
    touchPlayer({ uid: an, name: 'An', avatar: '' });
    addTaps(an, 'An', 50); steps.push('An tap x50 -> thổi lửa');
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
