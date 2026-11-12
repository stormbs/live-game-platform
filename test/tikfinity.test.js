// test/tikfinity.test.js — Cài đặt TikFinity bằng tay (KHÔNG còn file .tfc).
// Quyết định 2026-11-12 (Chủ tịch chốt): bỏ hẳn file .tfc — định dạng export
// của TikFinity được mã hóa (mật khẩu không công khai), file JSON thô sinh
// ra không khẳng định import được. Chỉ làm bài hướng dẫn tạo Action bằng
// tay (GET /huong-dan-tikfinity) + bảng body mẫu trên dashboard.
// - Bảng body trong lib/webhook-bodies.js là nguồn sự thật duy nhất: body
//   thay biến mẫu xong phải parse được JSON và đủ field mà parser của engine
//   cần (triggerTypeId, event, userId, nickname, uniqueId,
//   profilePictureUrl + field riêng từng loại).
// - share khác nhau theo game: ve-avatar=8, buong-giam=4 (parser buong-giam
//   đọc 8 là LEAVE), thap-sang-ban-do=8 (không đọc triggerTypeId).
// - Trang hướng dẫn phải giải thích rõ link webhook KHÔNG dùng chung (mỗi
//   người 1 link riêng theo game + username), có bảng body từng game, có
//   thứ tự Go LIVE trước rồi Connect, có cách kiểm chứng bằng số sự kiện.
// - Route /o/<game>/<username>/tikfinity.tfc phải 404 (đã gỡ).
// - POST body mẫu trong hướng dẫn tới webhook của từng engine phải được
//   engine nhận (gift -> ve-avatar {"received":true,...}, chat "Hà Nội" ->
//   bản đồ {"ok":true,"result":"chat"}).
// LƯU Ý: test này KHÔNG kiểm chứng được việc bấm nút trong TikFinity thật
// (chỉ user làm được trên máy Windows) — chỉ kiểm chứng nội dung hướng dẫn
// + body + route trên máy chủ.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');
const {
  eventBodies,
  webhookUrl,
  isSupportedGame,
  GAMES,
} = require('../lib/webhook-bodies');
const { buildGuideHtml } = require('../lib/guide');

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
const SHARE_IDS = {
  've-avatar': 8, 'buong-giam': 4, 'thap-sang-ban-do': 8,
  'vuon-hoa-mua-xuan': 8, 'bep-an-tap-the': 8, 'dua-xe-leo-nui': 8,
  'vong-quay-may-man': 8, 'bau-troi-phao-hoa': 8,
};

test('eventBodies: mọi game đều có 6 sự kiện, body thay biến xong parse được JSON và đủ field', () => {
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

test('webhookUrl: ghép đúng dạng /o/<game>/<username>/api/webhook, bỏ dấu / thừa ở base', () => {
  assert.equal(
    webhookUrl('ve-avatar', 'duong_tank', 'https://example.com/'),
    'https://example.com/o/ve-avatar/duong_tank/api/webhook',
  );
});

test('game lạ: isSupportedGame false, eventBodies throw', () => {
  assert.equal(isSupportedGame('game-la'), false);
  assert.throws(() => eventBodies('game-la'), /chưa hỗ trợ/);
});

test('buildGuideHtml: trang chung giải thích link KHÔNG dùng chung + bảng body cả 3 game + thứ tự Go LIVE', () => {
  const html = buildGuideHtml({});
  assert.ok(html.includes('KHÔNG dùng chung'), 'thiếu cảnh báo link webhook không dùng chung');
  assert.ok(html.includes('mỗi người 1 link riêng') || html.includes('link riêng'), 'thiếu giải thích link riêng theo người');
  assert.ok(html.includes('trộn vào cùng 1 game'), 'thiếu ví dụ trộn event khi dùng chung link');
  assert.ok(html.includes('Go LIVE'), 'thiếu thứ tự Go LIVE');
  assert.ok(html.includes('Connect'), 'thiếu bước Connect trong TikFinity');
  assert.ok(html.includes('số sự kiện'), 'thiếu cách kiểm chứng bằng số sự kiện');
  for (const game of Object.keys(GAMES)) {
    for (const ev of eventBodies(game)) {
      assert.ok(html.includes(ev.body), `trang hướng dẫn thiếu body ${game}/${ev.key}`);
    }
  }
  // share khác nhau theo game phải hiện đúng trong trang
  assert.ok(html.includes('{"triggerTypeId":8,"event":"share"'), 'thiếu body share 8 (ve-avatar/bản đồ)');
  assert.ok(html.includes('{"triggerTypeId":4,"event":"share"'), 'thiếu body share 4 (buồng giam)');
  assert.ok(html.includes('buồng giam đọc 8 là'), 'thiếu chú thích buồng giam đọc 8 là rời phòng');
});

test('buildGuideHtml: cá nhân hóa theo ?game=&username= hiện đúng link webhook của phòng', () => {
  const html = buildGuideHtml({ game: 'buong-giam', username: 'phongtest', baseUrl: 'https://example.com' });
  assert.ok(html.includes('https://example.com/o/buong-giam/phongtest/api/webhook'), 'thiếu link webhook đúng phòng');
  assert.ok(html.includes('Buong Giam - Moi su kien'), 'thiếu tên Action của buồng giam');
  assert.ok(html.includes('@phongtest'), 'thiếu username của phòng');
});

test('route GET /huong-dan-tikfinity trả trang hướng dẫn (chung + cá nhân hóa + game lạ không crash)', async () => {
  const t = await startTestServer();
  try {
    const generic = await fetchJson(t.base, '/huong-dan-tikfinity');
    assert.equal(generic.status, 200, 'trang hướng dẫn phải trả 200');
    assert.match(generic.res.headers.get('content-type') || '', /text\/html/);
    assert.ok(generic.text.includes('KHÔNG dùng chung'), 'trang chung thiếu cảnh báo link không dùng chung');
    assert.ok(generic.text.includes('{"triggerTypeId":4,"event":"share"'), 'trang chung thiếu body share buồng giam');
    const personal = await fetchJson(t.base, '/huong-dan-tikfinity?game=ve-avatar&username=phongtest');
    assert.equal(personal.status, 200);
    assert.ok(personal.text.includes(`${t.base}/o/ve-avatar/phongtest/api/webhook`), 'trang cá nhân hóa thiếu link webhook đúng phòng');
    const badGame = await fetchJson(t.base, '/huong-dan-tikfinity?game=game-la&username=x');
    assert.equal(badGame.status, 200, 'game lạ phải trả trang chung, không crash');
    assert.ok(badGame.text.includes('KHÔNG dùng chung'));
  } finally {
    await stopTestServer(t);
  }
});

test('route .tfc đã gỡ: GET /o/.../tikfinity.tfc và /room/.../tikfinity.tfc đều 404', async () => {
  const t = await startTestServer();
  try {
    for (const path of ['/o/ve-avatar/phongtest/tikfinity.tfc', '/room/buong-giam/phongtest/tikfinity.tfc']) {
      const { status } = await fetchJson(t.base, path);
      assert.equal(status, 404, `${path} phải 404 sau khi gỡ tính năng .tfc`);
    }
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

test('dashboard 3 game: KHÔNG còn .tfc, có link bài hướng dẫn + webhook URL + bảng body tay + thẻ trạng thái', () => {
  for (const rel of DASHBOARDS) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!text.includes('.tfc'), `${rel}: còn nhắc file .tfc`);
    assert.ok(!text.includes('Tải file TikFinity'), `${rel}: còn nút tải file .tfc`);
    assert.ok(!text.includes('Import and Export Settings'), `${rel}: còn bước import file`);
    assert.ok(!text.includes('Settings successfully imported'), `${rel}: còn thông báo import file`);
    assert.ok(text.includes('id="tf-guide-link"'), `${rel}: thiếu link bài hướng dẫn`);
    assert.ok(text.includes('href="/huong-dan-tikfinity"'), `${rel}: link hướng dẫn sai đường dẫn`);
    assert.ok(text.includes('huong-dan-tikfinity?game='), `${rel}: link hướng dẫn không điền game+username của phòng`);
    assert.ok(text.includes('id="tf-webhook-url"'), `${rel}: thiếu ô hiển thị webhook URL`);
    assert.ok(text.includes('copyTfWebhook'), `${rel}: thiếu nút sao chép webhook URL`);
    assert.ok(text.includes('Go LIVE'), `${rel}: thiếu thứ tự Go LIVE trước rồi Connect`);
    assert.ok(text.includes('Tạo Action bằng tay'), `${rel}: thiếu mục tạo Action bằng tay`);
    assert.ok(!text.includes('không cần cài gì thêm'), `${rel}: còn câu "không cần cài gì thêm" của luật cũ`);
    assert.ok(!text.includes('không cần cài đặt gì'), `${rel}: còn câu "không cần cài đặt gì" của luật cũ`);
    // Thẻ trạng thái kết nối trực tiếp vẫn còn (đếm event TikFinity).
    assert.ok(text.includes('direct-box') || text.includes('directBox'), `${rel}: mất thẻ trạng thái kết nối trực tiếp`);
  }
  // share đúng từng game trong bảng body trên dashboard
  const shares = {
    'games/ve-avatar/src/index.html': 8,
    'games/buong-giam/src/index.html': 4,
    'games/thap-sang-ban-do/src/public/dashboard.html': 8,
  };
  for (const [rel, shareId] of Object.entries(shares)) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(text.includes(`{"triggerTypeId":${shareId},"event":"share"`), `${rel}: bảng body share phải là ${shareId}`);
  }
});

test('landing: nhắc TikFinity + link bài hướng dẫn, KHÔNG còn .tfc', () => {
  const text = fs.readFileSync(path.join(ROOT, 'public', 'landing.html'), 'utf8');
  assert.ok(text.includes('TikFinity'), 'landing phải nhắc TikFinity');
  assert.ok(text.includes('/huong-dan-tikfinity'), 'landing phải link bài hướng dẫn cài đặt TikFinity');
  assert.ok(!text.includes('.tfc'), 'landing còn nhắc file .tfc');
  assert.ok(text.includes('Go LIVE'), 'landing phải nhắc thứ tự Go LIVE');
  assert.ok(text.includes('/api/rooms/'), 'landing phải còn kiểm tra trạng thái LIVE của room');
});

test('ve-avatar và buong-giam: bản src và bản public đều có link hướng dẫn + bảng body (đồng bộ)', () => {
  for (const game of ['ve-avatar', 'buong-giam']) {
    const a = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'index.html'), 'utf8');
    const b = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'public', 'index.html'), 'utf8');
    for (const needle of ['tf-guide-link', 'tf-webhook-url', 'Tạo Action bằng tay']) {
      assert.ok(a.includes(needle) && b.includes(needle), `${game}: ${needle} thiếu ở 1 trong 2 bản`);
    }
  }
});

test('POST body mẫu trong hướng dẫn tới webhook từng engine đều được nhận', async () => {
  const t = await startTestServer();
  try {
    for (const game of Object.keys(GAMES)) {
      for (const ev of eventBodies(game)) {
        const body = substitute(ev.body);
        const { status, json } = await fetchJson(t.base, `/o/${game}/phongtest/api/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        assert.equal(status, 200, `${game}/${ev.key}: webhook phải trả 200`);
        assert.ok(json && (json.received === true || json.ok === true),
          `${game}/${ev.key}: engine không nhận body (trả ${JSON.stringify(json)})`);
      }
    }
    // Kiểm chứng riêng: chat "Hà Nội" thắp sáng bản đồ
    const chatHn = substitute(eventBodies('thap-sang-ban-do').find((e) => e.key === 'chat').body)
      .replace('hello world', 'Hà Nội');
    const { json: hnJson } = await fetchJson(t.base, '/o/thap-sang-ban-do/phongtest/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: chatHn,
    });
    assert.equal(hnJson && hnJson.ok, true, 'chat "Hà Nội" phải được bản đồ nhận');
    assert.equal(hnJson && hnJson.result, 'chat');
  } finally {
    await stopTestServer(t);
  }
});
