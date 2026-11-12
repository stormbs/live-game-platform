// test/dua-thuyen-rong.test.js — Test game Đua Thuyền Rồng (game 12/13):
// tap +1m đúng đội; comment +5m; quà 10 xu = +50m; quà lạ = 0 + WARN;
// combo 10 tim/2s -> +10m, tối đa 1/5s; chạm đích thắng; hết giờ thuyền xa
// hơn thắng; tap delta + chống spam; demo start/stop + từ chối khi đã có
// event thật; overlay/dashboard 200; tikfinity-actions 6 URL riêng.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'dua-thuyen-rong';

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

test('dua-thuyen-rong: tap +1m đúng đội; comment +5m; quà 10 xu = +50m; quà lạ = 0 + WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_basic');
    await setSettings(t, user, { commentSpamS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // A: join +5m, tap delta 5 (dưới ngưỡng combo 10) -> 10m.
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 6);
    let st = await getState(t, user);
    assert.equal(st.meters.vang, 10, 'tap 5 -> +5m (đã có 5m của join)');
    assert.equal(st.meters.do, 5, 'Đỏ mới chỉ có 5m của join');
    // B: chờ hết spam 1s rồi bình luận -> +5m.
    await sleep(1200);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'đỏ cố lên' });
    st = await getState(t, user);
    assert.equal(st.meters.do, 10, 'comment +5m');
    // A tặng quà 10 xu -> +50m.
    const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Hoa hong', diamondCount: 10 });
    assert.equal(w.body.ok, true);
    st = await getState(t, user);
    assert.equal(st.meters.vang, 60, 'quà 10 xu = +50m');
    assert.equal(st.stats.gifts, 1);
    // Quà lạ (không có diamondCount): 0 mét + WARN.
    const w2 = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-b', nickname: 'BanB', giftName: 'Qua la' });
    assert.equal(w2.body.ok, false);
    assert.equal(w2.body.reason, 'unknown-coins');
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.meters.do, 10, 'quà lạ không cộng mét');
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: combo 10 tim/2s cùng đội -> +10m thưởng, tối đa 1/5s', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_combo');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    // Tap delta 10 trong 1 lần: 5 (join) + 10 + 10 (combo) = 25m.
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 11);
    let st = await getState(t, user);
    assert.equal(st.meters.vang, 25, '10 tim -> 10m + 10m thưởng combo');
    assert.equal(st.combos.vang, 1, '1 combo');
    // Tap tiếp ngay (trong cooldown 5s): chỉ +10m, không combo nữa.
    await tapDelta(t, room, 'u-a', 'AnhA', 11, 21);
    st = await getState(t, user);
    assert.equal(st.meters.vang, 35, 'cooldown: tap thêm 10m nhưng không thưởng');
    assert.equal(st.combos.vang, 1, 'vẫn 1 combo');
    // Hết cooldown 5s: tap 10 nữa -> combo lần 2.
    await sleep(5500);
    await tapDelta(t, room, 'u-a', 'AnhA', 21, 31);
    st = await getState(t, user);
    assert.equal(st.meters.vang, 55, 'hết cooldown: 10m + 10m thưởng');
    assert.equal(st.combos.vang, 2, '2 combo');
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: chạm đích trước thắng + đua mới', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_finish');
    await setSettings(t, user, { raceDistanceM: 12, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // A: 5 (join) + 7 tap (dưới ngưỡng combo) = 12m -> chạm đích ngay.
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 8);
    const st = await waitFor(t, user, (s) => s.phase === 'spotlight', 10, 500);
    assert.equal(st.phase, 'spotlight', 'chạm đích -> spotlight');
    assert.equal(st.winner.team, 'vang', 'Vàng về nhất');
    assert.equal(st.meters.vang, 12);
    const st2 = await waitFor(t, user, (s) => s.phase === 'lobby' && s.raceNo === 2, 10, 500);
    assert.equal(st2.raceNo, 2, 'sang đua mới');
    assert.equal(st2.meters.vang, 0);
    assert.equal(st2.meters.do, 0);
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: hết giờ thuyền xa hơn thắng', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_timeout');
    await setSettings(t, user, { raceDistanceM: 500, raceDurationS: 8, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // A: 5 + 10 tap + 10 combo = 25m; B: 5m.
    await tapDelta(t, room, 'u-a', 'AnhA', 1, 11);
    const st = await waitFor(t, user, (s) => s.phase === 'spotlight', 20, 500);
    assert.equal(st.phase, 'spotlight', 'hết giờ -> spotlight');
    assert.equal(st.winner.team, 'vang', 'Vàng xa hơn nên thắng');
    assert.ok(st.meters.vang > st.meters.do, 'Vàng xa hơn Đỏ');
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: tap delta + chống spam comment', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_spam');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    // Spam: bình luận thứ 2 của A trong 5s bị chặn.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'vàng cố lên' });
    const before = await getState(t, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'vàng mạnh quá' });
    const after = await getState(t, user);
    assert.equal(after.stats.commentsBlocked, before.stats.commentsBlocked + 1, 'spam comment bị chặn');
    // Tap delta: lần đầu đặt baseline (0), lần sau mới tính.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 100 });
    const s0 = await getState(t, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 105 });
    const s1 = await getState(t, user);
    assert.equal(s1.stats.taps, s0.stats.taps + 5, 'tap delta 5');
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: demo start -> mét 2 đội tăng; stop -> dừng; từ chối khi đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_demo');
    await enableDemo(t, user);
    const r = await postApi(t, user, '/api/demo/start', {});
    assert.equal(r.json.success, true, 'demo start ok');
    const st = await waitFor(t, user, (s) => s.demoActive && (s.meters.vang + s.meters.do > 0), 16, 500);
    assert.equal(st.demoActive, true);
    assert.ok(st.meters.vang + st.meters.do > 0, 'demo làm mét tăng');
    const r2 = await postApi(t, user, '/api/demo/stop', {});
    assert.equal(r2.json.success, true);
    const after = await getState(t, user);
    assert.equal(after.demoActive, false);
    // Mét cá nhân của người demo không tăng thêm sau khi dừng.
    const demoMeters = (s) => s.players.filter((p) => p.uid.startsWith('demo_')).reduce((a, p) => a + (p.meters || 0), 0);
    const m0 = demoMeters(after);
    await sleep(2500);
    const after2 = await getState(t, user);
    assert.equal(demoMeters(after2), m0, 'demo dừng thì mét demo không tăng');
    // Phòng đã có event thật -> demo bị từ chối.
    const user2 = uniq('dtr_demo2');
    await enableDemo(t, user2);
    const room2 = await t.rooms.getOrCreate(GAME, user2);
    await t.rooms.dispatchWebhook(room2, { triggerTypeId: 11, userId: 'u-real', nickname: 'NguoiThat', content: 'vàng' });
    const r3 = await postApi(t, user2, '/api/demo/start', {});
    assert.equal(r3.json.success, false);
    assert.equal(r3.json.reason, 'real-events-present');
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_ep');
    await enableDemo(t, user);
    const d = await postApi(t, user, '/api/test/demo', {});
    assert.equal(d.json.ok, true);
    const st = await getState(t, user);
    assert.ok(st.players.length >= 6, 'demo 1 lượt tạo >= 6 người');
    assert.ok(st.teamCounts.vang >= 1 && st.teamCounts.do >= 1, 'cả 2 đội đều có người');
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}?demo=1`);
    assert.equal(ov.status, 200, 'overlay 200');
    assert.ok(ov.text.includes('ĐUA THUYỀN RỒNG'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(db.status, 200, 'dashboard 200');
    assert.ok(db.text.includes('Đua Thuyền Rồng'), 'dashboard phải có tiêu đề game');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200, 'guide 200');
    assert.ok(String(guide.text || '').includes('Dua Thuyen Rong'), 'guide nhắc tới Dua Thuyen Rong');
    const acts = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(acts.status, 200);
    assert.equal(acts.json.actions.length, 6, 'đủ 6 action');
    for (const a of acts.json.actions) {
      assert.ok(a.url.includes('?event='), 'mỗi action 1 URL riêng ?event=');
      assert.ok(!/body/i.test(JSON.stringify(a)), 'không nhắc tới body');
    }
    // Nút test: bulk-join 100 người (chia 2 đội). Phòng đã có 6 người demo
    // trước đó (3+3) nên mỗi đội = 53.
    const bulk = await postApi(t, user, '/api/test/bulk-join', { count: 100 });
    assert.equal(bulk.json.count, 100);
    assert.equal(bulk.json.teamCounts.vang, 53);
    assert.equal(bulk.json.teamCounts.do, 53);
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('dtr_setA');
    const userB = uniq('dtr_setB');
    const r = await setSettings(t, userA, { raceDistanceM: 1, raceDurationS: 99999, comboThreshold: 1 });
    assert.equal(r.raceDistanceM, 5, 'raceDistanceM kẹp tối thiểu 5');
    assert.equal(r.raceDurationS, 1800, 'raceDurationS kẹp tối đa 1800');
    assert.equal(r.comboThreshold, 2, 'comboThreshold kẹp tối thiểu 2');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    await joinTeam(t, roomA, 'u-a', 'AnhA', 'vàng');
    const stB = await getState(t, userB);
    assert.equal(stB.players.length, 0, 'room B không thấy người của room A');
    assert.equal(stB.raceNo, 1);
  } finally { await stopTestServer(t); }
});

test('dua-thuyen-rong: đổi đội bị chặn khi đang đua; "vang" không dấu cũng nhận; follow 1 lần/đua', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dtr_team');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'vàng');
    await joinTeam(t, room, 'u-b', 'BanB', 'đỏ');
    let st = await getState(t, user);
    assert.equal(st.phase, 'racing', 'đua tự bắt đầu khi đủ 2 đội');
    // A đang đua, bình luận "đỏ" -> không đổi đội.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'đỏ' });
    st = await getState(t, user);
    assert.equal(st.players.find((p) => p.uid === 'u-a').team, 'vang', 'đang đua không đổi đội');
    // Người mới bình luận "vang" (không dấu) -> vào đội Vàng ngay cả khi đua.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-c', nickname: 'ChiC', content: 'vang' });
    st = await getState(t, user);
    assert.equal(st.players.find((p) => p.uid === 'u-c').team, 'vang', '"vang" không dấu vẫn vào đội');
    // Follow: +20m 1 lần/đua, lần 2 không cộng.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    const m1 = st.meters.vang;
    assert.ok(m1 >= 25, 'follow +20m (đã có 5m của join)');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    assert.equal(st.meters.vang, m1, 'follow lần 2 không cộng mét');
  } finally { await stopTestServer(t); }
});
