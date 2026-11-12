'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'bep-an-tap-the';
const GAME_ID = 'bep-an-tap-the';
let counter = 0;
function uniq() {
  counter += 1;
  return ('bep' + Date.now().toString(36).slice(-4) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 24);
}
const postJson = (t, p, b) => fetchJson(t.base, p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
});
const getState = (t, u) => fetchJson(t.base, `/o/${GAME}/${u}/api/state`).then((r) => r.json);
async function enableDemo(t, u, extra) {
  const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { demoMode: true, ...(extra || {}) });
  assert.equal(r.status, 200);
}
async function comment(t, u, text, name) {
  return postJson(t, `/o/${GAME}/${u}/api/test/comment`, { text, name: name || 'Người Thử' });
}

test('bep-an: comment thả đúng nguyên liệu (thịt +3 / rau +2 / gia vị +1 / không khớp = gia vị chung)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let r = await comment(t, u, 'thịt bò');
    assert.equal(r.json.ok, true);
    assert.equal(r.json.cat, 'thit');
    assert.equal(r.json.points, 3);
    r = await comment(t, u, 'rau muống');
    assert.equal(r.json.cat, 'rau');
    assert.equal(r.json.points, 2);
    r = await comment(t, u, 'muối');
    assert.equal(r.json.cat, 'giavi');
    assert.equal(r.json.points, 1);
    r = await comment(t, u, 'hello');
    assert.equal(r.json.cat, 'giavi');
    assert.equal(r.json.points, 1, 'không khớp từ khóa nào thì tính gia vị chung +1');
    const st = await getState(t, u);
    assert.equal(st.pot.points, 3 + 2 + 1 + 1);
    assert.deepEqual(st.pot.counts, { thit: 1, rau: 1, giavi: 2 });
  } finally { await stopTestServer(t); }
});

test('bep-an: chống spam bình luận — 1 người 1 bình luận/5s (qua webhook thật)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    // Phòng mới tạo đã tắt demoMode sẵn (rooms.js) nên webhook thật được tính.
    const body = { triggerTypeId: 11, event: 'chat', userId: 'u-spam', nickname: 'Spam', content: 'thịt bò' };
    let r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.json.ok, false, 'bình luận thứ 2 trong 5s phải bị chặn');
    const st = await getState(t, u);
    assert.equal(st.pot.points, 3, 'chỉ 1 bình luận được tính');
    assert.equal(st.stats.commentsBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('bep-an: tap delta + thổi lửa — lần đầu 0, 70 tap = 3đ cá nhân + 1 lần thổi lửa (nồi +5, lửa to)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    const like = (n) => postJson(t, `/o/${GAME}/${u}/api/webhook`,
      { triggerTypeId: 7, event: 'like', userId: 'u-tap', nickname: 'Tap', likeCount: n });
    let r = await like(50);
    assert.equal(r.json.ok, false, 'lần đầu thấy likeCount thì delta = 0');
    r = await like(120);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.taps, 70);
    const st = await getState(t, u);
    assert.equal(st.pot.points, 5, '1 lần thổi lửa: nồi +5');
    assert.equal(st.fireLevel, 3, 'thổi lửa xong lửa lên cấp 3');
    assert.equal(st.stats.blows, 1);
    assert.equal(st.top[0].points, 4, '70 tap = 3đ (20 tap/đ) + 1đ thổi lửa');
  } finally { await stopTestServer(t); }
});

test('bep-an: lửa to thì nguyên liệu +1 — comment thịt bò lúc lửa cấp 3 được +4', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/tap`, { uid: 'fire-tapper', count: 50 });
    let st = await getState(t, u);
    assert.equal(st.fireLevel, 3);
    const r = await comment(t, u, 'thịt bò');
    assert.equal(r.json.points, 4, 'thịt +3, lửa to +1');
    st = await getState(t, u);
    assert.equal(st.pot.points, 5 + 4);
  } finally { await stopTestServer(t); }
});

test('bep-an: quà 1 xu = 10 điểm nấu, mốc món mở dần; quà lạ 0đ + log', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { potTarget: 100000 });
    let r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: 10, giftName: 'Hoa hồng' });
    assert.equal(r.json.ok, true);
    let st = await getState(t, u);
    assert.equal(st.pot.points, 100);
    assert.equal(st.pot.giftCoins, 10);
    assert.equal(st.pot.dishesUnlocked.length, 0);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: 100, giftName: 'Heo may mắn' });
    st = await getState(t, u);
    assert.equal(st.pot.giftCoins, 110);
    assert.equal(st.pot.dishesUnlocked.length, 1);
    assert.equal(st.pot.dishesUnlocked[0].name, 'Gà luộc');
    await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: 500, giftName: 'Du thuyền' });
    st = await getState(t, u);
    assert.equal(st.pot.giftCoins, 610);
    assert.deepEqual(st.pot.dishesUnlocked.map((d) => d.name), ['Gà luộc', 'Bánh chưng', 'Giò chả']);
    // Quà lạ: không rõ xu -> 0 điểm + log cảnh báo.
    r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: null, giftName: 'Quà Lạ' });
    assert.equal(r.json.ok, false);
    st = await getState(t, u);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.pot.points, 100 + 1000 + 5000, 'quà lạ không cộng điểm');
    assert.ok(st.logs.some((l) => l.text.includes('không rõ số xu')));
  } finally { await stopTestServer(t); }
});

test('bep-an: follow +10đ, share +5đ cá nhân, không cộng điểm nồi', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    await postJson(t, `/o/${GAME}/${u}/api/test/follow`, {});
    await postJson(t, `/o/${GAME}/${u}/api/test/share`, {});
    const st = await getState(t, u);
    assert.equal(st.pot.points, 0, 'follow/share không cộng điểm nồi');
    // Endpoint test tạo uid mới mỗi lần gọi nên follow và share là 2 người khác nhau.
    assert.equal(st.top.length, 2);
    assert.equal(st.top[0].points, 10, 'follow +10đ');
    assert.equal(st.top[1].points, 5, 'share +5đ');
    assert.equal(st.stats.follows, 1);
    assert.equal(st.stats.shares, 1);
  } finally { await stopTestServer(t); }
});

test('bep-an: nồi đủ điểm -> dọn cỗ -> bốc thăm -> nồi mới, điểm cá nhân giữ nguyên', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { potTarget: 10, serveS: 1, resultsS: 1 });
    await comment(t, u, 'thịt bò', 'An');
    await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: 1, giftName: 'Hoa hồng' });
    let st = await getState(t, u);
    assert.equal(st.phase, 'serving', 'nồi 3+10=13 >= 10 phải sang dọn cỗ');
    let ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
      st = await getState(t, u);
      ok = st.potNo === 2 && st.phase === 'cooking';
    }
    assert.ok(ok, 'phải tự sang nồi #2 sau dọn cỗ + kết quả');
    assert.equal(st.pot.points, 0, 'nồi mới bắt đầu từ 0');
    assert.equal(st.history.length, 1, 'lịch sử ghi lại nồi #1');
    assert.ok(st.history[0].winners.length >= 1, 'bốc thăm phải có người trúng (đang trong phòng)');
    assert.equal(st.top[0].points, 10, 'điểm cá nhân giữ nguyên qua nồi mới (gift 1 xu = 10đ)');
  } finally { await stopTestServer(t); }
});

test('bep-an: endpoint test + bulk-join 100 người (cần bật chế độ thử)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 100 });
    assert.equal(r.json.success, true);
    assert.equal(r.json.count, 100);
    assert.equal(r.json.viewersOnline, 100);
    const d = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, {});
    assert.equal(d.json.success, true);
    assert.equal(d.json.steps.length, 6);
    const st = await getState(t, u);
    assert.ok(st.pot.points > 0, 'demo 6 bước phải làm nồi có điểm');
  } finally { await stopTestServer(t); }
});

test('bep-an: room A không lọt sang room B; overlay + dashboard trả 200', async () => {
  const t = await startTestServer();
  try {
    const a = uniq();
    const b = uniq();
    await enableDemo(t, a);
    await comment(t, a, 'thịt bò');
    const stB = await getState(t, b);
    assert.equal(stB.pot.points, 0, 'phòng B không được thừa điểm của phòng A');
    const ov = await fetchJson(t.base, `/o/${GAME}/${a}/overlay.html`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('BẾP ĂN TẬP THỂ'), 'overlay phải có tiêu đề game');
    const dash = await fetchJson(t.base, `/o/${GAME}/${a}/dashboard`);
    assert.equal(dash.status, 200);
    assert.ok(dash.text.includes('Hướng dẫn TikFinity'), 'dashboard phải có link hướng dẫn');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME_ID}&username=${a}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME_ID}/${a}/api/webhook`), 'guide phải có link webhook riêng của phòng');
  } finally { await stopTestServer(t); }
});

test('bep-an: settings chặn giá trị vượt giới hạn', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, {
      potTarget: 0, winnersCount: 0, tapPerBlow: 99999,
      dishMilestones: [{ coins: 50, name: 'Trứng luộc', icon: '🥚' }],
    });
    assert.equal(r.json.settings.potTarget, 1, 'potTarget tối thiểu 1');
    assert.equal(r.json.settings.winnersCount, 1, 'winnersCount tối thiểu 1');
    assert.equal(r.json.settings.tapPerBlow, 1000, 'tapPerBlow tối đa 1000');
    assert.deepEqual(r.json.settings.dishMilestones, [{ coins: 50, name: 'Trứng luộc', icon: '🥚' }]);
  } finally { await stopTestServer(t); }
});
