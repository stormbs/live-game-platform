// test/di-bar-online.test.js — Test game Đi Bar Online (game 14/14):
// vào bar -> dancer với 1 trong 8 nhân vật; tap +năng lượng (delta); quà 10 xu
// = +100 năng lượng + 1 ly; quà lạ = 0 + WARN; CHƠI TỰ DO, KHÔNG CÓ VÒNG
// (Chủ tịch 2026-11-13): người nhiều năng lượng nhất lúc đó LUÔN là Vua
// sàn (state.leader), năng lượng KHÔNG reset theo vòng; rời live -> dancer
// tạm ẩn, vào lại tính tiếp ⚡ đã có; chỉ phiên live mới (/api/session/reset)
// mới làm mới bar; drop: tim x2 trong 15s; điểm bàn = tổng live (không có
// thắng vòng / bao bar); tối đa 24 dancer trên sàn, người thứ 25 chờ ở quầy;
// demo start/stop + từ chối khi đã có event thật; ?demo=1 -> demoActive: true.
// TikFinity thật (1-Action, Chủ tịch chốt 2026-11-13): 1 Action duy nhất với URL gốc của phòng, KHÔNG body; 6 URL riêng ?event=<loại> chỉ là đường dự phòng (endpoint /api/tikfinity-actions).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'di-bar-online';

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
async function comment(t, room, uid, name, text) {
  const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: uid, nickname: name, content: text });
  assert.equal(w.status, 200, 'webhook comment 200');
  return w.body;
}
async function tap(t, room, uid, name, total) {
  const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: uid, nickname: name, likeCount: total });
  assert.equal(w.status, 200, 'webhook tap 200');
  return w.body;
}
async function gift(t, room, uid, name, coins) {
  const body = { triggerTypeId: 3, userId: uid, nickname: name, giftName: 'Quà thử' };
  if (coins !== null && coins !== undefined) body.diamondCount = coins;
  const w = await t.rooms.dispatchWebhook(room, body);
  assert.equal(w.status, 200, 'webhook gift 200');
  return w.body;
}

test('di-bar-online: vào bar -> dancer 1 trong 8 nhân vật; tap +năng lượng; quà 10 xu = +100 + 1 ly; quà lạ = 0 + WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_join');
    const room = await t.rooms.getOrCreate(GAME, user);
    await comment(t, room, 'u-a', 'An', 'vào bar');
    let st = await getState(t, user);
    assert.equal(st.totalDancers, 1, '1 dancer');
    assert.equal(st.floorCount, 1, '1 người trên sàn');
    const d = st.dancers[0];
    assert.ok(d.character && d.character.id >= 1 && d.character.id <= 8, 'nhân vật 1-8, có ' + JSON.stringify(d.character));
    assert.equal(d.energy, 5, 'comment vào bar +5 năng lượng');
    // Tap delta: lần đầu đặt baseline = 0 (parser map likeCount 0 -> 1 nên
    // baseline phải dùng tổng > 0).
    await tap(t, room, 'u-a', 'An', 100);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 5, 'tap baseline không cộng');
    await tap(t, room, 'u-a', 'An', 110);
    st = await getState(t, user);
    assert.equal(st.stats.taps, 10, 'delta 10 tim');
    assert.equal(st.dancers[0].energy, 15, 'tap +10 năng lượng');
    // Quà 10 xu = +100 năng lượng + 1 ly.
    const g = await gift(t, room, 'u-a', 'An', 10);
    assert.equal(g.ok, true);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 115, 'quà 10 xu = +100');
    assert.equal(st.dancers[0].drinks, 1, '1 ly đồ uống');
    assert.equal(st.stats.drinks, 1);
    // Quà lạ (không rõ xu) = 0 + log WARN.
    const g2 = await gift(t, room, 'u-a', 'An', null);
    assert.equal(g2.ok, false);
    assert.equal(g2.reason, 'unknown-coins');
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.dancers[0].energy, 115, 'quà lạ không cộng điểm');
    assert.equal(st.dancers[0].drinks, 1, 'quà lạ không cộng ly');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: chơi tự do — người nhiều năng lượng nhất lúc đó LUÔN là Vua sàn, không reset theo vòng', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_king');
    const room = await t.rooms.getOrCreate(GAME, user);
    await comment(t, room, 'u-a', 'An', 'vào bar');
    await comment(t, room, 'u-b', 'Bình', 'quẩy');
    await tap(t, room, 'u-a', 'An', 100);
    await tap(t, room, 'u-a', 'An', 120);
    await tap(t, room, 'u-b', 'Bình', 100);
    await tap(t, room, 'u-b', 'Bình', 105);
    let st = await getState(t, user);
    assert.ok(st.leader, 'có người dẫn đầu');
    assert.equal(st.leader.name, 'An', 'An nhiều năng lượng nhất (25 vs 10)');
    assert.equal(st.leader.energy, 25, 'Vua 25 năng lượng');
    assert.ok(st.top[0].name === 'An', 'top 1 là An');
    assert.ok(!('roundNo' in st) && !('phase' in st) && !('king' in st), 'không còn vòng/phase/king theo vòng');
    // Chờ lâu hơn cả vòng cũ (6s) -> năng lượng KHÔNG reset, Vua vẫn là An.
    await sleep(8000);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 25, 'không có vòng nên năng lượng không về 0');
    assert.equal(st.leader.name, 'An', 'Vua vẫn là An sau 8s');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: DJ drop — trong 15s drop tim x2, hết drop tim về x1', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_drop');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { dropIntervalS: 4, dropWarningS: 1, dropDurationS: 5 });
    await comment(t, room, 'u-a', 'An', 'vào bar');
    // Chờ drop bắt đầu (dropInterval 4s + warning 1s).
    let st = await waitFor(t, user, (s) => s.dropState === 'drop', 16, 500);
    assert.equal(st.dropState, 'drop', 'drop đang diễn ra');
    await tap(t, room, 'u-a', 'An', 100);
    await tap(t, room, 'u-a', 'An', 110);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 25, 'tim trong drop x2: 5 + 10x2 = 25');
    // Chờ drop kết thúc.
    st = await waitFor(t, user, (s) => s.dropState === 'idle', 20, 500);
    assert.equal(st.dropState, 'idle', 'drop đã hết');
    await tap(t, room, 'u-a', 'An', 115);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 30, 'hết drop tim về x1: 25 + 5 = 30');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: điểm bàn VIP = tổng live (không có thắng vòng / bao bar)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_table');
    const room = await t.rooms.getOrCreate(GAME, user);
    await comment(t, room, 'u-a', 'An', 'vào bar');
    await comment(t, room, 'u-a', 'An', 'bàn vàng');
    await comment(t, room, 'u-b', 'Bình', 'vào bar');
    await comment(t, room, 'u-b', 'Bình', 'bàn đỏ');
    await tap(t, room, 'u-a', 'An', 100);
    await tap(t, room, 'u-a', 'An', 110);
    await tap(t, room, 'u-b', 'Bình', 100);
    await tap(t, room, 'u-b', 'Bình', 105);
    const st = await getState(t, user);
    // An: 5 (vào bar) + 10 tap = 15; Bình: 5 + 5 = 10 (comment chọn bàn bị
    // chống spam nên không cộng thêm — nhưng bàn vẫn được gán).
    assert.equal(st.tables.vang.score, 15, 'điểm Bàn Vàng 15');
    assert.equal(st.tables.do.score, 10, 'điểm Bàn Đỏ 10');
    assert.ok(!('tableWinner' in st) && !('barCover' in st) && !('tableStreak' in st), 'không còn thắng vòng / bao bar');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: rời live -> dancer tạm ẩn, vào lại tính tiếp ⚡ đã có; phiên live mới mới reset', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_leave');
    const room = await t.rooms.getOrCreate(GAME, user);
    await enableDemo(t, user);
    // Vào bar qua endpoint test (demoMode đang bật nên webhook thật bị chặn):
    // comment "vào bar" +5, quà 1 xu +10 -> An 15 năng lượng.
    await postApi(t, user, '/api/test/join', { uid: 'u-a', name: 'An' });
    await postApi(t, user, '/api/test/gift', { uid: 'u-a', name: 'An', coins: 1 });
    let st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 15, 'An 15 năng lượng trước khi rời');
    // Rời live (endpoint test) -> dancer tạm ẩn khỏi sàn.
    const lv = await postApi(t, user, '/api/test/leave', { uid: 'u-a', name: 'An' });
    assert.equal(lv.status, 200, 'test leave 200');
    st = await getState(t, user);
    assert.equal(st.totalDancers, 0, 'rời live thì tạm ẩn khỏi sàn');
    assert.equal(st.top.length, 0, 'không còn trong top khi đã rời');
    // Tắt demoMode để webhook thật chạy lại, rồi vào lại live (webhook join,
    // triggerTypeId 6) -> hiện lại, ⚡ giữ nguyên.
    await setSettings(t, user, { demoMode: false });
    const j = await t.rooms.dispatchWebhook(room, { triggerTypeId: 6, userId: 'u-a', nickname: 'An' });
    assert.equal(j.status, 200, 'webhook join 200');
    st = await getState(t, user);
    assert.equal(st.totalDancers, 1, 'vào lại thì hiện lại trên sàn');
    assert.equal(st.dancers[0].energy, 15, 'vào lại tính tiếp 15 năng lượng đã có');
    assert.equal(st.leader.name, 'An', 'vào lại vẫn là người dẫn đầu');
    // Phiên live mới -> bar làm mới hoàn toàn.
    const rs = await postApi(t, user, '/api/session/reset', {});
    assert.equal(rs.status, 200, 'session reset 200');
    assert.equal(rs.json.success, true, 'reset ok');
    st = await getState(t, user);
    assert.equal(st.totalDancers, 0, 'phiên mới thì sàn trống');
    assert.equal(st.top.length, 0, 'phiên mới thì top trống');
    assert.equal(st.leader, null, 'phiên mới thì chưa có Vua');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: tap delta + chống spam bình luận', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_spam');
    const room = await t.rooms.getOrCreate(GAME, user);
    await comment(t, room, 'u-a', 'An', 'vào bar');
    // Bình luận ngay sau comment vào bar -> bị chống spam.
    const blocked = await comment(t, room, 'u-a', 'An', 'quẩy');
    assert.equal(blocked.ok, false, 'comment trong 5s bị chặn');
    assert.equal(blocked.reason, 'comment-spam');
    let st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 5, 'comment spam không cộng điểm');
    assert.equal(st.stats.commentsBlocked, 1);
    // Chờ qua 5s rồi bình luận lại -> +5.
    await sleep(5600);
    const ok = await comment(t, room, 'u-a', 'An', 'quẩy');
    assert.equal(ok.ok, true);
    st = await getState(t, user);
    assert.equal(st.dancers[0].energy, 10, 'hết spam bình luận +5');
    // Tap cùng tổng -> delta 0.
    await tap(t, room, 'u-a', 'An', 200);
    await tap(t, room, 'u-a', 'An', 200);
    st = await getState(t, user);
    assert.equal(st.stats.taps, 0, 'tap trùng tổng không cộng');
    assert.equal(st.dancers[0].energy, 10, 'năng lượng không đổi');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: tối đa 24 dancer trên sàn, người thứ 25 chờ ở quầy', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_24');
    await enableDemo(t, user);
    const r = await postApi(t, user, '/api/test/bulk-join', { count: 30 });
    assert.equal(r.status, 200, 'bulk-join 200');
    assert.equal(r.json.floorCount, 24, '24 người trên sàn');
    assert.equal(r.json.waitingCount, 6, '6 người chờ ở quầy');
    const st = await getState(t, user);
    assert.equal(st.floorCount, 24, 'floor 24');
    assert.equal(st.waitingCount, 6, 'waiting 6');
    assert.equal(st.totalDancers, 30, 'tổng 30 dancer');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: demo start -> năng lượng tăng; stop -> dừng; từ chối khi đã có event thật; ?demo=1', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_demo');
    const room = await t.rooms.getOrCreate(GAME, user);
    await enableDemo(t, user);
    const start = await postApi(t, user, '/api/demo/start', {});
    assert.equal(start.status, 200, 'demo start 200');
    assert.equal(start.json.success, true, 'demo start ok');
    let st = await waitFor(t, user, (s) => s.demoActive && s.totalDancers > 0, 10, 500);
    assert.equal(st.demoActive, true, 'demoActive true');
    assert.ok(st.totalDancers >= 12, '12 dancer demo');
    const e0 = st.top.reduce((a, d) => a + d.energy, 0);
    await sleep(5000);
    st = await getState(t, user);
    const e1 = st.top.reduce((a, d) => a + d.energy, 0);
    assert.ok(e1 > e0, `demo làm năng lượng tăng (${e0} -> ${e1})`);
    const stop = await postApi(t, user, '/api/demo/stop', {});
    assert.equal(stop.json.demoActive, false, 'demo stop');
    await sleep(3000);
    st = await getState(t, user);
    assert.equal(st.demoActive, false, 'demo đã dừng');
    // Có event thật -> từ chối chạy demo.
    await comment(t, room, 'u-real', 'Người thật', 'vào bar');
    st = await getState(t, user);
    assert.ok(st.webhookCount > 0, 'đã có event thật');
    const start2 = await postApi(t, user, '/api/demo/start', {});
    assert.equal(start2.json.success, false, 'demo từ chối khi có event thật');
    assert.equal(start2.json.reason, 'real-events-present');
    // ?demo=1: fetch thường không chạy JS của overlay nên chỉ kiểm tra trang
    // load 200 + có code tự chạy demo (chạy thật chỉ kiểm chứng được bằng
    // trình duyệt — xem TESTING.md checklist cho Agent Windows).
    const user2 = uniq('bar_demo_q');
    const page = await fetchJson(t.base, `/o/${GAME}/${user2}?demo=1`);
    assert.equal(page.status, 200, 'overlay ?demo=1 200');
    assert.ok(String(page.text).includes("params.get('demo')"), 'overlay có code tự chạy demo khi ?demo=1');
    assert.ok(String(page.text).includes('/api/demo/start'), 'overlay gọi /api/demo/start khi ?demo=1');
  } finally { await stopTestServer(t); }
});

test('di-bar-online: endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('bar_api');
    await enableDemo(t, user);
    const demo = await postApi(t, user, '/api/test/demo', {});
    assert.equal(demo.status, 200, 'test demo 200');
    let st = await getState(t, user);
    assert.ok(st.totalDancers >= 6, 'demo 1 lượt có dancer');
    const overlay = await fetchJson(t.base, `/o/${GAME}/${user}`);
    assert.equal(overlay.status, 200, 'overlay 200');
    assert.ok(String(overlay.text).includes('Đi Bar Online'), 'overlay có tiêu đề game');
    const dash = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(dash.status, 200, 'dashboard 200');
    assert.ok(String(dash.text).includes('Dashboard'), 'dashboard có tiêu đề');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200, 'guide 200');
    assert.ok(String(guide.text).includes('Đi Bar Online'), 'guide nhắc tới tên game');
    const acts = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(acts.status, 200, 'tikfinity-actions 200');
    assert.equal(acts.json.actions.length, 6, '6 action webhook');
    for (const key of ['gift', 'chat', 'like', 'follow', 'share', 'join']) {
      const a = acts.json.actions.find((x) => x.key === key);
      assert.ok(a, 'có action ' + key);
      assert.ok(String(a.url).includes(`?event=${key}`), 'URL riêng ?event=' + key);
    }
  } finally { await stopTestServer(t); }
});

test('di-bar-online: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('bar_set_a');
    const userB = uniq('bar_set_b');
    const s = await setSettings(t, userA, { tempo: 999, shotIntervalS: 1, volume: 500 });
    assert.equal(s.tempo, 180, 'tempo max 180');
    assert.equal(s.shotIntervalS, 3, 'shotIntervalS min 3');
    assert.equal(s.volume, 100, 'volume max 100');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    await comment(t, roomA, 'u-a', 'An', 'vào bar');
    const stA = await getState(t, userA);
    const stB = await getState(t, userB);
    assert.equal(stA.totalDancers, 1, 'room A có 1 dancer');
    assert.equal(stB.totalDancers, 0, 'room B không có dancer');
  } finally { await stopTestServer(t); }
});
