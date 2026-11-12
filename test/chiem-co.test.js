// test/chiem-co.test.js — Test game Chiếm Cờ (game 11/13):
// cửa sổ 30s chiếm cờ; giữ cờ +điểm/giây (Giữa x2); quà 10 xu = +200 lực;
// quà lạ = 0 + WARN; tap delta + chống spam; hết trận đội nhiều điểm thắng;
// hòa điểm -> xét số cờ; hòa cờ -> cờ chiếm cuối; demo start/stop + từ chối
// khi đã có event thật; overlay/dashboard 200; tikfinity-actions 6 URL riêng.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'chiem-co';

let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getState(t, user) {
  const s = await fetchJson(t.base, `/o/${GAME}/${user}/api/state`);
  assert.equal(s.status, 200, 'state 200');
  return s.json;
}
async function setSettings(t, user, body) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200, 'setSettings 200');
  return r.json.settings;
}
async function enableDemo(t, user) {
  return setSettings(t, user, { demoMode: true });
}
async function postApi(t, user, path, body) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r;
}
async function waitFor(t, user, pred, tries = 20, ms = 500) {
  for (let i = 0; i < tries; i += 1) {
    const st = await getState(t, user);
    if (pred(st)) return st;
    await sleep(ms);
  }
  return getState(t, user);
}
async function joinTeam(t, room, uid, name, teamWord) {
  const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: uid, nickname: name, content: teamWord });
  assert.equal(w.status, 200, 'webhook 200');
  return w.body;
}
async function tapDelta(t, room, uid, name, from, to) {
  await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: uid, nickname: name, likeCount: from });
  await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: uid, nickname: name, likeCount: to });
}

test('chiem-co: cửa sổ 30s — đội mạnh hơn chiếm cờ; giữ cờ +điểm/giây (Giữa x2)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_window');
    await setSettings(t, user, { windowS: 3, matchDurationS: 60 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'xanh');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // A: 5 (join) + 20 tap = 25 lực cờ Giữa. B: 5 + 5 = 10.
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 21);
    await tapDelta(t, room, 'u-b', 'BanB', 1, 6);
    const st = await waitFor(t, user, (s) => s.flags.mid.owner === 'xanh', 20, 500);
    assert.equal(st.flags.mid.owner, 'xanh', 'Xanh chiếm cờ Giữa');
    assert.equal(st.flags.left.owner, null);
    assert.equal(st.flags.right.owner, null);
    const p0 = st.points.xanh;
    await sleep(2600);
    const st2 = await getState(t, user);
    assert.ok(st2.points.xanh >= p0 + 3, `Giữa +2/s: ${p0} -> ${st2.points.xanh}`);
    assert.equal(st2.points.do, 0, 'Đỏ không giữ cờ nào nên 0 điểm');
  } finally { await stopTestServer(t); }
});

test('chiem-co: quà 10 xu = +200 lực; quà không rõ xu = 0 + log WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_gift');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'xanh');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Hoa hong', diamondCount: 10 });
    assert.equal(w.body.ok, true);
    let st = await getState(t, user);
    // 5 (join) + 200 (quà) = 205 lực cờ Giữa của Xanh.
    assert.equal(st.flags.mid.force.xanh, 205);
    assert.equal(st.stats.gifts, 1);
    // Quà lạ (không có diamondCount): 0 điểm + WARN.
    const w2 = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-b', nickname: 'BanB', giftName: 'Qua la' });
    assert.equal(w2.body.ok, false);
    assert.equal(w2.body.reason, 'unknown-coins');
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.flags.mid.force.do, 5, 'quà lạ không cộng lực (chỉ còn 5 của join)');
  } finally { await stopTestServer(t); }
});

test('chiem-co: tap delta + chống spam comment; hết trận đội nhiều điểm thắng + trận mới', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_end');
    await setSettings(t, user, { windowS: 2, matchDurationS: 8, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'xanh');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // Spam: bình luận thứ 2 của A trong 5s bị chặn (không cộng lực).
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'xanh cố lên' });
    const before = await getState(t, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'xanh mạnh quá' });
    const after = await getState(t, user);
    assert.equal(after.stats.commentsBlocked, before.stats.commentsBlocked + 1, 'spam comment bị chặn');
    // Tap delta: lần đầu đặt baseline (0), lần sau mới tính.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 100 });
    const s0 = await getState(t, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 120 });
    const s1 = await getState(t, user);
    assert.equal(s1.stats.taps, s0.stats.taps + 20, 'tap delta 20');
    // A mạnh hơn -> chiếm cờ Giữa -> tích điểm -> thắng trận.
    const st = await waitFor(t, user, (s) => s.phase === 'spotlight', 24, 500);
    assert.equal(st.phase, 'spotlight', 'hết trận -> spotlight');
    assert.equal(st.winner.team, 'xanh');
    assert.ok(st.points.xanh > st.points.do, 'Xanh nhiều điểm hơn');
    const st2 = await waitFor(t, user, (s) => s.phase === 'lobby' && s.matchNo === 2, 12, 500);
    assert.equal(st2.matchNo, 2, 'sang trận mới');
    assert.equal(st2.points.xanh, 0);
    assert.equal(st2.flags.mid.owner, null);
  } finally { await stopTestServer(t); }
});

test('chiem-co: hòa điểm -> xét số cờ (Đỏ thắng 2-1)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_tieflags');
    await setSettings(t, user, { windowS: 2, matchDurationS: 9, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    // A1 Xanh tập trung Giữa (mặc định): join +5, tap +20 -> 25.
    await joinTeam(t, room, 'u-a1', 'AnhA1', 'xanh');
    await tapDelta(t, room, 'u-a1', 'AnhA1', 1, 21);
    // B1 Đỏ -> cờ Trái: join +5 (Giữa), comment 'cờ trái' đổi focus (bị spam
    // chặn lực nhưng vẫn đổi focus), tap +10 -> Trái 10.
    await joinTeam(t, room, 'u-b1', 'BanB1', 'đỏ');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b1', nickname: 'BanB1', content: 'cờ trái' });
    await tapDelta(t, room, 'u-b1', 'BanB1', 1, 11);
    // B2 Đỏ -> cờ Phải: tương tự.
    await joinTeam(t, room, 'u-b2', 'BanB2', 'đỏ');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b2', nickname: 'BanB2', content: 'cờ phải' });
    await tapDelta(t, room, 'u-b2', 'BanB2', 1, 11);
    const st = await waitFor(t, user, (s) => s.phase === 'spotlight', 28, 500);
    assert.equal(st.phase, 'spotlight', 'hết trận');
    // Giữa 2/s x ~7s = 14 (Xanh); Trái+Phải 1+1/s x ~7s = 14 (Đỏ) -> hòa điểm.
    assert.equal(st.points.xanh, st.points.do, `hòa điểm: ${st.points.xanh} - ${st.points.do}`);
    assert.equal(st.winner.team, 'do', 'hòa điểm -> Đỏ thắng vì giữ 2 cờ (Xanh 1 cờ)');
  } finally { await stopTestServer(t); }
});

test('chiem-co: hòa điểm + hòa cờ -> cờ chiếm cuối thắng (Đỏ chiếm Phải sau)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_tielast');
    await setSettings(t, user, { windowS: 2, matchDurationS: 7, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    // A Xanh -> cờ Trái: join +5 (Giữa), focus Trái, tap +10 -> Trái 10.
    await joinTeam(t, room, 'u-a', 'AnhA', 'xanh');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'cờ trái' });
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 11);
    // B Đỏ -> cờ Phải: join +5 (Giữa), focus Phải, tap +10 -> Phải 10.
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'cờ phải' });
    await tapDelta(t, room, 'u-b', 'BanB', 1, 11);
    // Cờ Giữa: Xanh 5 (join) vs Đỏ 5 (join) -> hòa, không đổi chủ.
    const st = await waitFor(t, user, (s) => s.phase === 'spotlight', 24, 500);
    assert.equal(st.phase, 'spotlight', 'hết trận');
    assert.equal(st.flags.mid.owner, null, 'cờ Giữa hòa lực nên trống');
    assert.equal(st.points.xanh, st.points.do, `hòa điểm: ${st.points.xanh} - ${st.points.do}`);
    assert.equal(st.winner.team, 'do', 'hòa điểm + hòa cờ -> Đỏ thắng (chiếm Phải sau Trái)');
  } finally { await stopTestServer(t); }
});

test('chiem-co: demo start -> cờ/điểm thay đổi; stop -> dừng; từ chối khi đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_demo');
    await enableDemo(t, user);
    const r = await postApi(t, user, '/api/demo/start', {});
    assert.equal(r.json.success, true, 'demo start ok');
    const st = await waitFor(t, user, (s) => s.demoActive && (s.points.xanh + s.points.do > 0 || Object.values(s.flags).some((f) => f.force.xanh + f.force.do > 0)), 16, 500);
    assert.equal(st.demoActive, true);
    const r2 = await postApi(t, user, '/api/demo/stop', {});
    assert.equal(r2.json.success, true);
    const after = await getState(t, user);
    assert.equal(after.demoActive, false);
    // Lực cá nhân của người demo không tăng thêm sau khi dừng.
    const demoForce = (s) => s.players.filter((p) => p.uid.startsWith('demo-')).reduce((a, p) => a + (p.force || 0), 0);
    const f0 = demoForce(after);
    await sleep(2500);
    const after2 = await getState(t, user);
    assert.equal(demoForce(after2), f0, 'demo dừng thì lực demo không tăng');
    // Phòng đã có event thật -> demo bị từ chối.
    const user2 = uniq('chiemco_demo2');
    await enableDemo(t, user2);
    const room2 = await t.rooms.getOrCreate(GAME, user2);
    await t.rooms.dispatchWebhook(room2, { triggerTypeId: 11, userId: 'u-real', nickname: 'NguoiThat', content: 'xanh' });
    const r3 = await postApi(t, user2, '/api/demo/start', {});
    assert.equal(r3.json.success, false);
    assert.equal(r3.json.reason, 'real-events-present');
  } finally { await stopTestServer(t); }
});

test('chiem-co: endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_ep');
    await enableDemo(t, user);
    const d = await postApi(t, user, '/api/test/demo', {});
    assert.equal(d.json.ok, true);
    const st = await getState(t, user);
    assert.ok(st.players.length >= 6, 'demo 1 lượt tạo >= 6 người');
    assert.ok(st.teamCounts.xanh >= 1 && st.teamCounts.do >= 1, 'cả 2 đội đều có người');
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}?demo=1`);
    assert.equal(ov.status, 200, 'overlay 200');
    assert.ok(ov.text.includes('CHIẾM CỜ'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(db.status, 200, 'dashboard 200');
    assert.ok(db.text.includes('Chiếm Cờ'), 'dashboard phải có tiêu đề game');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200, 'guide 200');
    assert.ok(String(guide.text || '').includes('Chiem Co'), 'guide nhắc tới Chiem Co');
    const acts = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(acts.status, 200);
    assert.equal(acts.json.actions.length, 6, 'đủ 6 action');
    for (const a of acts.json.actions) {
      assert.ok(a.url.includes('?event='), 'mỗi action 1 URL riêng ?event=');
      assert.ok(!/body/i.test(JSON.stringify(a)), 'không nhắc tới body');
    }
    // Nút test: bulk-join 100 người (chia 2 đội). Phòng đã có 6 người demo
    // trước đó (3+3) nên mỗi đội >= 53.
    const bulk = await postApi(t, user, '/api/test/bulk-join', { count: 100 });
    assert.equal(bulk.json.count, 100);
    assert.equal(bulk.json.teamCounts.xanh, 53);
    assert.equal(bulk.json.teamCounts.do, 53);
  } finally { await stopTestServer(t); }
});

test('chiem-co: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('chiemco_setA');
    const userB = uniq('chiemco_setB');
    const r = await setSettings(t, userA, { windowS: 1, matchDurationS: 99999, coinToForce: 0 });
    assert.equal(r.windowS, 2, 'windowS kẹp tối thiểu 2');
    assert.equal(r.matchDurationS, 1800, 'matchDurationS kẹp tối đa 1800');
    assert.equal(r.coinToForce, 1, 'coinToForce kẹp tối thiểu 1');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    await joinTeam(t, roomA, 'u-a', 'AnhA', 'xanh');
    const stB = await getState(t, userB);
    assert.equal(stB.players.length, 0, 'room B không thấy người của room A');
    assert.equal(stB.matchNo, 1);
  } finally { await stopTestServer(t); }
});

test('chiem-co: đổi đội bị chặn khi đang đấu; "đồ" không nhầm thành "đỏ"', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('chiemco_team');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'xanh');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    let st = await getState(t, user);
    assert.equal(st.phase, 'playing', 'trận tự bắt đầu khi đủ 2 đội');
    // A đang đấu, bình luận "đỏ" -> không đổi đội.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'đỏ' });
    st = await getState(t, user);
    assert.equal(st.players.find((p) => p.uid === 'u-a').team, 'xanh', 'đang đấu không đổi đội');
    // Người mới bình luận "đồ ăn ngon" -> không vào đội Đỏ.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-c', nickname: 'ChiC', content: 'đồ ăn ngon quá' });
    st = await getState(t, user);
    assert.equal(st.players.find((p) => p.uid === 'u-c').team, null, '"đồ" không phải "đỏ"');
    // Follow/share: +30/+15 lực 1 lần/trận, lần 2 không cộng.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    const f1 = st.flags.mid.force.xanh;
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    assert.equal(st.flags.mid.force.xanh, f1, 'follow lần 2 không cộng lực');
    assert.ok(f1 >= 30, 'follow +30 lực');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 8, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    assert.ok(st.flags.mid.force.xanh >= f1 + 15, 'share +15 lực');
  } finally { await stopTestServer(t); }
});
