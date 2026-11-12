// ĐẤU TRƯỜNG SINH TỒN — engine nền tảng (room theo TikTok ID).
// Cơ chế lấy từ ~/workspace/overlay-moi/prompt-agent-dau-truong-sinh-ton.md:
// battle royale: bình luận "tham gia" -> chiến binh 100 HP + vũ khí ngẫu nhiên;
// 1 tim = đánh ngẫu nhiên 1 địch -1 HP; bình luận tên 1 chiến binh = -3 HP;
// 1 xu quà = +1 sát thương đòn tiếp theo (dồn tối đa +20); quà >=100 xu hồi
// +20 HP; follow = +10 HP 1 lần/trận. HP 0 -> gục, 10s sau biến mất khỏi sân.
// Vòng bo sau 3 phút: mỗi 10s mọi chiến binh -1 HP. Hết 10 phút còn >1 người
// -> người nhiều HP nhất thắng. Còn đúng 1 người -> spotlight 30s -> trận mới.
// Demo theo ~/workspace/overlay-moi/demo-mode-contract.md.
// TikFinity thật (xác minh từ log live thật): action WebHook CHỈ có ô URL,
// KHÔNG có body — 6 Action, mỗi action 1 URL riêng ?event=<loại>.
'use strict';

function createEngine(ctx) {
  const __dirname = ctx.gameDir;
  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const { loadJson, saveJson, normVi, parseTikFinityEvent, TapDelta, withTimers, mountTts } = require('../../lib/game-common');
  const { webhookUrl, publicBaseUrl } = require('../../lib/webhook-bodies');
  const TIKFINITY_ACTIONS = [
    { key: 'gift', actionName: 'Dau Truong Sinh Ton - Qua', triggerLabel: 'Sending a gift with min. coins value (min coins = 1)' },
    { key: 'chat', actionName: 'Dau Truong Sinh Ton - Binh luan', triggerLabel: 'Chat (any comment)' },
    { key: 'like', actionName: 'Dau Truong Sinh Ton - Tim', triggerLabel: 'Sending likes (taps)' },
    { key: 'follow', actionName: 'Dau Truong Sinh Ton - Follow', triggerLabel: 'Follow' },
    { key: 'share', actionName: 'Dau Truong Sinh Ton - Share', triggerLabel: 'Share' },
    { key: 'join', actionName: 'Dau Truong Sinh Ton - Vao phong', triggerLabel: 'Join' },
  ];
  const timers = withTimers(ctx);
  const DATA_DIR = ctx.dataDir;
  const USERNAME = String(ctx.roomPrefix || '').split('/').filter(Boolean).pop() || 'live';
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const SESSION_FILE = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const WEAPONS = [
    { id: 'kiem', icon: '⚔️', name: 'Kiếm' },
    { id: 'cung', icon: '🏹', name: 'Cung' },
    { id: 'bua', icon: '🔨', name: 'Búa' },
  ];

  const defaultSettings = {
    startHp: 100,         // HP khởi đầu
    tapDamage: 1,         // sát thương / 1 tim
    commentDamage: 3,     // sát thương khi bình luận đúng tên địch
    giftHealCoins: 100,   // quà >= X xu thì hồi máu
    giftHealHp: 20,       // hồi bao nhiêu HP
    followHealHp: 10,     // follow hồi bao nhiêu HP (1 lần/trận)
    maxBonus: 20,         // sát thương cộng dồn tối đa từ quà
    zoneAfterS: 180,      // vòng bo bắt đầu sau bao nhiêu giây
    zoneIntervalS: 10,    // vòng bo trừ HP mỗi bao nhiêu giây
    matchDurationS: 600,  // tối đa 1 trận (giây)
    maxFighters: 24,      // tối đa chiến binh trên sân
    downVisibleS: 10,     // người gục nằm trên sân bao lâu thì biến mất
    spotlightS: 30,       // vinh danh người thắng (giây)
    commentSpamS: 5,      // chống spam bình luận (giây/người)
    demoMode: false,
    voiceEnabled: true,
  };
  let settings = loadJson(SETTINGS_FILE, defaultSettings);
  saveJson(SETTINGS_FILE, settings);

  function defaultSession() {
    return {
      matchNo: 1,
      phase: 'lobby',       // lobby | fighting | spotlight
      phaseEndsAt: 0,
      matchStartedAt: 0,
      matchEndsAt: 0,
      zoneStartAt: 0,
      nextZoneAt: 0,
      zoneTicks: 0,
      fighters: {},         // uid -> fighter (cả đang đánh + đã gục trong trận)
      queue: [],            // uid chờ vào sân (đủ 24 người)
      downed: [],           // [{uid, name, downAt}] bảng "Đã gục" của trận
      winner: null,         // {uid, name, hp} hoặc null (hòa)
      players: {},          // uid -> {uid, name, avatarUrl, lastCommentAt, followedMatch, left, joinedAt}
      logs: [],
      stats: { joins: 0, comments: 0, commentsBlocked: 0, taps: 0, gifts: 0, giftsUnknown: 0, follows: 0, shares: 0, hits: 0, downs: 0 },
      avatarStats: { total: 0, withAvatar: 0 },
      avatarSeen: {},
      webhookCount: 0,
      demoActive: false,
      createdAt: Date.now(),
    };
  }
  let session = loadJson(SESSION_FILE, defaultSession());
  if (!session.fighters) session.fighters = {};
  if (!session.queue) session.queue = [];
  if (!session.downed) session.downed = [];
  if (!session.players) session.players = {};
  if (!session.stats) session.stats = defaultSession().stats;
  if (!session.avatarStats) session.avatarStats = { total: 0, withAvatar: 0 };
  if (!session.avatarSeen) session.avatarSeen = {};
  if (typeof session.webhookCount !== 'number') session.webhookCount = 0;
  session.demoActive = false;
  if (session.phase === 'fighting') session.phase = 'lobby';
  if (session.phase === 'lobby') session.phaseEndsAt = 0;
  saveJson(SESSION_FILE, session);

  const tapDelta = new TapDelta();
  const testTapTotals = {};
  const demoTapTotals = {};
  let demoTimer = null;
  const DEMO_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khang', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Quân', 'Thảo'];
  const DEMO_CHEERS = ['Đánh đi!', 'Cố lên!', 'Hay quá!', 'Đừng thua nha!', 'Mạnh nữa lên!'];

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
  function aliveFighters() {
    return Object.values(session.fighters).filter((f) => f.alive && !f.left);
  }
  function visibleFighters() {
    const now = Date.now();
    return Object.values(session.fighters)
      .filter((f) => !f.left && (f.alive || now - f.downAt < settings.downVisibleS * 1000))
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }
  function zonePct() {
    if (!session.zoneStartAt || session.phase !== 'fighting') return 0;
    const total = Math.max(1, (session.matchEndsAt - session.zoneStartAt) / 1000);
    return Math.max(0, Math.min(1, (Date.now() - session.zoneStartAt) / 1000 / total));
  }

  function statePayload() {
    const fighters = visibleFighters().map((f) => ({
      uid: f.uid, name: f.name, weapon: f.weapon, hp: f.hp, maxHp: f.maxHp,
      alive: f.alive, bonus: f.bonus, damageDealt: f.damageDealt, downAt: f.downAt,
    }));
    const top = Object.values(session.fighters)
      .sort((a, b) => b.damageDealt - a.damageDealt)
      .slice(0, 5)
      .map((f) => ({ uid: f.uid, name: f.name, weapon: f.weapon, damage: f.damageDealt, hp: f.hp, alive: f.alive }));
    return {
      game: 'dau-truong-sinh-ton',
      username: USERNAME,
      settings,
      matchNo: session.matchNo,
      phase: session.phase,
      phaseEndsAt: session.phaseEndsAt,
      matchEndsAt: session.matchEndsAt,
      zoneActive: session.phase === 'fighting' && session.zoneStartAt > 0 && Date.now() >= session.zoneStartAt,
      zonePct: zonePct(),
      zoneTicks: session.zoneTicks,
      fighters,
      queueCount: session.queue.length,
      queueNames: session.queue.slice(0, 8).map((uid) => (session.players[uid] || {}).name || uid),
      downed: session.downed.slice(-12),
      winner: session.winner,
      top,
      viewersOnline: Object.values(session.players).filter((p) => !p.left).length,
      stats: session.stats,
      logs: session.logs.slice(-30),
      avatarStats: session.avatarStats,
      webhookCount: session.webhookCount,
      demoActive: session.demoActive,
    };
  }

  function ensurePlayer(ev) {
    let p = session.players[ev.uid];
    if (!p) {
      p = {
        uid: ev.uid, name: ev.name || ev.uid, avatarUrl: ev.avatarUrl || null,
        lastCommentAt: 0, followedMatch: 0, joinedAt: Date.now(), left: false, leftAt: 0,
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

  function randomWeapon() { return WEAPONS[Math.floor(Math.random() * WEAPONS.length)]; }

  function addFighter(player) {
    const f = {
      uid: player.uid, name: player.name, weapon: randomWeapon(),
      hp: settings.startHp, maxHp: settings.startHp,
      alive: true, bonus: 0, damageDealt: 0, downAt: 0, joinedAt: Date.now(),
    };
    session.fighters[player.uid] = f;
    log(`⚔️ ${player.name} vào trận (${f.weapon.icon} ${f.weapon.name}, ${f.hp} HP)!`);
    // Đủ 2 chiến binh là trận bắt đầu NGAY (không chờ tick) để đòn đánh
    // sau đó không bị rơi vào lúc trận chưa bắt đầu.
    if (session.phase === 'lobby' && aliveFighters().length >= 2) startMatch();
    return f;
  }

  function joinArena(player) {
    const existing = session.fighters[player.uid];
    if (existing) {
      if (existing.alive) return { ok: false, reason: 'already-in' };
      // Đã gục trong trận này: không hồi sinh, chờ trận sau.
      log(`${player.name} đã gục — chờ trận sau để tham gia lại.`);
      return { ok: false, reason: 'down-wait-next-match' };
    }
    if (aliveFighters().length >= settings.maxFighters) {
      if (!session.queue.includes(player.uid)) {
        session.queue.push(player.uid);
        log(`⏳ Sân đã đủ ${settings.maxFighters} người — ${player.name} xếp hàng chờ (vị trí ${session.queue.length}).`);
      }
      return { ok: false, reason: 'queued' };
    }
    addFighter(player);
    return { ok: true };
  }

  function promoteQueue() {
    while (session.queue.length > 0 && aliveFighters().length < settings.maxFighters) {
      const uid = session.queue.shift();
      const p = session.players[uid];
      if (!p || p.left) continue;
      if (session.fighters[uid]) continue;
      addFighter(p);
      log(`➡️ ${p.name} từ hàng chờ vào sân!`);
    }
  }

  function checkWin() {
    if (session.phase !== 'fighting') return;
    const alive = aliveFighters();
    if (alive.length === 1) {
      endMatch(alive[0], 'còn lại 1 người sống sót');
    } else if (alive.length === 0) {
      endMatch(null, 'không còn ai sống sót');
    }
  }

  function dealDamage(attacker, target, baseDmg, source) {
    if (!target || !target.alive) return 0;
    const dmg = Math.max(1, baseDmg + (attacker ? attacker.bonus : 0));
    if (attacker) attacker.bonus = 0; // sát thương cộng dồn chỉ dùng cho 1 đòn
    target.hp = Math.max(0, target.hp - dmg);
    if (attacker) attacker.damageDealt += dmg;
    session.stats.hits += 1;
    ctx.io.emit('hit', { attacker: attacker ? attacker.name : null, target: target.name, targetUid: target.uid, dmg, source });
    log(`💥 ${attacker ? attacker.name : 'Vòng bo'} đánh ${target.name} -${dmg} HP (còn ${target.hp})`);
    if (target.hp <= 0) downFighter(target);
    else checkWin();
    return dmg;
  }

  function downFighter(f) {
    f.alive = false;
    f.hp = 0;
    f.downAt = Date.now();
    session.stats.downs += 1;
    session.downed.push({ uid: f.uid, name: f.name, downAt: f.downAt });
    log(`💀 ${f.name} đã gục!`);
    ctx.io.emit('down', { uid: f.uid, name: f.name });
    promoteQueue();
    checkWin();
  }

  function startMatch() {
    session.phase = 'fighting';
    session.matchStartedAt = Date.now();
    session.matchEndsAt = Date.now() + settings.matchDurationS * 1000;
    session.zoneStartAt = Date.now() + settings.zoneAfterS * 1000;
    session.nextZoneAt = session.zoneStartAt;
    session.zoneTicks = 0;
    log(`🔥 Trận ${session.matchNo} bắt đầu! ${aliveFighters().length} chiến binh — vòng bo sau ${settings.zoneAfterS}s.`);
    ctx.io.emit('match-start', { matchNo: session.matchNo });
    saveSession();
    broadcast();
  }

  function endMatch(winner, reason) {
    session.winner = winner ? { uid: winner.uid, name: winner.name, hp: winner.hp, weapon: winner.weapon } : null;
    session.phase = 'spotlight';
    session.phaseEndsAt = Date.now() + settings.spotlightS * 1000;
    if (winner) {
      log(`👑 ${winner.name} THẮNG TRẬN ${session.matchNo}! (${reason})`);
      ctx.io.emit('match-win', { uid: winner.uid, name: winner.name });
    } else {
      log(`🤝 Trận ${session.matchNo} không có người thắng (${reason}).`);
      ctx.io.emit('match-win', { uid: null, name: null });
    }
    saveSession();
    broadcast();
  }

  function resetMatch() {
    session.matchNo += 1;
    session.phase = 'lobby';
    session.phaseEndsAt = 0;
    session.matchStartedAt = 0;
    session.matchEndsAt = 0;
    session.zoneStartAt = 0;
    session.nextZoneAt = 0;
    session.zoneTicks = 0;
    session.fighters = {};
    session.queue = [];
    session.downed = [];
    session.winner = null;
    Object.values(session.players).forEach((p) => { p.followedMatch = 0; });
    log(`Trận mới #${session.matchNo} — bình luận "tham gia" để vào trận!`);
    saveSession();
    broadcast();
  }

  function resetSession() {
    session = defaultSession();
    tapDelta.reset();
    log('Đã làm mới phiên — trận mới, mọi người tham gia lại từ đầu.');
    saveSession();
    broadcast();
  }

  function isJoinText(text) {
    const t = normVi(String(text || '').trim());
    return t === 'tham gia' || t === 'join' || t === 'chien';
  }

  function handleIntake(ev) {
    if (!ev || !ev.uid) return { ok: false, reason: 'no-uid' };
    const p = ensurePlayer(ev);
    const now = Date.now();
    const me = session.fighters[ev.uid];
    switch (ev.kind) {
      case 'join': {
        session.stats.joins += 1;
        if (!me) log(`${p.name} vào xem đấu trường — bình luận "tham gia" để làm chiến binh!`);
        break;
      }
      case 'comment': {
        session.stats.comments += 1;
        const text = String(ev.text || '');
        if (isJoinText(text)) {
          joinArena(p);
          break;
        }
        // Bình luận tên 1 chiến binh -> tập trung đánh người đó -3 HP.
        if (!me || !me.alive) break; // chưa vào trận thì không đánh được
        if (session.phase !== 'fighting') break; // trận chưa bắt đầu
        if (now - p.lastCommentAt < settings.commentSpamS * 1000) {
          session.stats.commentsBlocked += 1;
          break;
        }
        const norm = normVi(text);
        const target = aliveFighters().find((f) => f.uid !== ev.uid && norm.includes(normVi(f.name)));
        if (!target) break; // không khớp tên ai -> chỉ cổ vũ
        p.lastCommentAt = now;
        dealDamage(me, target, settings.commentDamage, 'comment');
        break;
      }
      case 'tap': {
        // likeCount của TikFinity là TỔNG TÍCH LŨY — chỉ cộng phần tăng.
        // Parser mới: like không có số -> likeCount=null -> tính 1 tim/sự kiện.
        const total = ev.totalLikeCount ?? ev.likeCount ?? null;
        const delta = total !== null ? tapDelta.delta(ev.uid, total) : 1;
        if (delta > 0) {
          session.stats.taps += delta;
          if (me && me.alive && session.phase === 'fighting') {
            for (let i = 0; i < delta; i += 1) {
              const enemies = aliveFighters().filter((f) => f.uid !== ev.uid);
              if (enemies.length === 0) break;
              const target = enemies[Math.floor(Math.random() * enemies.length)];
              dealDamage(me, target, settings.tapDamage, 'tap');
              if (!me.alive) break;
            }
          }
        }
        break;
      }
      case 'gift': {
        const coins = ev.coins;
        if (coins === null || coins === undefined || Number.isNaN(Number(coins)) || Number(coins) < 1) {
          session.stats.giftsUnknown += 1;
          console.warn(`[dau-truong-sinh-ton] qua khong ro xu tu ${p.name} (${ev.giftName || '?'})`);
          log(`⚠️ Quà của ${p.name} không rõ số xu — 0 sát thương, không mặc định +5.`);
          break;
        }
        session.stats.gifts += 1;
        if (me && me.alive) {
          me.bonus = Math.min(settings.maxBonus, me.bonus + Math.floor(Number(coins)));
          if (Number(coins) >= settings.giftHealCoins) {
            me.hp = Math.min(me.maxHp, me.hp + settings.giftHealHp);
            log(`🎁 ${p.name} tặng ${ev.giftName || 'quà'} ${coins} xu → +${settings.giftHealHp} HP (còn ${me.hp}) + sát thương dồn ${me.bonus}!`);
          } else {
            log(`🎁 ${p.name} tặng ${ev.giftName || 'quà'} ${coins} xu → sát thương đòn sau +${me.bonus}!`);
          }
        } else {
          log(`🎁 ${p.name} tặng ${ev.giftName || 'quà'} ${coins} xu nhưng chưa vào trận — bình luận "tham gia" trước!`);
        }
        break;
      }
      case 'follow': {
        session.stats.follows += 1;
        if (me && me.alive && p.followedMatch !== session.matchNo) {
          p.followedMatch = session.matchNo;
          me.hp = Math.min(me.maxHp, me.hp + settings.followHealHp);
          log(`💙 ${p.name} follow → chiến binh của mình +${settings.followHealHp} HP (còn ${me.hp})!`);
        }
        break;
      }
      case 'share': {
        session.stats.shares += 1;
        break;
      }
      case 'leave': {
        p.left = true;
        p.leftAt = now;
        // Rời live giữa trận = bỏ cuộc: tính là gục (không hồi sinh trận này).
        if (me && me.alive) {
          me.left = true;
          log(`🚪 ${p.name} rời live — bỏ cuộc.`);
          checkWin();
        }
        const qi = session.queue.indexOf(ev.uid);
        if (qi >= 0) session.queue.splice(qi, 1);
        break;
      }
      default:
        return { ok: false, reason: 'unknown-kind' };
    }
    saveSession();
    broadcast();
    return { ok: true };
  }

  function tick() {
    const now = Date.now();
    if (session.phase === 'lobby') {
      if (aliveFighters().length >= 2) startMatch();
    } else if (session.phase === 'fighting') {
      // Vòng bo: sau zoneAfterS, mỗi zoneIntervalS mọi chiến binh -1 HP.
      if (session.zoneStartAt > 0 && now >= session.nextZoneAt && now >= session.zoneStartAt) {
        session.zoneTicks += 1;
        session.nextZoneAt = now + settings.zoneIntervalS * 1000;
        log(`⭕ Vòng bo siết! Mọi chiến binh -1 HP (lần ${session.zoneTicks}).`);
        ctx.io.emit('zone', { ticks: session.zoneTicks });
        for (const f of [...aliveFighters()]) {
          f.hp = Math.max(0, f.hp - 1);
          if (f.hp <= 0) downFighter(f);
        }
        checkWin();
      }
      // Hết giờ trận: còn >1 người -> người nhiều HP nhất thắng.
      if (session.phase === 'fighting' && now >= session.matchEndsAt) {
        const alive = aliveFighters().sort((a, b) => b.hp - a.hp || a.joinedAt - b.joinedAt);
        endMatch(alive[0] || null, alive[0] ? `hết 10 phút, nhiều HP nhất (${alive[0].hp})` : 'không còn ai sống sót');
      }
    } else if (session.phase === 'spotlight') {
      if (now >= session.phaseEndsAt) resetMatch();
    }
    saveSession();
  }

  // ---- Demo (theo demo-mode-contract) ----
  function demoUid(name) { return 'demo_' + name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); }
  function startDemo() {
    if (session.webhookCount > 0) {
      return { success: false, message: 'Phòng đã có sự kiện thật, không chạy demo được.' };
    }
    if (!settings.demoMode) {
      return { success: false, message: 'Bật chế độ thử trước rồi mới chạy demo.' };
    }
    if (session.demoActive) return { success: true, demoActive: true, message: 'Demo đang chạy.' };
    DEMO_NAMES.forEach((name) => {
      handleIntake({ kind: 'join', uid: demoUid(name), name: `Demo ${name}`, avatarUrl: null });
      handleIntake({ kind: 'comment', uid: demoUid(name), name: `Demo ${name}`, text: 'tham gia' });
      handleIntake({ kind: 'tap', uid: demoUid(name), name: `Demo ${name}`, totalLikeCount: 0 });
    });
    session.demoActive = true;
    log('🧪 Demo bắt đầu — 12 chiến binh demo vào trận.');
    const step = () => {
      if (!session.demoActive) return;
      const alive = aliveFighters().filter((f) => f.uid.startsWith('demo_'));
      if (alive.length === 0) return;
      const me = alive[Math.floor(Math.random() * alive.length)];
      const r = Math.random();
      if (r < 0.45) {
        demoTapTotals[me.uid] = (demoTapTotals[me.uid] || 0) + 1 + Math.floor(Math.random() * 6);
        handleIntake({ kind: 'tap', uid: me.uid, name: me.name, totalLikeCount: demoTapTotals[me.uid] });
      } else if (r < 0.7) {
        const enemies = alive.filter((f) => f.uid !== me.uid);
        if (enemies.length > 0) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: target.name });
        }
      } else if (r < 0.85) {
        const coins = [1, 5, 10, 50, 100][Math.floor(Math.random() * 5)];
        handleIntake({ kind: 'gift', uid: me.uid, name: me.name, giftName: 'Quà demo', coins, qty: 1 });
      } else if (r < 0.93) {
        handleIntake({ kind: 'follow', uid: me.uid, name: me.name });
      } else {
        handleIntake({ kind: 'comment', uid: me.uid, name: me.name, text: DEMO_CHEERS[Math.floor(Math.random() * DEMO_CHEERS.length)] });
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
    const base = webhookUrl('dau-truong-sinh-ton', USERNAME, publicBaseUrl(req));
    res.json({
      webhookUrl: base,
      actions: TIKFINITY_ACTIONS.map((a) => ({ ...a, url: `${base}?event=${a.key}` })),
    });
  });

  router.post('/api/settings', (req, res) => {
    const b = req.body || {};
    if (b.startHp !== undefined) settings.startHp = clampInt(b.startHp, 1, 500, settings.startHp);
    if (b.tapDamage !== undefined) settings.tapDamage = clampInt(b.tapDamage, 1, 10, settings.tapDamage);
    if (b.commentDamage !== undefined) settings.commentDamage = clampInt(b.commentDamage, 1, 20, settings.commentDamage);
    if (b.giftHealCoins !== undefined) settings.giftHealCoins = clampInt(b.giftHealCoins, 10, 1000, settings.giftHealCoins);
    if (b.giftHealHp !== undefined) settings.giftHealHp = clampInt(b.giftHealHp, 1, 100, settings.giftHealHp);
    if (b.followHealHp !== undefined) settings.followHealHp = clampInt(b.followHealHp, 0, 100, settings.followHealHp);
    if (b.maxBonus !== undefined) settings.maxBonus = clampInt(b.maxBonus, 1, 50, settings.maxBonus);
    if (b.zoneAfterS !== undefined) settings.zoneAfterS = clampInt(b.zoneAfterS, 2, 600, settings.zoneAfterS);
    if (b.zoneIntervalS !== undefined) settings.zoneIntervalS = clampInt(b.zoneIntervalS, 1, 60, settings.zoneIntervalS);
    if (b.matchDurationS !== undefined) settings.matchDurationS = clampInt(b.matchDurationS, 10, 1800, settings.matchDurationS);
    if (b.maxFighters !== undefined) settings.maxFighters = clampInt(b.maxFighters, 2, 50, settings.maxFighters);
    if (b.downVisibleS !== undefined) settings.downVisibleS = clampInt(b.downVisibleS, 5, 60, settings.downVisibleS);
    if (b.spotlightS !== undefined) settings.spotlightS = clampInt(b.spotlightS, 1, 120, settings.spotlightS);
    if (b.commentSpamS !== undefined) settings.commentSpamS = clampInt(b.commentSpamS, 1, 60, settings.commentSpamS);
    if (b.demoMode !== undefined) settings.demoMode = !!b.demoMode;
    if (b.voiceEnabled !== undefined) settings.voiceEnabled = !!b.voiceEnabled;
    saveSettings();
    res.json({ success: true, settings });
  });

  router.post('/api/session/reset', (req, res) => { resetSession(); res.json({ success: true }); });
  router.post('/api/match/reset', (req, res) => { resetMatch(); res.json({ success: true }); });
  router.post('/api/match/start', (req, res) => {
    if (session.phase === 'fighting') return res.json({ success: false, message: 'Trận đang diễn ra.' });
    if (aliveFighters().length < 2) return res.json({ success: false, message: 'Cần ít nhất 2 chiến binh.' });
    startMatch();
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
  function testUser(name) {
    const uid = 'test_' + Math.random().toString(36).slice(2, 8);
    return { uid, name: name || 'Người thử' };
  }
  // Đảm bảo uid cho trước là chiến binh (vào trận nếu chưa vào).
  function ensureTestFighter(uid, name) {
    if (!session.fighters[uid] || !session.fighters[uid].alive) {
      handleIntake({ kind: 'comment', uid, name, text: 'tham gia' });
    }
  }
  router.post('/api/test/join', (req, res) => {
    if (!needDemo(req, res)) return;
    const u = testUser((req.body || {}).name);
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text: 'tham gia' });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/comment', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const u = testUser(b.name);
    ensureTestFighter(u.uid, u.name);
    let text = b.text;
    if (!text) {
      const enemies = aliveFighters().filter((f) => f.uid !== u.uid);
      text = enemies.length > 0 ? enemies[0].name : 'tham gia';
    }
    handleIntake({ kind: 'comment', uid: u.uid, name: u.name, text });
    res.json({ success: true, uid: u.uid, text });
  });
  router.post('/api/test/tap', (req, res) => {
    if (!needDemo(req, res)) return;
    const b = req.body || {};
    const count = Math.max(1, Math.min(500, Number(b.count) || 20));
    ensureTestFighter('test-tapper', 'Người thử tim');
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
    ensureTestFighter(u.uid, u.name);
    handleIntake({ kind: 'gift', uid: u.uid, name: u.name, giftName: b.giftName || 'Hoa hồng', coins: b.coins === undefined ? 10 : b.coins, qty: 1 });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/follow', (req, res) => {
    if (!needDemo(req, res)) return;
    const u = testUser((req.body || {}).name);
    ensureTestFighter(u.uid, u.name);
    handleIntake({ kind: 'follow', uid: u.uid, name: u.name });
    res.json({ success: true, uid: u.uid });
  });
  router.post('/api/test/bulk-join', (req, res) => {
    if (!needDemo(req, res)) return;
    const count = Math.max(1, Math.min(200, Number((req.body || {}).count) || 100));
    for (let i = 0; i < count; i += 1) {
      const uid = `test_bulk_${i}`;
      handleIntake({ kind: 'comment', uid, name: `Chiến binh ${i + 1}`, text: 'tham gia' });
    }
    const st = statePayload();
    res.json({ success: true, count, fighters: st.fighters.length, queueCount: st.queueCount });
  });
  router.post('/api/test/demo', (req, res) => {
    if (!needDemo(req, res)) return;
    const steps = [];
    const a = testUser('Demo A');
    const b = testUser('Demo B');
    handleIntake({ kind: 'comment', uid: a.uid, name: a.name, text: 'tham gia' });
    steps.push('Demo A tham gia');
    handleIntake({ kind: 'comment', uid: b.uid, name: b.name, text: 'tham gia' });
    steps.push('Demo B tham gia');
    // Tap: lần 1 đặt baseline, lần 2 mới có delta thật.
    handleIntake({ kind: 'tap', uid: a.uid, name: a.name, totalLikeCount: 1 });
    handleIntake({ kind: 'tap', uid: a.uid, name: a.name, totalLikeCount: 6 });
    steps.push('Demo A thả 5 tim (đánh ngẫu nhiên)');
    handleIntake({ kind: 'comment', uid: a.uid, name: a.name, text: b.name });
    steps.push('Demo A bình luận tên Demo B (-3 HP)');
    handleIntake({ kind: 'gift', uid: a.uid, name: a.name, giftName: 'Hoa hồng', coins: 10, qty: 1 });
    steps.push('Demo A quà 10 xu (+10 sát thương dồn)');
    handleIntake({ kind: 'follow', uid: b.uid, name: b.name });
    steps.push('Demo B follow (+10 HP)');
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
