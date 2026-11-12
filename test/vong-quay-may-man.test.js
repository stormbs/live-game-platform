'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'vong-quay-may-man';
const GAME_ID = 'vong-quay-may-man';
let counter = 0;
function uniq() {
  counter += 1;
  return ('quay' + Date.now().toString(36).slice(-4) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 24);
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
  assert.ok(false, `quá thời gian chờ ${label} (state cuối: ${JSON.stringify(st).slice(0, 300)})`);
  return st;
}

test('vong-quay: 10 bình luận = 50đ -> quay chung, người trúng là người trong phòng', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    for (let i = 0; i < 10; i += 1) {
      const r = await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { text: 'Quay nào!' });
      assert.equal(r.json.ok, true);
    }
    const st = await waitFor(t, u, (s) => s.recentWins.length >= 1, 20, 'lượt quay chung hoàn thành');
    assert.equal(st.totalSpins, 1);
    assert.equal(st.progress, 0, 'quay xong thanh reset về 0 (đủ 50 đúng)');
    assert.ok(st.recentWins[0].name, 'người trúng phải có tên');
    assert.equal(st.stats.sharedSpins, 1);
  } finally { await stopTestServer(t); }
});

test('vong-quay: trộn tim + bình luận = 50đ -> quay chung; điểm dư giữ lại', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    // 3 người, mỗi người tap 10 lần (đúng giới hạn 10/phút) = 30đ.
    for (let i = 0; i < 3; i += 1) {
      const uid = `mix-tap-${i}`;
      await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid, totalLikeCount: 1 });
      const r = await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid, totalLikeCount: 11 });
      assert.equal(r.json.counted, 10);
    }
    // 5 bình luận = 25đ -> tổng 55đ -> quay chung 1 lần, dư 5đ.
    for (let i = 0; i < 5; i += 1) await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { text: 'Quay nào!' });
    const st = await waitFor(t, u, (s) => s.recentWins.length >= 1, 20, 'lượt quay chung hoàn thành');
    assert.equal(st.progress, 5, '55đ - 50đ = dư 5đ giữ lại');
  } finally { await stopTestServer(t); }
});

test('vong-quay: chống spam — 1 người tap 100 lần/phút chỉ 10 tim tính; comment 3 lần chỉ 2 tính', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'spam-tap', totalLikeCount: 1 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'spam-tap', totalLikeCount: 101 });
    assert.equal(r.json.taps, 100);
    assert.equal(r.json.counted, 10, 'tối đa 10 tim/phút/người');
    assert.equal(r.json.points, 10);
    let st = await getState(t, u);
    assert.equal(st.stats.tapsBlocked, 90);
    assert.equal(st.progress, 10);
    // Comment: 2 lần đầu tính, lần 3 bị chặn.
    await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { uid: 'spam-cmt', text: 'a' });
    await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { uid: 'spam-cmt', text: 'b' });
    const r3 = await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { uid: 'spam-cmt', text: 'c' });
    assert.equal(r3.json.ok, false, 'bình luận thứ 3 trong 1 phút phải bị chặn');
    st = await getState(t, u);
    assert.equal(st.progress, 20, '10 tim + 2 bình luận x5đ');
    assert.equal(st.stats.commentsBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('vong-quay: tap delta — gửi lại likeCount cũ thì không cộng thêm', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'delta-1', totalLikeCount: 50 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'delta-1', totalLikeCount: 50 });
    assert.equal(r.json.ok, false, 'likeCount không tăng thì delta = 0');
    const st = await getState(t, u);
    assert.equal(st.progress, 0);
  } finally { await stopTestServer(t); }
});

test('vong-quay: bảng quy đổi quà 6 mốc xu đúng (1/10/50/100/500/1000)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift-tiers`, {});
    assert.equal(r.json.success, true);
    assert.deepEqual(r.json.tiers, [
      { coins: 1, spins: 1, epic: false },
      { coins: 10, spins: 2, epic: false },
      { coins: 50, spins: 3, epic: false },
      { coins: 100, spins: 5, epic: false },
      { coins: 500, spins: 10, epic: true },
      { coins: 1000, spins: 20, epic: true },
    ]);
  } finally { await stopTestServer(t); }
});

test('vong-quay: quà 10 xu -> 2 lượt quay riêng xếp hàng, quay hết theo thứ tự', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: 10, giftName: 'Kính râm' });
    assert.equal(r.json.ok, true);
    assert.equal(r.json.spins, 2);
    let st = await getState(t, u);
    assert.ok(st.queueLength >= 1 || st.currentSpin, '2 lượt phải vào hàng chờ / đang quay');
    st = await waitFor(t, u, (s) => s.totalSpins >= 2 && s.recentWins.length >= 2, 40, '2 lượt quay riêng hoàn thành');
    assert.equal(st.stats.privateSpins, 2);
    assert.ok(st.giftLog.length >= 1);
    assert.equal(st.giftLog[0].coins, 10);
    assert.equal(st.giftLog[0].spins, 2);
  } finally { await stopTestServer(t); }
});

test('vong-quay: quà lạ không rõ xu -> 0 lượt + log, không mặc định lượt', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: null, giftName: 'Quà Lạ' });
    assert.equal(r.json.ok, false);
    const st = await getState(t, u);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.queueLength, 0);
    assert.equal(st.unknownGifts.length, 1);
    assert.ok(st.logs.some((l) => l.text.includes('không rõ số xu')));
  } finally { await stopTestServer(t); }
});

test('vong-quay: ép ô hiếm Vua May Mắn (test-only) -> trúng + vào Top', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/force-segment`, { segmentId: 1, name: 'Lan' });
    assert.equal(r.json.success, true);
    assert.equal(r.json.segment, 'Vua May Mắn');
    const st = await waitFor(t, u, (s) => s.recentWins.length >= 1, 20, 'lượt ép ô hoàn thành');
    assert.equal(st.recentWins[0].segment, 'Vua May Mắn');
    assert.equal(st.recentWins[0].name, 'Lan');
    assert.equal(st.top.length, 1);
    assert.equal(st.top[0].name, 'Lan');
    assert.equal(st.top[0].wins, 1);
  } finally { await stopTestServer(t); }
});

test('vong-quay: ép ô Quay Thêm 1 Lượt -> quay tiếp miễn phí sau 2s', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/force-segment`, { segmentId: 10, name: 'Minh' });
    assert.equal(r.json.success, true);
    const st = await waitFor(t, u, (s) => s.stats.extraSpins >= 1, 20, 'ô quay thêm phải sinh lượt miễn phí');
    assert.ok(st.recentWins.some((h) => h.segment === 'Quay Thêm 1 Lượt'));
    const st2 = await waitFor(t, u, (s) => s.totalSpins >= 2, 40, 'lượt quay thêm phải chạy');
    assert.ok(st2.totalSpins >= 2);
  } finally { await stopTestServer(t); }
});

test('vong-quay: quay chung không cho người vừa trúng trúng 2 lần liên tiếp', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    // Chỉ 1 người trong phòng: quay chung lần 1 trúng người đó.
    await postJson(t, `/o/${GAME}/${u}/api/test/join`, { name: 'Solo' });
    await postJson(t, `/o/${GAME}/${u}/api/spin/shared-now`, {});
    let st = await waitFor(t, u, (s) => s.recentWins.length >= 1, 20, 'lượt quay chung 1 hoàn thành');
    assert.equal(st.recentWins[0].name, 'Solo');
    // Quay chung lần 2: pool chỉ còn người vừa trúng -> không quay, lượt vẫn chờ.
    await postJson(t, `/o/${GAME}/${u}/api/spin/shared-now`, {});
    await sleep(2500);
    st = await getState(t, u);
    assert.equal(st.totalSpins, 1, 'không được quay chung lần 2 cho cùng 1 người');
    assert.equal(st.pendingShared, 1, 'lượt quay chung vẫn chờ, không mất');
    assert.equal(st.currentSpin, null);
  } finally { await stopTestServer(t); }
});

test('vong-quay: từ cấm — bình luận chứa từ cấm không cộng điểm', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/settings`, { bannedWords: 'lua dao' });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { text: 'lừa đảo nhé' });
    assert.equal(r.json.ok, false);
    const st = await getState(t, u);
    assert.equal(st.progress, 0);
    assert.equal(st.stats.commentsBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('vong-quay: bảng ô tổng khác 100% thì không lưu; khôi phục mặc định được', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let st = await getState(t, u);
    const bad = st.settings.segments.map((s) => ({ ...s, prob: s.id === 1 ? 1 : s.prob }));
    const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { segments: bad });
    assert.equal(r.status, 400, 'tổng 99% phải bị từ chối');
    assert.ok(r.json.message.includes('100%'));
    st = await getState(t, u);
    assert.equal(st.settings.segments[0].prob, 2, 'bảng ô cũ giữ nguyên sau lần lưu lỗi');
    const r2 = await postJson(t, `/o/${GAME}/${u}/api/segments/reset`, {});
    assert.equal(r2.json.success, true);
    assert.equal(r2.json.segments.length, 20);
    assert.equal(r2.json.segments.reduce((a, s) => a + s.prob, 0), 100);
  } finally { await stopTestServer(t); }
});

test('vong-quay: demo tự động — 3 người góp đủ 50đ + gift 50 xu (3 lượt riêng)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { spinS: 1, resultS: 1 });
    const d = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, {});
    assert.equal(d.json.success, true);
    assert.equal(d.json.steps.length, 4);
    let st = await getState(t, u);
    assert.equal(st.progress, 10, '60đ - 50đ = dư 10đ');
    assert.ok(st.pendingShared >= 1 || st.currentSpin || st.totalSpins >= 1, 'phải có lượt quay chung chờ/đang chạy');
    assert.ok(st.queueLength >= 3 || st.totalSpins >= 1, '3 lượt quay riêng phải xếp hàng');
    st = await waitFor(t, u, (s) => s.recentWins.length >= 1, 20, 'lượt quay chung của demo hoàn thành');
    assert.ok(st.recentWins.length >= 1);
  } finally { await stopTestServer(t); }
});

test('vong-quay: endpoint test + bulk-join 100 người (cần bật chế độ thử)', async () => {
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

test('vong-quay: room A không lọt sang room B; overlay + dashboard trả 200', async () => {
  const t = await startTestServer();
  try {
    const a = uniq();
    const b = uniq();
    await enableDemo(t, a);
    await postJson(t, `/o/${GAME}/${a}/api/test/comment`, { text: 'Quay nào!' });
    const stB = await getState(t, b);
    assert.equal(stB.progress, 0, 'phòng B không được thừa điểm của phòng A');
    const ov = await fetchJson(t.base, `/o/${GAME}/${a}/overlay.html`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('VÒNG QUAY MAY MẮN'), 'overlay phải có tiêu đề game');
    assert.ok(ov.text.includes('Quay vui miễn phí'), 'overlay phải ghi rõ quay miễn phí');
    const dash = await fetchJson(t.base, `/o/${GAME}/${a}/dashboard`);
    assert.equal(dash.status, 200);
    assert.ok(dash.text.includes('Hướng dẫn TikFinity'), 'dashboard phải có link hướng dẫn');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME_ID}&username=${a}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME_ID}/${a}/api/webhook`), 'guide phải có link webhook riêng của phòng');
  } finally { await stopTestServer(t); }
});

test('vong-quay: settings chặn giá trị vượt giới hạn', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { spinThreshold: 0, tapPerMin: 0, spinS: 0 });
    assert.equal(r.json.settings.spinThreshold, 1, 'spinThreshold tối thiểu 1');
    assert.equal(r.json.settings.tapPerMin, 1, 'tapPerMin tối thiểu 1');
    assert.equal(r.json.settings.spinS, 1, 'spinS tối thiểu 1');
  } finally { await stopTestServer(t); }
});
