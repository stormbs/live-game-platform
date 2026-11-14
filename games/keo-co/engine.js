// KÉO CO — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-keo-co.md:
// 2 đội Xanh vs Đỏ kéo dây; 1 tim = +1 lực, 1 bình luận tính điểm = +5,
// 1 xu quà = +10 lực, follow +20 (1 lần/người/hiệp), share +10 (1 lần/người/hiệp).
// Cờ chạm vạch đích 1 bên → bên đó thắng hiệp; hết giờ bên đang dẫn thắng.
// Thắng 3 hiệp trước (tối đa 5 hiệp) → thắng trận → vinh danh 20s → trận mới.
// Demo theo ~/workspace/overlay-moi/demo-mode-contract.md: ?demo=1 tự chạy,
// nút Chạy/Dừng demo ở dashboard, huy hiệu DEMO, tự dừng khi event thật tới,
// từ chối khi phòng đã có event thật (webhookCount > 0).
// Khác bản thiết kế: KHÔNG chạy server local — chạy trong platform,
// webhook qua dispatch có sẵn; quà tra số xu thật trong payload.
'use strict';

function createEngine(ctx) {
  const __dirname = ctx.gameDir;
  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const { loadJson, saveJson, parseTikFinityEvent, TapDelta, withTimers, mountTts } = require('../../lib/game-common');
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
  const TIKFINITY_ACTIONS = [
    { key: 'gift', actionName: 'Keo Co - Qua', triggerLabel: 'Sending a gift with min. coins value (min coins = 1)' },
    { key: 'chat', actionName: 'Keo Co - Binh luan', triggerLabel: 'Chat (any comment)' },
    { key: 'like', actionName: 'Keo Co - Tim', triggerLabel: 'Sending likes (taps)' },
    { key: 'follow', actionName: 'Keo Co - Follow', triggerLabel: 'Follow' },
    { key: 'share', actionName: 'Keo Co - Share', triggerLabel: 'Share' },
    { key: 'join', actionName: 'Keo Co - Vao phong', triggerLabel: 'Join' },
  ];
  const timers = withTimers(ctx);
  const DATA_DIR = ctx.dataDir;
  // ctx không có username — lấy từ roomPrefix '/o/<game>/<username>'.
  const USERNAME = String(ctx.roomPrefix || '').split('/').filter(Boolean).pop() || 'live';
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const SESSION_FILE = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const TEAM = {
    xanh: { id: 'xanh', name: 'Xanh', color: '#1e90ff', emoji: '🔵' },
    do: { id: 'do', name: 'Đỏ', color: '#e63946', emoji: '🔴' },
  };
  const MAX_PULLERS = 24;

  const defaultSettings = {
    tapForce: 0.1,        // lực / 1 tim (delta) — 10 tim = 1 lực
    commentForce: 1,      // lực / 1 bình luận tính điểm (cmt tên đội)
    coinToForce: 10,      // lực / 1 xu quà
    followForce: 20,      // lực follow (1 lần/người/hiệp)
    shareForce: 10,       // lực share (1 lần/người/hiệp)
    roundDurationS: 180,  // thời gian tối đa 1 hiệp (giây)
    winForce: 500,        // chênh lệch lực cần để cờ chạm vạch đích
    roundsToWin: 3,       // thắng bao nhiêu hiệp thì thắng trận
    roundBreakS: 10,      // nghỉ giữa các hiệp (giây)
    matchCelebrateS: 20,  // vinh danh đội thắng trận (giây)
    commentSpamS: 5,      // chống spam bình luận (giây/người)
    demoMode: false,
    voiceEnabled: true,
    teamXanhName: 'Xanh', // tên hiển thị đội Xanh (key đội 'xanh' không đổi)
    teamDoName: 'Đỏ',     // tên hiển thị đội Đỏ (key đội 'do' không đổi)
    teamXanhBg: '',       // ảnh nền đội Xanh (URL http(s) hoặc /shared/..., '' = không ảnh)
    teamDoBg: '',
    teamXanhColor: '#1E90FF', // màu chủ đạo đội Xanh
    teamDoColor: '#E63946',   // màu chủ đạo đội Đỏ
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      matchNo: 1,
      matchRound: 1,          // hiệp hiện tại trong trận (1..2*roundsToWin-1)
      phase: 'idle',          // idle | playing | roundEnd | matchEnd
      phaseEndsAt: 0,
      wins: { xanh: 0, do: 0 },
      force: { xanh: 0, do: 0 },
      players: {},            // uid -> player
      results: null,          // { winner: 'xanh'|'do'|null, wins, matchNo }
      lastRoundWinner: null,
      lastRoundReason: null,
      lastGift: null,           // { uid, name, team, giftName, coins, force, at } — quà mới nhất, overlay làm hiệu ứng
      flagWarned: { xanh: false, do: false },
      logs: [],
      stats: { joins: 0, comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0 },
      avatarStats: { total: 0, withAvatar: 0 },
      avatarSeen: {},
      webhookCount: 0,
      demoActive: false,
      createdAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players) session.players = {};
  if (!session.wins) session.wins = { xanh: 0, do: 0 };
  if (!session.force) session.force = { xanh: 0, do: 0 };
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  if (!('lastGift' in session)) session.lastGift = null;
  session.demoActive = false; // demo không sống qua restart
  session.phase = session.phase === 'playing' ? 'idle' : session.phase;
  if (session.phase === 'idle') session.phaseEndsAt = 0;
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  const testTapTotals = {};
  const demoTapTotals = {};
  let demoTimer = null;
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Bảo', 'Cường', 'Đạt', 'Giang', 'Hiếu', 'Khoa', 'Lan', 'Nam', 'Oanh', 'Sơn', 'Tú', 'Vân'];
  const DEMO_CHEERS = ['Cố lên!', 'Kéo mạnh lên!', 'Kéo đi mọi người ơi!', 'Đừng thua nha!', 'Mạnh nữa lên!', 'Cố lên cả đội ơi!'];
  const DEMO_GIFTS = [{ name: 'Hoa hồng', coins: 1 }, { name: 'Trà sữa', coins: 5 }, { name: 'Kính râm', coins: 10 }, { name: 'Bánh kem', coins: 20 }]; // quà demo định kỳ, tối đa 20 xu = 200 lực

  function saveSession() { saveJson(SESSION_FILE, session); }
  function saveSettings() { saveJson(SETTINGS_FILE, settings); }
  function clampInt(v, min, max, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }
  // tapForce là số thập phân (0.1 = 10 tim = 1 lực) — clampInt làm tròn
  // xuống sẽ biến 0.1 thành 0 nên dùng clamp riêng, làm tròn 2 chữ số.
  function clampFloat(v, min, max, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
  }
  // Tên đội hiển thị (chỉ đổi tên, không đổi key đội 'xanh'/'do').
  function teamDisplayName(team) {
    return team === 'xanh' ? (settings.teamXanhName || 'Xanh') : (settings.teamDoName || 'Đỏ');
  }
  // Validate tên đội: trim, bỏ <>&, tối đa 24 ký tự; rỗng -> giữ cũ.
  function cleanTeamName(v, current) {
    const s = String(v == null ? '' : v).trim().replace(/[<>&]/g, '');
    return s ? s.slice(0, 24) : current;
  }
  // Validate ảnh nền đội: '' = không ảnh; chỉ chấp nhận http(s):// hoặc
  // /shared/... và không chứa khoảng trắng/dấu nháy/ngoặc — sai thì giữ cũ.
  function cleanTeamBg(v, current) {
    const s = String(v == null ? '' : v).trim();
    if (s === '') return '';
    if (!/^https?:\/\/|\/shared\//.test(s)) return current;
    if (/[\s"'()]/.test(s)) return current;
    return s;
  }
  // Validate màu đội: phải là #RRGGBB — sai thì giữ cũ.
  function cleanTeamColor(v, current) {
    const s = String(v == null ? '' : v).trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : current;
  }
  function log(text) {
    session.logs.push({ t: Date.now(), text });
    if (session.logs.length > 100) session.logs = session.logs.slice(-100);
  }
  function broadcast() { ctx.io.emit('state-update', statePayload()); }
  function onlinePlayers() { return Object.values(session.players).filter((p) => !p.left); }
  function teamPlayers(team) {
    return onlinePlayers()
      .filter((p) => p.team === team)
      .sort((a, b) => (a.teamJoinedAt || 0) - (b.teamJoinedAt || 0));
  }
  function maxRounds() { return 2 * settings.roundsToWin - 1; }
  function flagPct() {
    // Cờ: -100 = vạch đích Xanh (trái), +100 = vạch đích Đỏ (phải).
    // Xanh kéo mạnh hơn -> cờ lệch TRÁI (âm), Đỏ mạnh hơn -> lệch PHẢI (dương).
    const diff = session.force.do - session.force.xanh;
    return Math.max(-100, Math.min(100, (diff / settings.winForce) * 100));
  }

  function statePayload() {
    const mkTeam = (team) => {
      const all = teamPlayers(team);
      const pullers = all.slice(0, MAX_PULLERS).map((p) => ({
        uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, force: p.forceRound,
      }));
      return { force: session.force[team], pullers, bench: Math.max(0, all.length - MAX_PULLERS), total: all.length };
    };
    const top = onlinePlayers()
      .filter((p) => p.team)
      .sort((a, b) => b.forceMatch - a.forceMatch)
      .slice(0, 5)
      .map((p) => ({ uid: p.uid, name: p.name, team: p.team, force: p.forceMatch }));
    // v4: khán giả chưa chọn đội (ngồi khán đài) + cờ chờ ghép trận.
    const spectators = onlinePlayers()
      .filter((p) => !p.team)
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
      .slice(0, 24)
      .map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, joinedAt: p.joinedAt || 0 }));
    const waitingForMatch = session.phase === 'idle'
      && ((teamPlayers('xanh').length > 0) !== (teamPlayers('do').length > 0));
    return {
      game: 'keo-co',
      username: USERNAME,
      settings,
      matchNo: session.matchNo,
      matchRound: session.matchRound,
      maxRounds: maxRounds(),
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      wins: session.wins,
      force: session.force,
      flagPct: flagPct(),
      teams: { xanh: mkTeam('xanh'), do: mkTeam('do') },
      top,
      spectators,
      waitingForMatch,
      lastGift: session.lastGift || null,
      viewersOnline: onlinePlayers().length,
      stats: session.stats,
      logs: session.logs.slice(-30),
      avatarStats: session.avatarStats,
      webhookCount: session.webhookCount,
      demoActive: session.demoActive,
      results: session.results,
      lastRoundWinner: session.lastRoundWinner,
      lastRoundReason: session.lastRoundReason,
    };
  }

  function ensurePlayer(ev) {
    let p = session.players[ev.uid];
    if (!p) {
      p = {
        uid: ev.uid, name: ev.name || ev.uid, avatarUrl: ev.avatarUrl || null,
        team: null, teamJoinedAt: 0, forceRound: 0, forceMatch: 0,
        lastCommentAt: 0, followedRound: 0, sharedRound: 0,
        joinedAt: Date.now(), left: false, leftAt: 0,
      };
      session.players[ev.uid] = p;
    }
    p.name = ev.name || p.name;
    if (ev.avatarUrl) p.avatarUrl = ev.avatarUrl;
    if (p.left) { p.left = false; p.leftAt = 0; }
    if (!session.avatarSeen[ev.uid]) {
      session.avatarSeen[ev.uid] = true;
      session.avatarStats.total += 1;
      if (ev.avatarUrl) session.avatarStats.withAvatar += 1;
    }
    return p;
  }

  // Nhận diện đội từ bình luận: token 'xanh' / 'đỏ' / 'do' (không dấu),
  // hoặc đúng '1' = Xanh, '2' = Đỏ. Dùng token thô (giữ dấu) để 'đồ'/'đó'
  // không bị nhận nhầm thành 'đỏ'.
  function detectTeam(text) {
    const raw = String(text || '').trim().toLowerCase();
    if (raw === '1') return 'xanh';
    if (raw === '2') return 'do';
    const tokens = raw.split(/[^a-zà-ỹđ0-9]+/).filter(Boolean);
    if (tokens.includes('xanh')) return 'xanh';
    if (tokens.includes('đỏ') || tokens.includes('do')) return 'do';
    return null;
  }

  function addForce(player, amount, reason) {
    if (!player.team || amount <= 0) return false;
    player.forceRound += amount;
    player.forceMatch += amount;
    session.force[player.team] += amount;
    return true;
  }

  function startRound() {
    session.phase = 'playing';
    session.phaseEndsAt = Date.now() + settings.roundDurationS * 1000;
    session.flagWarned = { xanh: false, do: false };
    session.lastRoundWinner = null;
    session.lastRoundReason = null;
    // KHÔNG reset lực ở đây: lực cổ vũ trong lúc chờ (giữa các hiệp) được
    // giữ làm lợi thế đầu hiệp. Lực reset ở endRound (khi hiệp kết thúc).
    log(`Hiệp ${session.matchRound} bắt đầu — kéo đi mọi người ơi!`);
    ctx.io.emit('round-start', { matchRound: session.matchRound });
    saveSession();
    broadcast();
  }

  function endRound(winner, reason) {
    // winner: 'xanh' | 'do' | null (hòa lực đúng 0 khi hết giờ)
    session.lastRoundWinner = winner;
    session.lastRoundReason = reason;
    if (winner) {
      session.wins[winner] += 1;
      log(`🏆 Đội ${teamDisplayName(winner)} thắng hiệp ${session.matchRound} (${reason}) — tỉ số ${session.wins.xanh}–${session.wins.do}`);
      ctx.io.emit('round-win', { team: winner, matchRound: session.matchRound, reason });
    } else {
      log(`Hiệp ${session.matchRound} hòa lực — không đội nào thắng hiệp này.`);
      ctx.io.emit('round-win', { team: null, matchRound: session.matchRound, reason });
    }
    // Hiệp kết thúc -> lực về 0 cho hiệp sau (lực cổ vũ trong giờ nghỉ
    // giữa hiệp sẽ tích lại từ 0).
    session.force = { xanh: 0, do: 0 };
    Object.values(session.players).forEach((p) => { p.forceRound = 0; });
    if (session.wins.xanh >= settings.roundsToWin || session.wins.do >= settings.roundsToWin
      || session.matchRound >= maxRounds()) {
      const matchWinner = session.wins.xanh > session.wins.do ? 'xanh'
        : session.wins.do > session.wins.xanh ? 'do' : null;
      session.results = { winner: matchWinner, wins: { ...session.wins }, matchNo: session.matchNo };
      session.phase = 'matchEnd';
      session.phaseEndsAt = Date.now() + settings.matchCelebrateS * 1000;
      if (matchWinner) {
        log(`🎉 Đội ${teamDisplayName(matchWinner)} THẮNG TRẬN ${session.matchNo}! Vinh danh ${settings.matchCelebrateS}s…`);
        ctx.io.emit('match-win', { team: matchWinner, wins: { ...session.wins } });
      } else {
        log(`Trận ${session.matchNo} hòa ${session.wins.xanh}–${session.wins.do} sau ${maxRounds()} hiệp.`);
        ctx.io.emit('match-win', { team: null, wins: { ...session.wins } });
      }
    } else {
      session.phase = 'roundEnd';
      session.phaseEndsAt = Date.now() + settings.roundBreakS * 1000;
    }
    saveSession();
    broadcast();
  }

  function resetMatch() {
    session.matchNo += 1;
    session.matchRound = 1;
    session.wins = { xanh: 0, do: 0 };
    session.force = { xanh: 0, do: 0 };
    session.results = null;
    session.lastRoundWinner = null;
    session.lastRoundReason = null;
    session.phase = 'idle';
    session.phaseEndsAt = 0;
    Object.values(session.players).forEach((p) => { p.forceRound = 0; p.forceMatch = 0; p.followedRound = 0; p.sharedRound = 0; });
    log(`Trận mới #${session.matchNo} — đội giữ nguyên, lực về 0.`);
    saveSession();
    broadcast();
  }

  function resetSession() {
    const keepLogs = [];
    session = defaultSession();
    session.logs = keepLogs;
    session.matchNo = 1;
    tapDelta.reset();
    log('Đã làm mới phiên — trận mới, đội và lực về 0.');
    saveSession();
    broadcast();
  }

  function handleIntake(ev) {
    if (!ev || !ev.uid) return { ok: false, reason: 'no-uid' };
    const p = ensurePlayer(ev);
    const now = Date.now();
    switch (ev.kind) {
      case 'join': {
        session.stats.joins += 1;
        if (!p.team) log(`${p.name} vào xem kéo co — bình luận "xanh" hoặc "đỏ" để chọn đội!`);
        break;
      }
      case 'comment': {
        session.stats.comments += 1;
        const team = detectTeam(ev.text);
        if (team && team !== p.team) {
          // Chỉ chặn ĐỔI đội giữa hiệp; khán giả chưa có đội thì được nhập đội ngay.
          if (p.team && session.phase === 'playing') {
            log(`${p.name} muốn đổi sang đội ${teamDisplayName(team)} nhưng đang trong hiệp — chỉ đổi đội giữa các hiệp.`);
          } else {
            p.team = team;
            p.teamJoinedAt = now;
            log(`${p.name} vào đội ${teamDisplayName(team)}!`);
          }
        }
        // Bình luận tính điểm: chống spam 1/5s/người (mặc định).
        if (now - p.lastCommentAt < settings.commentSpamS * 1000) {
          session.stats.commentsBlocked += 1;
          break;
        }
        p.lastCommentAt = now;
        if (p.team) {
          addForce(p, settings.commentForce, 'comment');
        }
        break;
      }
      case 'tap': {
        // likeCount của TikFinity là TỔNG TÍCH LŨY (adapter gửi thêm
        // totalLikeCount) — chỉ cộng phần tăng so với lần trước của người đó.
        const total = ev.totalLikeCount ?? ev.likeCount ?? null;
        const delta = total !== null ? tapDelta.delta(ev.uid, total) : 1;
        if (delta > 0) {
          session.stats.taps += delta;
          if (p.team) addForce(p, delta * settings.tapForce, 'tap');
        }
        break;
      }
      case 'gift': {
        const coins = ev.coins;
        if (coins === null || coins === undefined || Number.isNaN(Number(coins)) || Number(coins) < 1) {
          session.stats.giftsUnknown += 1;
          console.warn(`[keo-co] qua khong ro xu tu ${p.name} (${ev.giftName || '?'})`);
          log(`⚠️ Quà của ${p.name} không rõ số xu — 0 lực, không mặc định +5.`);
          break;
        }
        session.stats.gifts += 1;
        const force = Math.round(Number(coins) * settings.coinToForce);
        session.lastGift = { uid: p.uid, name: p.name, team: p.team || null, giftName: ev.giftName || 'quà', coins: Number(coins), force: p.team ? force : 0, at: Date.now() };
        if (p.team) {
          addForce(p, force, 'gift');
          log(`🎁 ${p.name} tặng ${ev.giftName || 'quà'} ${coins} xu → +${force} lực cho đội ${teamDisplayName(p.team)}!`);
        } else {
          log(`🎁 ${p.name} tặng ${ev.giftName || 'quà'} ${coins} xu nhưng chưa chọn đội — bình luận "xanh"/"đỏ" để tính lực!`);
        }
        break;
      }
      case 'follow': {
        session.stats.follows += 1;
        if (p.team && p.followedRound !== session.matchRound) {
          p.followedRound = session.matchRound;
          addForce(p, settings.followForce, 'follow');
          log(`💙 ${p.name} follow → +${settings.followForce} lực cho đội ${teamDisplayName(p.team)}!`);
        }
        break;
      }
      case 'share': {
        session.stats.shares += 1;
        if (p.team && p.sharedRound !== session.matchRound) {
          p.sharedRound = session.matchRound;
          addForce(p, settings.shareForce, 'share');
          log(`🔁 ${p.name} chia sẻ live → +${settings.shareForce} lực cho đội ${teamDisplayName(p.team)}!`);
        }
        break;
      }
      case 'leave': {
        p.left = true;
        p.leftAt = now;
        break;
      }
      default:
        return { ok: false, reason: 'unknown-kind' };
    }
    // Cảnh báo cờ sắp chạm đích (mỗi bên 1 lần/hiệp) — overlay đọc bằng TTS.
    const fp = flagPct();
    if (fp <= -75 && !session.flagWarned.xanh && session.phase === 'playing') {
      session.flagWarned.xanh = true;
      ctx.io.emit('flag-warning', { team: 'xanh' });
    } else if (fp >= 75 && !session.flagWarned.do && session.phase === 'playing') {
      session.flagWarned.do = true;
      ctx.io.emit('flag-warning', { team: 'do' });
    }
    // Cờ chạm vạch đích → thắng hiệp ngay.
    if (session.phase === 'playing') {
      if (fp <= -100) endRound('xanh', 'kéo cờ về vạch đích');
      else if (fp >= 100) endRound('do', 'kéo cờ về vạch đích');
    }
    saveSession();
    broadcast();
    return { ok: true };
  }

  function tick() {
    const now = Date.now();
    if (session.phase === 'idle') {
      // Tự bắt đầu hiệp khi cả 2 đội đều có người (tiến độ đầu tiên ≤ ~1 phút).
      if (teamPlayers('xanh').length > 0 && teamPlayers('do').length > 0) startRound();
    } else if (session.phase === 'playing') {
      if (now >= session.phaseEndsAt) {
        const diff = session.force.xanh - session.force.do;
        const winner = diff > 0 ? 'xanh' : diff < 0 ? 'do' : null;
        endRound(winner, winner ? 'hết giờ, đang dẫn lực' : 'hết giờ, hòa lực');
      }
    } else if (session.phase === 'roundEnd') {
      if (now >= session.phaseEndsAt) {
        session.matchRound += 1;
        session.phase = 'idle';
        session.phaseEndsAt = 0;
        saveSession();
        broadcast();
      }
    } else if (session.phase === 'matchEnd') {
      if (now >= session.phaseEndsAt) resetMatch();
    }
    saveSession();
  }

  // ---- Demo (theo demo-mode-contract) ----
  function demoUid(name) { return 'demo_' + name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); }
  // Ảnh đại diện demo (ảnh chân dung thật) để thấy mặt nhân vật = avatar người chơi.
  // i.pravatar.cc là ảnh thật; nếu không tải được, overlay tự rơi về mặt mặc định.
  function demoAvatar(i) { return `https://i.pravatar.cc/150?img=${((i * 7) % 70) + 1}`; }
  function startDemo() {
    if (session.webhookCount > 0) {
      return { success: false, message: 'Phòng đã có sự kiện thật, không chạy demo được.' };
    }
    if (!settings.demoMode) {
      return { success: false, message: 'Bật chế độ thử trước rồi mới chạy demo.' };
    }
    if (session.demoActive) return { success: true, demoActive: true, message: 'Demo đang chạy.' };
    // Demo v7 — dàn CHẬM để mắt kịp thấy từng khoảnh khắc:
    // Đợt 0: cả 24 người demo vào khán đài, đứng xem ~10s.
    // Đợt 1: 6 người đội Xanh nhập đội — chỉ 1 đội có người nên banner
    //   "Chờ ghép trận" hiện ~10s.
    // Đợt 2: 6 người đội Đỏ nhập đội — đủ 2 đội, hiệp tự bắt đầu.
    // Đợt 3: 6 người tiếp theo nhập đội sau ~5s (sóng 1 của đợt cuối).
    // Đợt 4: 6 người cuối nhập đội sau ~5s (sóng 2 của đợt cuối).
    // Sau đó cứ vài bước lại có khách mới đến khán đài, đứng xem ~10s
    // rồi mới nhập đội (tối đa 3 khách cùng chờ, ~30 người online,
    // mỗi đội ~15 người) + tặng quà định kỳ để thấy hiệu ứng quà.
    DEMO_NAMES.forEach((name, i) => {
      handleIntake({ kind: 'join', uid: demoUid(name), name: `Demo ${name}`, avatarUrl: demoAvatar(i) });
      // Đặt baseline tap = 0 cho mỗi người demo để bước tap sau luôn có delta thật.
      handleIntake({ kind: 'tap', uid: demoUid(name), name: `Demo ${name}`, totalLikeCount: 0 });
    });
    let demoStage = 0; // 0 = khán đài, 1 = chỉ Xanh (chờ ghép), 2 = Đỏ vào, 3 = đợt cuối, 4 = tự do
    let stageSteps = 0; // số bước đã chạy trong stage hiện tại
    let demoStepNo = 0;
    let trickleNo = 0;
    let pendingJoins = []; // [{ uid, name, team, dueStep }] — khách mới đang chờ ở khán đài, nhập đội sau ~15s
    let trickleLeaveAt = new Map(); // uid -> demoStepNo: khách trickle rời đội sau ~40s (16 bước) để có chỗ cho khách mới
    const joinTeam = (uid, name, team) => {
      handleIntake({ kind: 'comment', uid, name, text: team === 'xanh' ? '1' : '2' });
    };
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 24 người demo vào khán đài, rồi lần lượt nhập đội kéo co.');
    const step = () => {
      if (!session.demoActive) return;
      demoStepNo += 1;
      stageSteps += 1;
      // Đợt 0: ở khán đài ~10s (4 bước) để thấy đám đông khán giả.
      if (demoStage === 0) {
        if (stageSteps >= 4) {
          demoStage = 1; stageSteps = 0;
          DEMO_NAMES.slice(0, 6).forEach((name) => joinTeam(demoUid(name), `Demo ${name}`, 'xanh'));
        }
        return;
      }
      // Đợt 1: chỉ đội Xanh có người (~10s) — banner "Chờ ghép trận" hiện.
      if (demoStage === 1) {
        if (stageSteps >= 4) {
          demoStage = 2; stageSteps = 0;
          DEMO_NAMES.slice(6, 12).forEach((name) => joinTeam(demoUid(name), `Demo ${name}`, 'do'));
        }
        return;
      }
      // Đợt 2: đội Đỏ vào — đủ 2 đội, hiệp tự bắt đầu. Đợt cuối chia
      // thành 2 sóng (6 + 6) để thấy rõ từng lượt đi xuống.
      if (demoStage === 2) {
        demoStage = 3; stageSteps = 0;
        DEMO_NAMES.slice(12, 18).forEach((name, i) => joinTeam(demoUid(name), `Demo ${name}`, i % 2 === 0 ? 'xanh' : 'do'));
        return;
      }
      // Đợt 3: 6 người cuối nhập đội sau ~5s (sóng 2 của đợt cuối).
      if (demoStage === 3) {
        if (stageSteps >= 2) {
          demoStage = 4; stageSteps = 0;
          DEMO_NAMES.slice(18).forEach((name, i) => joinTeam(demoUid(name), `Demo ${name}`, i % 2 === 0 ? 'xanh' : 'do'));
        }
        return;
      }
      // Khách mới ở khán đài ~25s (10 bước) rồi mới nhập đội — để thấy
      // khán đài luôn có người đứng xem và thấy rõ lượt đi xuống.
      // Khách trickle rời đội sau ~30s (12 bước) — nhường chỗ cho khách
      // mới, khán đài không bao giờ cạn (demo không có người rời tự nhiên).
      for (const [uid, at] of trickleLeaveAt) {
        if (demoStepNo >= at) {
          trickleLeaveAt.delete(uid);
          handleIntake({ kind: 'leave', uid });
        }
      }
      const dueJoins = pendingJoins.filter((pj) => demoStepNo >= pj.dueStep);
      if (dueJoins.length) {
        pendingJoins = pendingJoins.filter((pj) => demoStepNo < pj.dueStep);
        dueJoins.forEach((pj) => {
          joinTeam(pj.uid, pj.name, pj.team);
          trickleLeaveAt.set(pj.uid, demoStepNo + 12);
        });
        // KHÔNG return: bước này vẫn tạo khách mới / quà / random để
        // khách đến đều, không bị ngắt quãng theo đợt nhập đội.
      }
      // Cứ 2 bước lại có 1 khách mới đến khán đài (tối đa ~36 người online,
      // mỗi đội ~15; tối đa 6 khách cùng chờ ở khán đài để luôn có người xem).
      if (demoStepNo % 2 === 0 && onlinePlayers().length < 36 && pendingJoins.length < 6) {
        trickleNo += 1;
        const uid = `demo_khach_${trickleNo}`;
        const name = `Khách ${trickleNo}`;
        handleIntake({ kind: 'join', uid, name, avatarUrl: demoAvatar(30 + trickleNo) });
        pendingJoins.push({ uid, name, team: trickleNo % 2 === 1 ? 'xanh' : 'do', dueStep: demoStepNo + 10 });
        return;
      }
      // Cứ 6 bước lại tặng 1 món quà (định kỳ, tối đa 20 xu = 200 lực) để thấy hiệu ứng quà.
      // % 6 == 3 (bước lẻ): khối trickle return ở mọi bước chẵn nên % 6 == 0
      // không bao giờ tới được — quà định kỳ gần như không chạy (lỗi #21).
      if (demoStepNo % 6 === 3) {
        const gift = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
        const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
        handleIntake({ kind: 'gift', uid: demoUid(name), name: `Demo ${name}`, giftName: gift.name, coins: gift.coins, qty: 1 });
        return;
      }
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
      const uid = demoUid(name);
      const r = Math.random();
      if (r < 0.45) {
        demoTapTotals[uid] = (demoTapTotals[uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid, name: `Demo ${name}`, totalLikeCount: demoTapTotals[uid] });
      } else if (r < 0.75) {
        handleIntake({ kind: 'comment', uid, name: `Demo ${name}`, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
      } else if (r < 0.9) {
        const coins = [1, 5, 10, 50][Math.floor(Math.random() * 4)];
        handleIntake({ kind: 'gift', uid, name: `Demo ${name}`, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.95) {
        handleIntake({ kind: 'follow', uid, name: `Demo ${name}` });
      } else {
        handleIntake({ kind: 'share', uid, name: `Demo ${name}` });
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

  // ---- Routes ----
  // QUAN TRỌNG: mount route lên ctx.router (router của room) — KHÔNG tạo
  // express.Router() mới (router mới không được platform gọi tới).
  const router = ctx.router;
  router.use(express.json());
  // TikFinity gửi body dạng form-urlencoded cố định (value1/value2/value3/
  // content/avatar_url) — cần urlencoded để req.body có dữ liệu cho parser.
  router.use(express.urlencoded({ extended: true }));
  router.use(express.static(path.join(__dirname, 'public')));

  router.post('/api/webhook', (req, res) => {
    session.webhookCount += 1;
    // Event thật đầu tiên TỰ DỪNG demo (theo contract) rồi mới xử lý.
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

  // Bảng 6 Action TikFinity của game này: tên action + loại trigger trong
  // Endpoint DỰ PHÒNG: trả 6 URL riêng theo sự kiện (?event=<loại>) để dùng
  // khi TikFinity không gửi trường event trong body. Dashboard hiện tại
  // KHÔNG còn gọi endpoint này (hướng 1-Action). KHÔNG có body (TikFinity
  // tự gửi form cố định KÈM trường event).
  router.get('/api/tikfinity-actions', (req, res) => {
    const base = webhookUrl('keo-co', USERNAME, publicBaseUrl(req));
    res.json({
      webhookUrl: base,
      actions: TIKFINITY_ACTIONS.map((a) => ({ ...a, url: `${base}?event=${a.key}` })),
    });
  });

  router.post('/api/settings', (req, res) => {
    const b = req.body || {};
    if (b.tapForce !== undefined) settings.tapForce = clampFloat(b.tapForce, 0.01, 10, settings.tapForce);
    if (b.commentForce !== undefined) settings.commentForce = clampInt(b.commentForce, 1, 50, settings.commentForce);
    if (b.coinToForce !== undefined) settings.coinToForce = clampInt(b.coinToForce, 1, 100, settings.coinToForce);
    if (b.followForce !== undefined) settings.followForce = clampInt(b.followForce, 0, 100, settings.followForce);
    if (b.shareForce !== undefined) settings.shareForce = clampInt(b.shareForce, 0, 100, settings.shareForce);
    if (b.roundDurationS !== undefined) settings.roundDurationS = clampInt(b.roundDurationS, 2, 600, settings.roundDurationS);
    if (b.winForce !== undefined) settings.winForce = clampInt(b.winForce, 100, 5000, settings.winForce);
    if (b.roundsToWin !== undefined) settings.roundsToWin = clampInt(b.roundsToWin, 1, 5, settings.roundsToWin);
    if (b.roundBreakS !== undefined) settings.roundBreakS = clampInt(b.roundBreakS, 1, 30, settings.roundBreakS);
    if (b.matchCelebrateS !== undefined) settings.matchCelebrateS = clampInt(b.matchCelebrateS, 1, 60, settings.matchCelebrateS);
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
    broadcast(); // overlay cập nhật tên/màu/nền đội ngay, không cần reload
    res.json({ success: true, settings });
  });

  router.post('/api/session/reset', (req, res) => { resetSession(); res.json({ success: true }); });
  router.post('/api/match/reset', (req, res) => { resetMatch(); res.json({ success: true }); });
  router.post('/api/round/reset', (req, res) => {
    session.matchRound += 1;
    if (session.matchRound > maxRounds()) { resetMatch(); }
    else { session.phase = 'idle'; session.phaseEndsAt = 0; session.force = { xanh: 0, do: 0 }; saveSession(); broadcast(); }
    res.json({ success: true });
  });
  router.post('/api/round/start', (req, res) => {
    if (session.phase === 'playing') return res.json({ success: false, message: 'Hiệp đang diễn ra.' });
    startRound();
    res.json({ success: true });
  });
  router.post('/api/round/stop', (req, res) => {
    if (session.phase !== 'playing') return res.json({ success: false, message: 'Không có hiệp nào đang diễn ra.' });
    session.phase = 'idle';
    session.phaseEndsAt = 0;
    saveSession();
    broadcast();
    res.json({ success: true });
  });

  // ---- Endpoint test (chỉ chạy khi demoMode bật) ----
  function needDemo(req, res) {
    if (!settings.demoMode) {
      res.status(403).json({ success: false, message: 'Bật chế độ thử trước.' });
      return false;
    }
    return true;
  }
  function testUser(name, team) {
    const uid = 'test_' + Math.random().toString(36).slice(2, 8);
    return { uid, name: name || 'Người thử' };
  }
  router.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const u = testUser((req.body || {}).name);
    handleIntake({ kind: 'join', uid: u.uid, name: u.name });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/comment', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text: b.text || 'xanh' });
    res.json({ success: true, uid: u.uid });
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
  router.post('/api/test/gift', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    // Tặng quà cần có đội trước để tính lực — cho người thử vào đội Xanh.
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text: 'xanh' });
    handleIntake({ kind: 'gift', uid: u.uid, name: u.name, giftName: b.giftName || 'Hoa hồng', coins: b.coins === undefined ? 10 : b.coins, qty: 1 });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const u = testUser((req.body || {}).name);
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text: 'đỏ' });
    handleIntake({ kind: 'follow', uid: u.uid, name: u.name });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/share', (req, res) => {
    if (!needDemo(req, res)) return;
    const u = testUser((req.body || {}).name);
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text: 'xanh' });
    handleIntake({ kind: 'share', uid: u.uid, name: u.name });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const count = Math.max(1, Math.min(200, Number((req.body || {}).count) || 100));
    for (let i = 0; i < count; i += 1) {
      const uid = `test_bulk_${i}`;
      handleIntake({ kind: 'join', uid, name: `Khán giả ${i + 1}` });
      handleIntake({ kind: 'comment', uid, name: `Khán giả ${i + 1}`, text: i % 2 === 0 ? 'xanh' : 'đỏ' });
    }
    const st = statePayload();
    res.json({ success: true, count, viewersOnline: st.viewersOnline });
  });
  router.post('/api/test/demo', (req, res) => {
    if (!needDemo(req, res)) return;
    const action = (req.body && req.body.action) || 'once';
    if (action === 'start') return res.json(startDemo());
    if (action === 'stop') return res.json(stopDemo());
    const steps = [];
    const a = testUser('Demo A');
    handleIntake({ kind: 'join', uid: a.uid, name: a.name });
    handleIntake({ kind: 'comment', uid: a.uid, name: a.name, text: 'xanh' });
    steps.push('join + vào đội Xanh');
    const b = testUser('Demo B');
    handleIntake({ kind: 'join', uid: b.uid, name: b.name });
    handleIntake({ kind: 'comment', uid: b.uid, name: b.name, text: 'đỏ' });
    steps.push('join + vào đội Đỏ');
    testTapTotals[a.uid] = 20;
    handleIntake({ kind: 'tap', uid: a.uid, name: a.name, totalLikeCount: 20 });
    steps.push('thả 20 tim cho đội Xanh');
    handleIntake({ kind: 'comment', uid: b.uid, name: b.name, text: 'Kéo mạnh lên!' });
    steps.push('bình luận cổ vũ đội Đỏ');
    handleIntake({ kind: 'gift', uid: a.uid, name: a.name, giftName: 'Hoa hồng', coins: 10, qty: 1 });
    steps.push('quà 10 xu cho đội Xanh');
    handleIntake({ kind: 'follow', uid: b.uid, name: b.name });
    steps.push('follow đội Đỏ');
    res.json({ success: true, steps });
  });
  router.post('/api/test/demo-start', (req, res) => {
    if (!needDemo(req, res)) return;
    res.json(startDemo());
  });
  router.post('/api/test/demo-stop', (req, res) => {
    if (!needDemo(req, res)) return;
    res.json(stopDemo());
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
