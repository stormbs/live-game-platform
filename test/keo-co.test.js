// test/keo-co.test.js — Test game Kéo Co trên nền tảng:
// 2 đội (comment chọn đội, tap cộng lực đúng đội), quà 10 xu = +100 lực,
// quà lạ không rõ xu = 0 điểm + log WARN, tap delta, chống spam comment,
// hết hiệp đội đang dẫn thắng, thắng trận (3 hiệp) -> vinh danh -> trận mới,
// đổi đội giữa hiệp bị chặn, 'đồ' không nhầm thành 'đỏ',
// demo start/stop + từ chối khi đã có event thật, overlay/dashboard 200.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'keo-co';

let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

async function enableDemo(t, user) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demoMode: true }),
  });
  assert.equal(r.status, 200);
}

async function getState(t, user) {
  const s = await fetchJson(t.base, `/o/${GAME}/${user}/api/state`);
  assert.equal(s.status, 200);
  return s.json;
}

async function setSettings(t, user, body) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200);
  return r.json.settings;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(t, user, pred, tries = 20, ms = 500) {
  for (let i = 0; i < tries; i += 1) {
    const st = await getState(t, user);
    if (pred(st)) return st;
    await sleep(ms);
  }
  return getState(t, user);
}

test('keo-co: comment chọn đội, tap cộng lực đúng đội, hết hiệp đội mạnh thắng', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_2doi');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { roundDurationS: 3, roundBreakS: 1, winForce: 5000 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhXanh', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanDo', content: 'đỏ' });
    // Hiệp tự bắt đầu khi cả 2 đội có người (tick 1s).
    let st = await waitFor(t, user, (s) => s.phase === 'playing');
    assert.equal(st.phase, 'playing', 'hiệp phải tự bắt đầu khi đủ 2 đội');
    assert.equal(st.teams.xanh.total, 1);
    assert.equal(st.teams.do.total, 1);
    // Tap: lần đầu baseline, lần 2 delta 30 -> đội Xanh +30 lực (đã +5 từ comment).
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhXanh', likeCount: 100 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhXanh', likeCount: 130 });
    st = await getState(t, user);
    assert.equal(st.stats.taps, 30, 'tap tính theo delta');
    assert.equal(st.force.xanh, 35, 'comment +5, tap 30 x 1 = 35 lực đội Xanh');
    assert.equal(st.force.do, 5, 'đội Đỏ chỉ có +5 từ comment');
    // Hết 3s -> đội Xanh đang dẫn thắng hiệp.
    st = await waitFor(t, user, (s) => s.phase === 'roundEnd', 20, 500);
    assert.equal(st.phase, 'roundEnd');
    assert.equal(st.lastRoundWinner, 'xanh');
    assert.equal(st.wins.xanh, 1);
    assert.equal(st.lastRoundReason, 'hết giờ, đang dẫn lực');
  } finally { await stopTestServer(t); }
});

test('keo-co: quà 10 xu = +100 lực; quà không rõ xu = 0 điểm + log WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_gift');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-g', nickname: 'NguoiTang', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-g', nickname: 'NguoiTang', giftName: 'Hoa hồng', diamondCount: 10, repeatCount: 1 });
    let st = await getState(t, user);
    assert.equal(st.force.xanh, 105, 'comment +5, quà 10 xu x 10 = +100');
    assert.equal(st.stats.gifts, 1);
    // Quà lạ không rõ xu.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-g', nickname: 'NguoiTang', giftName: 'Quà lạ', repeatCount: 1 });
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.force.xanh, 105, 'quà lạ không cộng lực');
    assert.ok(JSON.stringify(st.logs).includes('không rõ số xu'), 'log cảnh báo phải ghi rõ');
  } finally { await stopTestServer(t); }
});

test('keo-co: tap lần đầu đặt baseline, không cộng ồ ạt', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_tap');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-t', nickname: 'NguoiTap', content: 'đỏ' });
    // Người này đã tim 5000 lần từ trước khi room tạo.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-t', nickname: 'NguoiTap', likeCount: 5000 });
    let st = await getState(t, user);
    assert.equal(st.stats.taps, 0, 'delta lần đầu = 0');
    assert.equal(st.force.do, 5, 'chỉ có +5 từ comment, không bị 5000 tim ồ ạt');
  } finally { await stopTestServer(t); }
});

test('keo-co: chống spam comment 1/5s; hết giờ hòa lực -> không đội nào thắng hiệp', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_spam');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { roundDurationS: 2, roundBreakS: 1, winForce: 5000 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-s1', nickname: 'SpamXanh', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-s1', nickname: 'SpamXanh', content: 'Cố lên!' });
    let st = await getState(t, user);
    assert.equal(st.stats.commentsBlocked, 1, 'comment thứ 2 trong 5s bị chặn');
    assert.equal(st.force.xanh, 5, 'comment spam không cộng lực');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-s2', nickname: 'NguoiDo', content: 'đỏ' });
    // Lực 2 đội bằng nhau (5-5) -> hết giờ hòa.
    st = await waitFor(t, user, (s) => s.phase === 'roundEnd', 20, 500);
    assert.equal(st.phase, 'roundEnd', 'hiệp phải kết thúc đúng giờ');
    assert.equal(st.lastRoundWinner, null, 'hòa lực thì không đội nào thắng hiệp');
    assert.equal(st.wins.xanh, 0);
    assert.equal(st.wins.do, 0);
  } finally { await stopTestServer(t); }
});

test('keo-co: cờ chạm vạch đích thắng hiệp ngay; thắng 3 hiệp -> thắng trận -> trận mới', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_match');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { roundsToWin: 1, roundDurationS: 60, winForce: 100, matchCelebrateS: 1, roundBreakS: 1 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-m1', nickname: 'ManhXanh', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-m2', nickname: 'ManhDo', content: 'đỏ' });
    await waitFor(t, user, (s) => s.phase === 'playing');
    // Tap delta 100 -> lực Xanh = 5 + 100 = 105 >= winForce 100 -> cờ chạm vạch.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-m1', nickname: 'ManhXanh', likeCount: 10 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-m1', nickname: 'ManhXanh', likeCount: 110 });
    let st = await waitFor(t, user, (s) => s.phase === 'matchEnd', 20, 500);
    assert.equal(st.phase, 'matchEnd');
    assert.equal(st.results.winner, 'xanh');
    assert.equal(st.results.wins.xanh, 1);
    // Hết 1s vinh danh -> trận mới, đội giữ nguyên, lực về 0.
    st = await waitFor(t, user, (s) => s.matchNo === 2, 20, 500);
    assert.equal(st.matchNo, 2);
    assert.equal(st.wins.xanh, 0);
    assert.equal(st.force.xanh, 0);
    assert.equal(st.teams.xanh.total, 1, 'đội giữ nguyên sang trận mới');
    assert.equal(st.teams.do.total, 1);
  } finally { await stopTestServer(t); }
});

test('keo-co: đổi đội giữa hiệp bị chặn; "đồ" không nhầm thành "đỏ"', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_team');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-c', nickname: 'NguoiChoi', content: 'đồ đẹp quá' });
    let st = await getState(t, user);
    assert.equal(st.teams.xanh.total, 0, '"đồ" không phải đội Đỏ');
    assert.equal(st.teams.do.total, 0);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-c', nickname: 'NguoiChoi', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-d', nickname: 'DoiThu', content: '2' });
    st = await waitFor(t, user, (s) => s.phase === 'playing');
    assert.equal(st.teams.xanh.total, 1);
    assert.equal(st.teams.do.total, 1, '"2" = đội Đỏ');
    // Đang trong hiệp, bình luận "đỏ" không đổi được đội.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-c', nickname: 'NguoiChoi', content: 'đỏ' });
    st = await getState(t, user);
    assert.equal(st.teams.xanh.total, 1, 'đang trong hiệp không đổi đội được');
    assert.equal(st.teams.do.total, 1);
  } finally { await stopTestServer(t); }
});

test('keo-co: follow +20 (1 lần/người/hiệp), share +10 (1 lần/người/hiệp)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_flw');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-f', nickname: 'NguoiFollow', content: 'xanh' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-f', nickname: 'NguoiFollow' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-f', nickname: 'NguoiFollow' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 8, userId: 'u-f', nickname: 'NguoiFollow' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 8, userId: 'u-f', nickname: 'NguoiFollow' });
    const st = await getState(t, user);
    assert.equal(st.force.xanh, 5 + 20 + 10, 'comment +5, follow +20 (1 lần), share +10 (1 lần)');
    assert.equal(st.stats.follows, 2);
    assert.equal(st.stats.shares, 2);
  } finally { await stopTestServer(t); }
});

test('keo-co: demo start -> lực 2 đội tăng; stop -> dừng; từ chối khi đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_demo');
    await enableDemo(t, user);
    const start = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo-start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    // Demo cho 12 người vào 2 đội ngay (mỗi người +5 lực từ comment chọn đội).
    let st = await waitFor(t, user, (s) => s.demoActive === true && s.force.xanh > 0 && s.force.do > 0, 10, 500);
    assert.equal(st.demoActive, true);
    assert.ok(st.force.xanh >= 30 && st.force.do >= 30, 'demo vào đội đã cộng lực 2 bên');
    const f1 = { x: st.force.xanh, d: st.force.do };
    // Chờ tới 12s (bước demo 2.5s/bước) cho lực tăng thêm.
    st = await waitFor(t, user, (s) => s.force.xanh + s.force.do > f1.x + f1.d, 24, 500);
    assert.ok(st.force.xanh + st.force.do > f1.x + f1.d, 'demo đang chạy thì lực 2 đội tăng dần');
    const stop = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo-stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(stop.json.success, true);
    st = await getState(t, user);
    assert.equal(st.demoActive, false);
    const f2 = { x: st.force.xanh, d: st.force.do };
    await sleep(3000);
    st = await getState(t, user);
    assert.equal(st.force.xanh, f2.x, 'dừng demo thì lực không tăng nữa');
    assert.equal(st.force.do, f2.d);
  } finally { await stopTestServer(t); }
});

test('keo-co: demo bị từ chối khi phòng đã có event thật (webhookCount > 0)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_demono');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-r', nickname: 'NguoiThat', content: 'xanh' });
    const st0 = await getState(t, user);
    assert.equal(st0.webhookCount, 1);
    await enableDemo(t, user);
    const start = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo-start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(start.json.success, false, 'đã có event thật thì từ chối demo');
    const st = await getState(t, user);
    assert.equal(st.demoActive, false);
  } finally { await stopTestServer(t); }
});

test('keo-co: endpoint test 1 lượt + bulk-join 100 người; overlay + dashboard 200; guide có webhook', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_test100');
    await enableDemo(t, user);
    const demo = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(demo.status, 200);
    assert.equal(demo.json.steps.length, 6);
    const bulk = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/bulk-join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 100 }),
    });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.json.count, 100);
    assert.equal(bulk.json.viewersOnline, 102, '100 bulk + 2 demo 1 lượt');
    const st = await getState(t, user);
    assert.equal(st.teams.xanh.total, 51);
    assert.equal(st.teams.do.total, 51);
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('KÉO CO'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(db.status, 200);
    assert.ok(db.text.includes('Bảng điều khiển'), 'dashboard phải trả về trang điều khiển');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME}/${user}/api/webhook`), 'guide phải có link webhook đúng phòng');
  } finally { await stopTestServer(t); }
});

test('keo-co: /api/tikfinity-actions trả đủ 6 Action, mỗi action 1 URL riêng ?event= (KHÔNG có body)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_tikb');
    const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(r.status, 200);
    assert.ok(r.json.webhookUrl.includes(`/o/${GAME}/${user}/api/webhook`), 'URL webhook đúng phòng');
    assert.equal(r.json.actions.length, 6);
    const names = r.json.actions.map((a) => a.actionName);
    assert.deepEqual(names, [
      'Keo Co - Qua', 'Keo Co - Binh luan', 'Keo Co - Tim',
      'Keo Co - Follow', 'Keo Co - Share', 'Keo Co - Vao phong',
    ]);
    const triggers = r.json.actions.map((a) => a.triggerLabel);
    assert.ok(triggers[0].includes('Sending a gift with min. coins value'), 'Gift = min coins value');
    assert.equal(triggers[1], 'Chat (any comment)');
    assert.equal(triggers[2], 'Sending likes (taps)');
    assert.equal(triggers[3], 'Follow');
    assert.equal(triggers[4], 'Share');
    assert.equal(triggers[5], 'Join');
    // Mỗi action 1 URL riêng phân biệt bằng ?event=<loại>; KHÔNG có body.
    const keys = ['gift', 'chat', 'like', 'follow', 'share', 'join'];
    r.json.actions.forEach((a, i) => {
      assert.equal(a.key, keys[i]);
      assert.equal(a.url, `${r.json.webhookUrl}?event=${keys[i]}`, 'URL riêng của action ' + a.key);
      assert.ok(!('body' in a), 'không được có body trong action ' + a.key);
    });
    assert.ok(!JSON.stringify(r.json).includes('"body"'), 'response không nhắc tới body');
  } finally { await stopTestServer(t); }
});

test('keo-co: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('keo_a');
    const userB = uniq('keo_b');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    const roomB = await t.rooms.getOrCreate(GAME, userB);
    const s = await setSettings(t, userA, { tapForce: 999, winForce: 1, commentSpamS: 0 });
    assert.equal(s.tapForce, 10, 'tapForce chặn tối đa 10');
    assert.equal(s.winForce, 100, 'winForce = 1 -> kẹp lên tối thiểu 100');
    assert.equal(s.commentSpamS, 1, 'commentSpamS = 0 -> kẹp lên tối thiểu 1');
    await t.rooms.dispatchWebhook(roomA, { triggerTypeId: 11, userId: 'u-a', nickname: 'ChiPhongA', content: 'xanh' });
    const stB = await t.rooms.getState(roomB);
    assert.ok(!JSON.stringify(stB.body).includes('ChiPhongA'), 'room B không được thấy event room A');
  } finally { await stopTestServer(t); }
});

test('keo-co: /api/test/demo rẽ action start/stop/once đúng hàm (hồi quy lỗi B)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('keo_demoaction');
    await enableDemo(t, user);
    const call = (b) => fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
    });
    // stop khi demo chưa chạy: không bơm demo, demoActive false.
    const stop0 = await call({ action: 'stop' });
    assert.equal(stop0.json.demoActive, false, 'stop trước khi start thì demoActive false');
    let st = await getState(t, user);
    assert.equal(st.demoActive, false);
    assert.equal(st.force.xanh, 0, 'stop không được bơm demo');
    // start qua action: demo chạy, lực 2 đội tăng.
    const start = await call({ action: 'start' });
    assert.equal(start.json.demoActive, true, 'start qua action phải chạy demo');
    st = await waitFor(t, user, (s) => s.demoActive === true && s.force.xanh > 0 && s.force.do > 0, 10, 500);
    assert.equal(st.demoActive, true);
    // stop qua action: demo dừng hẳn, lực đứng yên (không bơm thêm lượt mẫu).
    const stop = await call({ action: 'stop' });
    assert.equal(stop.json.demoActive, false, 'stop qua action phải dừng demo');
    st = await getState(t, user);
    const snap = JSON.stringify([st.force.xanh, st.force.do]);
    await sleep(4000);
    st = await getState(t, user);
    assert.equal(JSON.stringify([st.force.xanh, st.force.do]), snap, 'stop qua action thì lực không tăng nữa');
    // once (không action): vẫn 1 lượt mẫu như cũ, trả đủ 6 bước.
    const once = await call({});
    assert.equal(once.json.steps.length, 6, 'once giữ nguyên 1 lượt mẫu 6 bước');
  } finally { await stopTestServer(t); }
});
