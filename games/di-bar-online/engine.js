// ĐI BAR ONLINE — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-di-bar-online.md:
// Phòng bar online: DJ đánh nhạc remix, khán giả vào làm dancer, quà là đồ
// uống, bảng LED chạy chữ, camera lia khắp phòng. Học CƠ CHẾ CHUNG của format
// bar đang hot (đều là sản phẩm trả phí, KHÔNG có repo miễn phí) và làm lại
// TOÀN BỘ bằng art/code gốc — mọi hình vẽ bằng CSS/canvas + emoji; nhạc tự
// tổng hợp bằng WebAudio (không file nhạc ngoài, không nhạc có bản quyền).
// - Vào bar: bình luận "vào bar" / "join" / "quẩy" -> dancer với 1 trong 8
//   nhân vật gốc (random, hoặc bình luận số 1-8 để chọn). Tối đa 24 dancer
//   trên sàn; người vào sau đứng ở quầy bar chờ lượt.
// - Nhảy: 1 tim (delta) = +1 năng lượng; 1 bình luận tính điểm (chống spam
//   1/5s) = +5; quà 1 xu = +10 năng lượng + 1 ly đồ uống; follow +30 (1 lần/vòng).
// - Vua sàn nhảy: vòng 3 phút, dancer nhiều năng lượng nhất khi hết vòng ->
//   lên ngôi Vua (camera zoom, LED chạy tên to, đội vương miện, TTS xướng tên).
//   Vinh danh 20s -> vòng mới, năng lượng về 0.
// - Đồ uống: quà >=10 xu = cocktail; >=50 xu = bottle service (pháo giấy +
//   camera zoom người tặng + LED ghi tên); >=100 xu = mở sâm panh (phun sâm
//   panh cả sàn, đèn chớp, LED tên to 10s).
// - DJ drop: mỗi 2 phút DJ "drop" (báo trước 10s): trong 15s drop, mọi tim
//   tính x2, đèn nhấp nháy nhanh, camera zoom vào DJ.
// - Đấu bàn VIP: bình luận "bàn vàng" / "bàn đỏ" để chọn bàn. Tổng năng lượng
//   + đồ uống của mỗi bàn được tính (điểm bàn = tổng năng lượng + số ly);
//   hết vòng, bàn nhiều hơn thắng vòng (hiện trên LED). Thắng 2 vòng liên
//   tiếp -> bàn đó "bao cả bar" 1 phút (mọi dancer của bàn được x2 năng lượng).
// Demo theo ~/workspace/overlay-moi/demo-mode-contract.md: ?demo=1 tự chạy,
// nút Chạy/Dừng demo ở dashboard, huy hiệu DEMO, tự dừng khi event thật tới,
// từ chối khi phòng đã có event thật (webhookCount > 0).
'use strict';

function createEngine(ctx) {
  const __dirname = ctx.gameDir;
  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const { loadJson, saveJson, normVi, parseTikFinityEvent, TapDelta, withTimers, mountTts } = require('../../lib/game-common');
  const { webhookUrl, publicBaseUrl } = require('../../lib/webhook-bodies');
  // TikFinity thật (xác minh từ log live thật 2026-11-13): action "Trigger
  // WebHook" CHỈ có ô URL, KHÔNG có ô body — TikFinity tự gửi body dạng
  // form cố định (value1/value2/value3/content/avatar_url). KHÔNG CÓ BODY.
  // Cơ chế đúng: 6 Action webhook, MỖI ACTION 1 URL RIÊNG phân biệt bằng
  // query ?event=<loại> + 6 Event, mỗi event chọn đúng action của nó ở
  // "Trigger all of these actions". (Parser đọc form do CEO sửa ở
  // lib/game-common.js — engine này không chạm file đó.)
  const GAME = 'di-bar-online';
  const GAME_NAME_VI = 'Đi Bar Online';
  const TIKFINITY_ACTIONS = [
    { key: 'gift', actionName: `${GAME_NAME_VI} - Qua`, triggerLabel: 'Sending a gift with min. coins value (min coins = 1)' },
    { key: 'chat', actionName: `${GAME_NAME_VI} - Binh luan`, triggerLabel: 'Chat (any comment)' },
    { key: 'like', actionName: `${GAME_NAME_VI} - Tim`, triggerLabel: 'Sending likes (taps)' },
    { key: 'follow', actionName: `${GAME_NAME_VI} - Follow`, triggerLabel: 'Follow' },
    { key: 'share', actionName: `${GAME_NAME_VI} - Share`, triggerLabel: 'Share' },
    { key: 'join', actionName: `${GAME_NAME_VI} - Vao phong`, triggerLabel: 'Join' },
  ];
  const timers = withTimers(ctx);
  const DATA_DIR = ctx.dataDir;
  // ctx không có username — lấy từ roomPrefix '/o/<game>/<username>'.
  const USERNAME = String(ctx.roomPrefix || '').split('/').filter(Boolean).pop() || 'live';
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const SESSION_FILE = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // 8 nhân vật GỐC (vẽ bằng CSS/emoji — không copy ai).
  const CHARACTERS = [
    { id: 1, name: 'DJ', emoji: '🎧', color: '#a78bfa', move: 'nod' },
    { id: 2, name: 'Hip-hop', emoji: '🧢', color: '#f59e0b', move: 'pop' },
    { id: 3, name: 'Dancer', emoji: '💃', color: '#ec4899', move: 'wave' },
    { id: 4, name: 'Robot', emoji: '🤖', color: '#94a3b8', move: 'robot' },
    { id: 5, name: 'Punk', emoji: '🤘', color: '#ef4444', move: 'shake' },
    { id: 6, name: 'Dân văn phòng', emoji: '👔', color: '#38bdf8', move: 'bounce' },
    { id: 7, name: 'Cao bồi', emoji: '🤠', color: '#d97706', move: 'line' },
    { id: 8, name: 'Người ngoài hành tinh', emoji: '👽', color: '#4ade80', move: 'wobble' },
  ];
  const TABLE_NAMES = { vang: 'Bàn Vàng', do: 'Bàn Đỏ' };
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_CHEERS = ['Quẩy lên!', 'Nhạc hay quá!', 'Lên sàn thôi!', 'Đêm nay cháy hết mình!'];
  const MAX_FLOOR = 24;

  const defaultSettings = {
    roundDurationS: 180,  // phút/vòng (giây)
    tapEnergy: 1,         // năng lượng / 1 tim (delta)
    commentEnergy: 5,     // năng lượng / 1 bình luận tính điểm
    coinToEnergy: 10,     // năng lượng / 1 xu quà
    followEnergy: 30,     // năng lượng follow (1 lần/vòng)
    dropIntervalS: 120,   // nhịp drop (giây)
    dropWarningS: 10,     // báo trước drop (giây)
    dropDurationS: 15,    // thời gian drop (giây)
    spotlightS: 20,       // vinh danh Vua sàn (giây)
    commentSpamS: 5,      // chống spam bình luận (giây/người)
    cameraMode: 'auto',   // auto | manual
    shotIntervalS: 8,     // thời gian mỗi shot camera (giây)
    musicEnabled: true,
    volume: 50,           // 0-100
    tempo: 128,           // BPM
    demoMode: false,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      roundNo: 1,
      phase: 'lobby',       // lobby | dancing | spotlight
      phaseEndsAt: 0,
      roundEndsAt: 0,
      dropState: 'idle',    // idle | warning | drop
      nextDropAt: 0,
      dropEndsAt: 0,
      players: {},          // uid -> player (dancer)
      king: null,           // { uid, name, energy, at, roundNo }
      tableScores: { vang: 0, do: 0 },
      tableStreak: { vang: 0, do: 0 },
      tableWinner: null,    // bàn thắng vòng vừa rồi
      barCover: null,       // { table, until } — bàn bao cả bar
      lastDrink: null,      // { tier, uid, name, coins, at }
      logs: [],
      stats: { joins: 0, comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, drinks: 0, follows: 0, shares: 0, leaves: 0, drops: 0 },
      avatarStats: { total: 0, withAvatar: 0 },
      avatarSeen: {},
      webhookCount: 0,
      demoActive: false,
      createdAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players) session.players = {};
  if (!session.tableScores) session.tableScores = { vang: 0, do: 0 };
  if (!session.tableStreak) session.tableStreak = { vang: 0, do: 0 };
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  session.demoActive = false; // demo không sống qua restart
  if (session.phase === 'dancing') session.phase = 'lobby';
  session.dropState = 'idle';
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  const testTapTotals = {};
  const demoTapTotals = {};
  let demoTimer = null;

  function saveSession() { saveJson(SESSION_FILE, session); }
  function saveSettings() { saveJson(SETTINGS_FILE, settings); }
  function clampInt(v, min, max, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }
  function log(text) {
    session.logs.push({ t: Date.now(), text });
    if (session.logs.length > 100) session.logs = session.logs.slice(-100);
  }
  function broadcast() { ctx.io.emit('state-update', statePayload()); }
  function charById(id) { return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]; }

  function floorDancers() {
    return Object.values(session.players)
      .filter((p) => p.isDancer && !p.left)
      .sort((a, b) => (a.joinedBarAt || 0) - (b.joinedBarAt || 0));
  }
  function topDancers(n) {
    return Object.values(session.players)
      .filter((p) => p.isDancer && !p.left)
      .sort((a, b) => (b.energy || 0) - (a.energy || 0) || (a.joinedBarAt || 0) - (b.joinedBarAt || 0))
      .slice(0, n || 3);
  }
  function computeTableScores() {
    const s = { vang: { energy: 0, drinks: 0, count: 0 }, do: { energy: 0, drinks: 0, count: 0 } };
    for (const p of Object.values(session.players)) {
      if (!p.isDancer || p.left || !p.table) continue;
      s[p.table].energy += p.energy || 0;
      s[p.table].drinks += p.drinks || 0;
      s[p.table].count += 1;
    }
    return {
      vang: { ...s.vang, score: s.vang.energy + s.vang.drinks },
      do: { ...s.do, score: s.do.energy + s.do.drinks },
    };
  }
  function statePayload() {
    const dancers = floorDancers();
    const floor = dancers.slice(0, MAX_FLOOR);
    const waiting = dancers.slice(MAX_FLOOR);
    const top = topDancers(5);
    const tables = computeTableScores();
    return {
      game: GAME,
      username: USERNAME,
      roundNo: session.roundNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      roundEndsAt: session.roundEndsAt,
      dropState: session.dropState,
      nextDropAt: session.nextDropAt,
      dropEndsAt: session.dropEndsAt,
      dancers: floor.map((p) => ({
        uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null,
        character: charById(p.character), energy: p.energy || 0,
        drinks: p.drinks || 0, table: p.table || null, isKing: !!(session.king && session.king.uid === p.uid),
      })),
      waiting: waiting.map((p) => ({
        uid: p.uid, name: p.name, character: charById(p.character),
        energy: p.energy || 0, table: p.table || null,
      })),
      floorCount: floor.length,
      waitingCount: waiting.length,
      totalDancers: dancers.length,
      top: top.map((p) => ({ uid: p.uid, name: p.name, character: charById(p.character), energy: p.energy || 0, drinks: p.drinks || 0, table: p.table || null })),
      tables,
      tableStreak: session.tableStreak,
      tableWinner: session.tableWinner,
      barCover: session.barCover,
      king: session.king,
      lastDrink: session.lastDrink,
      stats: session.stats,
      avatarStats: session.avatarStats,
      logs: session.logs.slice(-12),
      webhookCount: session.webhookCount,
      demoActive: session.demoActive,
      demoMode: settings.demoMode,
      voiceEnabled: settings.voiceEnabled,
      settings: {
        roundDurationS: settings.roundDurationS,
        tapEnergy: settings.tapEnergy,
        commentEnergy: settings.commentEnergy,
        coinToEnergy: settings.coinToEnergy,
        followEnergy: settings.followEnergy,
        dropIntervalS: settings.dropIntervalS,
        dropWarningS: settings.dropWarningS,
        dropDurationS: settings.dropDurationS,
        spotlightS: settings.spotlightS,
        commentSpamS: settings.commentSpamS,
        cameraMode: settings.cameraMode,
        shotIntervalS: settings.shotIntervalS,
        musicEnabled: settings.musicEnabled,
        volume: settings.volume,
        tempo: settings.tempo,
      },
      now: Date.now(),
    };
  }

  // -- detection ---------------------------------------------------------------
  function detectJoin(text) {
    if (!text) return false;
    const norm = normVi(text);
    const tokens = norm.split(/\s+/).filter(Boolean);
    return tokens.includes('vao') && tokens.includes('bar')
      || tokens.includes('join')
      || tokens.includes('quay');
  }
  function detectTable(text) {
    if (!text) return null;
    const norm = normVi(text);
    const tokens = norm.split(/\s+/).filter(Boolean);
    if (tokens.includes('ban') && tokens.includes('do')) return 'do';
    if (tokens.includes('ban') && tokens.includes('vang')) return 'vang';
    return null;
  }
  function detectCharacterPick(text) {
    if (!text) return null;
    const t = String(text).trim();
    if (/^[1-8]$/.test(t)) return Number(t);
    return null;
  }

  // -- round lifecycle ---------------------------------------------------------
  function startRound() {
    if (session.phase !== 'lobby') return;
    const now = Date.now();
    session.phase = 'dancing';
    session.roundEndsAt = now + settings.roundDurationS * 1000;
    session.nextDropAt = now + settings.dropIntervalS * 1000;
    session.dropState = 'idle';
    session.dropEndsAt = 0;
    session.king = null;
    session.tableWinner = null;
    log(`Vòng ${session.roundNo} bắt đầu (${settings.roundDurationS}s) — nhạc lên!`);
    saveSession();
    broadcast();
  }
  function endRound() {
    const now = Date.now();
    const top = topDancers(1);
    const king = top.length > 0 && (top[0].energy || 0) > 0 ? top[0] : null;
    session.king = king
      ? { uid: king.uid, name: king.name, energy: king.energy || 0, character: charById(king.character), at: now, roundNo: session.roundNo }
      : null;
    // Đấu bàn VIP: điểm bàn = tổng năng lượng + số ly.
    const tables = computeTableScores();
    let tableWinner = null;
    if (tables.vang.score !== tables.do.score) {
      tableWinner = tables.vang.score > tables.do.score ? 'vang' : 'do';
    }
    session.tableWinner = tableWinner;
    if (tableWinner) {
      session.tableStreak[tableWinner] += 1;
      session.tableStreak[tableWinner === 'vang' ? 'do' : 'vang'] = 0;
      if (session.tableStreak[tableWinner] >= 2) {
        session.barCover = { table: tableWinner, until: now + 60 * 1000 };
        session.tableStreak[tableWinner] = 0;
        log(`🔥 ${TABLE_NAMES[tableWinner]} thắng 2 vòng liên tiếp — BAO CẢ BAR 1 phút (x2 năng lượng)!`);
      }
    } else {
      session.tableStreak.vang = 0;
      session.tableStreak.do = 0;
    }
    session.phase = 'spotlight';
    session.phaseEndsAt = now + settings.spotlightS * 1000;
    if (king) {
      log(`👑 ${king.name} là Vua sàn nhảy vòng ${session.roundNo} (${king.energy} năng lượng)!`);
      ctx.io.emit('king', { uid: king.uid, name: king.name, text: `${king.name} là Vua sàn nhảy!` });
    } else {
      log(`Hết vòng ${session.roundNo}: chưa có ai nhảy (không có Vua).`);
    }
    if (tableWinner) log(`🏆 ${TABLE_NAMES[tableWinner]} thắng vòng (điểm ${tables[tableWinner].score} - ${tables[tableWinner === 'vang' ? 'do' : 'vang'].score}).`);
    saveSession();
    broadcast();
  }
  function resetRound() {
    session.roundNo += 1;
    session.phase = 'lobby';
    session.phaseEndsAt = 0;
    session.roundEndsAt = 0;
    session.dropState = 'idle';
    session.nextDropAt = 0;
    session.dropEndsAt = 0;
    session.tableWinner = null;
    for (const p of Object.values(session.players)) {
      p.energy = 0;
      p.drinks = 0;
      p.followedRound = false;
    }
    log(`Vòng ${session.roundNo} chuẩn bị — năng lượng về 0.`);
    saveSession();
    broadcast();
  }

  // -- players / energy --------------------------------------------------------
  function ensurePlayer(ev) {
    const uid = String(ev.uid || '');
    if (!uid) return null;
    let p = session.players[uid];
    if (!p) {
      p = {
        uid,
        name: ev.name || ev.nickname || uid,
        avatarUrl: ev.avatarUrl || null,
        isDancer: false,
        character: null,
        pickCharacter: null,
        table: null,
        energy: 0,
        drinks: 0,
        lastCommentAt: 0,
        followedRound: false,
        joinedAt: Date.now(),
        joinedBarAt: 0,
        left: false,
      };
      session.players[uid] = p;
      if (!session.avatarSeen[uid]) {
        session.avatarSeen[uid] = true;
        session.avatarStats.total += 1;
        if (ev.avatarUrl) session.avatarStats.withAvatar += 1;
      }
    } else {
      if (ev.name || ev.nickname) p.name = ev.name || ev.nickname;
      if (ev.avatarUrl) {
        if (!p.avatarUrl && !session.avatarSeen[uid]) session.avatarStats.withAvatar += 1;
        p.avatarUrl = ev.avatarUrl;
      }
      if (p.left) { p.left = false; p.joinedAt = Date.now(); }
    }
    return p;
  }
  function energyMultiplier(p) {
    if (session.barCover && session.barCover.until > Date.now() && p.table && p.table === session.barCover.table) return 2;
    return 1;
  }
  function addEnergy(p, amount) {
    if (!p || !p.isDancer || amount <= 0) return 0;
    const m = energyMultiplier(p);
    const total = amount * m;
    p.energy = (p.energy || 0) + total;
    return total;
  }

  // -- intake ----------------------------------------------------------------
  function handleIntake(ev) {
    if (!ev || !ev.uid) return { ok: false, reason: 'no-uid' };
    const kind = ev.kind;
    const now = Date.now();
    if (kind === 'join') {
      const p = ensurePlayer(ev);
      session.stats.joins += 1;
      if (p && !p.isDancer) log(`${p.name} vào phòng (chưa vào bar).`);
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'leave') {
      const p = session.players[String(ev.uid)];
      if (p && !p.left) {
        p.left = true;
        session.stats.leaves += 1;
        log(`${p.name} rời bar.`);
      }
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      const p = ensurePlayer(ev);
      if (!p) return { ok: false, reason: 'no-player' };
      const text = String(ev.text || ev.content || '');
      // Chọn nhân vật: bình luận số 1-8.
      const pick = detectCharacterPick(text);
      if (pick) {
        p.pickCharacter = pick;
        if (p.isDancer) {
          p.character = pick;
          log(`${p.name} đổi sang nhân vật ${charById(pick).name}.`);
        }
        saveSession(); broadcast();
        return { ok: true };
      }
      // Chọn bàn VIP.
      const table = detectTable(text);
      if (table) {
        if (p.table !== table) {
          p.table = table;
          log(`${p.name} chọn ${TABLE_NAMES[table]}.`);
        }
      }
      // Vào bar.
      if (detectJoin(text) && !p.isDancer) {
        p.isDancer = true;
        p.character = p.pickCharacter || (1 + Math.floor(Math.random() * 8));
        p.joinedBarAt = now;
        const floorCount = floorDancers().length;
        session.stats.joins += 1;
        log(`${p.name} vào bar làm ${charById(p.character).name} ${floorCount > MAX_FLOOR ? '(đứng quầy bar chờ lượt)' : '(lên sàn)'}.`);
        if (session.phase === 'lobby') startRound();
      }
      if (!p.isDancer) { saveSession(); broadcast(); return { ok: true }; }
      // Bình luận tính điểm (chống spam 1/5s).
      if (now - (p.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        saveSession(); broadcast();
        return { ok: false, reason: 'comment-spam' };
      }
      p.lastCommentAt = now;
      session.stats.comments += 1;
      addEnergy(p, settings.commentEnergy);
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'tap') {
      const p = ensurePlayer(ev);
      if (!p || !p.isDancer) { saveSession(); broadcast(); return { ok: true }; }
      const total = ev.totalLikeCount != null ? ev.totalLikeCount : (ev.likeCount != null ? ev.likeCount : null);
      const d = total !== null ? tapDelta.delta(String(ev.uid), total) : 1;
      if (d > 0) {
        session.stats.taps += d;
        let perTap = settings.tapEnergy;
        if (session.dropState === 'drop') perTap *= 2; // drop: tim x2
        addEnergy(p, d * perTap);
      }
      saveSession(); broadcast();
      return { ok: true, delta: d };
    }
    if (kind === 'gift') {
      const p = ensurePlayer(ev);
      const coins = ev.coins != null && Number.isFinite(Number(ev.coins)) ? Number(ev.coins) : null;
      if (!p || !p.isDancer) { saveSession(); broadcast(); return { ok: true }; }
      if (coins === null || Number.isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        console.warn(`[di-bar-online] unknown gift coins from ${ev.uid} (${ev.giftName || '?'})`);
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      session.stats.drinks += 1;
      const energy = Math.floor(coins) * settings.coinToEnergy;
      addEnergy(p, energy);
      p.drinks = (p.drinks || 0) + 1;
      const c = Math.floor(coins);
      let tier = 'drink';
      let msg = `${p.name} gọi 1 ly (+${energy} năng lượng).`;
      if (c >= 100) {
        tier = 'champagne';
        msg = `🍾 ${p.name} MỞ SÂM PANH (${c} xu)! Cả sàn phun sâm panh!`;
        ctx.io.emit('champagne', { uid: p.uid, name: p.name, text: `Mở sâm panh! Cảm ơn ${p.name}!` });
      } else if (c >= 50) {
        tier = 'bottle';
        msg = `🍾 ${p.name} gọi BOTTLE SERVICE (${c} xu)! Pháo giấy tung bay!`;
        ctx.io.emit('bottle', { uid: p.uid, name: p.name, text: `Cảm ơn ${p.name} đã gọi bottle service!` });
      } else if (c >= 10) {
        tier = 'cocktail';
        msg = `🍸 ${p.name} gọi cocktail (${c} xu) — xoay người, hất tóc!`;
      }
      session.lastDrink = { tier, uid: p.uid, name: p.name, coins: c, at: now };
      log(msg);
      saveSession(); broadcast();
      return { ok: true, energy, tier };
    }
    if (kind === 'follow') {
      const p = ensurePlayer(ev);
      session.stats.follows += 1;
      if (p && p.isDancer && !p.followedRound) {
        p.followedRound = true;
        addEnergy(p, settings.followEnergy);
      }
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'share') {
      const p = ensurePlayer(ev);
      session.stats.shares += 1;
      saveSession(); broadcast();
      return { ok: true };
    }
    return { ok: false, reason: 'unknown-kind' };
  }

  // -- tick ------------------------------------------------------------------
  function tick() {
    const now = Date.now();
    if (session.phase === 'lobby') {
      if (floorDancers().length > 0) startRound();
      return;
    }
    if (session.phase === 'dancing') {
      // DJ drop: báo trước dropWarningS, drop dropDurationS, rồi hẹn vòng sau.
      if (session.dropState === 'idle' && session.nextDropAt && now >= session.nextDropAt - settings.dropWarningS * 1000) {
        session.dropState = 'warning';
        log('🎧 DJ chuẩn bị DROP trong 10s — sẵn sàng quẩy!');
        ctx.io.emit('drop-warning', { text: 'DJ sắp drop!' });
        saveSession(); broadcast();
      } else if (session.dropState === 'warning' && session.nextDropAt && now >= session.nextDropAt) {
        session.dropState = 'drop';
        session.dropEndsAt = now + settings.dropDurationS * 1000;
        session.stats.drops += 1;
        log('🔥 DJ DROP! Tim x2 trong 15s!');
        ctx.io.emit('drop', { text: 'DJ drop! Tim nhân đôi!' });
        saveSession(); broadcast();
      } else if (session.dropState === 'drop' && session.dropEndsAt && now >= session.dropEndsAt) {
        session.dropState = 'idle';
        session.nextDropAt = now + settings.dropIntervalS * 1000;
        saveSession(); broadcast();
      }
      if (session.roundEndsAt && now >= session.roundEndsAt) endRound();
      return;
    }
    if (session.phase === 'spotlight') {
      if (session.phaseEndsAt && now >= session.phaseEndsAt) resetRound();
    }
  }

  // -- demo ------------------------------------------------------------------
  function demoUid(name) { return 'demo_' + name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); }
  function startDemo() {
    if (session.webhookCount > 0) {
      return { success: false, reason: 'real-events-present', message: 'Phòng đã có sự kiện thật, không chạy demo được.' };
    }
    if (!settings.demoMode) {
      return { success: false, message: 'Bật chế độ thử trước rồi mới chạy demo.' };
    }
    if (session.demoActive) return { success: true, demoActive: true, message: 'Demo đang chạy.' };
    DEMO_NAMES.forEach((name, i) => {
      const uid = demoUid(name);
      const p = ensurePlayer({ uid, name: `Demo ${name}` });
      if (p) {
        p.isDancer = true;
        p.character = (i % 8) + 1;
        p.table = i % 2 === 0 ? 'vang' : 'do';
        p.joinedBarAt = Date.now() + i;
        p.left = false;
      }
      handleIntake({ kind: 'tap', uid, name: `Demo ${name}`, totalLikeCount: 0 });
    });
    if (session.phase === 'lobby') startRound();
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 12 dancer demo quẩy trên sàn.');
    const step = () => {
      if (!session.demoActive) return;
      const demoPlayers = Object.values(session.players).filter((p) => p.uid.startsWith('demo_') && !p.left);
      if (demoPlayers.length === 0) return;
      const me = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
      const r = Math.random();
      if (r < 0.5) {
        demoTapTotals[me.uid] = (demoTapTotals[me.uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid: me.uid, name: me.name, totalLikeCount: demoTapTotals[me.uid] });
      } else if (r < 0.68) {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
      } else if (r < 0.85) {
        const coins = [1, 5, 10, 50][Math.floor(Math.random() * 4)];
        handleIntake({ kind: 'gift', uid: me.uid, name: me.name, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.93) {
        handleIntake({ kind: 'follow', uid: me.uid, name: me.name });
      } else {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: Math.random() < 0.5 ? 'bàn vàng' : 'bàn đỏ' });
      }
    };
    demoTimer = timers.setInterval(step, 2000);
    saveSession();
    broadcast();
    return { success: true, demoActive: true };
  }
  function stopDemo(reason) {
    if (demoTimer) { timers.clearInterval(demoTimer); demoTimer = null; }
    if (!session.demoActive) return { success: true, demoActive: false };
    session.demoActive = false;
    log(`🧪 Demo đã dừng${reason ? ' — ' + reason : ''}.`);
    saveSession();
    broadcast();
    return { success: true, demoActive: false };
  }
  function demoOneShot() {
    DEMO_NAMES.slice(0, 6).forEach((name, i) => {
      const uid = demoUid(name);
      const p = ensurePlayer({ uid, name: `Demo ${name}` });
      if (p) {
        p.isDancer = true;
        p.character = (i % 8) + 1;
        p.table = i % 2 === 0 ? 'vang' : 'do';
        p.joinedBarAt = Date.now() + i;
        p.left = false;
      }
    });
    if (session.phase === 'lobby') startRound();
    const u0 = demoUid(DEMO_NAMES[0]);
    const u1 = demoUid(DEMO_NAMES[1]);
    handleIntake({ kind: 'tap', uid: u0, name: 'Demo An', totalLikeCount: 0 });
    handleIntake({ kind: 'tap', uid: u0, name: 'Demo An', totalLikeCount: 12 });
    handleIntake({ kind: 'gift', uid: u1, name: 'Demo Bình', coins: 10, giftName: 'Quà demo' });
    saveSession(); broadcast();
    return { ok: true };
  }

  // -- routes ----------------------------------------------------------------
  const router = ctx.router;
  router.use(express.json());
  // TikFinity gửi body dạng form-urlencoded cố định.
  router.use(express.urlencoded({ extended: true }));
  router.use(express.static(path.join(__dirname, 'public')));

  router.post('/api/webhook', (req, res) => {
    session.webhookCount += 1;
    if (session.demoActive) {
      stopDemo('có sự kiện thật từ LIVE');
      settings.demoMode = false;
      saveSettings();
    }
    if (settings.demoMode) {
      saveSession();
      return res.json({ received: true, ok: false, reason: 'demo-mode' });
    }
    const ev = parseTikFinityEvent(req.body || {}, req.query || {});
    if (!ev) {
      saveSession();
      return res.json({ received: true, ok: false, reason: 'unrecognized', hint: 'Webhook chưa nhận diện: ' + String(JSON.stringify(req.body || {})).slice(0, 300) });
    }
    const out = handleIntake(ev);
    res.json({ received: true, kind: ev.kind, ...out });
  });

  router.get('/api/state', (req, res) => res.json(statePayload()));

  router.get('/api/tikfinity-actions', (req, res) => {
    const base = webhookUrl(GAME, USERNAME, publicBaseUrl(req));
    res.json({
      webhookUrl: base,
      actions: TIKFINITY_ACTIONS.map((a) => ({ ...a, url: `${base}?event=${a.key}` })),
    });
  });

  router.post('/api/settings', (req, res) => {
    const b = req.body || {};
    if (b.roundDurationS !== undefined) settings.roundDurationS = clampInt(b.roundDurationS, 5, 1800, settings.roundDurationS);
    if (b.tapEnergy !== undefined) settings.tapEnergy = clampInt(b.tapEnergy, 1, 10, settings.tapEnergy);
    if (b.commentEnergy !== undefined) settings.commentEnergy = clampInt(b.commentEnergy, 1, 50, settings.commentEnergy);
    if (b.coinToEnergy !== undefined) settings.coinToEnergy = clampInt(b.coinToEnergy, 1, 100, settings.coinToEnergy);
    if (b.followEnergy !== undefined) settings.followEnergy = clampInt(b.followEnergy, 0, 100, settings.followEnergy);
    if (b.dropIntervalS !== undefined) settings.dropIntervalS = clampInt(b.dropIntervalS, 5, 600, settings.dropIntervalS);
    if (b.dropWarningS !== undefined) settings.dropWarningS = clampInt(b.dropWarningS, 1, 60, settings.dropWarningS);
    if (b.dropDurationS !== undefined) settings.dropDurationS = clampInt(b.dropDurationS, 2, 120, settings.dropDurationS);
    if (b.spotlightS !== undefined) settings.spotlightS = clampInt(b.spotlightS, 1, 120, settings.spotlightS);
    if (b.commentSpamS !== undefined) settings.commentSpamS = clampInt(b.commentSpamS, 1, 60, settings.commentSpamS);
    if (b.cameraMode !== undefined && (b.cameraMode === 'auto' || b.cameraMode === 'manual')) settings.cameraMode = b.cameraMode;
    if (b.shotIntervalS !== undefined) settings.shotIntervalS = clampInt(b.shotIntervalS, 3, 30, settings.shotIntervalS);
    if (b.musicEnabled !== undefined) settings.musicEnabled = !!b.musicEnabled;
    if (b.volume !== undefined) settings.volume = clampInt(b.volume, 0, 100, settings.volume);
    if (b.tempo !== undefined) settings.tempo = clampInt(b.tempo, 60, 180, settings.tempo);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    res.json({ success: true, settings });
    broadcast();
  });
  router.post('/api/round/end', (req, res) => {
    if (session.phase === 'dancing') { endRound(); res.json({ success: true, phase: session.phase }); }
    else res.json({ success: false, message: 'Không có vòng đang diễn ra.' });
  });
  router.post('/api/round/reset', (req, res) => { resetRound(); res.json({ success: true, roundNo: session.roundNo }); });

  // ---- Endpoint test (chỉ chạy khi demoMode bật) ----
  function needDemo(req, res) {
    if (!settings.demoMode) {
      res.status(403).json({ success: false, message: 'Bật chế độ thử trước.' });
      return false;
    }
    return true;
  }
  function testUser(name) {
    const uid = 'test_' + Math.random().toString(36).slice(2, 8);
    return { uid, name: name || 'Người thử' };
  }
  router.post('/api/demo/start', (req, res) => {
    if (!needDemo(req, res)) return;
    res.json(startDemo());
  });
  router.post('/api/demo/stop', (req, res) => {
    if (!needDemo(req, res)) return;
    res.json(stopDemo());
  });
  router.post('/api/test/demo', (req, res) => {
    if (!needDemo(req, res)) return;
    const action = (req.body && req.body.action) || 'once';
    if (action === 'start') return res.json(startDemo());
    if (action === 'stop') return res.json(stopDemo());
    res.json(demoOneShot());
  });
  router.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(500, Number(b.count) || 20));
    const tp = session.players['test-tapper'];
    if (!tp || !tp.isDancer) {
      handleIntake({ kind: 'comment', uid: 'test-tapper', name: 'Người thử tim', text: 'vào bar' });
    }
    if (testTapTotals['test-tapper'] === undefined) {
      testTapTotals['test-tapper'] = 0;
      handleIntake({ kind: 'tap', uid: 'test-tapper', name: 'Người thử tim', totalLikeCount: 0 });
    }
    testTapTotals['test-tapper'] += count;
    handleIntake({ kind: 'tap', uid: 'test-tapper', name: 'Người thử tim', totalLikeCount: testTapTotals['test-tapper'] });
    res.json({ success: true, count });
  });
  router.post('/api/test/comment', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: b.text || 'quẩy' });
    res.json({ success: true, uid: b.uid || u.uid });
  });
  router.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    const r = handleIntake({ kind: 'gift', uid: b.uid || u.uid, name: b.name || u.name, coins: b.coins != null ? Number(b.coins) : 10, giftName: b.giftName || 'Quà thử' });
    res.json({ success: !!r.ok, ...r });
  });
  router.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    const r = handleIntake({ kind: 'follow', uid: b.uid || u.uid, name: b.name || u.name });
    res.json({ success: !!r.ok, ...r });
  });
  router.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    const r = handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: 'vào bar' });
    res.json({ success: !!r.ok, ...r });
  });
  router.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(200, Number(b.count) || 50));
    for (let i = 0; i < count; i++) {
      const uid = `test_bulk_${i}`;
      const p = ensurePlayer({ uid, name: `Người xem ${i + 1}` });
      if (p) {
        p.isDancer = true;
        p.character = (i % 8) + 1;
        p.table = i % 2 === 0 ? 'vang' : 'do';
        p.joinedBarAt = Date.now() + i;
        p.left = false;
      }
    }
    if (session.phase === 'lobby') startRound();
    saveSession(); broadcast();
    res.json({ success: true, count, floorCount: Math.min(count, MAX_FLOOR), waitingCount: Math.max(0, count - MAX_FLOOR) });
  });

  mountTts(router, DATA_DIR);
  timers.setInterval(tick, 1000);
  timers.setInterval(() => saveSession(), 10000);

  return {
    type: 'express',
    router,
    io: ctx.io,
    destroy() { stopDemo(); timers.clearAll(); },
  };
}

module.exports = createEngine;
