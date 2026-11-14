// CHIẾM CỜ — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-chiem-co.md:
// 2 đội Xanh vs Đỏ tranh 3 lá cờ (Trái / Giữa / Phải). Trong mỗi cửa sổ 30s,
// đội nào có tổng lực cao hơn ở 1 cờ thì chiếm được cờ đó (hòa lực -> không
// đổi chủ). Giữ cờ: +1 điểm/giây/cờ, cờ Giữa x2. Trận 10 phút: nhiều điểm hơn
// thắng; hòa điểm -> nhiều cờ hơn thắng; vẫn hòa -> đội chiếm cờ cuối thắng.
// Lực: 1 tim (delta) = +1; 1 bình luận tính điểm (chống spam 1/5s) = +5;
// 1 xu quà = +20 lực; follow +30 (1 lần/trận); share +15 (1 lần/trận).
// Người chưa chọn đội không tính lực. Quà không rõ xu -> 0 + log WARN.
// Chọn cờ để đánh: bình luận "cờ trái" / "cờ giữa" / "cờ phải" (hoặc chỉ
// "trái" / "giữa" / "phải"); mặc định cờ Giữa. (Bổ sung thiết kế: file gốc
// chỉ nói "tổng lực cao hơn ở 1 cờ" mà không ghi cách chọn cờ — chọn bằng
// từ khóa cờ là cách duy nhất để lực từng cờ khác nhau, nếu không cả 3 cờ
// luôn đổi chủ cùng lúc và cờ Giữa x2 điểm trở nên vô nghĩa.)
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
  // form cố định (value1/value2/value3/content/avatar_url) KÈM trường event.
  // Cơ chế đúng (1-Action, Chủ tịch chốt 2026-11-13): 1 Action webhook duy
  // nhất với URL gốc của phòng (không ?event=), mọi Event đều trỏ vào Action
  // đó; máy chủ đọc loại sự kiện từ trường event trong body. Đường dự phòng:
  // 6 URL ?event=<loại> + 6 Action riêng (chỉ dùng khi TikFinity không gửi
  // trường event). (Parser đọc form do CEO sửa ở lib/game-common.js —
  // engine này không chạm file đó.)
  const GAME = 'chiem-co';
  const GAME_NAME_VI = 'Chiếm Cờ';
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

  const FLAGS = [
    { id: 'left', name: 'Trái' },
    { id: 'mid', name: 'Giữa' },
    { id: 'right', name: 'Phải' },
  ];
  const FLAG_IDS = FLAGS.map((f) => f.id);
  // Tên đội hiển thị lấy từ settings (dashboard "Tùy chỉnh đội") để TTS/log
  // dùng đúng tên mới; mặc định 'Đội Xanh'/'Đội Đỏ' như trước.
  function teamLabel(team) {
    const n = team === 'xanh' ? settings.teamXanhName : settings.teamDoName;
    const clean = String(n || '').trim();
    return 'Đội ' + (clean || (team === 'xanh' ? 'Xanh' : 'Đỏ'));
  }
  const FLAG_NAMES = { left: 'cờ Trái', mid: 'cờ Giữa', right: 'cờ Phải' };
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_FOCUS = ['left', 'mid', 'right'];
  const DEMO_CHEERS = ['Cố lên!', 'Chiếm cờ đi!', 'Giữ cờ Giữa nha!', 'Đừng để mất cờ!', 'Mạnh nữa lên!'];

  const defaultSettings = {
    windowS: 30,          // cửa sổ chiếm cờ (giây)
    pointsPerFlagS: 1,    // điểm/giây/cờ
    midMultiplier: 2,     // hệ số cờ Giữa
    matchDurationS: 600,  // thời gian trận (giây)
    tapForce: 1,          // lực / 1 tim (delta)
    commentForce: 5,      // lực / 1 bình luận tính điểm
    coinToForce: 20,      // lực / 1 xu quà
    followForce: 30,      // lực follow (1 lần/trận)
    shareForce: 15,       // lực share (1 lần/trận)
    spotlightS: 30,       // vinh danh đội thắng (giây)
    commentSpamS: 5,      // chống spam bình luận (giây/người)
    demoMode: false,
    voiceEnabled: true,
    teamXanhName: 'Xanh',   // tên đội Xanh (dashboard "Tùy chỉnh đội")
    teamDoName: 'Đỏ',       // tên đội Đỏ
    teamXanhBg: '',         // ảnh nền đội Xanh (URL http(s) hoặc /shared/..., '' = không ảnh)
    teamDoBg: '',           // ảnh nền đội Đỏ
    teamXanhColor: '#0284C7', // màu chủ đạo đội Xanh
    teamDoColor: '#DC2626',   // màu chủ đạo đội Đỏ
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function emptyFlags() {
    const out = {};
    for (const f of FLAGS) out[f.id] = { owner: null, force: { xanh: 0, do: 0 } };
    return out;
  }
  function defaultSession() {
    return {
      matchNo: 1,
      phase: 'lobby',       // lobby | playing | spotlight
      phaseEndsAt: 0,
      matchEndsAt: 0,
      windowEndsAt: 0,
      windowNo: 0,
      points: { xanh: 0, do: 0 },
      flags: emptyFlags(),
      lastCapture: null,    // { team, flag, at }
      players: {},          // uid -> player
      winner: null,         // { team, points, reason, at }
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
  if (!session.points) session.points = { xanh: 0, do: 0 };
  if (!session.flags) session.flags = emptyFlags();
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  session.demoActive = false; // demo không sống qua restart
  if (session.phase === 'playing') session.phase = 'lobby';
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
  // Validate "Tùy chỉnh đội" (dashboard): tên trim + strip <>& + tối đa 24 ký
  // tự; bg chỉ nhận URL http(s) hoặc /shared/... và không chứa khoảng trắng,
  // dấu nháy hay ngoặc (chống chèn CSS/JS qua background-image); màu phải là
  // hex #rrggbb. Giá trị sai -> giữ nguyên giá trị cũ.
  function cleanTeamName(v, dflt) {
    const t = String(v == null ? '' : v).replace(/[<>&]/g, '').trim().slice(0, 24);
    return t || dflt;
  }
  function cleanTeamBg(v, dflt) {
    const t = String(v == null ? '' : v).trim();
    if (!t) return '';
    if (!/^(https?:\/\/|\/shared\/)/.test(t)) return dflt;
    if (/[\s"'()]/.test(t)) return dflt;
    return t;
  }
  function cleanTeamColor(v, dflt) {
    const t = String(v == null ? '' : v).trim();
    return /^#[0-9a-fA-F]{6}$/.test(t) ? t : dflt;
  }
  function log(text) {
    session.logs.push({ t: Date.now(), text });
    if (session.logs.length > 100) session.logs = session.logs.slice(-100);
  }
  function broadcast() { ctx.io.emit('state-update', statePayload()); }

  function statePayload() {
    const players = Object.values(session.players)
      .filter((p) => !p.left)
      .sort((a, b) => (b.forceMatch || 0) - (a.forceMatch || 0));
    const byTeam = { xanh: [], do: [], none: [] };
    for (const p of players) byTeam[p.team || 'none'].push(p);
    return {
      game: GAME,
      username: USERNAME,
      matchNo: session.matchNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      matchEndsAt: session.matchEndsAt,
      windowEndsAt: session.windowEndsAt,
      windowNo: session.windowNo,
      windowS: settings.windowS,
      points: session.points,
      flags: session.flags,
      lastCapture: session.lastCapture,
      players: players.slice(0, 72).map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarUrl: p.avatarUrl || null,
        team: p.team || null,
        focus: p.focus || 'mid',
        force: p.forceMatch || 0,
        left: !!p.left,
      })),
      teamCounts: { xanh: byTeam.xanh.length, do: byTeam.do.length, none: byTeam.none.length },
      top: {
        xanh: byTeam.xanh.slice(0, 5).map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, force: p.forceMatch || 0 })),
        do: byTeam.do.slice(0, 5).map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, force: p.forceMatch || 0 })),
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
        windowS: settings.windowS,
        pointsPerFlagS: settings.pointsPerFlagS,
        midMultiplier: settings.midMultiplier,
        matchDurationS: settings.matchDurationS,
        tapForce: settings.tapForce,
        commentForce: settings.commentForce,
        coinToForce: settings.coinToForce,
        followForce: settings.followForce,
        shareForce: settings.shareForce,
        spotlightS: settings.spotlightS,
        commentSpamS: settings.commentSpamS,
        teamXanhName: settings.teamXanhName,
        teamDoName: settings.teamDoName,
        teamXanhBg: settings.teamXanhBg,
        teamDoBg: settings.teamDoBg,
        teamXanhColor: settings.teamXanhColor,
        teamDoColor: settings.teamDoColor,
      },
      now: Date.now(),
    };
  }

  // -- team / focus detection ------------------------------------------------
  function detectTeam(text) {
    if (!text) return null;
    const raw = String(text).toLowerCase();
    const tokens = raw.replace(/[.,!?;:()\[\]{}"'“”]/g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.includes('đỏ') || tokens.includes('do')) return 'do';
    if (tokens.includes('xanh')) return 'xanh';
    if (tokens.includes('1')) return 'xanh';
    if (tokens.includes('2')) return 'do';
    return null;
  }
  // Chọn cờ: cần kèm từ "cờ", hoặc từ khóa cờ đứng một mình. Tránh "phải"
  // trong câu thường ("phải kéo mạnh") đổi cờ lung tung.
  function detectFocus(text) {
    if (!text) return null;
    const norm = normVi(text);
    const tokens = norm.split(/\s+/).filter(Boolean);
    const hasCo = tokens.includes('co');
    const alone = tokens.length === 1 ? tokens[0] : null;
    if ((hasCo && tokens.includes('trai')) || alone === 'trai') return 'left';
    if ((hasCo && tokens.includes('giua')) || alone === 'giua') return 'mid';
    if ((hasCo && tokens.includes('phai')) || alone === 'phai') return 'right';
    return null;
  }
  function teamCounts() {
    let xanh = 0; let doN = 0;
    for (const p of Object.values(session.players)) {
      if (p.left) continue;
      if (p.team === 'xanh') xanh++;
      else if (p.team === 'do') doN++;
    }
    return { xanh, do: doN };
  }
  function flagCount(team) {
    return FLAG_IDS.filter((id) => session.flags[id].owner === team).length;
  }

  // -- match lifecycle -------------------------------------------------------
  function startMatch() {
    if (session.phase !== 'lobby') return;
    const now = Date.now();
    session.phase = 'playing';
    session.matchEndsAt = now + settings.matchDurationS * 1000;
    session.windowEndsAt = now + settings.windowS * 1000;
    session.windowNo = 1;
    session.winner = null;
    session.lastCapture = null;
    log(`Trận ${session.matchNo} bắt đầu (${settings.matchDurationS}s, cửa sổ ${settings.windowS}s).`);
    saveSession();
    broadcast();
  }
  function resolveWindow() {
    const now = Date.now();
    for (const f of FLAGS) {
      const fl = session.flags[f.id];
      const fx = fl.force.xanh;
      const fd = fl.force.do;
      if (fx === fd) continue; // hòa lực -> không đổi chủ
      const winTeam = fx > fd ? 'xanh' : 'do';
      if (fl.owner !== winTeam) {
        fl.owner = winTeam;
        session.lastCapture = { team: winTeam, flag: f.id, at: now };
        log(`${teamLabel(winTeam)} chiếm ${FLAG_NAMES[f.id]}! (${fx} - ${fd})`);
        ctx.io.emit('flag-capture', { team: winTeam, flag: f.id, text: `${teamLabel(winTeam)} vừa chiếm ${FLAG_NAMES[f.id]}!` });
      }
    }
    // Cờ hòa lực: lực cửa sổ vẫn reset (cửa sổ mới bắt đầu lại từ 0).
    for (const f of FLAGS) session.flags[f.id].force = { xanh: 0, do: 0 };
    session.windowNo += 1;
    session.windowEndsAt = now + settings.windowS * 1000;
    saveSession();
    broadcast();
  }
  function endMatch() {
    const now = Date.now();
    const px = session.points.xanh;
    const pd = session.points.do;
    let winner = null;
    let reason = '';
    if (px !== pd) {
      winner = px > pd ? 'xanh' : 'do';
      reason = `điểm ${px} - ${pd}`;
    } else {
      const fx = flagCount('xanh');
      const fd = flagCount('do');
      if (fx !== fd) {
        winner = fx > fd ? 'xanh' : 'do';
        reason = `hòa điểm ${px} - ${pd}, hơn cờ ${fx} - ${fd}`;
      } else if (session.lastCapture) {
        winner = session.lastCapture.team;
        reason = `hòa điểm và hòa cờ, chiếm cờ cuối: ${FLAG_NAMES[session.lastCapture.flag]}`;
      } else {
        reason = `hòa ${px} - ${pd}, không ai chiếm cờ nào`;
      }
    }
    session.winner = winner
      ? { team: winner, points: { xanh: px, do: pd }, reason, at: now }
      : { team: null, points: { xanh: px, do: pd }, reason, at: now };
    session.phase = 'spotlight';
    session.phaseEndsAt = now + settings.spotlightS * 1000;
    if (winner) {
      log(`Hết trận: ${teamLabel(winner)} thắng (${reason}).`);
      ctx.io.emit('match-win', { team: winner, text: `${teamLabel(winner)} đã thắng trận!` });
    } else {
      log(`Hết trận: hòa (${reason}).`);
      ctx.io.emit('match-win', { team: null, text: 'Trận đấu kết thúc với tỷ số hòa!' });
    }
    saveSession();
    broadcast();
  }
  function resetMatch() {
    session.matchNo += 1;
    session.phase = 'lobby';
    session.phaseEndsAt = 0;
    session.matchEndsAt = 0;
    session.windowEndsAt = 0;
    session.windowNo = 0;
    session.points = { xanh: 0, do: 0 };
    session.flags = emptyFlags();
    session.lastCapture = null;
    session.winner = null;
    for (const p of Object.values(session.players)) {
      p.forceMatch = 0;
      p.followedMatch = false;
      p.sharedMatch = false;
    }
    log(`Trận ${session.matchNo} chuẩn bị (đội giữ nguyên).`);
    saveSession();
    broadcast();
  }

  // -- players / force -------------------------------------------------------
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
        focus: 'mid',
        forceMatch: 0,
        lastCommentAt: 0,
        followedMatch: false,
        sharedMatch: false,
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
  function addForce(p, amount) {
    if (!p || !p.team || amount <= 0) return false;
    const flagId = p.focus || 'mid';
    session.flags[flagId].force[p.team] += amount;
    p.forceMatch = (p.forceMatch || 0) + amount;
    return true;
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
        if (session.phase !== 'playing') {
          if (p.team !== team) {
            p.team = team;
            log(`${p.name} vào ${teamLabel(team)}.`);
          }
        } else if (p.team && p.team !== team) {
          // Đang đấu: người đã có đội thì không được đổi đội.
          log(`${p.name} muốn đổi sang ${teamLabel(team)} — chỉ đổi được giữa các trận.`);
        } else if (!p.team) {
          // Người mới chưa có đội vẫn được vào đội giữa trận.
          p.team = team;
          log(`${p.name} vào ${teamLabel(team)}.`);
        }
      }
      const focus = detectFocus(text);
      if (focus && p.focus !== focus) {
        p.focus = focus;
        log(`${p.name} chuyển sang đánh ${FLAG_NAMES[focus]}.`);
      }
      // Trận tự bắt đầu khi cả 2 đội đều có người (ngay trong intake).
      if (session.phase === 'lobby') {
        const c = teamCounts();
        if (c.xanh > 0 && c.do > 0) startMatch();
      }
      if (!p.team) { saveSession(); broadcast(); return { ok: true }; }
      if (now - (p.lastCommentAt || 0) < settings.commentSpamS * 1000) {
        session.stats.commentsBlocked += 1;
        saveSession(); broadcast();
        return { ok: false, reason: 'comment-spam' };
      }
      p.lastCommentAt = now;
      session.stats.comments += 1;
      addForce(p, settings.commentForce);
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
        addForce(p, d * settings.tapForce);
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
        console.warn(`[chiem-co] unknown gift coins from ${ev.uid} (${ev.giftName || '?'})`);
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const force = Math.floor(coins) * settings.coinToForce;
      addForce(p, force);
      log(`${p.name} tặng ${coins} xu -> +${force} lực ${FLAG_NAMES[p.focus || 'mid']}.`);
      saveSession(); broadcast();
      return { ok: true, force };
    }
    if (kind === 'follow') {
      const p = ensurePlayer(ev);
      session.stats.follows += 1;
      if (p && p.team && !p.followedMatch) {
        p.followedMatch = true;
        addForce(p, settings.followForce);
      }
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'share') {
      const p = ensurePlayer(ev);
      session.stats.shares += 1;
      if (p && p.team && !p.sharedMatch) {
        p.sharedMatch = true;
        addForce(p, settings.shareForce);
      }
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
      if (c.xanh > 0 && c.do > 0) startMatch();
      return;
    }
    if (session.phase === 'playing') {
      // Điểm giữ cờ: mỗi giây, mỗi cờ đang giữ cho đội +điểm (Giữa x hệ số).
      for (const f of FLAGS) {
        const owner = session.flags[f.id].owner;
        if (owner) {
          const rate = settings.pointsPerFlagS * (f.id === 'mid' ? settings.midMultiplier : 1);
          session.points[owner] += rate;
        }
      }
      if (session.windowEndsAt && now >= session.windowEndsAt) resolveWindow();
      if (session.matchEndsAt && now >= session.matchEndsAt) endMatch();
      saveSession(); broadcast();
      return;
    }
    if (session.phase === 'spotlight') {
      if (session.phaseEndsAt && now >= session.phaseEndsAt) resetMatch();
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
        p.team = i % 2 === 0 ? 'xanh' : 'do';
        p.focus = DEMO_FOCUS[i % 3];
        p.left = false;
      }
      handleIntake({ kind: 'tap', uid, name: `Demo ${name}`, totalLikeCount: 0 });
    });
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.xanh > 0 && c.do > 0) startMatch();
    }
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 12 người demo vào 2 đội, đánh 3 cờ.');
    const step = () => {
      if (!session.demoActive) return;
      const demoPlayers = Object.values(session.players).filter((p) => p.uid.startsWith('demo_') && !p.left);
      if (demoPlayers.length === 0) return;
      const me = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
      const r = Math.random();
      if (r < 0.45) {
        demoTapTotals[me.uid] = (demoTapTotals[me.uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid: me.uid, name: me.name, totalLikeCount: demoTapTotals[me.uid] });
      } else if (r < 0.65) {
        const flagWord = DEMO_FOCUS[Math.floor(Math.random() * 3)];
        const text = flagWord === 'left' ? 'cờ trái' : flagWord === 'mid' ? 'cờ giữa' : 'cờ phải';
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text });
      } else if (r < 0.8) {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
      } else if (r < 0.92) {
        const coins = [1, 5, 10][Math.floor(Math.random() * 3)];
        handleIntake({ kind: 'gift', uid: me.uid, name: me.name, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.96) {
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
        p.team = i % 2 === 0 ? 'xanh' : 'do';
        p.focus = DEMO_FOCUS[i % 3];
        p.left = false;
      }
    });
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.xanh > 0 && c.do > 0) startMatch();
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
    if (b.windowS !== undefined) settings.windowS = clampInt(b.windowS, 2, 300, settings.windowS);
    if (b.pointsPerFlagS !== undefined) settings.pointsPerFlagS = clampInt(b.pointsPerFlagS, 1, 10, settings.pointsPerFlagS);
    if (b.midMultiplier !== undefined) settings.midMultiplier = clampInt(b.midMultiplier, 1, 5, settings.midMultiplier);
    if (b.matchDurationS !== undefined) settings.matchDurationS = clampInt(b.matchDurationS, 5, 1800, settings.matchDurationS);
    if (b.tapForce !== undefined) settings.tapForce = clampInt(b.tapForce, 1, 10, settings.tapForce);
    if (b.commentForce !== undefined) settings.commentForce = clampInt(b.commentForce, 1, 50, settings.commentForce);
    if (b.coinToForce !== undefined) settings.coinToForce = clampInt(b.coinToForce, 1, 100, settings.coinToForce);
    if (b.followForce !== undefined) settings.followForce = clampInt(b.followForce, 0, 100, settings.followForce);
    if (b.shareForce !== undefined) settings.shareForce = clampInt(b.shareForce, 0, 100, settings.shareForce);
    if (b.spotlightS !== undefined) settings.spotlightS = clampInt(b.spotlightS, 1, 120, settings.spotlightS);
    if (b.commentSpamS !== undefined) settings.commentSpamS = clampInt(b.commentSpamS, 1, 60, settings.commentSpamS);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    if (b.teamXanhName !== undefined) settings.teamXanhName = cleanTeamName(b.teamXanhName, settings.teamXanhName);
    if (b.teamDoName !== undefined) settings.teamDoName = cleanTeamName(b.teamDoName, settings.teamDoName);
    if (b.teamXanhBg !== undefined) settings.teamXanhBg = cleanTeamBg(b.teamXanhBg, settings.teamXanhBg);
    if (b.teamDoBg !== undefined) settings.teamDoBg = cleanTeamBg(b.teamDoBg, settings.teamDoBg);
    if (b.teamXanhColor !== undefined) settings.teamXanhColor = cleanTeamColor(b.teamXanhColor, settings.teamXanhColor);
    if (b.teamDoColor !== undefined) settings.teamDoColor = cleanTeamColor(b.teamDoColor, settings.teamDoColor);
    saveSettings();
    res.json({ success: true, settings });
    broadcast();
  });
  router.post('/api/match/reset', (req, res) => { resetMatch(); res.json({ success: true, matchNo: session.matchNo }); });

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
    // Người thử tim chưa có đội thì cho vào đội Xanh để nút bấm thấy lực tăng.
    const tp = session.players['test-tapper'];
    if (!tp || !tp.team) {
      handleIntake({ kind: 'comment', uid: 'test-tapper', name: 'Người thử tim', text: 'xanh' });
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
    handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: b.text || 'xanh cố lên!' });
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
        p.team = i % 2 === 0 ? 'xanh' : 'do';
        p.focus = DEMO_FOCUS[i % 3];
        p.left = false;
      }
    }
    if (session.phase === 'lobby') {
      const c = teamCounts();
      if (c.xanh > 0 && c.do > 0) startMatch();
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
