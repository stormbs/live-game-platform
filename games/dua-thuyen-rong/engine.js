// ĐUA THUYỀN RỒNG — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-dua-thuyen-rong.md:
// 2 đội Vàng vs Đỏ chèo thuyền rồng 500m. 1 tim (delta) = +1m; 1 bình luận
// tính điểm (chống spam 1/5s) = +5m; 1 xu quà = +5m; follow +20m (1 lần/đua).
// Combo trống: trong cửa sổ 2s có >=10 tim của cùng 1 đội -> trống dồn:
// đội đó +10m thưởng + hiệu ứng trống (tối đa 1 combo/5s/đội).
// Thuyền nào chạm đích trước thắng; tối đa 5 phút — hết giờ, thuyền xa hơn
// thắng. Vinh danh 30s (rồng phun lửa + TTS xướng tên đội thắng) -> đua mới,
// đội giữ nguyên, mét về 0. Mỗi thuyền tối đa 12 người chèo hiện trên thuyền
// (người vào sau vẫn tính mét nhưng đứng ở bờ cổ vũ).
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
  const GAME = 'dua-thuyen-rong';
  const GAME_NAME_VI = 'Đua Thuyền Rồng';
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

  const TEAM_NAMES = { vang: 'Đội Vàng', do: 'Đội Đỏ' };
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_CHEERS = ['Chèo đi!', 'Mạnh tay lên!', 'Nhịp đều nào!', 'Về đích thôi!', 'Cố lên cả đội!'];

  const defaultSettings = {
    raceDistanceM: 500,   // cự ly đua (m)
    tapM: 1,              // mét / 1 tim (delta)
    commentM: 5,          // mét / 1 bình luận tính điểm
    coinToM: 5,           // mét / 1 xu quà
    followM: 20,          // mét follow (1 lần/đua)
    comboThreshold: 10,   // số tim trong cửa sổ để kích combo
    comboWindowS: 2,      // cửa sổ combo (giây)
    comboCooldownS: 5,    // giãn cách combo/đội (giây)
    comboBonusM: 10,      // mét thưởng khi combo
    raceDurationS: 300,   // thời gian tối đa 1 cuộc đua (giây)
    spotlightS: 30,       // vinh danh đội thắng (giây)
    commentSpamS: 5,      // chống spam bình luận (giây/người)
    demoMode: false,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      raceNo: 1,
      phase: 'lobby',       // lobby | racing | spotlight
      phaseEndsAt: 0,
      raceEndsAt: 0,
      meters: { vang: 0, do: 0 },
      combos: { vang: 0, do: 0 },
      players: {},          // uid -> player
      winner: null,         // { team, meters, reason, at }
      logs: [],
      stats: { joins: 0, comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, leaves: 0 },
      avatarStats: { total: 0, withAvatar: 0 },
      avatarSeen: {},
      webhookCount: 0,
      demoActive: false,
      createdAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players) session.players = {};
  if (!session.meters) session.meters = { vang: 0, do: 0 };
  if (!session.combos) session.combos = { vang: 0, do: 0 };
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  session.demoActive = false; // demo không sống qua restart
  if (session.phase === 'racing') session.phase = 'lobby';
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  const testTapTotals = {};
  const demoTapTotals = {};
  let demoTimer = null;
  // Combo: mốc thời gian từng tim theo đội (chỉ trong bộ nhớ, không lưu đĩa).
  const tapTimes = { vang: [], do: [] };
  const lastComboAt = { vang: 0, do: 0 };

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

  function statePayload() {
    const players = Object.values(session.players)
      .filter((p) => !p.left)
      .sort((a, b) => (b.metersRace || 0) - (a.metersRace || 0));
    const byTeam = { vang: [], do: [], none: [] };
    for (const p of players) byTeam[p.team || 'none'].push(p);
    return {
      game: GAME,
      username: USERNAME,
      raceNo: session.raceNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      raceEndsAt: session.raceEndsAt,
      raceDistanceM: settings.raceDistanceM,
      meters: session.meters,
      progress: {
        vang: Math.min(100, (session.meters.vang / settings.raceDistanceM) * 100),
        do: Math.min(100, (session.meters.do / settings.raceDistanceM) * 100),
      },
      combos: session.combos,
      players: players.slice(0, 48).map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarUrl: p.avatarUrl || null,
        team: p.team || null,
        meters: p.metersRace || 0,
        left: !!p.left,
      })),
      rowers: {
        vang: byTeam.vang.slice(0, 12).map((p) => ({ name: p.name, meters: p.metersRace || 0 })),
        do: byTeam.do.slice(0, 12).map((p) => ({ name: p.name, meters: p.metersRace || 0 })),
      },
      teamCounts: { vang: byTeam.vang.length, do: byTeam.do.length, none: byTeam.none.length },
      top: {
        vang: byTeam.vang.slice(0, 5).map((p) => ({ name: p.name, meters: p.metersRace || 0 })),
        do: byTeam.do.slice(0, 5).map((p) => ({ name: p.name, meters: p.metersRace || 0 })),
      },
      stats: session.stats,
      avatarStats: session.avatarStats,
      logs: session.logs.slice(-12),
      winner: session.winner,
      webhookCount: session.webhookCount,
      demoActive: session.demoActive,
      demoMode: settings.demoMode,
      voiceEnabled: settings.voiceEnabled,
      settings: {
        raceDistanceM: settings.raceDistanceM,
        tapM: settings.tapM,
        commentM: settings.commentM,
        coinToM: settings.coinToM,
        followM: settings.followM,
        comboThreshold: settings.comboThreshold,
        comboWindowS: settings.comboWindowS,
        comboCooldownS: settings.comboCooldownS,
        comboBonusM: settings.comboBonusM,
        raceDurationS: settings.raceDurationS,
        spotlightS: settings.spotlightS,
        commentSpamS: settings.commentSpamS,
      },
      now: Date.now(),
    };
  }

  // -- team detection --------------------------------------------------------
  function detectTeam(text) {
    if (!text) return null;
    const raw = String(text).toLowerCase();
    const tokens = raw.replace(/[.,!?;:()\[\]{}"'“”]/g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.includes('đỏ') || tokens.includes('do')) return 'do';
    if (tokens.includes('vàng') || tokens.includes('vang')) return 'vang';
    if (tokens.includes('1')) return 'vang';
    if (tokens.includes('2')) return 'do';
    return null;
  }
  function teamCounts() {
    let vang = 0; let doN = 0;
    for (const p of Object.values(session.players)) {
      if (p.left) continue;
      if (p.team === 'vang') vang++;
      else if (p.team === 'do') doN++;
    }
    return { vang, do: doN };
  }

  // -- race lifecycle --------------------------------------------------------
  function startRace() {
    if (session.phase !== 'lobby') return;
    const now = Date.now();
    session.phase = 'racing';
    session.raceEndsAt = now + settings.raceDurationS * 1000;
    session.winner = null;
    log(`Cuộc đua ${session.raceNo} bắt đầu (${settings.raceDistanceM}m, tối đa ${settings.raceDurationS}s).`);
    saveSession();
    broadcast();
  }
  function endRace(winnerTeam, reason) {
    const now = Date.now();
    session.winner = {
      team: winnerTeam,
      meters: { vang: session.meters.vang, do: session.meters.do },
      reason,
      at: now,
    };
    session.phase = 'spotlight';
    session.phaseEndsAt = now + settings.spotlightS * 1000;
    if (winnerTeam) {
      log(`Hết đua: ${TEAM_NAMES[winnerTeam]} thắng (${reason}).`);
      ctx.io.emit('race-win', { team: winnerTeam, text: `${TEAM_NAMES[winnerTeam]} về nhất!` });
    } else {
      log(`Hết đua: hòa (${reason}).`);
      ctx.io.emit('race-win', { team: null, text: 'Cuộc đua kết thúc với tỷ số hòa!' });
    }
    saveSession();
    broadcast();
  }
  function checkFinish() {
    if (session.phase !== 'racing') return;
    if (session.meters.vang >= settings.raceDistanceM && session.meters.do >= settings.raceDistanceM) {
      const w = session.meters.vang === session.meters.do ? null : (session.meters.vang > session.meters.do ? 'vang' : 'do');
      endRace(w, w ? `cả 2 cùng chạm đích, ${TEAM_NAMES[w]} xa hơn` : 'cả 2 cùng chạm đích cùng lúc');
    } else if (session.meters.vang >= settings.raceDistanceM) {
      endRace('vang', `chạm đích ${settings.raceDistanceM}m trước`);
    } else if (session.meters.do >= settings.raceDistanceM) {
      endRace('do', `chạm đích ${settings.raceDistanceM}m trước`);
    }
  }
  function resetRace() {
    session.raceNo += 1;
    session.phase = 'lobby';
    session.phaseEndsAt = 0;
    session.raceEndsAt = 0;
    session.meters = { vang: 0, do: 0 };
    session.winner = null;
    tapTimes.vang = [];
    tapTimes.do = [];
    lastComboAt.vang = 0;
    lastComboAt.do = 0;
    for (const p of Object.values(session.players)) {
      p.metersRace = 0;
      p.followedRace = false;
    }
    log(`Cuộc đua ${session.raceNo} chuẩn bị (đội giữ nguyên).`);
    saveSession();
    broadcast();
  }

  // -- players / meters ------------------------------------------------------
  function ensurePlayer(ev) {
    const uid = String(ev.uid || '');
    if (!uid) return null;
    let p = session.players[uid];
    if (!p) {
      p = {
        uid,
        name: ev.name || ev.nickname || uid,
        avatarUrl: ev.avatarUrl || null,
        team: null,
        metersRace: 0,
        lastCommentAt: 0,
        followedRace: false,
        joinedAt: Date.now(),
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
  function addMeters(p, amount) {
    if (!p || !p.team || amount <= 0) return false;
    session.meters[p.team] += amount;
    p.metersRace = (p.metersRace || 0) + amount;
    return true;
  }
  // Combo trống: >= threshold tim của cùng 1 đội trong cửa sổ -> +thưởng.
  function noteTaps(team, count) {
    if (!team || count <= 0) return;
    const now = Date.now();
    const win = settings.comboWindowS * 1000;
    const arr = tapTimes[team];
    for (let i = 0; i < count; i++) arr.push(now);
    while (arr.length && now - arr[0] > win) arr.shift();
    if (arr.length >= settings.comboThreshold && now - lastComboAt[team] >= settings.comboCooldownS * 1000) {
      lastComboAt[team] = now;
      session.combos[team] += 1;
      session.meters[team] += settings.comboBonusM;
      log(`🥁 Trống dồn! ${TEAM_NAMES[team]} +${settings.comboBonusM}m thưởng.`);
      ctx.io.emit('drum', { team, text: 'Trống dồn!' });
      checkFinish();
    }
  }

  // -- intake ----------------------------------------------------------------
  function handleIntake(ev) {
    if (!ev || !ev.uid) return { ok: false, reason: 'no-uid' };
    const kind = ev.kind;
    const now = Date.now();
    if (kind === 'join') {
      const p = ensurePlayer(ev);
      session.stats.joins += 1;
      if (p && !p.team) log(`${p.name} vào phòng (chưa chọn đội).`);
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'leave') {
      const p = session.players[String(ev.uid)];
      if (p && !p.left) {
        p.left = true;
        session.stats.leaves += 1;
        log(`${p.name} rời live.`);
      }
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'comment') {
      const p = ensurePlayer(ev);
      if (!p) return { ok: false, reason: 'no-player' };
      const text = String(ev.text || ev.content || '');
      const team = detectTeam(text);
      if (team) {
        if (session.phase !== 'racing') {
          if (p.team !== team) {
            p.team = team;
            log(`${p.name} vào ${TEAM_NAMES[team]}.`);
          }
        } else if (p.team && p.team !== team) {
          log(`${p.name} muốn đổi sang ${TEAM_NAMES[team]} — chỉ đổi được giữa các cuộc đua.`);
        } else if (!p.team) {
          p.team = team;
          log(`${p.name} vào ${TEAM_NAMES[team]}.`);
        }
      }
      // Đua tự bắt đầu khi cả 2 đội đều có người (ngay trong intake).
      if (session.phase === 'lobby') {
        const c = teamCounts();
        if (c.vang > 0 && c.do > 0) startRace();
      }
      if (!p.team) { saveSession(); broadcast(); return { ok: true }; }
      if (now - (p.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        saveSession(); broadcast();
        return { ok: false, reason: 'comment-spam' };
      }
      p.lastCommentAt = now;
      session.stats.comments += 1;
      addMeters(p, settings.commentM);
      checkFinish();
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'tap') {
      const p = ensurePlayer(ev);
      if (!p || !p.team) { saveSession(); broadcast(); return { ok: true }; }
      const total = ev.totalLikeCount != null ? ev.totalLikeCount : (ev.likeCount != null ? ev.likeCount : null);
      const d = total !== null ? tapDelta.delta(String(ev.uid), total) : 1;
      if (d > 0) {
        session.stats.taps += d;
        addMeters(p, d * settings.tapM);
        noteTaps(p.team, d);
        checkFinish();
      }
      saveSession(); broadcast();
      return { ok: true, delta: d };
    }
    if (kind === 'gift') {
      const p = ensurePlayer(ev);
      const coins = ev.coins != null && Number.isFinite(Number(ev.coins)) ? Number(ev.coins) : null;
      if (!p || !p.team) { saveSession(); broadcast(); return { ok: true }; }
      if (coins === null || Number.isNaN(coins) || coins < 1) {
        session.stats.giftsUnknown += 1;
        console.warn(`[dua-thuyen-rong] unknown gift coins from ${ev.uid} (${ev.giftName || '?'})`);
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const m = Math.floor(coins) * settings.coinToM;
      addMeters(p, m);
      log(`${p.name} tặng ${coins} xu -> +${m}m.`);
      checkFinish();
      saveSession(); broadcast();
      return { ok: true, meters: m };
    }
    if (kind === 'follow') {
      const p = ensurePlayer(ev);
      session.stats.follows += 1;
      if (p && p.team && !p.followedRace) {
        p.followedRace = true;
        addMeters(p, settings.followM);
        checkFinish();
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
      const c = teamCounts();
      if (c.vang > 0 && c.do > 0) startRace();
      return;
    }
    if (session.phase === 'racing') {
      if (session.raceEndsAt && now >= session.raceEndsAt) {
        const mv = session.meters.vang;
        const md = session.meters.do;
        if (mv === md) endRace(null, `hết giờ, hòa ${mv} - ${md}m`);
        else endRace(mv > md ? 'vang' : 'do', `hết giờ, xa hơn ${Math.max(mv, md)}m`);
      }
      return;
    }
    if (session.phase === 'spotlight') {
      if (session.phaseEndsAt && now >= session.phaseEndsAt) resetRace();
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
        p.team = i % 2 === 0 ? 'vang' : 'do';
        p.left = false;
      }
      handleIntake({ kind: 'tap', uid, name: `Demo ${name}`, totalLikeCount: 0 });
    });
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.vang > 0 && c.do > 0) startRace();
    }
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 12 người demo chèo 2 thuyền.');
    const step = () => {
      if (!session.demoActive) return;
      const demoPlayers = Object.values(session.players).filter((p) => p.uid.startsWith('demo_') && !p.left);
      if (demoPlayers.length === 0) return;
      const me = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
      const r = Math.random();
      if (r < 0.5) {
        demoTapTotals[me.uid] = (demoTapTotals[me.uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid: me.uid, name: me.name, totalLikeCount: demoTapTotals[me.uid] });
      } else if (r < 0.7) {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
      } else if (r < 0.85) {
        const coins = [1, 5, 10][Math.floor(Math.random() * 3)];
        handleIntake({ kind: 'gift', uid: me.uid, name: me.name, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.93) {
        handleIntake({ kind: 'follow', uid: me.uid, name: me.name });
      } else {
        handleIntake({ kind: 'share', uid: me.uid, name: me.name });
      }
    };
    demoTimer = timers.setInterval(step, 2500);
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
        p.team = i % 2 === 0 ? 'vang' : 'do';
        p.left = false;
      }
    });
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.vang > 0 && c.do > 0) startRace();
    }
    const u0 = demoUid(DEMO_NAMES[0]);
    const u1 = demoUid(DEMO_NAMES[1]);
    handleIntake({ kind: 'tap', uid: u0, name: 'Demo An', totalLikeCount: 0 });
    handleIntake({ kind: 'tap', uid: u0, name: 'Demo An', totalLikeCount: 12 });
    handleIntake({ kind: 'gift', uid: u1, name: 'Demo Bình', coins: 5, giftName: 'Quà demo' });
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
    if (b.raceDistanceM !== undefined) settings.raceDistanceM = clampInt(b.raceDistanceM, 5, 2000, settings.raceDistanceM);
    if (b.tapM !== undefined) settings.tapM = clampInt(b.tapM, 1, 10, settings.tapM);
    if (b.commentM !== undefined) settings.commentM = clampInt(b.commentM, 1, 50, settings.commentM);
    if (b.coinToM !== undefined) settings.coinToM = clampInt(b.coinToM, 1, 100, settings.coinToM);
    if (b.followM !== undefined) settings.followM = clampInt(b.followM, 0, 100, settings.followM);
    if (b.comboThreshold !== undefined) settings.comboThreshold = clampInt(b.comboThreshold, 2, 50, settings.comboThreshold);
    if (b.comboWindowS !== undefined) settings.comboWindowS = clampInt(b.comboWindowS, 1, 10, settings.comboWindowS);
    if (b.comboCooldownS !== undefined) settings.comboCooldownS = clampInt(b.comboCooldownS, 1, 30, settings.comboCooldownS);
    if (b.comboBonusM !== undefined) settings.comboBonusM = clampInt(b.comboBonusM, 0, 100, settings.comboBonusM);
    if (b.raceDurationS !== undefined) settings.raceDurationS = clampInt(b.raceDurationS, 5, 1800, settings.raceDurationS);
    if (b.spotlightS !== undefined) settings.spotlightS = clampInt(b.spotlightS, 1, 120, settings.spotlightS);
    if (b.commentSpamS !== undefined) settings.commentSpamS = clampInt(b.commentSpamS, 1, 60, settings.commentSpamS);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    res.json({ success: true, settings });
    broadcast();
  });
  router.post('/api/race/reset', (req, res) => { resetRace(); res.json({ success: true, raceNo: session.raceNo }); });

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
    res.json(demoOneShot());
  });
  router.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(500, Number(b.count) || 20));
    // Người thử tim chưa có đội thì cho vào đội Vàng để nút bấm thấy thuyền chạy.
    const tp = session.players['test-tapper'];
    if (!tp || !tp.team) {
      handleIntake({ kind: 'comment', uid: 'test-tapper', name: 'Người thử tim', text: 'vàng' });
    }
    // Gieo baseline tap = 0 trước để lần bấm đầu tiên đã có delta thật
    // (TapDelta lần đầu gặp uid luôn trả 0).
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
    handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: b.text || 'vàng cố lên!' });
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
    const r = handleIntake({ kind: 'join', uid: b.uid || u.uid, name: b.name || u.name });
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
        p.team = i % 2 === 0 ? 'vang' : 'do';
        p.left = false;
      }
    }
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.vang > 0 && c.do > 0) startRace();
    }
    saveSession(); broadcast();
    res.json({ success: true, count, teamCounts: teamCounts() });
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
