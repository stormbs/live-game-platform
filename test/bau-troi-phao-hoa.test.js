'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'bau-troi-phao-hoa';
const GAME_ID = 'bau-troi-phao-hoa';
let counter = 0;
function uniq() {
  counter += 1;
  return ('phao' + Date.now().toString(36).slice(-4) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 24);
}
const postJson = (t, p, b) => fetchJson(t.base, p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
});
const getState = (t, u) => fetchJson(t.base, `/o/${GAME}/${u}/api/state`).then((r) => r.json);
async function enableDemo(t, u, extra) {
  const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { demoMode: true, ...(extra || {}) });
  assert.equal(r.status, 200);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(t, u, pred, tries = 20, label = 'điều kiện') {
  let st;
  for (let i = 0; i < tries; i += 1) {
    await sleep(500);
    st = await getState(t, u);
    if (pred(st)) return st;
  }
  assert.ok(false, `quá thời gian chờ ${label} (state cuối: ${JSON.stringify(st).slice(0, 400)})`);
  return st;
}

test('phao-hoa: join lần đầu 0đ + pháo chào mừng mang tên', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/join`, { name: 'An' });
    const st = await waitFor(t, u, (s) => s.totalFireworks >= 1, 10, 'pháo chào mừng nổ');
    assert.equal(st.top.length, 1);
    assert.equal(st.top[0].name, 'An');
    assert.equal(st.top[0].points, 0, 'join không cộng điểm');
    assert.equal(st.recentFireworks[st.recentFireworks.length - 1].kind, 'small');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: tap x45 -> +2đ, dư 5 tap, 2 pháo nhỏ', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'tap-45', name: 'Tapper', count: 45 });
    assert.equal(r.json.points, 2);
    const st = await waitFor(t, u, (s) => s.totalFireworks >= 2, 10, '2 pháo nhỏ nổ');
    assert.equal(st.top[0].points, 2);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: tap delta qua webhook — gửi lại likeCount cũ thì +0đ, không pháo', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    const like = (n) => postJson(t, `/o/${GAME}/${u}/api/webhook`,
      { triggerTypeId: 7, event: 'like', userId: 'u-tap', nickname: 'Tap', likeCount: n });
    let r = await like(50);
    assert.equal(r.json.ok, false, 'lần đầu thấy likeCount thì delta = 0');
    r = await like(90);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.taps, 40);
    assert.equal(r.json.points, 2, '40 tap = +2đ');
    const st = await getState(t, u);
    assert.equal(st.top[0].points, 2);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: comment 2 lần trong 3s — cái 1 +1đ, cái 2 bị chặn (qua webhook thật)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    const body = { triggerTypeId: 11, event: 'chat', userId: 'u-cmt', nickname: 'Cmt', content: 'đẹp quá' };
    let r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.points, 1);
    r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.json.ok, false, 'bình luận thứ 2 trong 5s phải bị chặn');
    const st = await getState(t, u);
    assert.equal(st.top[0].points, 1);
    assert.equal(st.stats.commentsBlocked, 1);
    assert.equal(st.recentComments.length, 1, 'chỉ 1 bong bóng comment');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: quà 3 tầng — 1 xu +10đ pháo tròn, 10 xu +100đ pháo chùm, 100 xu +1000đ pháo hình tim', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'g1', name: 'Nho', coins: 1, giftName: 'Hoa hồng' });
    assert.equal(r.json.points, 10);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'g10', name: 'Vua', coins: 10, giftName: 'Kính râm' });
    assert.equal(r.json.points, 100);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'g100', name: 'Lon', coins: 100, giftName: 'Vương miện' });
    assert.equal(r.json.points, 1000);
    const st = await getState(t, u);
    const kinds = st.recentFireworks.map((f) => f.kind);
    assert.ok(kinds.includes('small'), 'quà 1 xu -> pháo tròn nhỏ');
    assert.ok(kinds.includes('cluster'), 'quà 10 xu -> pháo chùm');
    const shape = st.recentFireworks.find((f) => f.kind === 'shape');
    assert.ok(shape, 'quà 100 xu -> pháo hình');
    assert.equal(shape.shape, 'heart', 'hình mặc định là trái tim');
    assert.deepEqual(st.top.map((p) => p.points), [1000, 100, 10]);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: quà lạ không rõ xu -> +0đ + log WARN, pháo nhỏ visual only', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: null, giftName: 'Quà Lạ' });
    assert.equal(r.json.ok, false);
    const st = await getState(t, u);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.totalFireworks, 1, 'pháo nhỏ visual only vẫn nổ');
    assert.equal(st.top.length, 1);
    assert.equal(st.top[0].points, 0, 'không cộng điểm');
    assert.ok(st.logs.some((l) => l.text.includes('không rõ số xu')));
  } finally { await stopTestServer(t); }
});

test('phao-hoa: follow x2 — lần 1 +5đ + pháo chữ tên, lần 2 = 0', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let r = await postJson(t, `/o/${GAME}/${u}/api/test/follow`, { uid: 'flw-1', name: 'An' });
    assert.equal(r.json.ok, true);
    assert.equal(r.json.points, 5);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/follow`, { uid: 'flw-1', name: 'An' });
    assert.equal(r.json.ok, false, 'follow lần 2 trong phiên không cộng');
    const st = await getState(t, u);
    assert.equal(st.top[0].points, 5);
    assert.equal(st.stats.followsBlocked, 1);
    const nameFw = st.recentFireworks.find((f) => f.kind === 'name');
    assert.ok(nameFw, 'phải có pháo chữ follow');
    assert.equal(nameFw.text, 'AN');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: share x2 trong 30s — lần 1 +1đ, lần 2 = 0', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let r = await postJson(t, `/o/${GAME}/${u}/api/test/share`, { uid: 'shr-1', name: 'An' });
    assert.equal(r.json.ok, true);
    assert.equal(r.json.points, 1);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/share`, { uid: 'shr-1', name: 'An' });
    assert.equal(r.json.ok, false, 'share lần 2 trong 30s phải bị chặn');
    const st = await getState(t, u);
    assert.equal(st.top[0].points, 1);
    assert.equal(st.stats.sharesBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: 20 pháo nhỏ cùng lúc -> gộp (xN), tổng vẫn đủ 20, không vượt 8/s', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 20 });
    assert.equal(r.json.count, 20);
    const st = await waitFor(t, u, (s) => s.totalFireworks >= 20, 10, '20 pháo nhỏ (gộp) nổ xong');
    assert.equal(st.totalFireworks, 20, 'điểm/pháo vẫn đếm đủ dù gộp');
    assert.ok(st.stats.merged > 0, 'phải có pháo được gộp');
    assert.ok(st.recentFireworks.some((f) => f.kind === 'merged'), 'phải có pháo gộp xN trong lịch sử');
    assert.equal(st.stats.dropped, 0, 'không rớt pháo nào khi đủ hàng đợi');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: hàng đợi pháo nhỏ đầy (20) -> rớt cũ nhất, điểm vẫn đủ (màn lớn đang chạy thì pháo nhỏ chờ)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { grandShowS: 30 });
    // Bắn màn lớn ngay để tạm dừng pháo nhỏ, rồi nhồi 30 join vào hàng đợi.
    await postJson(t, `/o/${GAME}/${u}/api/grand-show/now`, {});
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 30 });
    assert.equal(r.json.count, 30);
    const st = await getState(t, u);
    assert.equal(st.smallQueueLength, 20, 'hàng đợi pháo nhỏ tối đa 20');
    assert.equal(st.stats.dropped, 10, '30 - 20 = 10 pháo cũ nhất bị rớt (chỉ visual)');
    assert.equal(st.grandShows, 1);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: mốc 100 pháo (đặt mốc 5 để test) -> màn lớn 10s + top 3 đúng điểm', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { grandEvery: 5, grandShowS: 1 });
    await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 5 });
    const st = await waitFor(t, u, (s) => s.grandShows >= 1, 10, 'màn lớn bắt đầu');
    assert.equal(st.grandShows, 1);
    assert.ok(st.totalFireworks >= 17, '5 pháo nhỏ + 12 pháo màn lớn = 17');
    assert.ok(st.logs.some((l) => l.text.includes('MÀN PHÁO LỚN')));
  } finally { await stopTestServer(t); }
});

test('phao-hoa: countdown test 3s -> màn đại + pháo chữ chúc mừng', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/countdown/test`, { seconds: 3 });
    assert.equal(r.json.success, true);
    const st = await waitFor(t, u, (s) => s.finaleCount >= 1, 24, 'màn đại countdown');
    assert.equal(st.finaleCount, 1);
    assert.ok(st.recentFireworks.some((f) => f.kind === 'finale'), 'phải có pháo màn đại');
    const nameFw = st.recentFireworks.find((f) => f.kind === 'name' && f.text === 'CHÚC MỪNG NĂM MỚI!');
    assert.ok(nameFw, 'phải có pháo chữ dòng chúc mừng');
    assert.equal(st.countdown.active, false, 'countdown tự tắt sau màn đại');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: countdown mặc định TẮT — không đặt giờ G thì không có đồng hồ', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const st = await getState(t, u);
    assert.equal(st.countdown, null);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: 2 người trùng nickname khác uniqueId -> 2 người riêng, không gộp điểm', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'lan-1', name: 'Lan', count: 20 });
    await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'lan-2', name: 'Lan', count: 20 });
    const st = await getState(t, u);
    assert.equal(st.top10.length, 2, '2 Lan khác uid là 2 người riêng');
    assert.deepEqual(st.top10.map((p) => p.points), [1, 1]);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: demo 12 bước -> màn lớn + Chi top 1101đ + màn đại countdown', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { grandShowS: 1, finaleS: 2 });
    const d = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, {});
    assert.equal(d.json.success, true);
    assert.equal(d.json.steps.length, 12);
    let st = await waitFor(t, u, (s) => s.grandShows >= 1, 20, 'màn lớn của demo');
    assert.equal(st.grandShows, 1);
    st = await waitFor(t, u, (s) => s.finaleCount >= 1, 40, 'màn đại countdown của demo');
    assert.equal(st.finaleCount, 1);
    assert.equal(st.top[0].name, 'Chi');
    assert.equal(st.top[0].points, 1101, 'Chi: comment 1 + gift 10 xu 100đ + gift 100 xu 1000đ');
    assert.equal(st.top[1].name, 'Bình');
    assert.equal(st.top[1].points, 11, 'Bình: gift 1 xu 10đ + tap 1đ');
    assert.equal(st.top[2].name, 'An');
    assert.equal(st.top[2].points, 7, 'An: tap 1 + follow 5 + share 1');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: endpoint test + bulk-join 100 người (cần bật chế độ thử)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 100 });
    assert.equal(r.json.success, true);
    assert.equal(r.json.count, 100);
    assert.equal(r.json.viewersOnline, 100);
  } finally { await stopTestServer(t); }
});

test('phao-hoa: room A không lọt sang room B; overlay + dashboard trả 200', async () => {
  const t = await startTestServer();
  try {
    const a = uniq();
    const b = uniq();
    await enableDemo(t, a);
    await postJson(t, `/o/${GAME}/${a}/api/test/tap`, { uid: 'iso-1', name: 'Iso', count: 20 });
    const stB = await getState(t, b);
    assert.equal(stB.totalFireworks, 0, 'phòng B không được thừa pháo của phòng A');
    const ov = await fetchJson(t.base, `/o/${GAME}/${a}/overlay.html`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('Bầu Trời Pháo Hoa'), 'overlay phải có tiêu đề game');
    assert.ok(ov.text.includes('id="sky"'), 'overlay phải có canvas bầu trời');
    const dash = await fetchJson(t.base, `/o/${GAME}/${a}/dashboard`);
    assert.equal(dash.status, 200);
    assert.ok(dash.text.includes('Hướng dẫn TikFinity'), 'dashboard phải có link hướng dẫn');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME_ID}&username=${a}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME_ID}/${a}/api/webhook`), 'guide phải có link webhook riêng của phòng');
  } finally { await stopTestServer(t); }
});

test('phao-hoa: settings chặn giá trị vượt giới hạn', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { maxPerSec: 0, grandEvery: 0, tapPerPoint: 0, bigShape: 'star' });
    assert.equal(r.json.settings.maxPerSec, 1, 'maxPerSec tối thiểu 1');
    assert.equal(r.json.settings.grandEvery, 1, 'grandEvery tối thiểu 1');
    assert.equal(r.json.settings.tapPerPoint, 1, 'tapPerPoint tối thiểu 1');
    assert.equal(r.json.settings.bigShape, 'star', 'đổi hình pháo lớn sang sao');
  } finally { await stopTestServer(t); }
});
