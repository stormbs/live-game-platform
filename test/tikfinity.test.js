// test/tikfinity.test.js — File TikFinity (.tfc) cho từng room + mục cài đặt
// TikFinity trên dashboard/landing.
// - .tfc sinh ra phải đúng cấu trúc, đúng webhook URL của room, body template
//   của từng sự kiện thay biến mẫu xong phải parse được JSON và đủ field mà
//   parser của engine cần (triggerTypeId, event, userId, nickname, uniqueId,
//   profilePictureUrl + field riêng từng loại).
// - share khác nhau theo game: ve-avatar=8, buong-giam=4 (parser buong-giam
//   đọc 8 là LEAVE), thap-sang-ban-do=8 (không đọc triggerTypeId).
// - Route GET /o/<game>/<username>/tikfinity.tfc (cả prefix /room/) trả file
//   với content-type + tên file tải về đúng room.
// - Dashboard 3 game (cả bản src và bản public) + landing phải có mục cài đặt
//   TikFinity (nút tải .tfc, webhook URL + nút sao chép, hướng dẫn import) và
//   KHÔNG còn câu "không cần cài gì thêm" (luật cũ đã đảo ngược: TikFinity
//   là đường sự kiện chính). Thẻ trạng thái kết nối trực tiếp vẫn phải còn
//   (nó đếm mọi event qua webhook.count, kể cả event TikFinity).
// LƯU Ý: test này KHÔNG kiểm chứng được việc import file .tfc vào TikFinity
// thật (định dạng export của TikFinity được mã hóa, mật khẩu không công
// khai) — chỉ kiểm chứng cấu trúc file sinh ra + nội dung hướng dẫn.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');
const {
  buildTikfinityFile,
  eventBodies,
  webhookUrl,
  isSupportedGame,
  GAMES,
} = require('../lib/tikfinity');

const ROOT = path.join(__dirname, '..');

// Thay biến $... của TikFinity bằng giá trị mẫu để kiểm chứng body JSON.
// CHÚ Ý: giá trị thay vào KHÔNG kèm ngoặc kép — template đã có ngoặc kép
// sẵn ở field chuỗi, còn field số ($diamondCount...) để trần trong template.
const SUBS = {
  $userId: 'u123',
  $nickname: 'Test User',
  $uniqueId: 'testuser',
  $profilePictureUrl: 'https://example.com/a.jpg',
  $giftName: 'Rose',
  $diamondCount: '5',
  $repeatCount: '2',
  $comment: 'hello world',
  $likeCount: '10',
};
function substitute(body) {
  let out = body;
  for (const [k, v] of Object.entries(SUBS)) out = out.split(k).join(v);
  return out;
}

const EXPECTED_EVENTS = [
  { key: 'gift', triggerTypeId: 3, fields: { giftName: 'Rose', diamondCount: 5, repeatCount: 2 } },
  { key: 'chat', triggerTypeId: 11, fields: { content: 'hello world' } },
  { key: 'like', triggerTypeId: 7, fields: { likeCount: 10 } },
  { key: 'follow', triggerTypeId: 1, fields: {} },
  { key: 'join', triggerTypeId: 6, fields: {} },
];
const SHARE_IDS = { 've-avatar': 8, 'buong-giam': 4, 'thap-sang-ban-do': 8 };

test('eventBodies: 3 game đều có 6 sự kiện, body thay biến xong parse được JSON và đủ field', () => {
  for (const game of Object.keys(GAMES)) {
    const bodies = eventBodies(game);
    assert.equal(bodies.length, 6, `${game} phải có 6 sự kiện`);
    assert.deepEqual(bodies.map((b) => b.key), ['gift', 'chat', 'like', 'follow', 'share', 'join']);
    for (const ev of bodies) {
      const parsed = JSON.parse(substitute(ev.body));
      assert.equal(parsed.event, ev.key, `${game}/${ev.key}: thiếu chuỗi event`);
      assert.equal(parsed.triggerTypeId, ev.triggerTypeId, `${game}/${ev.key}: sai triggerTypeId`);
      assert.equal(parsed.userId, 'u123', `${game}/${ev.key}: thiếu userId`);
      assert.equal(parsed.nickname, 'Test User', `${game}/${ev.key}: thiếu nickname`);
      assert.equal(parsed.uniqueId, 'testuser', `${game}/${ev.key}: thiếu uniqueId`);
      assert.equal(parsed.profilePictureUrl, 'https://example.com/a.jpg', `${game}/${ev.key}: thiếu profilePictureUrl`);
      const expected = EXPECTED_EVENTS.find((e) => e.key === ev.key)
        || { key: 'share', triggerTypeId: SHARE_IDS[game], fields: {} };
      assert.equal(parsed.triggerTypeId, expected.triggerTypeId, `${game}/${ev.key}: sai triggerTypeId`);
      for (const [k, v] of Object.entries(expected.fields)) {
        assert.equal(parsed[k], v, `${game}/${ev.key}: thiếu/sai field ${k}`);
      }
    }
    const share = bodies.find((b) => b.key === 'share');
    assert.equal(share.triggerTypeId, SHARE_IDS[game], `${game}: share phải dùng triggerTypeId ${SHARE_IDS[game]}`);
  }
});

test('buildTikfinityFile: JSON hợp lệ, đúng webhook URL, 1 Action POST tới đúng URL, ghi rõ best-effort', () => {
  const base = 'https://live-game-platform-production.up.railway.app';
  for (const game of Object.keys(GAMES)) {
    const raw = buildTikfinityFile(game, 'kiemtra123');
    const doc = JSON.parse(raw);
    assert.equal(doc.format, 'tikfinity-settings');
    assert.equal(doc.game, game);
    assert.equal(doc.username, 'kiemtra123');
    assert.equal(doc.webhookUrl, `${base}/o/${game}/kiemtra123/api/webhook`);
    assert.equal(doc.actions.length, 1, '1 Action duy nhất cho cả 6 sự kiện');
    const action = doc.actions[0];
    assert.equal(action.name, GAMES[game].actionName);
    assert.equal(action.method, 'POST');
    assert.equal(action.contentType, 'application/json');
    assert.equal(action.url, doc.webhookUrl);
    assert.equal(action.events.length, 6);
    assert.ok(/best-effort/i.test(doc.note), 'file phải ghi rõ là best-effort chưa xác minh');
  }
});

test('webhookUrl: ghép đúng dạng /o/<game>/<username>/api/webhook, bỏ dấu / thừa ở base', () => {
  assert.equal(
    webhookUrl('ve-avatar', 'duong_tank', 'https://example.com/'),
    'https://example.com/o/ve-avatar/duong_tank/api/webhook',
  );
});

test('game lạ: isSupportedGame false, buildTikfinityFile/eventBodies throw', () => {
  assert.equal(isSupportedGame('game-la'), false);
  assert.throws(() => buildTikfinityFile('game-la', 'x'), /chưa hỗ trợ file TikFinity/);
  assert.throws(() => eventBodies('game-la'), /chưa hỗ trợ file TikFinity/);
});

test('route GET /o/<game>/<username>/tikfinity.tfc trả file đúng room (cả 3 game)', async () => {
  const t = await startTestServer();
  try {
    for (const [game, shareId] of Object.entries(SHARE_IDS)) {
      const { status, text, res } = await fetchJson(t.base, `/o/${game}/phongtest/tikfinity.tfc`);
      assert.equal(status, 200, `${game}: route .tfc phải trả 200`);
      assert.match(res.headers.get('content-type') || '', /application\/octet-stream/);
      assert.match(res.headers.get('content-disposition') || '', new RegExp(`${game}-phongtest\\.tfc`));
      const doc = JSON.parse(text);
      assert.equal(doc.webhookUrl, `${t.base}/o/${game}/phongtest/api/webhook`, `${game}: webhook URL phải theo host đang chạy`);
      const share = doc.actions[0].events.find((e) => e.type === 'share');
      assert.equal(share.triggerTypeId, shareId, `${game}: share trong file phải là ${shareId}`);
    }
  } finally {
    await stopTestServer(t);
  }
});

test('route GET /room/<game>/<username>/tikfinity.tfc cũng trả file (prefix dashboard)', async () => {
  const t = await startTestServer();
  try {
    const { status, text } = await fetchJson(t.base, '/room/buong-giam/phongtest/tikfinity.tfc');
    assert.equal(status, 200);
    const doc = JSON.parse(text);
    assert.equal(doc.webhookUrl, `${t.base}/o/buong-giam/phongtest/api/webhook`);
  } finally {
    await stopTestServer(t);
  }
});

test('route .tfc với game không tồn tại -> 400', async () => {
  const t = await startTestServer();
  try {
    const { status } = await fetchJson(t.base, '/o/game-la/phongtest/tikfinity.tfc');
    assert.equal(status, 400);
  } finally {
    await stopTestServer(t);
  }
});

const DASHBOARDS = [
  'games/ve-avatar/src/index.html',
  'games/ve-avatar/src/public/index.html',
  'games/buong-giam/src/index.html',
  'games/buong-giam/src/public/index.html',
  'games/thap-sang-ban-do/src/public/dashboard.html',
];

test('dashboard 3 game: có mục TikFinity (nút tải .tfc, webhook URL + sao chép, hướng dẫn import), không còn "không cần cài gì thêm"', () => {
  for (const rel of DASHBOARDS) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(text.includes('Tải file TikFinity'), `${rel}: thiếu nút tải file .tfc`);
    assert.ok(text.includes('href="tikfinity.tfc"'), `${rel}: thiếu link tải tikfinity.tfc`);
    assert.ok(text.includes('id="tf-webhook-url"'), `${rel}: thiếu ô hiển thị webhook URL`);
    assert.ok(text.includes('copyTfWebhook'), `${rel}: thiếu nút sao chép webhook URL`);
    assert.ok(text.includes('Import and Export Settings'), `${rel}: thiếu bước import TikFinity`);
    assert.ok(text.includes('Settings successfully imported'), `${rel}: thiếu thông báo import thành công`);
    assert.ok(text.includes('Go LIVE'), `${rel}: thiếu thứ tự Go LIVE trước rồi Connect`);
    assert.ok(text.includes('chưa xác minh'), `${rel}: phải ghi rõ file .tfc chưa xác minh`);
    assert.ok(!text.includes('không cần cài gì thêm'), `${rel}: còn câu "không cần cài gì thêm" của luật cũ`);
    assert.ok(!text.includes('không cần cài đặt gì'), `${rel}: còn câu "không cần cài đặt gì" của luật cũ`);
    assert.ok(!text.includes('không cần cài thêm gì'), `${rel}: còn câu "không cần cài thêm gì" của luật cũ`);
    // Thẻ trạng thái kết nối trực tiếp vẫn còn (đếm event TikFinity).
    assert.ok(text.includes('direct-box') || text.includes('directBox'), `${rel}: mất thẻ trạng thái kết nối trực tiếp`);
  }
});

test('landing: nhắc TikFinity + .tfc, không còn "không cần cài đặt gì"', () => {
  const text = fs.readFileSync(path.join(ROOT, 'public', 'landing.html'), 'utf8');
  assert.ok(text.includes('TikFinity'), 'landing phải nhắc TikFinity');
  assert.ok(text.includes('(.tfc)'), 'landing phải nhắc file .tfc trên dashboard');
  assert.ok(text.includes('Go LIVE'), 'landing phải nhắc thứ tự Go LIVE');
  assert.ok(!text.includes('không cần cài đặt gì'), 'landing còn câu "không cần cài đặt gì" của luật cũ');
  assert.ok(!text.includes('không cần cài gì thêm'), 'landing còn câu "không cần cài gì thêm"');
  assert.ok(text.includes('/api/rooms/'), 'landing phải còn kiểm tra trạng thái LIVE của room');
});

test('ve-avatar và buong-giam: bản src và bản public đều có mục TikFinity (đồng bộ)', () => {
  for (const game of ['ve-avatar', 'buong-giam']) {
    const a = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'index.html'), 'utf8');
    const b = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'public', 'index.html'), 'utf8');
    for (const needle of ['Tải file TikFinity', 'tf-webhook-url', 'Import and Export Settings']) {
      assert.ok(a.includes(needle) && b.includes(needle), `${game}: ${needle} thiếu ở 1 trong 2 bản`);
    }
  }
});
