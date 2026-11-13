'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'dua-xe-leo-nui';
const GAME_ID = 'dua-xe-leo-nui';
let counter = 0;
function uniq() {
  counter += 1;
  return ('dua' + Date.now().toString(36).slice(-4) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(0, 24);
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

test('dua-xe: comment +10m xe streamer; chống spam 1 comment/5s (qua webhook thật)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    const body = { triggerTypeId: 11, event: 'chat', userId: 'u-cmt', nickname: 'Cmt', content: 'Đẩy xe nào!' };
    let r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meters, 10);
    r = await postJson(t, `/o/${GAME}/${u}/api/webhook`, body);
    assert.equal(r.json.ok, false, 'bình luận thứ 2 trong 5s phải bị chặn');
    const st = await getState(t, u);
    assert.equal(st.streamer.meters, 10);
    assert.equal(st.streamer.comments, 1);
    assert.equal(st.stats.commentsBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('dua-xe: tap delta — lần đầu 0, 100 tap = +50m xe streamer', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    const like = (n) => postJson(t, `/o/${GAME}/${u}/api/webhook`,
      { triggerTypeId: 7, event: 'like', userId: 'u-tap', nickname: 'Tap', likeCount: n });
    let r = await like(40);
    assert.equal(r.json.ok, false, 'lần đầu thấy likeCount thì delta = 0');
    r = await like(140);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.taps, 100);
    assert.equal(r.json.meters, 50);
    const st = await getState(t, u);
    assert.equal(st.streamer.meters, 50);
    assert.equal(st.streamer.taps, 100);
  } finally { await stopTestServer(t); }
});

test('dua-xe: quà ngoài top 3 đẩy xe streamer; vào top 3 thì xe của mình; đổi hạng', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const gift = (uid, name, coins) => postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid, name, coins, giftName: 'Quà thử' });
    await gift('g-chi', 'Chi', 100);
    await gift('g-binh', 'Bình', 200);
    await gift('g-dung', 'Dung', 300);
    let st = await getState(t, u);
    assert.equal(st.streamer.meters, 0, '3 người đầu đều vào top 3 nên xe streamer chưa được đẩy');
    assert.deepEqual(st.top.map((x) => x.name), ['Dung', 'Bình', 'Chi']);
    // An tặng 5 xu khi top 3 đã đủ người -> ngoài top 3 -> xe streamer +5m.
    let r = await gift('g-an', 'An', 5);
    assert.equal(r.json.inTop, false);
    st = await getState(t, u);
    assert.equal(st.streamer.meters, 5);
    assert.equal(st.streamer.giftMeters, 5);
    // An tặng thêm 400 xu -> 405đ, vào top 1; Chi (100đ) rớt khỏi top 3.
    r = await gift('g-an', 'An', 400);
    assert.equal(r.json.inTop, true);
    assert.equal(r.json.rank, 1);
    st = await getState(t, u);
    assert.deepEqual(st.top.map((x) => x.name), ['An', 'Dung', 'Bình']);
    assert.equal(st.top[0].carMeters, 405);
    assert.equal(st.streamer.meters, 5, 'mét quà ngoài top 3 đã cho xe streamer thì ở lại xe streamer');
    assert.ok(st.logs.some((l) => l.text.includes('vào Top 1')), 'phải log khi vào top 3');
  } finally { await stopTestServer(t); }
});

test('dua-xe: quà lạ không rõ xu -> 0 điểm + log cảnh báo, không mặc định +5', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { coins: null, giftName: 'Quà Lạ' });
    assert.equal(r.json.ok, false);
    const st = await getState(t, u);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.streamer.meters, 0);
    assert.equal(st.top.length, 0);
    assert.ok(st.logs.some((l) => l.text.includes('không rõ số xu')));
  } finally { await stopTestServer(t); }
});

test('dua-xe: follow +5m xe streamer, 1 lần/người/ván', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    let r = await postJson(t, `/o/${GAME}/${u}/api/test/follow`, { uid: 'flw-1' });
    assert.equal(r.json.ok, true);
    r = await postJson(t, `/o/${GAME}/${u}/api/test/follow`, { uid: 'flw-1' });
    assert.equal(r.json.ok, false, 'follow lần 2 trong cùng ván không cộng');
    const st = await getState(t, u);
    assert.equal(st.streamer.meters, 5);
    assert.equal(st.streamer.follows, 1);
    assert.equal(st.stats.follows, 2);
  } finally { await stopTestServer(t); }
});

test('dua-xe: chạm đỉnh 1000m (đặt 50m) -> thắng ngay -> bảng vinh danh -> ván mới', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { trackLength: 50, resultsS: 1 });
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'win-1', name: 'Chi', coins: 60, giftName: 'Du thuyền' });
    assert.equal(r.json.ok, true);
    let st = await getState(t, u);
    assert.equal(st.phase, 'results', 'xe 60m >= 50m phải thắng ngay');
    assert.equal(st.winner.name, 'Chi');
    assert.equal(st.winner.wonBy, 'summit');
    assert.equal(st.results.standings[0].name, 'Chi');
    let ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      await sleep(500);
      st = await getState(t, u);
      ok = st.roundNo === 2 && st.phase === 'racing';
    }
    assert.ok(ok, 'phải tự sang ván #2 sau bảng vinh danh');
    assert.equal(st.streamer.meters, 0);
    assert.equal(st.top.length, 0, 'điểm quà reset theo ván mới');
    assert.equal(st.history.length, 1);
    assert.equal(st.history[0].winner, 'Chi');
  } finally { await stopTestServer(t); }
});

test('dua-xe: hết giờ -> xe cao nhất thắng', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { resultsS: 1 });
    await postJson(t, `/o/${GAME}/${u}/api/test/comment`, { text: 'Đẩy xe nào!' });
    await postJson(t, `/o/${GAME}/${u}/api/race/set-clock`, { seconds: 2 });
    let st = await getState(t, u);
    let ok = false;
    for (let i = 0; i < 14 && !ok; i += 1) {
      await sleep(500);
      st = await getState(t, u);
      ok = st.phase === 'results';
    }
    assert.ok(ok, 'hết giờ phải sang bảng vinh danh');
    assert.equal(st.winner.type, 'streamer', 'xe streamer 10m là cao nhất');
    assert.equal(st.winner.wonBy, 'timeout');
    ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      await sleep(500);
      st = await getState(t, u);
      ok = st.roundNo === 2 && st.phase === 'racing';
    }
    assert.ok(ok, 'phải tự sang ván #2 sau bảng vinh danh');
  } finally { await stopTestServer(t); }
});

test('dua-xe: hòa mét khi hết giờ -> ai đạt mức đó TRƯỚC thắng', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { resultsS: 1 });
    await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'tie-a', name: 'AnhA', coins: 10, giftName: 'Hoa hồng' });
    await sleep(10);
    await postJson(t, `/o/${GAME}/${u}/api/test/gift`, { uid: 'tie-b', name: 'AnhB', coins: 10, giftName: 'Hoa hồng' });
    await postJson(t, `/o/${GAME}/${u}/api/race/set-clock`, { seconds: 2 });
    let st = await getState(t, u);
    let ok = false;
    for (let i = 0; i < 14 && !ok; i += 1) {
      await sleep(500);
      st = await getState(t, u);
      ok = st.phase === 'results';
    }
    assert.ok(ok, 'hết giờ phải sang bảng vinh danh');
    assert.equal(st.winner.name, 'AnhA', 'cùng 10m thì người đạt 10m trước thắng');
    assert.equal(st.winner.wonBy, 'timeout');
  } finally { await stopTestServer(t); }
});

test('dua-xe: demo 10 bước -> Chi về đích 1050m, xe streamer 150m, rồi ván mới', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u, { resultsS: 1 });
    const d = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, {});
    assert.equal(d.json.success, true);
    assert.equal(d.json.steps.length, 10);
    let st = await getState(t, u);
    assert.equal(st.phase, 'results', 'demo phải kết thúc ở bảng vinh danh (Chi về đích)');
    assert.equal(st.winner.name, 'Chi');
    assert.equal(st.winner.wonBy, 'summit');
    assert.equal(st.results.streamer.meters, 150, 'xe streamer: 30 cmt + 20 tap + 100 cmt = 150m');
    assert.equal(st.top[0].name, 'Chi');
    assert.equal(st.top[0].giftPoints, 1050);
    assert.equal(st.top[1].name, 'Bình');
    assert.equal(st.top[1].giftPoints, 205);
    let ok = false;
    for (let i = 0; i < 12 && !ok; i += 1) {
      await sleep(500);
      st = await getState(t, u);
      ok = st.roundNo === 2 && st.phase === 'racing';
    }
    assert.ok(ok, 'phải tự sang ván #2 sau bảng vinh danh');
  } finally { await stopTestServer(t); }
});

test('dua-xe: endpoint test + bulk-join 100 người (cần bật chế độ thử)', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/test/bulk-join`, { count: 100 });
    assert.equal(r.json.success, true);
    assert.equal(r.json.count, 100);
    assert.equal(r.json.viewersOnline, 100);
    const st = await getState(t, u);
    assert.equal(st.top.length, 0, 'join không tạo xe (chưa có quà)');
  } finally { await stopTestServer(t); }
});

test('dua-xe: room A không lọt sang room B; overlay + dashboard trả 200', async () => {
  const t = await startTestServer();
  try {
    const a = uniq();
    const b = uniq();
    await enableDemo(t, a);
    await postJson(t, `/o/${GAME}/${a}/api/test/comment`, { text: 'Đẩy xe nào!' });
    const stB = await getState(t, b);
    assert.equal(stB.streamer.meters, 0, 'phòng B không được thừa mét của phòng A');
    const ov = await fetchJson(t.base, `/o/${GAME}/${a}/overlay.html`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('ĐUA XE LEO NÚI'), 'overlay phải có tiêu đề game');
    const dash = await fetchJson(t.base, `/o/${GAME}/${a}/dashboard`);
    assert.equal(dash.status, 200);
    assert.ok(dash.text.includes('Hướng dẫn TikFinity'), 'dashboard phải có link hướng dẫn');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME_ID}&username=${a}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME_ID}/${a}/api/webhook`), 'guide phải có link webhook riêng của phòng');
  } finally { await stopTestServer(t); }
});

test('dua-xe: settings chặn giá trị vượt giới hạn', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { trackLength: 0, topN: 9, roundS: 0 });
    assert.equal(r.json.settings.trackLength, 10, 'trackLength tối thiểu 10');
    assert.equal(r.json.settings.topN, 5, 'topN tối đa 5');
    assert.equal(r.json.settings.roundS, 5, 'roundS tối thiểu 5');
  } finally { await stopTestServer(t); }
});

test('dua-xe: demo start/stop liên tục — xe streamer chạy, dừng thì đứng yên', async () => {
  const t = await startTestServer();
  try {
    const u = uniq();
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.equal(start.json.demoActive, true);
    let st = await getState(t, u);
    assert.equal(st.demoActive, true);
    assert.ok(st.streamer.meters > 0, 'demo phải đẩy xe streamer ngay khi bật');
    const activity = (s) => s.stats.taps + s.stats.comments + s.stats.gifts + s.stats.follows + s.stats.shares + s.stats.joins;
    const a1 = activity(st);
    const m1 = st.streamer.meters;
    await sleep(6000);
    st = await getState(t, u);
    assert.ok(activity(st) > a1, 'demo chạy thì số liệu phải tăng');
    assert.ok(st.streamer.meters > m1, 'demo chạy thì xe streamer phải chạy tiếp');
    const stop = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'stop' });
    assert.equal(stop.json.demoActive, false);
    st = await getState(t, u);
    const snap = JSON.stringify([st.stats, st.streamer.meters]);
    await sleep(4000);
    st = await getState(t, u);
    assert.equal(JSON.stringify([st.stats, st.streamer.meters]), snap, 'dừng demo thì xe + số liệu không tự đổi nữa');
  } finally { await stopTestServer(t); }
});

test('dua-xe: demo tự dừng khi event thật tới; từ chối bật khi đã có event thật; overlay ?demo=1', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq());
    const u = room.username;
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.json.demoActive, true);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that', nickname: 'NguoiThat', content: 'Đẩy xe nào!' });
    let st = await getState(t, u);
    assert.equal(st.demoActive, false, 'event thật tới thì demo phải tự dừng');
    assert.ok(st.webhookCount >= 1);
    // Hồi quy lỗi A: event thật THỨ 2 sau khi demo dừng KHÔNG được bị nuốt —
    // webhook phải xử lý thật (không trả demoMode:true) vì "Chế độ thử" đã tự tắt.
    const r2 = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that-2', nickname: 'NguoiThat2', content: 'hello lần 2' });
    assert.equal(r2.body.demoMode, undefined, 'event thật thứ 2 không được trả demoMode');
    assert.equal(r2.body.received, true);
    st = await getState(t, u);
    assert.ok(st.webhookCount >= 2, 'event thật thứ 2 phải được đếm');
    // Phòng đã có event thật -> từ chối bật lại. Bật lại "Chế độ thử" trước
    // rồi mới thử start: lần này phải từ chối theo chặn webhookCount (chứ
    // không phải vì demoMode đã tắt sau event thật đầu tiên).
    await enableDemo(t, u);
    const start2 = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start2.json.success, false, 'phòng có event thật thì không bật được demo');
    assert.match(start2.json.message || '', /event thật/);
    const ov = await fetchJson(t.base, `/o/${GAME}/${u}?demo=1`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('demo-badge'), 'overlay phải có huy hiệu DEMO');
    assert.ok(ov.text.includes("get('demo') === '1'"), 'overlay phải có autostart ?demo=1');
    const db = await fetchJson(t.base, `/room/${GAME}/${u}`);
    assert.ok(db.text.includes('Chạy demo'), 'dashboard phải có nút Chạy demo');
    assert.ok(db.text.includes('Dừng demo'), 'dashboard phải có nút Dừng demo');
  } finally { await stopTestServer(t); }
});
