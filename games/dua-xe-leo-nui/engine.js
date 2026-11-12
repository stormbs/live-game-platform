// ĐUA XE LEO NÚI — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-dua-xe-leo-nui.md
// (KHỐI 1–4): 4 xe trên 1 dốc — xe streamer (vàng) + xe top 3 quà
// (xanh/đỏ/tím). Comment +10m, tap +0,5m, quà 1 xu = 1m (xe của chính
// người tặng nếu đang top 3, ngược lại đẩy xe streamer + vẫn tích điểm
// đua top 3), follow +5m (1 lần/người/ván). Ai chạm 1000m thắng ngay;
// hết 10 phút xe cao nhất thắng (hòa → ai đạt mức đó trước thắng).
// Thắng → bảng vinh danh 30s → ván mới.
// Khác bản thiết kế: KHÔNG chạy server local cổng 3012; quà tra số xu thật
// trong payload (không có bảng quà hardcode); xe chạy mượt bằng nội suy
// phía overlay (CSS transition), server chỉ giữ vị trí đích.
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

  const CAR_COLORS = ['🔵', '🔴', '🟣', '🟢', '🟠'];
  const CAR_COLOR_NAMES = ['xanh', 'đỏ', 'tím', 'xanh lá', 'cam'];

  const defaultSettings = {
    trackLength: 1000,
    roundS: 600,
    commentMeters: 10,
    tapMeters: 0.5,
    giftMetersPerCoin: 1,
    followMeters: 5,
    commentSpamS: 5,
    resultsS: 30,
    topN: 3,
    inactivityCleanupMin: 10,
    demoMode: true,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      roundNo: 1,
      phase: 'racing', // racing | results
      roundEndsAt: Date.now() + settings.roundS * 1000,
      resultsEndsAt: 0,
      streamer: { meters: 0, comments: 0, taps: 0, giftMeters: 0, follows: 0, bestMeters: 0, bestAt: 0 },
      racers: {}, // uid -> {name, avatar, giftPoints, firstGiftAt, lastCommentAt, followed, online, lastActiveAt, bestMeters, bestAt}
      winner: null, // {type, uid, name, meters, wonBy}
      results: null, // snapshot bảng vinh danh
      history: [], // {roundNo, winner, at}
      announcedMilestones: [], // 'streamer-500', '<uid>-500'...
      warned60: false,
      stats: { comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, joins: 0 },
      logs: [],
      webhookCount: 0,
      avatarStats: { total: 0, withAvatar: 0 },
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (session.phase !== 'racing' && session.phase !== 'results') session.phase = 'racing';
  if (!session.streamer) session.streamer = defaultSession().streamer;
  if (!session.racers || typeof session.racers !== 'object') session.racers = {};
  if (!session.stats) session.stats = defaultSession().stats;
  if (!Array.isArray(session.announcedMilestones)) session.announcedMilestones = [];
  if (!session.roundEndsAt) session.roundEndsAt = Date.now() + settings.roundS * 1000;
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
  function touchRacer(ev) {
    const r = session.racers[ev.uid] || {
      name: ev.name, avatar: ev.avatar || '', giftPoints: 0, firstGiftAt: 0,
      lastCommentAt: 0, followed: false, online: true, lastActiveAt: Date.now(),
      bestMeters: 0, bestAt: 0,
    };
    r.name = ev.name;
    if (ev.avatar) r.avatar = ev.avatar;
    r.online = true;
    r.lastActiveAt = Date.now();
    session.racers[ev.uid] = r;
    return r;
  }
  function trackAvatar(ev) {
    if (!ev.uid || ev.isDemo) return; // người xem demo không tính vào thống kê avatar thật
    session.avatarStats.total += 1;
    if (ev.avatar) session.avatarStats.withAvatar += 1;
  }
  // Top N quà hiện tại: điểm cao → sớm hơn (firstGiftAt) → uid.
  function topRacers() {
    return Object.entries(session.racers)
      .filter(([, r]) => r.giftPoints > 0)
      .map(([uid, r]) => ({ uid, ...r, carMeters: r.giftPoints * settings.giftMetersPerCoin }))
      .sort((a, b) => b.giftPoints - a.giftPoints || (a.firstGiftAt || 0) - (b.firstGiftAt || 0) || a.uid.localeCompare(b.uid))
      .slice(0, settings.topN);
  }
  function carStandings() {
    const cars = [{ type: 'streamer', uid: null, name: 'STREAMER', meters: session.streamer.meters, bestAt: session.streamer.bestAt || 0, avatar: '' }];
    for (const r of topRacers()) {
      cars.push({ type: 'racer', uid: r.uid, name: r.name, meters: r.carMeters, bestAt: r.bestAt || 0, avatar: r.avatar || '' });
    }
    return cars.sort((a, b) => b.meters - a.meters || (a.bestAt || 0) - (b.bestAt || 0));
  }
  function noteBest(car, now) {
    // Ghi timestamp lần đầu đạt mức mét nguyên mới (phục vụ luật hòa).
    const m = Math.floor(car.meters);
    if (m > Math.floor(car.bestMeters || 0)) {
      car.bestMeters = car.meters;
      car.bestAt = now;
    } else {
      car.bestMeters = Math.max(car.bestMeters || 0, car.meters);
    }
  }
  function noteRacerBest(p, now) {
    // Xe tay đua: vị trí = tổng điểm quà (1 xu = 1m).
    const m = p.giftPoints * settings.giftMetersPerCoin;
    if (Math.floor(m) > Math.floor(p.bestMeters || 0)) {
      p.bestMeters = m;
      p.bestAt = now;
    } else {
      p.bestMeters = Math.max(p.bestMeters || 0, m);
    }
  }
  function announceMilestone(key, text) {
    if (session.announcedMilestones.includes(key)) return;
    session.announcedMilestones.push(key);
    addLog(text, 'milestone');
    io.emit('milestone', { key, text });
  }
  function checkMilestones(meters, label) {
    for (const m of [500, 750, 900]) {
      if (meters >= m) announceMilestone(`${label}-${m}`, `🚩 ${label} vừa vượt mốc ${m}m!`);
    }
  }
  function checkWin() {
    if (session.phase !== 'racing') return false;
    const cars = carStandings();
    const done = cars.find((c) => c.meters >= settings.trackLength);
    if (done) { finishRace(done, 'summit'); return true; }
    return false;
  }
  function finishRace(winnerCar, wonBy) {
    session.phase = 'results';
    session.resultsEndsAt = Date.now() + settings.resultsS * 1000;
    session.winner = { type: winnerCar.type, uid: winnerCar.uid, name: winnerCar.name, meters: winnerCar.meters, wonBy };
    const standings = carStandings();
    session.results = {
      winner: session.winner,
      standings: standings.map((c, i) => ({ rank: i + 1, type: c.type, name: c.name, meters: Math.round(c.meters * 10) / 10 })),
      streamer: { meters: Math.round(session.streamer.meters * 10) / 10, comments: session.streamer.comments, taps: session.streamer.taps, giftMeters: Math.round(session.streamer.giftMeters * 10) / 10 },
      durationS: Math.round((Date.now() - (session.roundEndsAt - settings.roundS * 1000)) / 1000),
    };
    session.history.push({ roundNo: session.roundNo, winner: session.winner.name, wonBy, at: Date.now() });
    if (session.history.length > 20) session.history = session.history.slice(-20);
    addLog(`🏆 VÁN ${session.roundNo} KẾT THÚC — ${winnerCar.name} thắng (${wonBy === 'summit' ? 'về đích' : 'hết giờ, cao nhất'})!`, 'win');
    io.emit('win', { winner: session.winner, results: session.results });
  }
  function newRace() {
    session.streamer = { meters: 0, comments: 0, taps: 0, giftMeters: 0, follows: 0, bestMeters: 0, bestAt: 0 };
    for (const r of Object.values(session.racers)) {
      r.giftPoints = 0; r.firstGiftAt = 0; r.lastCommentAt = 0;
      r.followed = false; r.bestMeters = 0; r.bestAt = 0;
    }
    session.roundNo += 1;
    session.phase = 'racing';
    session.roundEndsAt = Date.now() + settings.roundS * 1000;
    session.resultsEndsAt = 0;
    session.winner = null;
    session.results = null;
    session.announcedMilestones = [];
    session.warned60 = false;
    addLog(`🏁 Ván mới #${session.roundNo} bắt đầu — mọi xe về vạch xuất phát!`, 'system');
    saveSession();
    io.emit('new-race', { roundNo: session.roundNo });
    broadcast();
  }
  function pushStreamer(meters, label) {
    const now = Date.now();
    session.streamer.meters += meters;
    noteBest(session.streamer, now);
    checkMilestones(session.streamer.meters, 'Xe streamer');
    checkWin();
  }

  function handleIntake(ev) {
    const { uid, name, avatar, kind, coins, giftName, giftId, text } = ev;
    if (session.phase !== 'racing' && kind !== 'join') {
      if (kind === 'join') { /* join vẫn nhận trong lúc kết quả */ }
      else { addLog(`⏸️ [${name}] ${kind} trong lúc bảng vinh danh — không tính điểm ván này.`, 'info'); saveSession(); broadcast(); return { ok: false, reason: 'results' }; }
    }
    if (kind === 'join') {
      if (!uid) return { ok: false };
      touchRacer(ev);
      session.stats.joins += 1;
      addLog(`👋 [${name}] vào đường đua.`, 'join');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchRacer(ev);
      session.stats.comments += 1;
      const now = Date.now();
      if (now - (p.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        addLog(`⏳ [${name}] bình luận trong thời gian chống spam (${settings.commentSpamS}s), không đẩy xe.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      p.lastCommentAt = now;
      session.streamer.comments += 1;
      pushStreamer(settings.commentMeters, 'comment');
      addLog(`💬 [${name}] bình luận → xe streamer +${settings.commentMeters}m (${Math.round(session.streamer.meters * 10) / 10}m).`, 'comment');
      saveSession(); broadcast();
      return { ok: true, meters: settings.commentMeters };
    }
    if (kind === 'tap') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchRacer(ev);
      const total = ev.totalLikeCount ?? ev.likeCount ?? null;
      const d = total !== null ? tapDelta.delta(uid, total) : 1;
      if (d <= 0) { saveSession(); broadcast(); return { ok: false, reason: 'no-delta' }; }
      session.stats.taps += d;
      session.streamer.taps += d;
      pushStreamer(d * settings.tapMeters, 'tap');
      saveSession(); broadcast();
      return { ok: true, taps: d, meters: d * settings.tapMeters };
    }
    if (kind === 'share') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchRacer(ev);
      session.stats.shares += 1;
      addLog(`🔁 [${name}] chia sẻ live.`, 'share');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'follow') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const p = touchRacer(ev);
      session.stats.follows += 1;
      if (p.followed) {
        addLog(`➕ [${name}] follow lại — đã tính 1 lần trong ván này rồi.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'already-followed' };
      }
      p.followed = true;
      session.streamer.follows += 1;
      pushStreamer(settings.followMeters, 'follow');
      addLog(`➕ [${name}] theo dõi kênh → xe streamer +${settings.followMeters}m.`, 'follow');
      saveSession(); broadcast();
      return { ok: true, meters: settings.followMeters };
    }
    if (kind === 'gift') {
      if (!uid) { addLog('⚠️ Quà tặng thiếu ID người dùng, bỏ qua.', 'warn'); saveSession(); broadcast(); return { ok: false }; }
      trackAvatar(ev);
      const p = touchRacer(ev);
      if (coins === null || isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        addLog(`⚠️ [${name}] tặng "${giftName}" nhưng không rõ số xu (giftId: ${giftId || 'không có'}) — chỉ log, không cộng điểm.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      if (!p.firstGiftAt) p.firstGiftAt = Date.now();
      const beforeTop = topRacers().map((r) => r.uid);
      p.giftPoints += coins;
      noteRacerBest(p, Date.now());
      const afterTop = topRacers();
      const inTop = afterTop.some((r) => r.uid === uid);
      const rank = afterTop.findIndex((r) => r.uid === uid) + 1;
      const meters = coins * settings.giftMetersPerCoin;
      if (inTop) {
        // Xe của chính người tặng = tổng điểm quà (đã cộng ở trên).
        if (!beforeTop.includes(uid)) {
          addLog(`🏁 [${name}] vừa vào Top ${rank} (${CAR_COLOR_NAMES[rank - 1]})! Xe chạy từ vạch xuất phát lên ${Math.round(p.giftPoints * settings.giftMetersPerCoin)}m.`, 'top3');
          io.emit('top3-enter', { uid, name, rank, meters: p.giftPoints * settings.giftMetersPerCoin });
        }
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu → xe của họ +${meters}m (tổng ${p.giftPoints} xu).`, 'gift');
        checkMilestones(p.giftPoints * settings.giftMetersPerCoin, name);
      } else {
        session.streamer.giftMeters += meters;
        pushStreamer(meters, 'gift');
        addLog(`🎁 [${name}] tặng "${giftName}" ${coins} xu (ngoài top ${settings.topN}) → xe streamer +${meters}m, tổng quà của họ ${p.giftPoints} xu.`, 'gift');
      }
      checkWin();
      saveSession(); broadcast();
      return { ok: true, coins, inTop, rank: inTop ? rank : 0 };
    }
    addLog(`👁️ [${name}] ${kind} — chỉ log.`, 'info');
    saveSession(); broadcast();
    return { ok: false };
  }

  function tick() {
    const now = Date.now();
    let changed = false;
    const idleMs = settings.inactivityCleanupMin * 60 * 1000;
    for (const p of Object.values(session.racers)) {
      if (p.online && now - p.lastActiveAt > idleMs) { p.online = false; changed = true; }
    }
    if (session.phase === 'racing') {
      if (!session.warned60 && session.roundEndsAt - now <= 60000 && session.roundEndsAt - now > 0) {
        session.warned60 = true;
        addLog('⏰ Còn 60 giây cuối ván!', 'warn');
        io.emit('last-minute');
        changed = true;
      }
      if (now >= session.roundEndsAt) {
        const cars = carStandings();
        finishRace(cars[0], 'timeout');
        changed = true;
      }
    } else if (session.phase === 'results' && now >= session.resultsEndsAt) {
      newRace();
      return;
    }
    if (changed || dirty) { saveSession(); broadcast(); }
  }
  timers.setInterval(tick, 1000);

  function statePayload() {
    const top = topRacers();
    return {
      proto: 1,
      game: 'dua-xe-leo-nui',
      roundNo: session.roundNo,
      phase: session.phase,
      roundEndsAt: session.roundEndsAt,
      roundSecondsLeft: Math.max(0, Math.ceil((session.roundEndsAt - Date.now()) / 1000)),
      resultsEndsAt: session.resultsEndsAt,
      trackLength: settings.trackLength,
      streamer: { ...session.streamer, meters: Math.round(session.streamer.meters * 10) / 10 },
      cars: carStandings().map((c) => ({ ...c, meters: Math.round(c.meters * 10) / 10 })),
      top: top.map((r, i) => ({ rank: i + 1, uid: r.uid, name: r.name, avatar: r.avatar || '', giftPoints: r.giftPoints, carMeters: Math.round(r.carMeters * 10) / 10, color: CAR_COLORS[i], colorName: CAR_COLOR_NAMES[i] })),
      winner: session.winner,
      results: session.results,
      history: session.history.slice(-5),
      viewersOnline: Object.values(session.racers).filter((p) => p.online).length,
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
    res.json({ received: true, kind: ev.kind, ok: !!r.ok, taps: r.taps, meters: r.meters, coins: r.coins, inTop: r.inTop, reason: r.reason });
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
    num('trackLength', 10, 100000, 1000);
    num('roundS', 5, 3600, 600);
    num('commentMeters', 0, 1000, 10);
    num('tapMeters', 0, 100, 0.5);
    num('giftMetersPerCoin', 0, 100, 1);
    num('followMeters', 0, 1000, 5);
    num('commentSpamS', 1, 60, 5);
    num('resultsS', 1, 300, 30);
    num('topN', 1, 5, 3);
    num('inactivityCleanupMin', 1, 120, 10);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    addLog('⚙️ Đã lưu cài đặt đua xe.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, settings });
  });

  app.post('/api/session/reset', (req, res) => {
    stopDemo();
    session = defaultSession();
    tapDelta.reset();
    addLog('🔄 Đã làm mới phiên: ván + điểm + log về trống.', 'system');
    saveSession(); broadcast();
    io.emit('session-reset');
    res.json({ success: true });
  });
  app.post('/api/race/reset', (req, res) => {
    newRace();
    res.json({ success: true, roundNo: session.roundNo });
  });
  app.post('/api/race/force-timeout', (req, res) => {
    if (session.phase !== 'racing') return res.json({ success: false, message: 'Ván không đang chạy.' });
    session.roundEndsAt = Date.now();
    saveSession(); broadcast();
    res.json({ success: true });
  });
  app.post('/api/race/set-clock', (req, res) => {
    const s = Math.max(1, Math.floor(Number((req.body && req.body.seconds) || 60)));
    if (session.phase !== 'racing') return res.json({ success: false, message: 'Ván không đang chạy.' });
    session.roundEndsAt = Date.now() + s * 1000;
    session.warned60 = s > 60;
    addLog(`⏱️ Đồng hồ ván đặt còn ${s}s.`, 'system');
    saveSession(); broadcast();
    res.json({ success: true, secondsLeft: s });
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
    const t = (req.body && req.body.text) || 'Đẩy xe nào!';
    const r = handleIntake({ uid: testUid('cmt'), name: n, avatar: '', kind: 'comment', text: t });
    res.json({ success: true, ok: !!r.ok, meters: r.meters });
  });
  app.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Thả Tim';
    const count = Math.max(1, Math.floor(Number((req.body && req.body.count) || 50)));
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('tap');
    touchRacer({ uid, name: n, avatar: '' });
    session.stats.taps += count;
    session.streamer.taps += count;
    pushStreamer(count * settings.tapMeters, 'tap');
    saveSession(); broadcast();
    res.json({ success: true, count, meters: count * settings.tapMeters });
  });
  app.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Quà';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('gift');
    const coins = (req.body && req.body.coins !== undefined) ? Number(req.body.coins) : 10;
    const giftName = String((req.body && req.body.giftName) || 'Quà tặng thử').slice(0, 60);
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'gift', coins: isNaN(coins) ? null : coins, giftName, giftId: 'test' });
    res.json({ success: true, ok: !!r.ok, coins, inTop: !!r.inTop, rank: r.rank || 0 });
  });
  app.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Theo Dõi';
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('flw');
    const r = handleIntake({ uid, name: n, avatar: '', kind: 'follow' });
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
    res.json({ success: true, count, viewersOnline: Object.values(session.racers).filter((p) => p.online).length });
  });
  // ---------------- Demo tự động (xem ~/workspace/overlay-moi/demo-mode-contract.md) ----------------
  const DEMO_CAST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Lan', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_COMMENTS = ['Đẩy xe nào!', 'Lên đỉnh nào!', 'Nhanh lên!', 'Cố lên!', 'Xe vàng chạy đi!'];
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
      // 2 lần tap: lần 1 làm mốc delta, lần 2 +40 tim -> xe streamer +20m ngay.
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 1, isDemo: true });
      m.likeTotal = 41;
      handleIntake({ uid, name, avatar: '', kind: 'tap', totalLikeCount: 41, isDemo: true });
      // Quà 10 xu để vào Top 3 — xe của chính người đó bắt đầu chạy.
      handleIntake({ uid, name, avatar: '', kind: 'gift', coins: 10, giftName: 'Hoa hồng', giftId: 'demo', isDemo: true });
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
    } else if (roll < 0.88) {
      const [coins, giftName] = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
      handleIntake({ uid: m.uid, name: m.name, avatar: '', kind: 'gift', coins, giftName, giftId: 'demo', isDemo: true });
    } else if (roll < 0.94) {
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
    const clearSpam = (uid) => { const p = session.racers[uid]; if (p) p.lastCommentAt = 0; };
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'join' }); steps.push('1. An join');
    for (let i = 0; i < 3; i += 1) { clearSpam(an); handleIntake({ uid: an, name: 'An', avatar: '', kind: 'comment', text: 'Đẩy xe nào!' }); }
    steps.push('2. An comment x3 -> xe streamer +30m');
    touchRacer({ uid: an, name: 'An', avatar: '' });
    session.stats.taps += 40; session.streamer.taps += 40;
    pushStreamer(40 * settings.tapMeters, 'tap'); steps.push('3. An tap x40 -> xe streamer +20m (tổng 50m)');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'gift', coins: 5, giftName: 'Hoa hồng', giftId: 'demo' });
    steps.push('4. Bình gift 5 xu -> Bình 5đ, vào Top 3 hạng 1 (xe 5m)');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'gift', coins: 100, giftName: 'Heo may mắn', giftId: 'demo' });
    steps.push('5. Chi gift 100 xu -> vào Top 3, xe 100m');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'gift', coins: 200, giftName: 'Du thuyền', giftId: 'demo' });
    steps.push('6. Bình gift 200 xu -> Bình 205đ, Top 3 hạng 1, xe 205m');
    for (let i = 0; i < 10; i += 1) { clearSpam(an); handleIntake({ uid: an, name: 'An', avatar: '', kind: 'comment', text: 'Lên đỉnh nào!' }); }
    steps.push('7. An comment x10 -> xe streamer +100m');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'gift', coins: 800, giftName: 'Du thuyền', giftId: 'demo' });
    steps.push('8. Chi gift 800 xu -> Chi 900đ, xe 900m (mốc 900m)');
    handleIntake({ uid: chi, name: 'Chi', avatar: '', kind: 'gift', coins: 150, giftName: 'Du thuyền', giftId: 'demo' });
    steps.push('9. Chi gift 150 xu -> Chi 1050đ -> VỀ ĐÍCH, bảng vinh danh');
    steps.push('10. Chờ hết bảng vinh danh (resultsS) -> tự reset ván mới');
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
