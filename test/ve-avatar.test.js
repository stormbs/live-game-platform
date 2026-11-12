// test/ve-avatar.test.js — Test chế độ demo game Vẽ Avatar:
// POST /api/test/demo start/stop liên tục, tự dừng khi có event thật,
// từ chối bật khi phòng đã có event thật, overlay ?demo=1, dashboard có nút demo.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 've-avatar';

let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

const postJson = (t, p, b) => fetchJson(t.base, p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
});
const getState = (t, u) => fetchJson(t.base, `/o/${GAME}/${u}/api/state`).then((r) => r.json);
async function enableDemo(t, u) {
  const r = await postJson(t, `/o/${GAME}/${u}/api/settings`, { demoMode: true });
  assert.equal(r.status, 200);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('ve-avatar: demo start/stop liên tục — hàng đợi vẽ tăng, dừng thì top quà đứng yên', async () => {
  const t = await startTestServer();
  try {
    const u = uniq('ve_demo');
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.equal(start.json.demoActive, true);
    let st = await getState(t, u);
    assert.equal(st.demoActive, true, 'state phải báo demoActive');
    assert.ok(st.waitingCount + st.drawn.length + st.drawingRow.length > 0, 'demo phải đưa người vào hàng đợi vẽ ngay khi bật');
    assert.equal(st.avatarStats.total, 0, 'người xem demo không tính vào thống kê avatar thật');
    const logs1 = st.logs.length;
    await sleep(7000);
    st = await getState(t, u);
    assert.ok(st.logs.length > logs1, 'demo chạy thì log phải tăng');
    assert.ok(st.waitingCount + st.drawn.length + st.drawingRow.length > 0, 'demo chạy thì vẫn có người trong hàng đợi/vẽ');
    const stop = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'stop' });
    assert.equal(stop.json.demoActive, false);
    st = await getState(t, u);
    assert.equal(st.demoActive, false);
    // Top quà + top tim chỉ đổi khi có intake mới -> dừng demo thì phải đứng yên
    // (hàng đợi vẫn vẽ tiếp khung đã xếp nên không so waitingCount/drawn).
    const snap = JSON.stringify([st.vipTop, st.tapTop]);
    await sleep(4000);
    st = await getState(t, u);
    assert.equal(JSON.stringify([st.vipTop, st.tapTop]), snap, 'dừng demo thì top quà/tim không tự đổi nữa');
  } finally { await stopTestServer(t); }
});

test('ve-avatar: demo tự dừng khi event thật tới; từ chối bật khi đã có event thật; overlay ?demo=1', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('ve_demostop'));
    const u = room.username;
    await enableDemo(t, u);
    const start = await postJson(t, `/o/${GAME}/${u}/api/test/demo`, { action: 'start' });
    assert.equal(start.json.demoActive, true);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that', nickname: 'NguoiThat', content: 'vẽ đẹp quá' });
    let st = await getState(t, u);
    assert.equal(st.demoActive, false, 'event thật tới thì demo phải tự dừng');
    assert.ok(st.webhook.count >= 1);
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
