// test/vuon-hoa-mua-xuan.test.js — Test game Vườn Hoa Mùa Xuân trên nền tảng:
// webhook TikFinity (comment/tap/gift/follow), tap delta, chống spam,
// quà lạ không rõ xu, mưa/cầu vồng, hồng vàng, lễ hội + reset ván,
// endpoint test + bulk-join, overlay/dashboard HTTP 200.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'vuon-hoa-mua-xuan';

// Username duy nhat moi lan chay: session cua room luu tren dia (data/)
// nen dung lai username cu se ke thua state cu.
let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`; // username tối đa 24 ký tự

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

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('vuon-hoa: comment gieo hạt; comment spam trong 5s bị chặn', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_spam'));
    const c1 = { triggerTypeId: 11, userId: 'u-spam', nickname: 'NguoiSpam', profilePictureUrl: 'https://example.com/a.jpg', content: 'hoa đẹp quá' };
    assert.equal((await t.rooms.dispatchWebhook(room, c1)).status, 200);
    let st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 1, 'comment đầu gieo 1 hạt');
    assert.equal(st.body.flowers[0].stage, 'seed');
    assert.equal(st.body.stats.comments, 1);

    assert.equal((await t.rooms.dispatchWebhook(room, c1)).status, 200);
    st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 1, 'comment spam không gieo thêm');
    assert.equal(st.body.stats.commentsBlocked, 1);
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: tap tính theo delta (likeCount tích lũy), tối đa 8 hoa/người', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_tap'));
    const like = (total) => ({ triggerTypeId: 7, userId: 'u-tap', nickname: 'NguoiTap', likeCount: total });
    await t.rooms.dispatchWebhook(room, like(50));
    let st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 0, 'lần đầu thấy likeCount thì delta = 0, không gieo');
    await t.rooms.dispatchWebhook(room, like(70)); // delta 20
    st = await t.rooms.getState(room);
    assert.equal(st.body.stats.taps, 20);
    const mine = st.body.flowers.filter((f) => f.uid === 'u-tap');
    assert.equal(mine.length, 8, 'tối đa 8 hoa/người, tim thừa thành tăng trưởng');
    // Tim thừa tưới hoa non nhất (giai đoạn sớm nhất trước): 12 tim thừa
    // = 4 hoa lên mầm (3 tăng trưởng/hoa), chưa hoa nào nở.
    assert.equal(st.body.gardenBlooms, 0);
    assert.equal(mine.filter((f) => f.stage === 'sprout').length, 4);
    assert.equal(mine.filter((f) => f.stage === 'seed').length, 4);
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: quà 10 xu tưới hoa; quà 100 xu mưa; quà 500 xu cầu vồng', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_gift'));
    const uid = 'u-gift';
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: uid, nickname: 'NguoiTang', content: 'gieo hạt' });
    let st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 1);
    // Quà 10 xu: 1 xu = 1 tăng trưởng -> hạt 10 điểm = nở luôn (3 giai đoạn x 3).
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: uid, nickname: 'NguoiTang', giftName: 'Hoa hồng', diamondCount: 10, repeatCount: 1 });
    st = await t.rooms.getState(room);
    assert.equal(st.body.flowers[0].stage, 'bloom', 'quà 10 xu tưới đủ cho hoa nở');
    assert.equal(st.body.gardenBlooms, 1);

    // Mưa: 2 hạt mới của 2 người khác +5 tăng trưởng -> lên mầm.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-mua1', nickname: 'Mua1', content: 'x' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-mua2', nickname: 'Mua2', content: 'x' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-mua3', nickname: 'Mua3', giftName: 'Heo may mắn', diamondCount: 100, repeatCount: 1 });
    st = await t.rooms.getState(room);
    const sprouts = st.body.flowers.filter((f) => f.stage === 'sprout');
    assert.equal(sprouts.length, 2, 'mưa +5 làm 2 hạt mới lên mầm');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: quà không rõ xu -> 0 điểm + log cảnh báo, không mặc định +5', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_qua_la'));
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-la', nickname: 'NguoiLa', content: 'gieo' });
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-la', nickname: 'NguoiLa', giftName: 'Quà lạ không rõ giá', repeatCount: 1 });
    const st = await t.rooms.getState(room);
    assert.equal(st.body.stats.giftsUnknown, 1);
    assert.equal(st.body.flowers[0].stage, 'seed', 'quà lạ không tưới gì');
    assert.equal(st.body.viewersOnline, 1);
    assert.ok(JSON.stringify(st.body.logs).includes('không rõ số xu'), 'log cảnh báo phải ghi rõ');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: follow gieo hồng vàng ở nụ; follow lại không gieo thêm', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_follow'));
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-flw', nickname: 'NguoiFollow', profilePictureUrl: 'https://example.com/a.jpg' });
    let st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 1);
    assert.equal(st.body.flowers[0].type, 'hong-vang');
    assert.equal(st.body.flowers[0].stage, 'bud');
    assert.equal(st.body.flowers[0].golden, true);
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 1, userId: 'u-flw', nickname: 'NguoiFollow' });
    st = await t.rooms.getState(room);
    assert.equal(st.body.flowers.length, 1, 'follow lại không gieo thêm hồng vàng');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: endpoint test + bulk-join 100 người (cần bật chế độ thử)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('hoa_test100');
    await enableDemo(t, user);
    const bulk = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/bulk-join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 100 }),
    });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.json.count, 100);
    assert.equal(bulk.json.viewersOnline, 100);
    const demo = await fetchJson(t.base, `/o/${GAME}/${user}/api/test/demo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(demo.status, 200);
    assert.equal(demo.json.steps.length, 6);
    const st = await getState(t, user);
    assert.ok(st.flowers.length >= 1, 'demo phải gieo được hoa');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: đủ mốc hoa nở -> lễ hội -> kết quả -> ván mới', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('hoa_festival');
    await enableDemo(t, user);
    // Hạ ngưỡng để test nhanh: 2 hoa nở là đầy vườn, lễ hội/kết quả 1s.
    await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gardenTargetBlooms: 2, milestones: [2], growthPerStage: 1, festivalS: 1, resultsS: 1 }),
    });
    await fetchJson(t.base, `/o/${GAME}/${user}/api/test/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A' }),
    });
    await fetchJson(t.base, `/o/${GAME}/${user}/api/test/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'B' }),
    });
    // Quà 100 xu: mưa +5 -> với growthPerStage=1, 2 hạt nở luôn.
    await fetchJson(t.base, `/o/${GAME}/${user}/api/test/gift`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'C', coins: 100, giftName: 'Heo may mắn' }),
    });
    let st = await getState(t, user);
    assert.equal(st.gardenBlooms, 2);
    assert.equal(st.phase, 'festival');
    // Chờ lễ hội (1s) + kết quả (1s) + tick -> ván mới.
    let round2 = false;
    for (let i = 0; i < 10; i += 1) {
      await sleep(500);
      st = await getState(t, user);
      if (st.roundNo === 2 && st.phase === 'playing') { round2 = true; break; }
    }
    assert.ok(round2, 'phải tự reset sang ván 2 sau lễ hội + kết quả');
    assert.equal(st.flowers.length, 0, 'ván mới vườn trống');
    assert.equal(st.gardenBlooms, 0);
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: room A không lọt sang room B; overlay + dashboard trả 200', async () => {
  const t = await startTestServer();
  try {
    const roomA = await t.rooms.getOrCreate(GAME, uniq('hoa_a'));
    const roomB = await t.rooms.getOrCreate(GAME, uniq('hoa_b'));
    await t.rooms.dispatchWebhook(roomA, { triggerTypeId: 11, userId: 'u-a', nickname: 'ChiPhongA', content: 'hoa' });
    const stB = await t.rooms.getState(roomB);
    assert.ok(!JSON.stringify(stB.body).includes('ChiPhongA'), 'room B không được thấy event room A');
    const ov = await fetchJson(t.base, `/o/${GAME}/${roomA.username}`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('VƯỜN HOA MÙA XUÂN'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${roomA.username}`);
    assert.equal(db.status, 200);
    assert.ok(db.text.includes('Bảng điều khiển'), 'dashboard phải trả về trang điều khiển');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${roomA.username}`);
    assert.equal(guide.status, 200);
    assert.ok(guide.text.includes(`/o/${GAME}/${roomA.username}/api/webhook`), 'guide phải có link webhook đúng phòng');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: settings chặn giá trị vượt giới hạn', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('hoa_settings');
    const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plots: 200, growthPerStage: 0 }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.settings.plots, 100, 'plots chặn tối đa 100');
    assert.equal(r.json.settings.growthPerStage, 1, 'growthPerStage = 0 -> kẹp lên tối thiểu 1');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: demo start/stop liên tục — mô phỏng khán giả, dừng thì state đứng yên', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('hoa_demoloop');
    await enableDemo(t, user);
    const post = (p, b) => fetchJson(t.base, `/o/${GAME}/${user}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
    });
    const start = await post('/api/test/demo', { action: 'start' });
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.equal(start.json.demoActive, true);
    const st1 = await getState(t, user);
    assert.equal(st1.demoActive, true, 'state phải báo demoActive');
    assert.ok(st1.flowers.length > 0, 'demo phải gieo hoa ngay khi bật');
    const activity = (s) => s.stats.taps + s.stats.comments + s.stats.gifts + s.stats.follows + s.stats.shares + s.stats.joins;
    await sleep(6000);
    const st2 = await getState(t, user);
    assert.ok(activity(st2) > activity(st1), 'demo chạy thì số liệu phải tăng');
    const stop = await post('/api/test/demo', { action: 'stop' });
    assert.equal(stop.json.demoActive, false);
    const st3 = await getState(t, user);
    assert.equal(st3.demoActive, false);
    const snap = JSON.stringify([st3.stats, st3.flowers.length]);
    await sleep(4000);
    const st4 = await getState(t, user);
    assert.equal(JSON.stringify([st4.stats, st4.flowers.length]), snap, 'dừng demo thì state không tự đổi nữa');
  } finally { await stopTestServer(t); }
});

test('vuon-hoa: demo tự dừng khi event thật tới; từ chối bật khi đã có event thật; overlay ?demo=1 có autostart', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate(GAME, uniq('hoa_demostop'));
    const user = room.username;
    await enableDemo(t, user);
    const post = (p, b) => fetchJson(t.base, `/o/${GAME}/${user}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
    });
    const start = await post('/api/test/demo', { action: 'start' });
    assert.equal(start.json.demoActive, true);
    // Event thật đầu tiên tới -> demo tự dừng.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that', nickname: 'NguoiThat', content: 'hello' });
    let st = await getState(t, user);
    assert.equal(st.demoActive, false, 'event thật tới thì demo phải tự dừng');
    assert.ok(st.webhookCount >= 1);
    // Hồi quy lỗi A: event thật THỨ 2 sau khi demo dừng KHÔNG được bị nuốt —
    // webhook phải xử lý thật (không trả demoMode:true) vì "Chế độ thử" đã tự tắt.
    const r2 = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-that-2', nickname: 'NguoiThat2', content: 'hello lần 2' });
    assert.equal(r2.body.demoMode, undefined, 'event thật thứ 2 không được trả demoMode');
    assert.equal(r2.body.received, true);
    st = await getState(t, user);
    assert.ok(st.webhookCount >= 2, 'event thật thứ 2 phải được đếm');
    // Phòng đã có event thật -> từ chối bật lại. Bật lại "Chế độ thử" trước
    // rồi mới thử start: lần này phải từ chối theo chặn webhookCount (chứ
    // không phải vì demoMode đã tắt sau event thật đầu tiên).
    await enableDemo(t, user);
    const start2 = await post('/api/test/demo', { action: 'start' });
    assert.equal(start2.json.success, false, 'phòng có event thật thì không bật được demo');
    assert.match(start2.json.message || '', /event thật/);
    // Overlay ?demo=1: trang overlay có huy hiệu DEMO + code tự chạy demo.
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}?demo=1`);
    assert.equal(ov.status, 200);
    assert.ok(ov.text.includes('demo-badge'), 'overlay phải có huy hiệu DEMO');
    assert.ok(ov.text.includes("get('demo') === '1'"), 'overlay phải có autostart ?demo=1');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.ok(db.text.includes('Chạy demo'), 'dashboard phải có nút Chạy demo');
    assert.ok(db.text.includes('Dừng demo'), 'dashboard phải có nút Dừng demo');
  } finally { await stopTestServer(t); }
});
