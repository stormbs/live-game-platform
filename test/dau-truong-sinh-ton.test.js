// test/dau-truong-sinh-ton.test.js — Test game Đấu Trường Sinh Tồn:
// join -> 100 HP; tap -> địch ngẫu nhiên mất HP; comment tên -> đúng người -3;
// quà 10 xu = +10 sát thương dồn; quà lạ = 0 + WARN; gục ở 0 HP (không âm),
// còn 1 người -> thắng + trận mới; vòng bo trừ HP đều; tap delta + chống spam;
// tối đa 24 người, người thứ 25 chờ hàng; demo start/stop + từ chối khi đã
// có event thật; overlay/dashboard 200; /api/tikfinity-actions 6 URL riêng.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'dau-truong-sinh-ton';

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

function hpOf(st, uid) {
  const f = st.fighters.find((x) => x.uid === uid);
  return f ? f.hp : null;
}

test('dau-truong: join -> 100 HP; tap -> địch ngẫu nhiên mất HP; comment tên -> đúng người -3', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_join');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    let st = await getState(t, user);
    assert.equal(st.fighters.length, 1);
    assert.equal(st.fighters[0].hp, 100, 'vào trận với 100 HP');
    assert.equal(st.phase, 'lobby', '1 người thì chưa bắt đầu');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    st = await getState(t, user);
    assert.equal(st.phase, 'fighting', 'đủ 2 người là trận bắt đầu ngay');
    assert.equal(st.fighters.length, 2);
    // Tap: lần đầu baseline, lần 2 delta 5 -> chỉ còn B là địch nên B -5.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 100 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 105 });
    st = await getState(t, user);
    assert.equal(st.stats.taps, 5, 'tap tính theo delta');
    assert.equal(hpOf(st, 'u-b'), 90, 'tap 5 lần -> địch -10 HP (tapDamage 2)');
    assert.equal(hpOf(st, 'u-a'), 100, 'không tự đánh mình');
    // Bình luận đúng tên địch -> -3 HP.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'BanB' });
    st = await getState(t, user);
    assert.equal(hpOf(st, 'u-b'), 87, 'bình luận tên địch -> -3 HP');
    assert.equal(st.top[0].uid, 'u-a');
    assert.equal(st.top[0].damage, 13, 'top sát thương: 5 tap x 2 + 3 tên = 13');
  } finally { await stopTestServer(t); }
});

test('dau-truong: quà 10 xu = +10 sát thương dồn, đòn sau dùng hết; quà lạ = 0 + WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_gift');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Hoa hồng', diamondCount: 10, repeatCount: 1 });
    let st = await getState(t, user);
    assert.equal(st.fighters.find((f) => f.uid === 'u-a').bonus, 10, 'quà 10 xu = +10 sát thương dồn');
    assert.equal(hpOf(st, 'u-b'), 100, 'quà chưa đánh thì HP địch chưa đổi');
    // Tap 1 lần -> đòn 2 + 10 = 12, bonus về 0.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 1 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 2 });
    st = await getState(t, user);
    assert.equal(hpOf(st, 'u-b'), 88, 'đòn sau = 2 + 10 bonus = 12 sát thương');
    assert.equal(st.fighters.find((f) => f.uid === 'u-a').bonus, 0, 'bonus chỉ dùng cho 1 đòn');
    // Quà lạ không rõ xu.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Quà lạ', repeatCount: 1 });
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.fighters.find((f) => f.uid === 'u-a').bonus, 0, 'quà lạ không cộng bonus');
    assert.ok(JSON.stringify(st.logs).includes('không rõ số xu'), 'log cảnh báo phải ghi rõ');
  } finally { await stopTestServer(t); }
});

test('dau-truong: quà 100 xu hồi +20 HP; follow +10 HP 1 lần/trận', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_heal');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    // B đánh A 5 lần (tap delta 5) -> A còn 90 (tapDamage 2).
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-b', nickname: 'BanB', likeCount: 10 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-b', nickname: 'BanB', likeCount: 15 });
    let st = await getState(t, user);
    assert.equal(hpOf(st, 'u-a'), 90);
    // Quà 100 xu -> hồi 20 nhưng tối đa 100.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Heo may mắn', diamondCount: 100, repeatCount: 1 });
    st = await getState(t, user);
    assert.equal(hpOf(st, 'u-a'), 100, 'hồi 20 HP, tối đa 100');
    // Follow +10: A đang 100 nên không vượt max; đánh A xuống rồi follow.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-b', nickname: 'BanB', likeCount: 25 });
    st = await getState(t, user);
    assert.equal(hpOf(st, 'u-a'), 80, 'B tap thêm 10 -> A còn 80');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-a', nickname: 'AnhA' });
    st = await getState(t, user);
    assert.equal(hpOf(st, 'u-a'), 90, 'follow +10 HP (1 lần/trận, lần 2 không cộng)');
  } finally { await stopTestServer(t); }
});

test('dau-truong: gục ở 0 HP (không âm), còn 1 người -> thắng + trận mới', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_win');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { startHp: 5, spotlightS: 1 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 1 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 6 });
    let st = await waitFor(t, user, (s) => s.phase === 'spotlight', 20, 500);
    assert.equal(st.phase, 'spotlight');
    assert.equal(st.winner.name, 'AnhA');
    assert.equal(hpOf(st, 'u-b'), 0, 'HP về 0, không âm');
    assert.equal(st.downed.length, 1);
    assert.equal(st.downed[0].name, 'BanB');
    // Hết 1s vinh danh -> trận mới, mọi người tham gia lại từ đầu.
    st = await waitFor(t, user, (s) => s.matchNo === 2 && s.phase === 'lobby', 20, 500);
    assert.equal(st.matchNo, 2);
    assert.equal(st.fighters.length, 0, 'trận mới: sân trống, phải tham gia lại');
    assert.equal(st.downed.length, 0);
  } finally { await stopTestServer(t); }
});

test('dau-truong: vòng bo sau 3 phút trừ HP đều mỗi 10s', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_zone');
    const room = await t.rooms.getOrCreate(GAME, user);
    await setSettings(t, user, { startHp: 20, zoneAfterS: 2, zoneIntervalS: 1, matchDurationS: 60 });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    const st = await waitFor(t, user, (s) => s.zoneTicks >= 2, 20, 500);
    assert.ok(st.zoneTicks >= 2, 'vòng bo đã siết ít nhất 2 lần');
    assert.equal(st.zoneActive, true);
    assert.equal(hpOf(st, 'u-a'), hpOf(st, 'u-b'), 'vòng bo trừ HP đều cả 2');
    assert.ok(hpOf(st, 'u-a') < 20, 'HP đã giảm do vòng bo');
  } finally { await stopTestServer(t); }
});

test('dau-truong: chống spam comment 1/5s; tap lần đầu đặt baseline', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_spam');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-b', nickname: 'BanB', content: 'tham gia' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'BanB' });
    let st = await getState(t, user);
    assert.equal(hpOf(st, 'u-b'), 97, 'bình luận tên lần 1 -> -3');
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'BanB' });
    st = await getState(t, user);
    assert.equal(st.stats.commentsBlocked, 1, 'bình luận tên lần 2 trong 5s bị chặn');
    assert.equal(hpOf(st, 'u-b'), 97, 'comment spam không trừ HP');
    // Tap: người này đã tim 5000 lần từ trước.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 7, userId: 'u-a', nickname: 'AnhA', likeCount: 5000 });
    st = await getState(t, user);
    assert.equal(st.stats.taps, 0, 'delta lần đầu = 0');
    assert.equal(hpOf(st, 'u-b'), 97, 'không bị 5000 tim ồ ạt');
  } finally { await stopTestServer(t); }
});

test('dau-truong: tối đa 24 người, người thứ 25 chờ hàng; có người gục thì vào thay', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_max24');
    await setSettings(t, user, { startHp: 3 });
    await enableDemo(t, user);
    const bulk = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/bulk-join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 25 }),
    });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.json.count, 25);
    assert.equal(bulk.json.fighters, 24, 'tối đa 24 chiến binh trên sân');
    assert.equal(bulk.json.queueCount, 1, 'người thứ 25 chờ hàng');
    // Chiến binh 1 bình luận tên Chiến binh 2 (3 HP) -> gục -> người chờ vào thay.
    // (Tắt chế độ thử trước: webhook thật bị bỏ qua khi demoMode bật.)
    await setSettings(t, user, { demoMode: false });
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'test_bulk_0', nickname: 'Chiến binh 1', content: 'Chiến binh 2' });
    const st = await getState(t, user);
    assert.equal(st.downed.length, 1, 'Chiến binh 2 đã gục');
    assert.equal(st.queueCount, 0, 'người chờ đã vào thay');
    assert.equal(st.fighters.filter((f) => f.alive).length, 24, 'sân lại đủ 24 người sống');
  } finally { await stopTestServer(t); }
});

test('dau-truong: demo start -> HP thay đổi; stop -> dừng; từ chối khi đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_demo');
    await enableDemo(t, user);
    const start = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo-start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    let st = await waitFor(t, user, (s) => s.demoActive === true && s.fighters.length >= 2, 10, 500);
    assert.equal(st.demoActive, true);
    assert.equal(st.phase, 'fighting', 'demo vào đủ 2 người là trận bắt đầu');
    st = await waitFor(t, user, (s) => s.stats.hits > 0, 24, 500);
    assert.ok(st.stats.hits > 0, 'demo đang chạy thì có đòn đánh');
    const hpTotal = st.fighters.reduce((a, f) => a + f.hp, 0);
    assert.ok(hpTotal < st.fighters.length * 100, 'HP tổng đã giảm do demo đánh nhau');
    const stop = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo-stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(stop.json.success, true);
    st = await getState(t, user);
    assert.equal(st.demoActive, false);
    const hits0 = st.stats.hits;
    const hp0 = st.fighters.reduce((a, f) => a + f.hp, 0);
    await sleep(3000);
    st = await getState(t, user);
    assert.equal(st.stats.hits, hits0, 'dừng demo thì không còn đòn đánh mới');
    assert.equal(st.fighters.reduce((a, f) => a + f.hp, 0), hp0, 'dừng demo thì HP không đổi');
  } finally { await stopTestServer(t); }
});

test('dau-truong: demo bị từ chối khi phòng đã có event thật (webhookCount > 0)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_demono');
    const room = await t.rooms.getOrCreate(GAME, user);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-r', nickname: 'NguoiThat', content: 'tham gia' });
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

test('dau-truong: endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautruong_test1');
    await enableDemo(t, user);
    const demo = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(demo.status, 200);
    assert.equal(demo.json.steps.length, 6);
    const st = await getState(t, user);
    assert.ok(st.fighters.length >= 2, 'demo 1 lượt phải có 2 chiến binh');
    assert.equal(st.phase, 'fighting');
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('ĐẤU TRƯỜNG SINH TỒN'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(db.status, 200);
    assert.ok(db.text.includes('Bảng điều khiển'), 'dashboard phải trả về trang điều khiển');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME}/${user}/api/webhook`), 'guide phải có link webhook đúng phòng');
    const tik = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(tik.status, 200);
    assert.equal(tik.json.actions.length, 6);
    assert.deepEqual(tik.json.actions.map((a) => a.actionName), [
      'Dau Truong Sinh Ton - Qua', 'Dau Truong Sinh Ton - Binh luan', 'Dau Truong Sinh Ton - Tim',
      'Dau Truong Sinh Ton - Follow', 'Dau Truong Sinh Ton - Share', 'Dau Truong Sinh Ton - Vao phong',
    ]);
    tik.json.actions.forEach((a, i) => {
      const keys = ['gift', 'chat', 'like', 'follow', 'share', 'join'];
      assert.equal(a.url, `${tik.json.webhookUrl}?event=${keys[i]}`);
      assert.ok(!('body' in a), 'không được có body');
    });
  } finally { await stopTestServer(t); }
});

test('dau-truong: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('dautruong_a');
    const userB = uniq('dautruong_b');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    const roomB = await t.rooms.getOrCreate(GAME, userB);
    const s = await setSettings(t, userA, { startHp: 9999, tapDamage: 0, zoneAfterS: 1 });
    assert.equal(s.startHp, 500, 'startHp chặn tối đa 500');
    assert.equal(s.tapDamage, 1, 'tapDamage = 0 -> kẹp lên tối thiểu 1');
    assert.equal(s.zoneAfterS, 2, 'zoneAfterS = 1 -> kẹp lên tối thiểu 2');
    await t.rooms.dispatchWebhook(roomA, { triggerTypeId: 11, userId: 'u-a', nickname: 'ChiPhongA', content: 'tham gia' });
    const stB = await t.rooms.getState(roomB);
    assert.ok(!JSON.stringify(stB.body).includes('ChiPhongA'), 'room B không được thấy event room A');
  } finally { await stopTestServer(t); }
});
