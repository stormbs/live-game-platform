// test/buong-giam.test.js — Test chế độ demo game Buồng Giam:
// POST /api/test/demo start/stop liên tục, tự dừng khi có event thật,
// từ chối bật khi phòng đã có event thật, overlay ?demo=1, dashboard có nút demo.
// Lưu ý: buồng giam giữ nguyên /api/demo-mode + watermark + demoFastChicken;
// vòng lặp demo chỉ thêm lên trên, gate bằng gameState.isDemoMode.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'buong-giam';

let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

const postJson = (t, p, b) => fetchJson(t.base, p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
});
const getState = (t, u) => fetchJson(t.base, `/o/${GAME}/${u}/api/state`).then((r) => r.json);
async function enableDemo(t, u) {
  const r = await postJson(t, `/o/${GAME}/${u}/api/demo-mode`, { enabled: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.isDemoMode, true);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const totalPoints = (st) => Object.values(st.users || {}).reduce((a, u) => a + (u.points || 0), 0);

test('buong-giam: demo start/stop liên tục — tù nhân lên mâm, dừng thì điểm đứng yên', async () => {
  const t = await startTestServer();
  try {
    const u = uniq('bg_demo');
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.equal(start.json.demoActive, true);
    let st = await getState(t, u);
    assert.equal(st.demoActive, true, 'state phải báo demoActive');
    assert.ok(Object.keys(st.users).length >= 3, 'demo phải đưa 3 tù nhân vào buồng ngay khi bật');
    assert.ok(totalPoints(st) >= 250, 'demo phải tặng Heo 50 xu (250đ) cho người đầu tiên lên Mâm 1');
    const p1 = totalPoints(st);
    await sleep(6000);
    st = await getState(t, u);
    assert.ok(totalPoints(st) > p1, 'demo chạy thì tổng điểm phải tăng');
    const stop = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'stop' });
    assert.equal(stop.json.demoActive, false);
    st = await getState(t, u);
    assert.equal(st.demoActive, false);
    // Người demo có isSimulated=true (miễn trừ điểm idle) -> tổng điểm phải đứng yên.
    const snap = JSON.stringify([totalPoints(st), Object.keys(st.users).length]);
    await sleep(4000);
    st = await getState(t, u);
    assert.equal(JSON.stringify([totalPoints(st), Object.keys(st.users).length]), snap, 'dừng demo thì điểm + số tù nhân không tự đổi nữa');
  } finally { await stopTestServer(t); }
});

test('buong-giam: demo tự dừng khi event thật tới; từ chối bật khi đã có event thật; overlay ?demo=1', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('bg_demostop'));
    const u = room.username;
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.json.demoActive, true);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that', nickname: 'NguoiThat', content: 'hello' });
    let st = await getState(t, u);
    assert.equal(st.demoActive, false, 'event thật tới thì demo phải tự dừng');
    assert.ok(st.webhook.count >= 1);
    const start2 = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start2.json.success, false, 'phòng có event thật thì không bật được demo');
    assert.match(start2.json.message || '', /event thật/);
    const ov = await fetchJson(t.base, `/o/${GAME}/${u}?demo=1`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('demo-watermark'), 'overlay phải có watermark DEMO');
    assert.ok(ov.text.includes("get('demo') === '1'"), 'overlay phải có autostart ?demo=1');
    const db = await fetchJson(t.base, `/room/${GAME}/${u}`);
    assert.ok(db.text.includes('Chạy demo'), 'dashboard phải có nút Chạy demo');
    assert.ok(db.text.includes('Dừng demo'), 'dashboard phải có nút Dừng demo');
  } finally { await stopTestServer(t); }
});
