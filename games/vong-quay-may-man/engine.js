// VÒNG QUAY MAY MẮN KHỔNG LỒ — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-vong-quay-may-man.md
// (KHỐI 1–4): vòng quay 20 ô có trọng số (trúng 75% / trượt 25%);
// thanh tích lũy chung 50 điểm (tim +1, bình luận +5) = 1 lượt quay chung,
// người trúng ngẫu nhiên trong phòng; quà tặng → quay riêng ngay theo
// 6 mốc xu (1–9→1, 10–49→2, 50–99→3, 100–499→5, 500–999→10, ≥1000→20+Epic).
// Ô 10 "Quay Thêm 1 Lượt" quay tiếp ngay sau 2s.
// LUẬT CHƠI: trò vui MIỄN PHÍ, trúng thưởng chỉ là vinh danh trong live —
// KHÔNG dùng tiền thật để chơi, KHÔNG hiện chữ "mua lượt quay".
// Khác bản thiết kế: KHÔNG chạy server local cổng 3013; quà tra số xu thật
// trong payload (không có bảng quà hardcode — mốc xu chính là bảng);
// hàng chờ không có giới hạn cứng (vượt 10 lượt thì dashboard cảnh báo
// nhưng KHÔNG mất lượt nào).
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

  // Bảng 20 ô mặc định — tổng tỉ lệ đúng 100% (trúng 75% / trượt 25%).
  const DEFAULT_SEGMENTS = [
    { id: 1, icon: '👑', name: 'Vua May Mắn', prize: 'Vương miện vàng + tên lên tường vinh danh cả phiên', prob: 2 },
    { id: 2, icon: '🎆', name: 'Pháo Hoa Tên Bạn', prize: 'Pháo hoa + tên bay to giữa màn hình 8s', prob: 3 },
    { id: 3, icon: '💃', name: 'Nhảy Múa 10s', prize: 'Nhân vật của người trúng nhảy múa dưới spotlight 10s', prob: 4 },
    { id: 4, icon: '🎤', name: 'Hát 1 Câu', prize: 'Giọng đọc xướng tên người trúng 1 câu vui', prob: 4 },
    { id: 5, icon: '🌟', name: 'Sao May Mắn', prize: 'Huy hiệu sao vàng bên cạnh tên trong phiên', prob: 5 },
    { id: 6, icon: '🎨', name: 'Đổi Màu Vòng Quay', prize: 'Người trúng chọn màu chủ đạo của vòng quay 5 phút', prob: 5 },
    { id: 7, icon: '📣', name: 'Xướng Tên 3 Lần', prize: 'Giọng đọc xướng tên người trúng 3 lần vang dội', prob: 5 },
    { id: 8, icon: '💎', name: 'Kim Cương May Mắn', prize: 'Khung kim cương quanh avatar người trúng cả phiên', prob: 3 },
    { id: 9, icon: '🍀', name: 'Cỏ 4 Lá', prize: 'Huy hiệu cỏ 4 lá + lời chúc may mắn', prob: 6 },
    { id: 10, icon: '🎁', name: 'Quay Thêm 1 Lượt', prize: 'Tặng ngay 1 lượt quay riêng miễn phí (quay tiếp luôn)', prob: 5 },
    { id: 11, icon: '😂', name: 'Biệt Danh Hài 5 Phút', prize: 'Người trúng mang biệt danh hài do phòng bình chọn 5 phút', prob: 6 },
    { id: 12, icon: '🎵', name: 'Nhạc Chúc Mừng Riêng', prize: 'Phát 1 đoạn nhạc chúc mừng mang tên người trúng', prob: 4 },
    { id: 13, icon: '🏆', name: 'Top May Mắn', prize: 'Tên vào bảng Top May Mắn của phiên', prob: 4 },
    { id: 14, icon: '✨', name: 'Hào Quang May Mắn', prize: 'Hiệu ứng hào quang vàng quanh nhân vật 10 phút', prob: 5 },
    { id: 15, icon: '🎭', name: 'Đổi Trang Phục Vòng Quay', prize: 'Người trúng chọn trang phục/kiểu vòng quay 5 phút', prob: 4 },
    { id: 16, icon: '💌', name: 'Lời Chúc May Mắn', prize: 'Lời chúc may mắn cá nhân hiện to + giọng đọc đọc lên', prob: 5 },
    { id: 17, icon: '🥇', name: 'Huy Chương Vàng', prize: 'Huy chương vàng gắn lên tường vinh danh cả phiên', prob: 2 },
    { id: 18, icon: '🎪', name: 'Múa Lân Chúc Mừng', prize: 'Múa lân mini chúc mừng người trúng 8s', prob: 3 },
    { id: 19, icon: '🍂', name: 'Chúc bạn may mắn lần sau', prize: 'Trượt — không có thưởng, giọng đọc động viên 1 câu', prob: 15, miss: true },
    { id: 20, icon: '🍂', name: 'Chúc bạn may mắn lần sau', prize: 'Trượt — không có thưởng, giọng đọc động viên 1 câu', prob: 10, miss: true },
  ];
  // Mốc xu → lượt quay riêng: [tối đa xu của mốc, số lượt].
  const DEFAULT_GIFT_TIERS = [
    { maxCoins: 9, spins: 1 }, { maxCoins: 49, spins: 2 }, { maxCoins: 99, spins: 3 },
    { maxCoins: 499, spins: 5 }, { maxCoins: 999, spins: 10 }, { maxCoins: Infinity, spins: 20 },
  ];

  const defaultSettings = {
    spinThreshold: 50,
    tapPoints: 1,
    commentPoints: 5,
    tapPerMin: 10,
    commentPerMin: 2,
    spinsPerMin: 5,
    queueWarnMax: 10,
    spinS: 6,
    resultS: 8,
    extraSpinDelayS: 2,
    activeWindowMin: 5,
    inactivityCleanupMin: 10,
    segments: DEFAULT_SEGMENTS,
    giftSpins: [1, 2, 3, 5, 10, 20],
    bannedWords: [],
    demoMode: true,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  if (!Array.isArray(settings.segments) || settings.segments.length !== 20) settings.segments = DEFAULT_SEGMENTS;
  if (!Array.isArray(settings.giftSpins) || settings.giftSpins.length !== 6) settings.giftSpins = [1, 2, 3, 5, 10, 20];
  if (!Array.isArray(settings.bannedWords)) settings.bannedWords = [];
  saveJson(SETTINGS_FILE, settings);

  function giftTiers() {
    const maxs = [9, 49, 99, 499, 999, Infinity];
    return settings.giftSpins.map((spins, i) => ({ maxCoins: maxs[i], spins }));
  }
  function spinsForCoins(coins) {
    for (const t of giftTiers()) if (coins <= t.maxCoins) return t.spins;
    return 20;
  }

  function defaultSession() {
    return {
      progress: 0,
      totalSpins: 0,
      queue: [], // {type:'private', uid, name, avatar, epic, forcedSegment, notBefore}
      pendingShared: 0,
      currentSpin: null, // {id, type, winnerUid, winnerName, winnerAvatar, segmentIndex, epic, startedAt, endsAt, resultEndsAt, resultShown}
      lastSpinAt: 0,
      lastSharedWinnerUid: null,
      lastSharedMiss: false, // lần quay chung gần nhất có trượt không (luật: không trượt 2 lần liên tiếp)
      players: {}, // uid -> {name, avatar, online, lastActiveAt, tapWindowStart, tapsThisMinute, commentWindowStart, commentsThisMinute, spinsThisMinute, spinWindowStart}
      history: [], // {name, segment, prize, time, type, epic, miss}
      topLucky: {}, // uid -> {name, avatar, wins}
      giftLog: [],
      unknownGifts: [],
      stats: { comments: 0, commentsBlocked: 0, taps: 0, tapsBlocked: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, joins: 0, sharedSpins: 0, privateSpins: 0, extraSpins: 0 },
      logs: [],
      webhookCount: 0,
      avatarStats: { total: 0, withAvatar: 0 },
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players || typeof session.players !== 'object') session.players = {};
  if (!session.stats) session.stats = defaultSession().stats;
  if (!Array.isArray(session.queue)) session.queue = [];
  if (typeof session.lastSharedMiss !== 'boolean') session.lastSharedMiss = false;
  if (!Array.isArray(session.history)) session.history = [];
  if (!session.topLucky || typeof session.topLucky !== 'object') session.topLucky = {};
  if (!Array.isArray(session.giftLog)) session.giftLog = [];
  if (!Array.isArray(session.unknownGifts)) session.unknownGifts = [];
  // Vòng đang quay dở khi server restart thì bỏ (không quay tiếp kết quả cũ).
  if (session.currentSpin) session.currentSpin = null;
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  let dirty = false;
  let spinSeq = 0;
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
      name: ev.name, avatar: ev.avatar || '', online: true, lastActiveAt: Date.now(),
      tapWindowStart: 0, tapsThisMinute: 0, commentWindowStart: 0, commentsThisMinute: 0,
      spinWindowStart: 0, spinsThisMinute: 0,
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
  function pickSegment() {
    const total = settings.segments.reduce((a, s) => a + (Number(s.prob) || 0), 0);
    if (total <= 0) return 0;
    let r = Math.random() * total;
    for (let i = 0; i < settings.segments.length; i += 1) {
      r -= Number(settings.segments[i].prob) || 0;
      if (r <= 0) return i;
    }
    return settings.segments.length - 1;
  }
  function pickSharedWinner() {
    const now = Date.now();
    const pool = Object.entries(session.players)
      .filter(([, p]) => p.online && now - p.lastActiveAt <= settings.activeWindowMin * 60 * 1000)
      .filter(([uid]) => uid !== session.lastSharedWinnerUid)
      .map(([uid, p]) => ({ uid, name: p.name, avatar: p.avatar || '' }));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function startSpin(type, winner, opts) {
    const o = opts || {};
    let segmentIndex = o.forcedSegment !== undefined ? o.forcedSegment : pickSegment();
    // Luật thiết kế: quay chung KHÔNG được trượt 2 lần liên tiếp — lần quay chung
    // trước trượt thì lần này quay lại tới khi trúng (chỉ quay chung, không áp
    // cho quay riêng). Guard 50 lần đề phòng bảng ô toàn ô trượt (không xảy ra
    // với bảng mặc định 75/25).
    if (type === 'shared' && session.lastSharedMiss && o.forcedSegment === undefined) {
      let guard = 0;
      while (settings.segments[segmentIndex] && settings.segments[segmentIndex].miss && guard < 50) {
        segmentIndex = pickSegment();
        guard += 1;
      }
      if (guard > 0) addLog('🍀 Quay chung trước trượt — quay lại để không trượt 2 lần liên tiếp.', 'info');
    }
    const now = Date.now();
    spinSeq += 1;
    session.currentSpin = {
      id: spinSeq,
      type,
      winnerUid: winner.uid || null,
      winnerName: winner.name,
      winnerAvatar: winner.avatar || '',
      segmentIndex,
      segment: settings.segments[segmentIndex],
      epic: !!o.epic,
      startedAt: now,
      endsAt: now + settings.spinS * 1000,
      resultEndsAt: now + settings.spinS * 1000 + settings.resultS * 1000,
      resultShown: false,
    };
    session.totalSpins += 1;
    session.lastSpinAt = now;
    if (type === 'shared') session.stats.sharedSpins += 1;
    else session.stats.privateSpins += 1;
    io.emit('spin-start', { spin: session.currentSpin });
    dirty = true;
  }
  function finishSpin() {
    const sp = session.currentSpin;
    if (!sp) return;
    const seg = sp.segment;
    if (sp.type === 'shared') session.lastSharedMiss = !!seg.miss;
    session.history.push({
      name: sp.winnerName, segment: seg.name, icon: seg.icon, prize: seg.prize,
      time: Date.now(), type: sp.type, epic: sp.epic, miss: !!seg.miss,
    });
    if (session.history.length > 100) session.history = session.history.slice(-100);
    if (!seg.miss && sp.winnerUid) {
      const tl = session.topLucky[sp.winnerUid] || { name: sp.winnerName, avatar: sp.winnerAvatar || '', wins: 0 };
      tl.name = sp.winnerName;
      if (sp.winnerAvatar) tl.avatar = sp.winnerAvatar;
      tl.wins += 1;
      session.topLucky[sp.winnerUid] = tl;
    }
    if (seg.id === 10) {
      // Ô "Quay Thêm 1 Lượt": quay tiếp ngay 1 lượt riêng miễn phí sau 2s.
      session.queue.unshift({
        type: 'private', uid: sp.winnerUid, name: sp.winnerName, avatar: sp.winnerAvatar || '',
        epic: sp.epic, forcedSegment: undefined, notBefore: Date.now() + settings.extraSpinDelayS * 1000, extra: true,
      });
      session.stats.extraSpins += 1;
      addLog(`🎁 [${sp.winnerName}] trúng ô "Quay Thêm 1 Lượt" — quay tiếp miễn phí sau ${settings.extraSpinDelayS}s!`, 'extra');
    }
    session.currentSpin = null;
    dirty = true;
  }
  function addSharedPoints(points) {
    session.progress += points;
    while (session.progress >= settings.spinThreshold) {
      session.progress -= settings.spinThreshold;
      session.pendingShared += 1;
    }
    dirty = true;
  }
  function addPrivateSpins(uid, name, avatar, count, epic) {
    const now = Date.now();
    const p = session.players[uid];
    // Giới hạn tốc độ xử lý 5 lượt/người/phút: vượt thì vẫn xếp hàng chờ (không mất lượt),
    // tick sẽ chỉ lấy tối đa 5 lượt/phút của mỗi người ra quay.
    for (let i = 0; i < count; i += 1) {
      session.queue.push({ type: 'private', uid, name, avatar: avatar || '', epic: !!epic, forcedSegment: undefined, notBefore: 0, extra: false });
    }
    if (p) { /* Giới hạn 5 lượt/người/phút tính lúc BẮT ĐẦU quay (xem tick), không tính lúc xếp hàng. */ }
    if (session.queue.length > settings.queueWarnMax) {
      addLog(`⚠️ Hàng chờ quay đã ${session.queue.length} lượt (vượt ngưỡng ${settings.queueWarnMax}) — các lượt vẫn được giữ, không mất lượt nào.`, 'warn');
    }
    dirty = true;
  }

  function tick() {
    const now = Date.now();
    let changed = false;
    const idleMs = settings.inactivityCleanupMin * 60 * 1000;
    for (const p of Object.values(session.players)) {
      if (p.online && now - p.lastActiveAt > idleMs) { p.online = false; changed = true; }
    }
    const sp = session.currentSpin;
    if (sp) {
      if (!sp.resultShown && now >= sp.endsAt) {
        sp.resultShown = true;
        const seg = sp.segment;
        addLog(seg.miss
          ? `🍂 [${sp.winnerName}] quay ${sp.type === 'shared' ? 'chung' : 'riêng'} → trượt: "${seg.name}".`
          : `🎉 [${sp.winnerName}] quay ${sp.type === 'shared' ? 'chung' : 'riêng'} → trúng ${seg.icon} ${seg.name}!`, seg.miss ? 'info' : 'win');
        io.emit('spin-result', { spin: sp });
        changed = true;
      }
      if (sp.resultShown && now >= sp.resultEndsAt) {
        finishSpin();
        changed = true;
      }
    }
    if (!session.currentSpin && now >= session.lastSpinAt + 10000) {
      // Lượt quay riêng ưu tiên trước lượt quay chung. Giới hạn tốc độ:
      // tối đa 5 lượt quay/người/phút (tính lúc bắt đầu quay).
      const qi = session.queue.findIndex((q) => {
        if ((q.notBefore || 0) > now) return false;
        const p = session.players[q.uid];
        if (p) {
          if (now - (p.spinWindowStart || 0) >= 60000) { p.spinWindowStart = now; p.spinsThisMinute = 0; }
          if (p.spinsThisMinute >= settings.spinsPerMin) return false;
        }
        return true;
      });
      if (qi >= 0) {
        const q = session.queue.splice(qi, 1)[0];
        const p = session.players[q.uid];
        if (p) p.spinsThisMinute += 1;
        startSpin('private', { uid: q.uid, name: q.name, avatar: q.avatar }, { epic: q.epic, forcedSegment: q.forcedSegment });
        changed = true;
      } else if (session.pendingShared > 0) {
        const winner = pickSharedWinner();
        if (winner) {
          session.pendingShared -= 1;
          session.lastSharedWinnerUid = winner.uid;
          startSpin('shared', winner, {});
          changed = true;
        } else {
          // Chưa có người đủ điều kiện (pool trống / chỉ còn người vừa trúng):
          // giữ lượt quay chung chờ, không mất.
        }
      }
    }
    if (changed || dirty) { saveSession(); broadcast(); }
  }
  timers.setInterval(tick, 500);

  function topList() {
    return Object.entries(session.topLucky)
      .map(([uid, v]) => ({ uid, name: v.name, avatar: v.avatar || '', wins: v.wins }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);
  }
  function statePayload() {
    return {
      proto: 1,
      game: 'vong-quay-may-man',
      progress: session.progress,
      spinThreshold: settings.spinThreshold,
      totalSpins: session.totalSpins,
      queueLength: session.queue.length,
      pendingShared: session.pendingShared,
      currentSpin: session.currentSpin,
      recentWins: session.history.slice(-8).reverse(),
      top: topList(),
      giftLog: session.giftLog.slice(-20).reverse(),
      unknownGifts: session.unknownGifts.slice(-20).reverse(),
      viewersOnline: Object.values(session.players).filter((p) => p.online).length,
      settings: { ...settings, segments: settings.segments },
      logs: session.logs.slice(-60),
      webhookCount: session.webhookCount,
      demoActive: demo.active,
      avatarStats: session.avatarStats,
      avatarWarning: session.avatarStats.total > 0 && session.avatarStats.withAvatar === 0,
      stats: session.stats,
    };
  }
  function broadcast() { io.emit('state-update', statePayload()); }

  function handleIntake(ev) {
    const { uid, name, avatar, kind, coins, giftName, giftId, text } = ev;
    if (kind === 'join') {
      if (!uid) return { ok: false };
      touchPlayer(ev);
      session.stats.joins += 1;
      addLog(`👋 [${name}] vào phòng quay.`, 'join');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchPlayer(ev);
      session.stats.comments += 1;
      const now = Date.now();
      if (now - (p.commentWindowStart || 0) >= 60000) { p.commentWindowStart = now; p.commentsThisMinute = 0; }
      if (containsBanned(text) || containsBanned(name)) {
        session.stats.commentsBlocked += 1;
        addLog(`🚫 [${name}] bình luận chứa từ cấm — không cộng điểm thanh chung.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'banned' };
      }
      if (p.commentsThisMinute >= settings.commentPerMin) {
        session.stats.commentsBlocked += 1;
        addLog(`⏳ [${name}] đã bình luận ${settings.commentPerMin} lần/phút — bình luận này không cộng điểm.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      p.commentsThisMinute += 1;
      addSharedPoints(settings.commentPoints);
      addLog(`💬 [${name}] bình luận +${settings.commentPoints}đ thanh chung (${session.progress}/${settings.spinThreshold}).`, 'comment');
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
      const now = Date.now();
      if (now - (p.tapWindowStart || 0) >= 60000) { p.tapWindowStart = now; p.tapsThisMinute = 0; }
      if (containsBanned(name)) {
        session.stats.tapsBlocked += d;
        addLog(`🚫 [${name}] tên chứa từ cấm — ${d} tim không cộng điểm.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'banned' };
      }
      const allowed = Math.max(0, Math.min(d, settings.tapPerMin - p.tapsThisMinute));
      const blocked = d - allowed;
      p.tapsThisMinute += allowed;
      if (blocked > 0) {
        session.stats.tapsBlocked += blocked;
        addLog(`⏳ [${name}] đã tim ${settings.tapPerMin} lần/phút — ${blocked} tim không cộng điểm.`, 'info');
      }
      if (allowed > 0) addSharedPoints(allowed * settings.tapPoints);
      saveSession(); broadcast();
      return { ok: true, taps: d, counted: allowed, points: allowed * settings.tapPoints };
    }
    if (kind === 'share') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchPlayer(ev);
      session.stats.shares += 1;
      addLog(`🔁 [${name}] chia sẻ live.`, 'share');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'follow') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchPlayer(ev);
      session.stats.follows += 1;
      addLog(`➕ [${name}] theo dõi kênh.`, 'follow');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'gift') {
      if (!uid) { addLog('⚠️ Quà tặng thiếu ID người dùng, bỏ qua.', 'warn'); saveSession(); broadcast(); return { ok: false }; }
      trackAvatar(ev);
      const p = touchPlayer(ev);
      if (coins === null || isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        session.unknownGifts.push({ name, giftName, giftId: giftId || 'không có', coins: null, time: Date.now() });
        if (session.unknownGifts.length > 100) session.unknownGifts = session.unknownGifts.slice(-100);
        addLog(`⚠️ [${name}] tặng "${giftName}" nhưng không rõ số xu (giftId: ${giftId || 'không có'}) — 0 lượt quay, chỉ log.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const spins = spinsForCoins(coins);
      const epic = coins >= 500;
      session.giftLog.push({ name, giftName, giftId: giftId || 'không có', coins, spins, time: Date.now() });
      if (session.giftLog.length > 100) session.giftLog = session.giftLog.slice(-100);
      addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → ${spins} lượt quay riêng${epic ? ' + hiệu ứng Epic' : ''}!`, 'gift');
      addPrivateSpins(uid, name, avatar, spins, epic);
      saveSession(); broadcast();
      return { ok: true, coins, spins, epic };
    }
    addLog(`👁️ [${name}] ${kind} — chỉ log.`, 'info');
    saveSession(); broadcast();
    return { ok: false };
  }

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
    res.json({ received: true, kind: ev.kind, ok: !!r.ok, taps: r.taps, counted: r.counted, points: r.points, spins: r.spins, reason: r.reason });
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
    num('spinThreshold', 1, 1000, 50);
    num('tapPoints', 0, 10, 1);
    num('commentPoints', 0, 50, 5);
    num('tapPerMin', 1, 100, 10);
    num('commentPerMin', 1, 10, 2);
    num('spinsPerMin', 1, 20, 5);
    num('queueWarnMax', 1, 100, 10);
    num('spinS', 1, 15, 6);
    num('resultS', 1, 30, 8);
    num('extraSpinDelayS', 0, 10, 2);
    num('activeWindowMin', 1, 30, 5);
    num('inactivityCleanupMin', 1, 120, 10);
    if (b.segments !== undefined && Array.isArray(b.segments) && b.segments.length === 20) {
      const segs = b.segments.map((s, i) => ({
        id: i + 1,
        icon: String(s.icon || '🎡').slice(0, 4),
        name: String(s.name || `Ô ${i + 1}`).slice(0, 40),
        prize: String(s.prize || '').slice(0, 120),
        prob: Math.max(0, Number(s.prob) || 0),
        miss: !!s.miss,
      }));
      const total = segs.reduce((a, s) => a + s.prob, 0);
      if (Math.abs(total - 100) > 0.001) {
        return res.status(400).json({ success: false, message: `Tổng tỉ lệ phải = 100% (hiện ${total}%).` });
      }
      settings.segments = segs;
    }
    if (b.giftSpins !== undefined && Array.isArray(b.giftSpins) && b.giftSpins.length === 6) {
      const gs = b.giftSpins.map((x) => Math.max(1, Math.min(50, Math.floor(Number(x) || 1))));
      settings.giftSpins = gs;
    }
    if (b.bannedWords !== undefined) {
      settings.bannedWords = String(b.bannedWords).split(',').map((w) => w.trim()).filter(Boolean).slice(0, 50);
    }
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    addLog('⚙️ Đã lưu cài đặt vòng quay.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, settings });
  });
  app.post('/api/segments/reset', (req, res) => {
    settings.segments = DEFAULT_SEGMENTS.map((s) => ({ ...s }));
    saveSettings();
    addLog('🎡 Đã khôi phục bảng 20 ô mặc định.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, segments: settings.segments });
  });

  app.post('/api/session/reset', (req, res) => {
    stopDemo();
    session = defaultSession();
    tapDelta.reset();
    addLog('🔄 Đã làm mới phiên: thanh + hàng chờ + lịch sử + top về trống.', 'system');
    saveSession(); broadcast();
    io.emit('session-reset');
    res.json({ success: true });
  });
  app.post('/api/spin/shared-now', (req, res) => {
    session.pendingShared += 1;
    addLog('🎡 Chủ phòng bấm quay ngay 1 lượt chung.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, pendingShared: session.pendingShared });
  });
  app.post('/api/progress/reset', (req, res) => {
    session.progress = 0;
    addLog('🔄 Đã reset thanh tích lũy chung về 0.', 'system');
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
    const t = (req.body && req.body.text) || 'Quay nào!';
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'comment', text: t });
    res.json({ success: true, ok: !!r.ok, points: r.points });
  });
  app.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Thả Tim';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('tap');
    const total = Math.max(1, Math.floor(Number((req.body && req.body.totalLikeCount) || 10)));
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'tap', totalLikeCount: total });
    res.json({ success: true, ok: !!r.ok, taps: r.taps, counted: r.counted, points: r.points });
  });
  app.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Quà';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('gift');
    const coins = (req.body && req.body.coins !== undefined) ? Number(req.body.coins) : 10;
    const giftName = String((req.body && req.body.giftName) || 'Quà tặng thử').slice(0, 60);
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'gift', coins: isNaN(coins) ? null : coins, giftName, giftId: 'test' });
    res.json({ success: true, ok: !!r.ok, coins, spins: r.spins, epic: !!r.epic });
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
  app.post('/api/test/force-segment', (req, res) => {
    if (!needDemo(req, res)) return;
    const segmentId = Math.floor(Number((req.body && req.body.segmentId) || 1));
    const idx = settings.segments.findIndex((s) => s.id === segmentId);
    if (idx < 0) return res.status(400).json({ success: false, message: 'Ô không tồn tại.' });
    const n = (req.body && req.body.name) || 'Người Thử Ép Ô';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('force');
    touchPlayer({ uid, name: n, avatar: '' });
    session.queue.push({ type: 'private', uid, name: n, avatar: '', epic: false, forcedSegment: idx, notBefore: 0, extra: false });
    saveSession(); broadcast();
    res.json({ success: true, segmentId, segment: settings.segments[idx].name });
  });
  // Test-only: giả lập lần quay chung trước đã trượt, để kiểm tra luật
  // "quay chung không trượt 2 lần liên tiếp" (chỉ demoMode).
  app.post('/api/test/force-shared-miss', (req, res) => {
    if (!needDemo(req, res)) return;
    session.lastSharedMiss = true;
    saveSession(); broadcast();
    res.json({ success: true, lastSharedMiss: true });
  });
  app.post('/api/test/gift-tiers', (req, res) => {
    if (!needDemo(req, res)) return;
    const coinsList = [1, 10, 50, 100, 500, 1000];
    const rows = coinsList.map((c) => ({ coins: c, spins: spinsForCoins(c), epic: c >= 500 }));
    res.json({ success: true, tiers: rows });
  });
  // ---------------- Demo tự động (xem ~/workspace/overlay-moi/demo-mode-contract.md) ----------------
  const DEMO_CAST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Lan', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_COMMENTS = ['Quay nào!', 'May mắn nào!', 'Vòng quay ơi!', 'Trúng lớn nào!', 'Quay trúng Vua đi!'];
  const DEMO_GIFTS = [[1, 'Hoa hồng'], [5, 'Hoa hồng'], [10, 'Kính râm'], [50, 'Heo may mắn'], [100, 'Heo may mắn']];
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
      // 2 lần tap: lần 1 làm mốc delta, lần 2 +10 tim (đúng giới hạn 10/phút).
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 1, isDemo: true });
      m.likeTotal = 11;
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 11, isDemo: true });
      handleIntake({ uid, name, avatar: '', kind: 'comment', text: 'Quay nào!', isDemo: true });
      handleIntake({ uid, name, avatar: '', kind: 'comment', text: 'May mắn nào!', isDemo: true });
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
      m.likeTotal += 5 + Math.floor(Math.random() * 6); // +5..10 tim (trong giới hạn 10/phút)
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
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'join' });
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'join' });
    steps.push('1. An, Bình, Chi join phòng');
    // Mỗi người tap 10 lần (đúng giới hạn 10/phút) = 30đ, comment 2 lần = 30đ.
    // Tap tính theo delta nên cần 2 lần gửi: lần 1 làm mốc (delta 0), lần 2 +10.
    for (const [uid, nm] of [[an, 'An'], [binh, 'Bình'], [chi, 'Chi']]) {
      handleIntake({ uid, name: nm, avatar: '', kind: 'tap', totalLikeCount: 1 });
      handleIntake({ uid, name: nm, avatar: '', kind: 'tap', totalLikeCount: 11 });
      handleIntake({ uid, name: nm, avatar: '', kind: 'comment', text: 'Quay nào!' });
      handleIntake({ uid, name: nm, avatar: '', kind: 'comment', text: 'May mắn nào!' });
    }
    steps.push('2. Mỗi người tap 10 + comment x2 -> thanh chung 60đ, đủ 50đ -> quay chung (dư 10đ)');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'gift', coins: 50, giftName: 'Heo may mắn', giftId: 'demo' });
    steps.push('3. An gift 50 xu -> 3 lượt quay riêng xếp hàng sau lượt chung');
    steps.push('4. Chờ vòng quay chạy hết các lượt -> xem lịch sử + Top May Mắn');
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
