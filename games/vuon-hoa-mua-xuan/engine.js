// VƯỜN HOA MÙA XUÂN — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-vuon-hoa-mua-xuan.md
// (KHỐI 0–4): bình luận/tim gieo hạt → mầm → nụ → nở; quà tưới nước;
// follow = hoa hồng vàng; mốc 25/50/75/100 hoa nở → lễ hội → ván mới.
// Khác bản thiết kế: KHÔNG chạy server local cổng 3010 — chạy trong
// platform, webhook qua dispatch có sẵn; quà tra số xu thật trong payload
// (không có bảng quà hardcode — payload chính là bảng).
'use strict';

function createEngine(ctx) {
  const __dirname = ctx.gameDir;
  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const cors = require('cors');
  const { loadJson, saveJson, parseTikFinityEvent, TapDelta, withTimers, mountTts } = require('../../lib/game-common');
  const timers = withTimers(ctx);
  const DATA_DIR = ctx.dataDir;
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const SESSION_FILE = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const FLOWER_TYPES = [
    { id: 'mai', icon: '🌼', name: 'Mai vàng' },
    { id: 'dao', icon: '🌸', name: 'Đào hồng' },
    { id: 'cuc', icon: '🏵️', name: 'Cúc vàng' },
    { id: 'sen', icon: '🪷', name: 'Sen hồng' },
    { id: 'hong', icon: '🌹', name: 'Hồng đỏ' },
    { id: 'huongduong', icon: '🌻', name: 'Hướng dương' },
  ];
  const STAGE_ORDER = ['seed', 'sprout', 'bud', 'bloom'];

  const defaultSettings = {
    plots: 40,
    maxFlowersPerViewer: 8,
    growthPerStage: 3,
    sproutAutoS: 10,
    dewIntervalS: 60,
    dewGrowth: 1,
    harvestAfterBloomS: 90,
    gardenTargetBlooms: 100,
    milestones: [25, 50, 75, 100],
    giftCoinToGrowth: 1,
    giftRainCoins: 100,
    giftRainbowCoins: 500,
    followPoints: 5,
    commentSpamS: 5,
    shareGrowth: 2,
    inactivityCleanupMin: 10,
    festivalS: 30,
    resultsS: 30,
    demoMode: true,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  settings.milestones = Array.isArray(settings.milestones) ? settings.milestones : [25, 50, 75, 100];
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      roundNo: 1,
      phase: 'playing', // playing | festival | results
      phaseEndsAt: 0,
      gardenBlooms: 0,
      milestonesHit: [],
      flowers: [], // {id, uid, name, avatar, type, golden, stage, growth, plantedAt, bloomAt}
      nursery: [], // {uid, name, avatar, type, queuedAt}
      viewers: {}, // uid -> {name, avatar, points, online, lastActiveAt, lastCommentAt, followed, goldenRose}
      flowerSeq: 0,
      stats: { comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, joins: 0 },
      logs: [],
      webhookCount: 0,
      avatarStats: { total: 0, withAvatar: 0 },
      results: null,
      lastDewAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  // Khôi phục sau restart: ván đang lễ hội/kết quả thì về playing để khỏi kẹt.
  if (session.phase !== 'playing') { session.phase = 'playing'; session.phaseEndsAt = 0; }
  if (!Array.isArray(session.flowers)) session.flowers = [];
  if (!Array.isArray(session.nursery)) session.nursery = [];
  if (!session.viewers || typeof session.viewers !== 'object') session.viewers = {};
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
  function touchViewer(ev) {
    const v = session.viewers[ev.uid] || {
      name: ev.name, avatar: ev.avatar || '', points: 0, online: true,
      lastActiveAt: Date.now(), lastCommentAt: 0, followed: false, goldenRose: false,
    };
    v.name = ev.name;
    if (ev.avatar) v.avatar = ev.avatar;
    v.online = true;
    v.lastActiveAt = Date.now();
    session.viewers[ev.uid] = v;
    return v;
  }
  function trackAvatar(ev) {
    if (!ev.uid) return;
    session.avatarStats.total += 1;
    if (ev.avatar) session.avatarStats.withAvatar += 1;
  }
  function viewerFlowers(uid) {
    return session.flowers.filter((f) => f.uid === uid);
  }
  function youngestFlower(uid) {
    const list = viewerFlowers(uid);
    if (!list.length) return null;
    list.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.plantedAt - b.plantedAt);
    return list[0];
  }
  function youngestGardenFlower() {
    if (!session.flowers.length) return null;
    const list = [...session.flowers];
    list.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.plantedAt - b.plantedAt);
    return list[0];
  }
  function randomType() {
    return FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)].id;
  }
  function topList() {
    return Object.entries(session.viewers)
      .map(([uid, v]) => ({ uid, name: v.name, avatar: v.avatar || '', points: v.points, online: v.online }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  }

  function checkMilestones() {
    for (const m of settings.milestones) {
      if (session.gardenBlooms >= m && !session.milestonesHit.includes(m)) {
        session.milestonesHit.push(m);
        if (m >= settings.gardenTargetBlooms) {
          session.phase = 'festival';
          session.phaseEndsAt = Date.now() + settings.festivalS * 1000;
          addLog(`🎉 VƯỜN ĐẦY — ${m} hoa đã nở! Lễ hội hoa bắt đầu!`, 'festival');
          io.emit('festival', { blooms: session.gardenBlooms, roundNo: session.roundNo });
        } else {
          const effect = m === 25 ? '🦋 Bướm bay về vườn!' : m === 50 ? '🐝 Ong về vườn, sương xuân ×2!' : '🌈 Cầu vồng xuất hiện trên vườn!';
          addLog(`🌸 Mốc ${m} hoa nở: ${effect}`, 'milestone');
          io.emit('milestone', { milestone: m, effect });
        }
      }
    }
  }
  function addGrowth(flower, n, byName) {
    if (!flower || n <= 0) return;
    const v = session.viewers[flower.uid];
    flower.growth += n;
    if (v) v.points += n;
    while (flower.stage !== 'bloom' && flower.growth >= settings.growthPerStage) {
      flower.growth -= settings.growthPerStage;
      const idx = STAGE_ORDER.indexOf(flower.stage);
      flower.stage = STAGE_ORDER[Math.min(idx + 1, 3)];
      if (flower.stage === 'bloom') {
        flower.bloomAt = Date.now();
        flower.growth = 0;
        session.gardenBlooms += 1;
        addLog(`🌸 Hoa ${flower.type === 'hong-vang' ? 'hồng vàng' : flower.type} của [${flower.name}] đã NỞ! (${session.gardenBlooms}/${settings.gardenTargetBlooms})`, 'bloom');
        io.emit('bloom', { flower: { ...flower } });
        checkMilestones();
        break;
      }
    }
    dirty = true;
  }
  function plantSeed(ev) {
    const v = touchViewer(ev);
    const mine = viewerFlowers(ev.uid);
    if (mine.length >= settings.maxFlowersPerViewer) {
      // Đủ hoa rồi: tim/comment thừa chuyển thành tăng trưởng cho hoa non nhất.
      const y = youngestFlower(ev.uid);
      if (y) { addGrowth(y, 1, ev.name); return { planted: false, grown: true }; }
      return { planted: false, grown: false };
    }
    const type = randomType();
    if (session.flowers.length < settings.plots) {
      session.flowerSeq += 1;
      const f = {
        id: session.flowerSeq, uid: ev.uid, name: ev.name, avatar: ev.avatar || '',
        type, golden: false, stage: 'seed', growth: 0, plantedAt: Date.now(), bloomAt: 0,
      };
      session.flowers.push(f);
      v.points += 1;
      addLog(`🌱 [${ev.name}] gieo 1 hạt ${type} (luống ${session.flowers.length}/${settings.plots}).`, 'plant');
      dirty = true;
      return { planted: true, flower: f };
    }
    // Hết luống: vào vườn ươm chờ.
    session.nursery.push({ uid: ev.uid, name: ev.name, avatar: ev.avatar || '', type, queuedAt: Date.now() });
    v.points += 1;
    addLog(`🌱 [${ev.name}] gieo hạt ${type} — vườn đầy, vào vườn ươm chờ (${session.nursery.length} hạt).`, 'plant');
    dirty = true;
    return { planted: false, nursery: true };
  }
  function plantFromNursery() {
    while (session.flowers.length < settings.plots && session.nursery.length) {
      const w = session.nursery.shift();
      session.flowerSeq += 1;
      session.flowers.push({
        id: session.flowerSeq, uid: w.uid, name: w.name, avatar: w.avatar || '',
        type: w.type, golden: false, stage: 'seed', growth: 0, plantedAt: Date.now(), bloomAt: 0,
      });
      addLog(`🌱 Hạt của [${w.name}] từ vườn ươm đã gieo vào luống trống.`, 'plant');
    }
    dirty = true;
  }

  function handleIntake(ev) {
    const { uid, name, avatar, kind, coins, giftName, giftId, text } = ev;
    if (kind === 'join') {
      if (!uid) return { ok: false };
      touchViewer(ev);
      session.stats.joins += 1;
      addLog(`👋 [${name}] vào vườn.`, 'join');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const v = touchViewer(ev);
      session.stats.comments += 1;
      const now = Date.now();
      if (now - (v.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        addLog(`⏳ [${name}] bình luận trong thời gian chống spam (${settings.commentSpamS}s), không gieo hạt.`, 'info');
        saveSession(); broadcast();
        return { ok: false, reason: 'spam' };
      }
      v.lastCommentAt = now;
      plantSeed(ev);
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'tap') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchViewer(ev);
      // likeCount của TikFinity là TỔNG TÍCH LŨY (adapter gửi thêm
      // totalLikeCount) — chỉ cộng phần tăng so với lần trước của người đó.
      const total = ev.totalLikeCount ?? ev.likeCount ?? null;
      const d = total !== null ? tapDelta.delta(uid, total) : 1;
      if (d <= 0) { saveSession(); broadcast(); return { ok: false, reason: 'no-delta' }; }
      session.stats.taps += d;
      for (let i = 0; i < d; i += 1) plantSeed(ev);
      addLog(`❤️ [${name}] +${d} tim (tổng ${session.stats.taps}).`, 'tap');
      saveSession(); broadcast();
      return { ok: true, taps: d };
    }
    if (kind === 'share') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      touchViewer(ev);
      session.stats.shares += 1;
      const y = youngestFlower(uid);
      if (y) addGrowth(y, settings.shareGrowth, name);
      addLog(`🔁 [${name}] chia sẻ live (+${settings.shareGrowth} tăng trưởng cho hoa).`, 'share');
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'follow') {
      if (!uid) return { ok: false };
      trackAvatar(ev);
      const v = touchViewer(ev);
      session.stats.follows += 1;
      if (!v.followed) {
        v.followed = true;
        v.points += settings.followPoints;
        if (!v.goldenRose && session.flowers.length < settings.plots) {
          v.goldenRose = true;
          session.flowerSeq += 1;
          session.flowers.push({
            id: session.flowerSeq, uid, name, avatar: avatar || '',
            type: 'hong-vang', golden: true, stage: 'bud', growth: 0, plantedAt: Date.now(), bloomAt: 0,
          });
          addLog(`🌹 [${name}] theo dõi kênh — hoa hồng vàng đã gieo (bắt đầu ở giai đoạn nụ)!`, 'follow');
        } else {
          addLog(`🌹 [${name}] theo dõi kênh (+${settings.followPoints}đ).`, 'follow');
        }
      } else {
        v.points += settings.followPoints;
        addLog(`🌹 [${name}] theo dõi lại (+${settings.followPoints}đ, không gieo thêm hồng vàng).`, 'follow');
      }
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'gift') {
      if (!uid) { addLog('⚠️ Quà tặng thiếu ID người dùng, bỏ qua.', 'warn'); saveSession(); broadcast(); return { ok: false }; }
      trackAvatar(ev);
      touchViewer(ev);
      if (coins === null || isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        addLog(`⚠️ [${name}] tặng "${giftName}" nhưng không rõ số xu (giftId: ${giftId || 'không có'}) — chỉ log, không cộng điểm, không tưới.`, 'warn');
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const growth = Math.max(1, Math.floor(coins * settings.giftCoinToGrowth));
      const v = session.viewers[uid];
      if (coins >= settings.giftRainbowCoins) {
        const y = youngestFlower(uid) || youngestGardenFlower();
        if (y) {
          // Cầu vồng: 1 hoa nở ngay + mọi hoa +10.
          while (y.stage !== 'bloom') {
            const idx = STAGE_ORDER.indexOf(y.stage);
            y.stage = STAGE_ORDER[Math.min(idx + 1, 3)];
            if (y.stage === 'bloom') {
              y.bloomAt = Date.now(); y.growth = 0;
              session.gardenBlooms += 1;
              checkMilestones();
              break;
            }
          }
        }
        for (const f of session.flowers) if (f !== y) addGrowth(f, 10, name);
        if (v) v.points += growth;
        addLog(`🌈 [${name}] tặng "${giftName}" ${coins} xu — CẦU VỒNG! 1 hoa nở ngay + mọi hoa +10 tăng trưởng.`, 'gift');
        io.emit('rainbow', { name, coins });
      } else if (coins >= settings.giftRainCoins) {
        for (const f of session.flowers) addGrowth(f, 5, name);
        if (v) v.points += growth;
        addLog(`🌧️ [${name}] tặng "${giftName}" ${coins} xu — CƠN MƯA! Mọi hoa +5 tăng trưởng.`, 'gift');
        io.emit('rain', { name, coins });
      } else {
        const y = youngestFlower(uid) || youngestGardenFlower();
        if (y) addGrowth(y, growth, name);
        addLog(`💧 [${name}] tặng "${giftName}" ${coins} xu — tưới +${growth} tăng trưởng.`, 'gift');
      }
      saveSession(); broadcast();
      return { ok: true, coins };
    }
    addLog(`👁️ [${name}] ${kind} — chỉ log.`, 'info');
    saveSession(); broadcast();
    return { ok: false };
  }

  function resetRound() {
    session.flowers = [];
    session.nursery = [];
    session.gardenBlooms = 0;
    session.milestonesHit = [];
    session.phase = 'playing';
    session.phaseEndsAt = 0;
    session.results = null;
    session.lastDewAt = Date.now();
    for (const v of Object.values(session.viewers)) {
      v.points = 0; v.followed = false; v.goldenRose = false;
    }
    session.roundNo += 1;
    addLog(`🔄 Ván mới #${session.roundNo} bắt đầu — vườn trống lại.`, 'system');
    saveSession();
    io.emit('round-reset', { roundNo: session.roundNo });
    broadcast();
  }

  // Tick 1 giây: nảy mầm, hái hoa, sương xuân, dọn viewer im, chuyển pha.
  function tick() {
    const now = Date.now();
    let changed = false;
    for (const f of session.flowers) {
      if (f.stage === 'seed' && now - f.plantedAt >= settings.sproutAutoS * 1000) {
        f.stage = 'sprout';
        changed = true;
      }
    }
    const before = session.flowers.length;
    session.flowers = session.flowers.filter((f) => {
      if (f.stage === 'bloom' && f.bloomAt && now - f.bloomAt >= settings.harvestAfterBloomS * 1000) {
        addLog(`🧺 Hoa của [${f.name}] đã được hái (bay vào giỏ, trả luống).`, 'harvest');
        return false;
      }
      return true;
    });
    if (session.flowers.length !== before) { plantFromNursery(); changed = true; }
    if (now - session.lastDewAt >= settings.dewIntervalS * 1000) {
      session.lastDewAt = now;
      for (const f of session.flowers) addGrowth(f, settings.dewGrowth, 'sương xuân');
      if (session.flowers.length) addLog(`💧 Giọt sương xuân: mọi hoa +${settings.dewGrowth} tăng trưởng.`, 'dew');
      changed = true;
    }
    const idleMs = settings.inactivityCleanupMin * 60 * 1000;
    for (const v of Object.values(session.viewers)) {
      if (v.online && now - v.lastActiveAt > idleMs) { v.online = false; changed = true; }
    }
    if (session.phase === 'festival' && now >= session.phaseEndsAt) {
      session.phase = 'results';
      session.phaseEndsAt = now + settings.resultsS * 1000;
      session.results = {
        roundNo: session.roundNo, blooms: session.gardenBlooms,
        top: topList(), at: now,
      };
      addLog(`🏆 Kết quả ván #${session.roundNo}: ${session.results.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}đ`).join(' — ') || 'chưa có ai trồng hoa'}.`, 'results');
      io.emit('results', session.results);
      changed = true;
    } else if (session.phase === 'results' && now >= session.phaseEndsAt) {
      resetRound();
      return;
    }
    if (changed || dirty) { saveSession(); broadcast(); }
  }
  timers.setInterval(tick, 1000);

  function statePayload() {
    return {
      proto: 1,
      game: 'vuon-hoa-mua-xuan',
      roundNo: session.roundNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      gardenBlooms: session.gardenBlooms,
      target: settings.gardenTargetBlooms,
      milestones: settings.milestones,
      milestonesHit: session.milestonesHit,
      plots: settings.plots,
      flowers: session.flowers,
      nursery: { count: session.nursery.length, waiting: session.nursery.slice(0, 3).map((w) => w.name) },
      top: topList(),
      viewersOnline: Object.values(session.viewers).filter((v) => v.online).length,
      settings,
      logs: session.logs.slice(-60),
      webhookCount: session.webhookCount,
      avatarStats: session.avatarStats,
      avatarWarning: session.avatarStats.total > 0 && session.avatarStats.withAvatar === 0,
      stats: session.stats,
      results: session.results,
    };
  }
  function broadcast() { io.emit('state-update', statePayload()); }

  // ---------------- API ----------------
  app.post('/api/webhook', (req, res) => {
    session.webhookCount = (session.webhookCount || 0) + 1;
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
    res.json({ received: true, kind: ev.kind, ok: !!r.ok });
  });

  app.get('/api/state', (req, res) => res.json(statePayload()));

  app.post('/api/settings', (req, res) => {
    const b = req.body || {};
    const num = (k, min, max, dflt) => {
      if (b[k] !== undefined) settings[k] = Math.min(max, Math.max(min, Number(b[k]) || dflt));
    };
    num('plots', 1, 100, 40);
    num('maxFlowersPerViewer', 1, 20, 8);
    num('growthPerStage', 1, 10, 3);
    num('sproutAutoS', 1, 120, 10);
    num('dewIntervalS', 10, 600, 60);
    num('dewGrowth', 1, 5, 1);
    num('harvestAfterBloomS', 10, 600, 90);
    num('gardenTargetBlooms', 1, 1000, 100);
    num('giftCoinToGrowth', 1, 100, 1);
    num('giftRainCoins', 10, 10000, 100);
    num('giftRainbowCoins', 50, 100000, 500);
    num('followPoints', 0, 100, 5);
    num('commentSpamS', 1, 60, 5);
    num('shareGrowth', 0, 20, 2);
    num('inactivityCleanupMin', 1, 120, 10);
    num('festivalS', 1, 120, 30);
    num('resultsS', 1, 120, 30);
    if (b.milestones !== undefined && Array.isArray(b.milestones)) {
      settings.milestones = b.milestones.map((m) => Math.max(1, Math.floor(Number(m) || 0))).filter((m) => m > 0).sort((x, y) => x - y);
    }
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    addLog('⚙️ Đã lưu cài đặt vườn hoa.', 'system');
    saveSession(); broadcast();
    res.json({ success: true, settings });
  });

  app.post('/api/session/reset', (req, res) => {
    session = defaultSession();
    tapDelta.reset();
    addLog('🔄 Đã làm mới phiên: vườn + điểm + log về trống.', 'system');
    saveSession(); broadcast();
    io.emit('session-reset');
    res.json({ success: true });
  });
  app.post('/api/round/reset', (req, res) => {
    resetRound();
    res.json({ success: true, roundNo: session.roundNo });
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
    const r = handleIntake({ uid: testUid('cmt'), name: n, avatar: '', kind: 'comment', text: (req.body && req.body.text) || 'hoa đẹp quá' });
    res.json({ success: true, ok: !!r.ok });
  });
  app.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const n = (req.body && req.body.name) || 'Người Thử Thả Tim';
    const count = Math.max(1, Math.floor(Number((req.body && req.body.count) || 20)));
    const uid = (req.body && req.body.uid) ? String(req.body.uid) : testUid('tap');
    // Test tap: cộng thẳng số tap mới (không qua delta tích lũy).
    touchViewer({ uid, name: n, avatar: '' });
    session.stats.taps += count;
    for (let i = 0; i < count; i += 1) plantSeed({ uid, name: n, avatar: '' });
    addLog(`❤️ [TEST ${n}] +${count} tim.`, 'tap');
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
    res.json({ success: true, count, viewersOnline: Object.values(session.viewers).filter((v) => v.online).length });
  });
  app.post('/api/test/demo', (req, res) => {
    if (!needDemo(req, res)) return;
    const steps = [];
    const an = testUid('demo-an');
    const binh = testUid('demo-binh');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'join' }); steps.push('An join');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'comment', text: 'hoa đẹp quá' }); steps.push('An comment -> gieo hạt');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'join' }); steps.push('Bình join');
    handleIntake({ uid: binh, name: 'Bình', avatar: '', kind: 'gift', coins: 10, giftName: 'Hoa hồng', giftId: 'demo' }); steps.push('Bình gift 10 xu -> tưới');
    handleIntake({ uid: an, name: 'An', avatar: '', kind: 'follow' }); steps.push('An follow -> hồng vàng');
    touchViewer({ uid: an, name: 'An', avatar: '' });
    session.stats.taps += 20;
    for (let i = 0; i < 20; i += 1) plantSeed({ uid: an, name: 'An', avatar: '' });
    steps.push('An tap x20');
    res.json({ success: true, steps });
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
