// ĐẤU TRÍ — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-dau-tri.md:
// Đấu trường tri thức 2 đội (A xanh / B cam). Streamer ra câu hỏi, khán giả
// trả lời bằng bình luận A/B/C/D. Đội trả lời đúng nhiều + nhanh hơn thì thắng.
// - Vào đội: bình luận "đội a" / "đội b" (không dấu cũng nhận; 1 = đội A,
//   2 = đội B). Chưa chọn đội thì câu trả lời không tính điểm đội (vẫn hiện
//   tên). Đổi đội chỉ giữa các trận (1 trận = 10 câu).
// - Ngân hàng câu hỏi: dashboard thêm/sửa/xóa (mặc định kèm 10 câu sẵn).
//   Streamer bấm "Câu tiếp theo" hoặc bật chế độ tự động.
// - Trả lời: bình luận đúng 1 chữ A/B/C/D. Mỗi người chỉ trả lời 1 lần/câu
//   (lần đầu tính, lần sau bỏ qua). Đúng = +10 điểm cho đội; người đúng ĐẦU
//   TIÊN của câu +5 thưởng. Sai = 0. Hết 30s/câu -> chốt đáp án, hiện đáp án
//   đúng + bảng điểm (màn reveal 5s).
// - Tim không tính điểm (chỉ cổ vũ). Quà: 1 xu = +2 điểm cho đội người tặng.
//   Follow = +10 điểm đội mình 1 lần/trận.
// - Hết 10 câu: đội nhiều điểm hơn thắng. Hòa -> đội có nhiều người trả lời
//   đúng đầu tiên hơn thắng. Vinh danh top 3 cá nhân (nhiều câu đúng nhất)
//   30s -> trận mới (câu hỏi xáo trộn lại, đội giữ nguyên).
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
  const GAME = 'dau-tri';
  const GAME_NAME_VI = 'Đấu Trí';
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
  const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const TEAM_NAMES = { a: 'Đội A', b: 'Đội B' };
  // Tên đội hiển thị = settings (dashboard tùy chỉnh được); fallback TEAM_NAMES.
  function teamName(t) {
    if (t === 'a') return (settings.teamAName || TEAM_NAMES.a);
    if (t === 'b') return (settings.teamBName || TEAM_NAMES.b);
    return TEAM_NAMES.a;
  }
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_CHEERS = ['Câu này dễ!', 'Chắc chắn là A!', 'Tôi biết đáp án!', 'Hồi hộp quá!'];
  const LETTERS = ['a', 'b', 'c', 'd'];

  function defaultQuestions() {
    return [
      { id: 'q1', text: 'Thủ đô của Việt Nam là thành phố nào?', options: ['TP. Hồ Chí Minh', 'Hà Nội', 'Huế', 'Đà Nẵng'], correct: 'b' },
      { id: 'q2', text: '2 + 2 × 3 bằng bao nhiêu?', options: ['12', '10', '8', '6'], correct: 'c' },
      { id: 'q3', text: 'Hành tinh nào gần Mặt Trời nhất?', options: ['Sao Kim', 'Sao Hỏa', 'Sao Thủy', 'Sao Mộc'], correct: 'c' },
      { id: 'q4', text: 'Cái gì càng dùng càng ngắn?', options: ['Nến', 'Bút chì', 'Thước kẻ', 'Sợi dây'], correct: 'b' },
      { id: 'q5', text: 'Sông nào dài nhất chảy qua Việt Nam?', options: ['Sông Hồng', 'Sông Mekong', 'Sông Đồng Nai', 'Sông Cả'], correct: 'b' },
      { id: 'q6', text: 'Con gì có 8 chân?', options: ['Nhện', 'Kiến', 'Ong', 'Bướm'], correct: 'a' },
      { id: 'q7', text: 'Một năm nhuận có bao nhiêu ngày?', options: ['365', '366', '364', '360'], correct: 'b' },
      { id: 'q8', text: 'Tiếng Anh của "con mèo" là gì?', options: ['Dog', 'Bird', 'Cat', 'Fish'], correct: 'c' },
      { id: 'q9', text: 'Cái gì có răng mà không cắn được?', options: ['Lược', 'Cưa', 'Bánh răng', 'Tất cả đều cắn được'], correct: 'a' },
      { id: 'q10', text: 'Nước nào đông dân nhất thế giới (năm 2024)?', options: ['Trung Quốc', 'Ấn Độ', 'Mỹ', 'Indonesia'], correct: 'b' },
    ];
  }

  const defaultSettings = {
    correctPoints: 10,    // điểm / câu trả lời đúng
    firstBonus: 5,        // thưởng người đúng đầu tiên của câu
    questionS: 30,        // giây / câu
    revealS: 5,           // giây hiện đáp án đúng sau khi chốt
    questionsPerMatch: 10, // số câu / trận
    coinToPoints: 2,      // điểm / 1 xu quà
    followPoints: 10,     // điểm follow (1 lần/trận)
    autoMode: false,      // tự động chuyển câu
    spotlightS: 30,       // vinh danh top 3 (giây)
    demoMode: false,
    voiceEnabled: true,
    teamAName: 'Đội A',
    teamBName: 'Đội B',
    teamABg: '',
    teamBBg: '',
    teamAColor: '#38BDF8',
    teamBColor: '#FB923C',
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  let questions = loadJson(QUESTIONS_FILE, null);
  if (!Array.isArray(questions) || questions.length === 0) {
    questions = defaultQuestions();
    saveJson(QUESTIONS_FILE, questions);
  }
  function saveQuestions() { saveJson(QUESTIONS_FILE, questions); }

  function defaultSession() {
    return {
      matchNo: 1,
      phase: 'lobby',       // lobby | question | reveal | between | spotlight
      phaseEndsAt: 0,
      questionNo: 0,        // câu hiện tại (1-based), 0 = chưa bắt đầu
      questionOrder: [],    // thứ tự id câu hỏi đã xáo trộn của trận
      current: null,        // { questionId, text, options, counts, answers, firstCorrect, locked, correct, endsAt }
      points: { a: 0, b: 0 },
      firstCounts: { a: 0, b: 0 },
      players: {},          // uid -> player
      winner: null,         // { team, points, reason, at, top3 }
      logs: [],
      stats: { joins: 0, comments: 0, answers: 0, answersCorrect: 0, answersBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, leaves: 0 },
      avatarStats: { total: 0, withAvatar: 0 },
      avatarSeen: {},
      webhookCount: 0,
      demoActive: false,
      createdAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.players) session.players = {};
  if (!session.points) session.points = { a: 0, b: 0 };
  if (!session.firstCounts) session.firstCounts = { a: 0, b: 0 };
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  session.demoActive = false; // demo không sống qua restart
  if (session.phase === 'question' || session.phase === 'reveal') session.phase = 'lobby';
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
  function cleanTeamName(v, fallback) {
    const t = String(v == null ? '' : v).replace(/[<>&]/g, '').trim().slice(0, 24);
    return t || fallback;
  }
  function validTeamBg(v, fallback) {
    const t = String(v == null ? '' : v).trim();
    if (!t) return ''; // để trống = không ảnh nền
    if (!/^(https?:\/\/|\/shared\/)/.test(t)) return fallback;
    if (/[\s"'()]/.test(t)) return fallback;
    return t;
  }
  function validTeamColor(v, fallback) {
    const t = String(v == null ? '' : v).trim();
    return /^#[0-9a-fA-F]{6}$/.test(t) ? t : fallback;
  }
  function log(text) {
    session.logs.push({ t: Date.now(), text });
    if (session.logs.length > 100) session.logs = session.logs.slice(-100);
  }
  function broadcast() { ctx.io.emit('state-update', statePayload()); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function topIndividuals() {
    return Object.values(session.players)
      .filter((p) => !p.left && (p.correctMatch || 0) > 0)
      .sort((x, y) => (y.correctMatch || 0) - (x.correctMatch || 0) || (y.firstMatch || 0) - (x.firstMatch || 0))
      .slice(0, 3)
      .map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, team: p.team || null, correct: p.correctMatch || 0, first: p.firstMatch || 0 }));
  }
  function statePayload() {
    const players = Object.values(session.players)
      .filter((p) => !p.left)
      .sort((a, b) => (b.correctMatch || 0) - (a.correctMatch || 0));
    const byTeam = { a: [], b: [], none: [] };
    for (const p of players) byTeam[p.team || 'none'].push(p);
    const cur = session.current;
    return {
      game: GAME,
      username: USERNAME,
      matchNo: session.matchNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      questionNo: session.questionNo,
      questionsPerMatch: Math.min(settings.questionsPerMatch, questions.length),
      bankCount: questions.length,
      current: cur ? {
        questionId: cur.questionId,
        text: cur.text,
        options: cur.options,
        counts: cur.counts,
        totalAnswers: Object.keys(cur.answers).length,
        firstCorrect: cur.firstCorrect,
        locked: cur.locked,
        // Đáp án đúng CHỈ hiện sau khi chốt (chống gian lận qua state JSON).
        correct: cur.locked ? cur.correct : null,
        endsAt: cur.endsAt,
      } : null,
      points: session.points,
      firstCounts: session.firstCounts,
      players: players.slice(0, 48).map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarUrl: p.avatarUrl || null,
        team: p.team || null,
        correct: p.correctMatch || 0,
        first: p.firstMatch || 0,
        answeredCurrent: !!(cur && cur.answers[p.uid]),
        left: !!p.left,
      })),
      teamCounts: { a: byTeam.a.length, b: byTeam.b.length, none: byTeam.none.length },
      top: {
        a: byTeam.a.slice(0, 5).map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, correct: p.correctMatch || 0 })),
        b: byTeam.b.slice(0, 5).map((p) => ({ uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, correct: p.correctMatch || 0 })),
      },
      top3: topIndividuals(),
      stats: session.stats,
      avatarStats: session.avatarStats,
      logs: session.logs.slice(-12),
      winner: session.winner,
      webhookCount: session.webhookCount,
      demoActive: session.demoActive,
      demoMode: settings.demoMode,
      autoMode: settings.autoMode,
      voiceEnabled: settings.voiceEnabled,
      settings: {
        correctPoints: settings.correctPoints,
        firstBonus: settings.firstBonus,
        questionS: settings.questionS,
        revealS: settings.revealS,
        questionsPerMatch: settings.questionsPerMatch,
        coinToPoints: settings.coinToPoints,
        followPoints: settings.followPoints,
        spotlightS: settings.spotlightS,
        teamAName: settings.teamAName || TEAM_NAMES.a,
        teamBName: settings.teamBName || TEAM_NAMES.b,
        teamABg: settings.teamABg || '',
        teamBBg: settings.teamBBg || '',
        teamAColor: settings.teamAColor || '#38BDF8',
        teamBColor: settings.teamBColor || '#FB923C',
      },
      now: Date.now(),
    };
  }

  // -- team / answer detection -----------------------------------------------
  function detectTeam(text) {
    if (!text) return null;
    const norm = normVi(text);
    const tokens = norm.split(/\s+/).filter(Boolean);
    if (tokens.includes('doi') && tokens.includes('b')) return 'b';
    if (tokens.includes('doi') && tokens.includes('a')) return 'a';
    if (tokens.includes('2')) return 'b';
    if (tokens.includes('1')) return 'a';
    return null;
  }
  // Đáp án: bình luận đúng 1 chữ A/B/C/D (bỏ dấu câu ở cuối).
  function detectAnswer(text) {
    if (!text) return null;
    const cleaned = normVi(text).replace(/[^a-z]/g, '');
    if (cleaned.length === 1 && LETTERS.includes(cleaned)) return cleaned;
    return null;
  }

  // -- question flow ---------------------------------------------------------
  function startMatch() {
    session.matchNo = session.matchNo || 1;
    session.questionOrder = shuffle(questions.map((q) => q.id));
    session.questionNo = 0;
    session.points = { a: 0, b: 0 };
    session.firstCounts = { a: 0, b: 0 };
    session.winner = null;
    for (const p of Object.values(session.players)) {
      p.correctMatch = 0;
      p.firstMatch = 0;
      p.followedMatch = false;
    }
    log(`Trận ${session.matchNo} bắt đầu (${Math.min(settings.questionsPerMatch, questions.length)} câu).`);
  }
  function openQuestion() {
    const total = Math.min(settings.questionsPerMatch, questions.length);
    if (session.questionNo >= total) { endMatch(); return; }
    const qid = session.questionOrder[session.questionNo];
    const q = questions.find((x) => x.id === qid) || questions[0];
    session.questionNo += 1;
    const now = Date.now();
    session.current = {
      questionId: q.id,
      text: q.text,
      options: q.options.slice(),
      correct: q.correct,
      counts: { a: 0, b: 0, c: 0, d: 0 },
      answers: {},
      firstCorrect: null,
      locked: false,
      endsAt: now + settings.questionS * 1000,
    };
    session.phase = 'question';
    session.phaseEndsAt = session.current.endsAt;
    log(`Câu ${session.questionNo}/${total}: ${q.text}`);
    ctx.io.emit('question', { no: session.questionNo, total, text: q.text });
    saveSession();
    broadcast();
  }
  function lockQuestion() {
    if (!session.current || session.current.locked) return;
    const cur = session.current;
    cur.locked = true;
    session.phase = 'reveal';
    session.phaseEndsAt = Date.now() + settings.revealS * 1000;
    const correctLetter = cur.correct.toUpperCase();
    log(`Chốt câu ${session.questionNo}: đáp án đúng là ${correctLetter}.`);
    ctx.io.emit('reveal', { correct: cur.correct, counts: cur.counts });
    saveSession();
    broadcast();
  }
  function advanceAfterReveal() {
    const total = Math.min(settings.questionsPerMatch, questions.length);
    if (session.questionNo >= total) { endMatch(); return; }
    if (settings.autoMode) {
      openQuestion();
    } else {
      session.phase = 'between';
      session.phaseEndsAt = 0;
      saveSession();
      broadcast();
    }
  }
  // Nút "Câu tiếp theo" của streamer: lobby -> bắt đầu trận + mở câu 1;
  // question -> chốt ngay; reveal/between -> mở câu kế (hoặc kết thúc trận).
  function nextQuestion() {
    if (session.phase === 'spotlight') return { ok: false, reason: 'spotlight' };
    if (session.phase === 'question') {
      lockQuestion();
      return { ok: true, phase: session.phase };
    }
    if (session.phase === 'lobby') startMatch();
    if (session.phase === 'between' || session.phase === 'lobby' || session.phase === 'reveal') {
      const total = Math.min(settings.questionsPerMatch, questions.length);
      if (session.questionNo >= total && session.questionNo > 0) { endMatch(); return { ok: true, phase: session.phase }; }
      openQuestion();
      return { ok: true, phase: session.phase };
    }
    return { ok: false, reason: 'unknown-phase' };
  }
  function endMatch() {
    const now = Date.now();
    const pa = session.points.a;
    const pb = session.points.b;
    let winner = null;
    let reason = '';
    if (pa !== pb) {
      winner = pa > pb ? 'a' : 'b';
      reason = `điểm ${pa} - ${pb}`;
    } else {
      const fa = session.firstCounts.a;
      const fb = session.firstCounts.b;
      if (fa !== fb) {
        winner = fa > fb ? 'a' : 'b';
        reason = `hòa điểm ${pa} - ${pb}, hơn số lần đúng đầu tiên ${fa} - ${fb}`;
      } else {
        reason = `hòa ${pa} - ${pb}, hòa cả số lần đúng đầu tiên`;
      }
    }
    const top3 = topIndividuals();
    session.winner = winner
      ? { team: winner, points: { a: pa, b: pb }, reason, top3, at: now }
      : { team: null, points: { a: pa, b: pb }, reason, top3, at: now };
    session.phase = 'spotlight';
    session.phaseEndsAt = now + settings.spotlightS * 1000;
    session.current = null;
    if (winner) {
      log(`Hết trận: ${teamName(winner)} thắng (${reason}).`);
      ctx.io.emit('match-win', { team: winner, text: `${teamName(winner)} đã thắng trận!` });
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
    session.questionNo = 0;
    session.questionOrder = [];
    session.current = null;
    session.points = { a: 0, b: 0 };
    session.firstCounts = { a: 0, b: 0 };
    session.winner = null;
    for (const p of Object.values(session.players)) {
      p.correctMatch = 0;
      p.firstMatch = 0;
      p.followedMatch = false;
    }
    log(`Trận ${session.matchNo} chuẩn bị (đội giữ nguyên, câu hỏi xáo lại).`);
    saveSession();
    broadcast();
  }

  // -- players ---------------------------------------------------------------
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
        correctMatch: 0,
        firstMatch: 0,
        lastCommentAt: 0,
        followedMatch: false,
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
        const inMatch = session.phase === 'question' || session.phase === 'reveal' || session.phase === 'between';
        if (!inMatch) {
          if (p.team !== team) {
            p.team = team;
            log(`${p.name} vào ${teamName(team)}.`);
          }
        } else if (p.team && p.team !== team) {
          log(`${p.name} muốn đổi sang ${teamName(team)} — chỉ đổi được giữa các trận.`);
        } else if (!p.team) {
          p.team = team;
          log(`${p.name} vào ${teamName(team)}.`);
        }
        saveSession(); broadcast();
        return { ok: true };
      }
      // Trả lời câu hỏi: đúng 1 chữ A/B/C/D, 1 lần/câu.
      const letter = detectAnswer(text);
      if (letter) {
        const cur = session.current;
        if (!cur || cur.locked || session.phase !== 'question') {
          return { ok: false, reason: 'no-active-question' };
        }
        if (cur.answers[p.uid]) {
          session.stats.answersBlocked += 1;
          saveSession(); broadcast();
          return { ok: false, reason: 'already-answered' };
        }
        const correct = letter === cur.correct;
        cur.answers[p.uid] = { letter, correct, at: now };
        cur.counts[letter] += 1;
        session.stats.answers += 1;
        if (correct) {
          session.stats.answersCorrect += 1;
          p.correctMatch = (p.correctMatch || 0) + 1;
          if (p.team) {
            session.points[p.team] += settings.correctPoints;
            if (!cur.firstCorrect) {
              cur.firstCorrect = { uid: p.uid, name: p.name, team: p.team, avatarUrl: p.avatarUrl || null };
              session.points[p.team] += settings.firstBonus;
              session.firstCounts[p.team] += 1;
              p.firstMatch = (p.firstMatch || 0) + 1;
              log(`⚡ ${p.name} trả lời đúng ĐẦU TIÊN (+${settings.firstBonus} thưởng)!`);
            }
          } else if (!cur.firstCorrect) {
            // Chưa có đội: vẫn ghi nhận đúng đầu tiên để hiện tên, nhưng
            // không cộng điểm đội và không tính vào firstCounts.
            cur.firstCorrect = { uid: p.uid, name: p.name, team: null, avatarUrl: p.avatarUrl || null };
          }
        }
        saveSession(); broadcast();
        return { ok: true, correct };
      }
      // Bình luận khác: chỉ đếm, không tính điểm.
      session.stats.comments += 1;
      saveSession(); broadcast();
      return { ok: true };
    }
    if (kind === 'tap') {
      const p = ensurePlayer(ev);
      if (!p) { saveSession(); broadcast(); return { ok: true }; }
      const total = ev.totalLikeCount != null ? ev.totalLikeCount : (ev.likeCount != null ? ev.likeCount : null);
      const d = total !== null ? tapDelta.delta(String(ev.uid), total) : 1;
      if (d > 0) {
        session.stats.taps += d;
        ctx.io.emit('cheer', { uid: p.uid, name: p.name, count: d });
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
        console.warn(`[dau-tri] unknown gift coins from ${ev.uid} (${ev.giftName || '?'})`);
        saveSession(); broadcast();
        return { ok: false, reason: 'unknown-coins' };
      }
      session.stats.gifts += 1;
      const pts = Math.floor(coins) * settings.coinToPoints;
      session.points[p.team] += pts;
      log(`${p.name} tặng ${coins} xu -> +${pts} điểm ${teamName(p.team)}.`);
      saveSession(); broadcast();
      return { ok: true, points: pts };
    }
    if (kind === 'follow') {
      const p = ensurePlayer(ev);
      session.stats.follows += 1;
      if (p && p.team && !p.followedMatch) {
        p.followedMatch = true;
        session.points[p.team] += settings.followPoints;
        log(`${p.name} follow -> +${settings.followPoints} điểm ${teamName(p.team)}.`);
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
    if (session.phase === 'question') {
      if (session.current && session.current.endsAt && now >= session.current.endsAt) {
        lockQuestion();
      }
      return;
    }
    if (session.phase === 'reveal') {
      if (session.phaseEndsAt && now >= session.phaseEndsAt) advanceAfterReveal();
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
        p.team = i % 2 === 0 ? 'a' : 'b';
        p.left = false;
      }
      handleIntake({ kind: 'tap', uid, name: `Demo ${name}`, totalLikeCount: 0 });
    });
    // Demo cần câu đang mở mới trả lời được.
    if (session.phase === 'lobby' || session.phase === 'between') {
      nextQuestion();
    }
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 12 người demo trả lời ngẫu nhiên A–D.');
    const step = () => {
      if (!session.demoActive) return;
      const demoPlayers = Object.values(session.players).filter((p) => p.uid.startsWith('demo_') && !p.left);
      if (demoPlayers.length === 0) return;
      const me = demoPlayers[Math.floor(Math.random() * demoPlayers.length)];
      const r = Math.random();
      if (r < 0.6) {
        // Trả lời ngẫu nhiên A–D cho câu đang mở (50% chọn đúng đáp án để
        // demo thấy điểm tăng; còn lại chọn ngẫu nhiên).
        if (session.phase === 'question' && session.current) {
          const letter = Math.random() < 0.5
            ? session.current.correct
            : LETTERS[Math.floor(Math.random() * 4)];
          handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: letter });
        }
      } else if (r < 0.75) {
        demoTapTotals[me.uid] = (demoTapTotals[me.uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid: me.uid, name: me.name, totalLikeCount: demoTapTotals[me.uid] });
      } else if (r < 0.87) {
        const coins = [1, 5, 10][Math.floor(Math.random() * 3)];
        handleIntake({ kind: 'gift', uid: me.uid, name: me.name, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.94) {
        handleIntake({ kind: 'follow', uid: me.uid, name: me.name });
      } else {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
      }
    };
    demoTimer = timers.setInterval(step, 1500);
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
        p.team = i % 2 === 0 ? 'a' : 'b';
        p.left = false;
      }
    });
    if (session.phase === 'lobby' || session.phase === 'between') {
      nextQuestion();
    }
    const cur = session.current;
    if (cur) {
      const correct = cur.correct;
      const wrong = LETTERS.find((l) => l !== correct);
      handleIntake({ kind: 'comment', uid: demoUid(DEMO_NAMES[0]), name: 'Demo An', text: correct });
      handleIntake({ kind: 'comment', uid: demoUid(DEMO_NAMES[1]), name: 'Demo Bình', text: wrong });
      handleIntake({ kind: 'comment', uid: demoUid(DEMO_NAMES[2]), name: 'Demo Chi', text: correct });
      handleIntake({ kind: 'gift', uid: demoUid(DEMO_NAMES[3]), name: 'Demo Dũng', coins: 5, giftName: 'Quà demo' });
    }
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
    // parseTikFinityEvent trả field `avatar`, còn engine dùng `avatarUrl` —
    // không map thì avatar thật từ TikFinity không bao giờ vào player.
    if (ev && !ev.avatarUrl && ev.avatar) ev.avatarUrl = ev.avatar;
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

  // Ngân hàng câu hỏi (dashboard quản lý).
  router.get('/api/questions', (req, res) => res.json({ questions }));
  router.post('/api/questions', (req, res) => {
    const b = req.body || {};
    const text = String(b.text || '').trim();
    const options = Array.isArray(b.options) ? b.options.map((o) => String(o || '').trim()) : [];
    const correct = String(b.correct || '').toLowerCase();
    if (!text || options.length !== 4 || options.some((o) => !o) || !LETTERS.includes(correct)) {
      return res.status(400).json({ success: false, message: 'Câu hỏi cần nội dung + đủ 4 đáp án + đáp án đúng A/B/C/D.' });
    }
    const q = { id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, options, correct };
    questions.push(q);
    saveQuestions();
    res.json({ success: true, question: q });
  });
  router.put('/api/questions/:id', (req, res) => {
    const q = questions.find((x) => x.id === req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi.' });
    const b = req.body || {};
    if (b.text !== undefined) q.text = String(b.text || '').trim() || q.text;
    if (Array.isArray(b.options) && b.options.length === 4 && b.options.every((o) => String(o || '').trim())) {
      q.options = b.options.map((o) => String(o).trim());
    }
    if (b.correct !== undefined && LETTERS.includes(String(b.correct).toLowerCase())) q.correct = String(b.correct).toLowerCase();
    saveQuestions();
    res.json({ success: true, question: q });
  });
  router.delete('/api/questions/:id', (req, res) => {
    const idx = questions.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi.' });
    if (questions.length <= 1) return res.status(400).json({ success: false, message: 'Phải giữ ít nhất 1 câu hỏi.' });
    questions.splice(idx, 1);
    saveQuestions();
    res.json({ success: true });
  });

  router.post('/api/question/next', (req, res) => {
    res.json(nextQuestion());
  });
  router.post('/api/question/lock', (req, res) => {
    lockQuestion();
    res.json({ success: true, phase: session.phase });
  });

  router.post('/api/settings', (req, res) => {
    const b = req.body || {};
    if (b.correctPoints !== undefined) settings.correctPoints = clampInt(b.correctPoints, 1, 100, settings.correctPoints);
    if (b.firstBonus !== undefined) settings.firstBonus = clampInt(b.firstBonus, 0, 50, settings.firstBonus);
    if (b.questionS !== undefined) settings.questionS = clampInt(b.questionS, 2, 300, settings.questionS);
    if (b.revealS !== undefined) settings.revealS = clampInt(b.revealS, 1, 30, settings.revealS);
    if (b.questionsPerMatch !== undefined) settings.questionsPerMatch = clampInt(b.questionsPerMatch, 1, 50, settings.questionsPerMatch);
    if (b.coinToPoints !== undefined) settings.coinToPoints = clampInt(b.coinToPoints, 1, 100, settings.coinToPoints);
    if (b.followPoints !== undefined) settings.followPoints = clampInt(b.followPoints, 0, 100, settings.followPoints);
    if (b.autoMode !== undefined) settings.autoMode = !!b.autoMode;
    if (b.spotlightS !== undefined) settings.spotlightS = clampInt(b.spotlightS, 1, 120, settings.spotlightS);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    if (b.teamAName !== undefined) settings.teamAName = cleanTeamName(b.teamAName, settings.teamAName);
    if (b.teamBName !== undefined) settings.teamBName = cleanTeamName(b.teamBName, settings.teamBName);
    if (b.teamABg !== undefined) settings.teamABg = validTeamBg(b.teamABg, settings.teamABg);
    if (b.teamBBg !== undefined) settings.teamBBg = validTeamBg(b.teamBBg, settings.teamBBg);
    if (b.teamAColor !== undefined) settings.teamAColor = validTeamColor(b.teamAColor, settings.teamAColor);
    if (b.teamBColor !== undefined) settings.teamBColor = validTeamColor(b.teamBColor, settings.teamBColor);
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
  router.post('/api/test/answer', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const r = handleIntake({ kind: 'comment', uid: b.uid || testUser(b.name).uid, name: b.name || 'Người thử', text: b.letter || 'a' });
    res.json({ success: !!r.ok, ...r });
  });
  router.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    const r = handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: b.team === 'b' ? 'đội b' : 'đội a' });
    res.json({ success: !!r.ok, ...r });
  });
  router.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(500, Number(b.count) || 20));
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
    handleIntake({ kind: 'comment', uid: b.uid || u.uid, name: b.name || u.name, text: b.text || 'a' });
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
  router.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(200, Number(b.count) || 50));
    for (let i = 0; i < count; i++) {
      const uid = `test_bulk_${i}`;
      const p = ensurePlayer({ uid, name: `Người xem ${i + 1}` });
      if (p) {
        p.team = i % 2 === 0 ? 'a' : 'b';
        p.left = false;
      }
    }
    saveSession(); broadcast();
    res.json({ success: true, count, teamCounts: { a: Object.values(session.players).filter((p) => !p.left && p.team === 'a').length, b: Object.values(session.players).filter((p) => !p.left && p.team === 'b').length } });
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
