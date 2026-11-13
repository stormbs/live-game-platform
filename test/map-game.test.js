// test/map-game.test.js — Thắp Sáng Bản Đồ Việt Nam (2026-11-12):
// (1) Hoàng Sa/Trường Sa vẽ TRONG bản đồ, gộp vào tỉnh chủ quản;
// (2) bỏ cơ chế comment số + không hiện số trên tỉnh (chỉ tên tỉnh mới tính);
// (3) avatar neo ở quê tới hết ván dù người chơi đã rời live.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'thap-sang-ban-do';
const ISLANDS = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'games', GAME, 'src', 'public', 'islands.json'), 'utf8'));

async function postChat(tBase, roomBase, uniqueId, nickname, content) {
  return fetchJson(tBase, `${roomBase}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'chat', uniqueId, nickname, content }),
  });
}

async function getState(tBase, roomBase) {
  const s = await fetchJson(tBase, `${roomBase}/api/state`);
  assert.equal(s.status, 200);
  return s.json;
}

function litNums(state) {
  return state.provinces.filter((p) => p.lit).map((p) => p.num);
}

test('islands.json: Hoàng Sa thuộc Đà Nẵng (6), Trường Sa thuộc Khánh Hòa (18)', () => {
  assert.equal(ISLANDS.hoangSa.provinceNum, 6);
  assert.equal(ISLANDS.hoangSa.provinceName, 'Đà Nẵng');
  assert.equal(ISLANDS.truongSa.provinceNum, 18);
  assert.equal(ISLANDS.truongSa.provinceName, 'Khánh Hòa');
});

test('overlay: đảo vẽ TRONG #mapSvg (không còn #islandSvg/khung riêng), viewBox mở sang Biển Đông', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/overlay_user`;
    const res = await fetch(t.base + base + '/');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('id="islandSvg"'), 'không còn lớp SVG đảo riêng');
    assert.ok(!html.includes('islandBox'), 'không còn khung đảo');
    assert.ok(!html.includes('islandTitle') && !html.includes('islandSub'), 'không còn tiêu đề/phụ đề khung đảo');
    assert.ok(html.includes('id="mapSvg"'), 'có SVG bản đồ');
    assert.ok(html.includes('viewBox="255 275 800 1260"'), 'viewBox bản đồ mở sang phải tới x=1055 để chứa đảo');
    assert.ok(html.includes('id="islandLayer"'), 'có lớp đảo trong SVG bản đồ');
    // Đảo ăn theo tỉnh chủ quản: island-6 theo Đà Nẵng (6), island-18 theo Khánh Hòa (18).
    assert.ok(html.includes("getElementById('island-6')"), 'đảo Hoàng Sa gắn với tỉnh 6');
    assert.ok(html.includes("getElementById('island-18')"), 'đảo Trường Sa gắn với tỉnh 18');
    assert.ok(html.includes("getElementById('islandLabel-6')"), 'nhãn QĐ. Hoàng Sa');
    assert.ok(html.includes("getElementById('islandLabel-18')"), 'nhãn QĐ. Trường Sa');
  } finally {
    await stopTestServer(t);
  }
});

test('comment tên tỉnh thắp sáng; comment số không thắp gì', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/number_user`;
    // Số 1-34 (kèm #) không thắp gì — kể cả nhiều số trong 1 comment.
    for (const n of ['12', '6', '#15', '5 12 30']) {
      const r = await postChat(t.base, base, 'so_tester', 'Số Tester', n);
      assert.equal(r.status, 200);
    }
    let state = await getState(t.base, base);
    assert.deepEqual(litNums(state), [], 'comment số không được thắp tỉnh nào');
    // Đối chứng: tên tỉnh vẫn thắp bình thường.
    await postChat(t.base, base, 'ten_tester', 'Tên Tester', 'Hà Nội');
    state = await getState(t.base, base);
    assert.ok(litNums(state).includes(12), 'comment "Hà Nội" phải thắp Hà Nội (12)');
  } finally {
    await stopTestServer(t);
  }
});

test('overlay: không còn hiển thị số trên tỉnh', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/nonum_user`;
    const res = await fetch(t.base + base + '/');
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('id="numLayer"'), 'không còn lớp số tỉnh');
    assert.ok(!html.includes('provNum'), 'không còn class số tỉnh');
    assert.ok(!html.includes('t.textContent = p.num'), 'không còn vẽ số lên tỉnh');
    assert.ok(!html.includes('số 1–34') && !html.includes('số 1-34'), 'không còn nhắc comment số');
  } finally {
    await stopTestServer(t);
  }
});

test('avatar: danh sách gửi HẾT người có quê (không cắt top 60) — người rời live không rớt khỏi list khi đông', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/crowd_user`;
    // 65 người, mỗi người chọn 1 quê (xoay vòng tên tỉnh) — vượt mức cắt cũ 60.
    const names = ['Hà Nội', 'Đà Nẵng', 'Khánh Hòa', 'TP.HCM', 'Nghệ An', 'Thanh Hóa', 'Hải Phòng', 'Cần Thơ'];
    for (let i = 0; i < 65; i++) {
      const r = await postChat(t.base, base, `dong_${i}`, `Đông ${i}`, names[i % names.length]);
      assert.equal(r.status, 200);
    }
    const state = await getState(t.base, base);
    assert.equal(state.avatars.length, 65, 'phải gửi đủ 65 avatar, không cắt top 60');
  } finally {
    await stopTestServer(t);
  }
});

test('avatar: rơi vào quê, rời live vẫn neo, chỉ hết ván mới dọn', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/anchor_user`;
    // Chọn quê Đà Nẵng -> avatar rơi vào tỉnh 6.
    await postChat(t.base, base, 'neo_tester', 'Neo Tester', 'Đà Nẵng');
    let state = await getState(t.base, base);
    let av = state.avatars.find((a) => a.name === 'Neo Tester');
    assert.ok(av, 'avatar phải xuất hiện sau khi chọn quê');
    assert.equal(av.home, 6, 'avatar neo ở Đà Nẵng (6)');
    // Rời live -> avatar VẪN ở đó.
    const leave = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'leave', uniqueId: 'neo_tester', nickname: 'Neo Tester' }),
    });
    assert.equal(leave.status, 200);
    assert.equal(leave.json.result, 'leave');
    state = await getState(t.base, base);
    av = state.avatars.find((a) => a.name === 'Neo Tester');
    assert.ok(av, 'rời live rồi avatar vẫn phải neo ở quê');
    assert.equal(av.home, 6, 'avatar vẫn ở Đà Nẵng (6) sau khi rời live');
    // Hết ván (reset) -> avatar dọn sạch.
    const reset = await fetchJson(t.base, `${base}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    assert.equal(reset.status, 200);
    state = await getState(t.base, base);
    assert.deepEqual(state.avatars, [], 'hết ván thì avatar phải dọn sạch');
    assert.equal(state.lit, 0, 'hết ván thì bản đồ về 0/34');
  } finally {
    await stopTestServer(t);
  }
});

// ---------- Demo tự động (demo-mode-contract.md) ----------
async function postDemo(tBase, roomBase, action) {
  return fetchJson(tBase, `${roomBase}/api/test/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}
function statsKey(state) { return JSON.stringify(state.stats); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('demo: start → demoActive, state tiến triển; stop → state đứng yên', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/demo_user`;
    const start = await postDemo(t.base, base, 'start');
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.equal(start.json.demoActive, true);
    let state = await getState(t.base, base);
    assert.equal(state.demoActive, true, 'state phải có demoActive=true sau khi start');
    assert.equal(state.simulator, true, 'demo bật simulator');
    // Đợi vòng lặp mô phỏng chạy: stats phải đổi trong 8s (simStep mỗi 1.2s).
    const before = statsKey(state);
    let changed = false;
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      state = await getState(t.base, base);
      if (statsKey(state) !== before) { changed = true; break; }
    }
    assert.ok(changed, 'demo phải làm state tiến triển trong vài giây');
    // Stop → state đứng yên.
    const stop = await postDemo(t.base, base, 'stop');
    assert.equal(stop.json.success, true);
    assert.equal(stop.json.demoActive, false);
    const s1 = await getState(t.base, base);
    assert.equal(s1.demoActive, false);
    await sleep(2500);
    const s2 = await getState(t.base, base);
    assert.equal(statsKey(s2), statsKey(s1), 'sau khi stop, state phải đứng yên');
  } finally {
    await stopTestServer(t);
  }
});

test('demo: từ chối start khi phòng đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/demo_refuse_user`;
    await postChat(t.base, base, 'real_user', 'Người Thật', 'Hà Nội');
    const state = await getState(t.base, base);
    assert.equal(state.webhook.count, 1);
    const r = await postDemo(t.base, base, 'start');
    assert.equal(r.json.success, false);
    assert.match(r.json.message, /event thật/);
    const s2 = await getState(t.base, base);
    assert.equal(s2.demoActive, false, 'phòng có event thật thì demoActive vẫn false');
  } finally {
    await stopTestServer(t);
  }
});

test('demo: event thật tới thì demo tự dừng', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/demo_autostop_user`;
    await postDemo(t.base, base, 'start');
    let state = await getState(t.base, base);
    assert.equal(state.demoActive, true);
    await postChat(t.base, base, 'real_user', 'Người Thật', 'Đà Nẵng');
    state = await getState(t.base, base);
    assert.equal(state.demoActive, false, 'webhook thật phải dừng demo');
    assert.equal(state.simulator, false, 'simulator cũng phải tắt theo');
  } finally {
    await stopTestServer(t);
  }
});

test('demo: once chạy 3 lượt mô phỏng ngay', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/demo_once_user`;
    const before = statsKey(await getState(t.base, base));
    const r = await postDemo(t.base, base, 'once');
    assert.equal(r.json.success, true);
    const after = statsKey(await getState(t.base, base));
    assert.notEqual(after, before, 'once phải làm stats đổi (3 lượt mô phỏng)');
  } finally {
    await stopTestServer(t);
  }
});

test('demo: overlay có huy hiệu DEMO + autostart ?demo=1; dashboard có nút Chạy/Dừng demo', async () => {
  const t = await startTestServer();
  try {
    const base = `/o/${GAME}/demo_ui_user`;
    const ov = await fetch(t.base + base + '/');
    assert.equal(ov.status, 200);
    const ovHtml = await ov.text();
    assert.ok(ovHtml.includes('id="demo-badge"'), 'overlay có huy hiệu DEMO');
    assert.ok(ovHtml.includes("get('demo') === '1'"), 'overlay có autostart ?demo=1');
    assert.ok(ovHtml.includes("/api/test/demo"), 'overlay autostart gọi /api/test/demo');
    const db = await fetch(t.base + base + '/dashboard');
    assert.equal(db.status, 200);
    const dbHtml = await db.text();
    assert.ok(dbHtml.includes('▶ Chạy demo'), 'dashboard có nút Chạy demo');
    assert.ok(dbHtml.includes('■ Dừng demo'), 'dashboard có nút Dừng demo');
    assert.ok(dbHtml.includes('demoStart()') && dbHtml.includes('demoStop()'), 'dashboard có hàm demoStart/demoStop');
  } finally {
    await stopTestServer(t);
  }
});
