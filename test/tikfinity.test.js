// test/tikfinity.test.js — Hợp đồng TikFinity 1 ACTION DUY NHẤT (Chủ tịch chốt 2026-11-13).
// Cơ chế thật đã xác minh (từ ảnh TikFinity thật + log live thật của game
// bản đồ): action "Trigger WebHook" chỉ có ô URL, KHÔNG có ô body.
// TikFinity tự gửi body KÈM loại sự kiện (trường event), máy chủ đọc loại
// từ body nên 1 Action với URL gốc của phòng (không ?event=) xử lý được
// mọi sự kiện — tạo 1 Action duy nhất, các Event đều trỏ vào Action đó.
// - Guide (GET /huong-dan-tikfinity): Bước 1 lấy 1 URL webhook duy nhất,
//   Bước 2 tạo 1 Action duy nhất, Bước 3 các Event đều trỏ vào Action đó;
//   mục "Dự phòng — Tách riêng từng sự kiện" giữ 6 URL ?event= + 6 tên
//   Action riêng, CHỈ dùng khi TikFinity không gửi loại sự kiện trong body.
// - Dashboard cả 14 game: hướng dẫn 1 Action duy nhất, KHÔNG còn bảng
//   6 URL theo sự kiện, KHÔNG còn ?event= trong dashboard.
// - Route /o/<game>/<username>/tikfinity.tfc phải 404 (đã gỡ).
// - Link webhook KHÔNG dùng chung, thứ tự Go LIVE trước rồi Connect, kiểm
//   chứng bằng số sự kiện > 0 trên dashboard.
// - POST form + ?event= tới webhook 8 game cũ đều được engine nhận đúng loại
//   (đường dự phòng vẫn chạy); quà form phải đọc đúng xu từ value3
//   (ve-avatar vipTop, buong-giam points), chat "Hà Nội" phải thắp sáng bản đồ.
// LƯU Ý: test này KHÔNG kiểm chứng được việc bấm nút trong TikFinity thật
// (chỉ user làm được trên máy Windows) — chỉ kiểm chứng nội dung hướng dẫn
// + URL + route + engine nhận event trên máy chủ.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');
const {
  webhookUrl,
  isSupportedGame,
  GAMES,
} = require('../lib/webhook-bodies');
const { buildGuideHtml, GAME_NAMES, EVENTS } = require('../lib/guide');

const ROOT = path.join(__dirname, '..');

const EVENT_KEYS = ['gift', 'chat', 'like', 'follow', 'share', 'join'];

// Thẻ <pre> thật (không tính chuỗi "<prefix>" trong comment/code).
const PRE_TAG = /<pre(\s|>)/;

test('webhookUrl: ghép đúng dạng /o/<game>/<username>/api/webhook, bỏ dấu / thừa ở base', () => {
  assert.equal(
    webhookUrl('ve-avatar', 'duong_tank', 'https://example.com/'),
    'https://example.com/o/ve-avatar/duong_tank/api/webhook',
  );
});

test('game lạ: isSupportedGame false', () => {
  assert.equal(isSupportedGame('game-la'), false);
});

test('EVENTS: đúng 6 sự kiện theo thứ tự; GAME_NAMES: đủ 6 game mới', () => {
  assert.deepEqual(EVENTS.map((e) => e.key), EVENT_KEYS);
  assert.deepEqual(
    ['keo-co', 'dau-truong-sinh-ton', 'chiem-co', 'dua-thuyen-rong', 'dau-tri', 'di-bar-online'].map((g) => GAME_NAMES[g]),
    ['Kéo Co', 'Đấu Trường Sinh Tồn', 'Chiếm Cờ', 'Đua Thuyền Rồng', 'Đấu Trí', 'Đi Bar Online'],
  );
});

test('buildGuideHtml: trang chung giải thích link KHÔNG dùng chung + 1 Action duy nhất + 6 URL dạng mẫu ở mục dự phòng + thứ tự Go LIVE, KHÔNG có <pre>/body', () => {
  const html = buildGuideHtml({});
  assert.ok(html.includes('KHÔNG dùng chung'), 'thiếu cảnh báo link webhook không dùng chung');
  assert.ok(html.includes('mỗi người 1 link riêng') || html.includes('link riêng'), 'thiếu giải thích link riêng theo người');
  assert.ok(html.includes('trộn vào cùng 1 game'), 'thiếu ví dụ trộn event khi dùng chung link');
  assert.ok(html.includes('Go LIVE'), 'thiếu thứ tự Go LIVE');
  assert.ok(html.includes('Connect'), 'thiếu bước Connect trong TikFinity');
  assert.ok(html.includes('số sự kiện'), 'thiếu cách kiểm chứng bằng số sự kiện');
  for (const key of EVENT_KEYS) {
    assert.ok(html.includes(`?event=${key}`), `trang chung thiếu URL dạng mẫu ?event=${key}`);
  }
  assert.ok(!PRE_TAG.test(html), 'trang hướng dẫn còn thẻ <pre>');
  assert.ok(!html.includes('triggerTypeId'), 'trang hướng dẫn còn nhắc triggerTypeId');
  assert.ok(!html.includes('eventBodies'), 'trang hướng dẫn còn nhắc eventBodies');
  assert.ok(!html.includes('"event":"gift"'), 'trang hướng dẫn còn body JSON mẫu');
  assert.ok(!html.includes('Body JSON'), 'trang hướng dẫn còn nhắc Body JSON');
  assert.ok(!html.includes('Sao chép body'), 'trang hướng dẫn còn nút Sao chép body');
  assert.ok(html.includes('Không cần nhập body'), 'thiếu giải thích action webhook không có ô body');
  assert.ok(html.includes('Tạo 1 Action webhook duy nhất'), 'trang chung thiếu mục tạo 1 Action duy nhất');
  assert.ok(html.includes('Chỉ cần 1 Action duy nhất'), 'trang chung thiếu câu chỉ cần 1 Action duy nhất');
  assert.ok(html.includes('Tách riêng từng sự kiện'), 'trang chung thiếu mục dự phòng tách riêng từng sự kiện');
});

test('buildGuideHtml: cá nhân hóa theo ?game=&username= hiện 1 URL webhook duy nhất + 1 Action duy nhất, mục dự phòng giữ 6 URL theo sự kiện', () => {
  const html = buildGuideHtml({ game: 'buong-giam', username: 'phongtest', baseUrl: 'https://example.com' });
  // Cách chính: 1 URL webhook duy nhất (không ?event=) + 1 Action duy nhất tên game.
  assert.ok(html.includes('id="guide-webhook-url"'), 'thiếu ô URL webhook duy nhất của phòng');
  assert.ok(
    html.includes('https://example.com/o/buong-giam/phongtest/api/webhook</code>'),
    'URL webhook chính phải là URL gốc của phòng, không thêm ?event=',
  );
  assert.ok(html.includes('Tạo 1 Action webhook duy nhất'), 'thiếu mục tạo 1 Action duy nhất');
  assert.ok(html.includes('(Action duy nhất)'), 'thiếu ghi chú các Event đều trỏ vào Action duy nhất');
  // Mục dự phòng: vẫn đủ 6 URL theo sự kiện + 6 tên Action riêng + 6 nút sao chép.
  for (const key of EVENT_KEYS) {
    assert.ok(
      html.includes(`https://example.com/o/buong-giam/phongtest/api/webhook?event=${key}`),
      `mục dự phòng thiếu URL webhook đúng phòng cho sự kiện ${key}`,
    );
  }
  assert.equal((html.match(/Sao chép URL/g) || []).length, 7, 'phải có 7 nút Sao chép URL (1 chính + 6 dự phòng)');
  for (const name of ['Buong Giam - Qua', 'Buong Giam - Binh luan', 'Buong Giam - Tim', 'Buong Giam - Follow', 'Buong Giam - Share', 'Buong Giam - Vao phong']) {
    assert.ok(html.includes(name), `mục dự phòng thiếu tên Action ${name}`);
  }
  assert.ok(html.includes('@phongtest'), 'thiếu username của phòng');
  assert.ok(!PRE_TAG.test(html), 'trang cá nhân hóa còn thẻ <pre>');
  assert.ok(!html.includes('triggerTypeId'), 'trang cá nhân hóa còn nhắc triggerTypeId');
});

test('route GET /huong-dan-tikfinity trả trang hướng dẫn (chung + cá nhân hóa + game lạ không crash)', async () => {
  const t = await startTestServer();
  try {
    const generic = await fetchJson(t.base, '/huong-dan-tikfinity');
    assert.equal(generic.status, 200, 'trang hướng dẫn phải trả 200');
    assert.match(generic.res.headers.get('content-type') || '', /text\/html/);
    assert.ok(generic.text.includes('KHÔNG dùng chung'), 'trang chung thiếu cảnh báo link không dùng chung');
    assert.ok(generic.text.includes('Tạo 1 Action webhook duy nhất'), 'trang chung thiếu mục tạo 1 Action duy nhất');
    for (const key of EVENT_KEYS) {
      assert.ok(generic.text.includes(`?event=${key}`), `mục dự phòng trang chung thiếu URL ?event=${key}`);
    }
    assert.ok(!PRE_TAG.test(generic.text), 'trang chung còn thẻ <pre>');
    const personal = await fetchJson(t.base, '/huong-dan-tikfinity?game=ve-avatar&username=phongtest');
    assert.equal(personal.status, 200);
    assert.ok(personal.text.includes(`${t.base}/o/ve-avatar/phongtest/api/webhook</code>`), 'trang cá nhân hóa thiếu URL webhook duy nhất (không ?event=)');
    assert.ok(personal.text.includes('Tạo 1 Action webhook duy nhất'), 'trang cá nhân hóa thiếu mục tạo 1 Action duy nhất');
    for (const key of EVENT_KEYS) {
      assert.ok(personal.text.includes(`${t.base}/o/ve-avatar/phongtest/api/webhook?event=${key}`), `mục dự phòng trang cá nhân hóa thiếu URL ?event=${key}`);
    }
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

const DASHBOARDS_FULL = [
  'games/ve-avatar/src/index.html',
  'games/ve-avatar/src/public/index.html',
  'games/buong-giam/src/index.html',
  'games/buong-giam/src/public/index.html',
  'games/thap-sang-ban-do/src/public/dashboard.html',
];

const DASHBOARDS_GROUP_B = [
  'games/keo-co/src/index.html',
  'games/keo-co/src/public/index.html',
  'games/dau-truong-sinh-ton/src/index.html',
  'games/dau-truong-sinh-ton/src/public/index.html',
  'games/chiem-co/src/index.html',
  'games/chiem-co/src/public/index.html',
  'games/dau-tri/src/index.html',
  'games/dau-tri/src/public/index.html',
  'games/dua-thuyen-rong/src/index.html',
  'games/dua-thuyen-rong/src/public/index.html',
  'games/di-bar-online/src/index.html',
  'games/di-bar-online/src/public/index.html',
];

const DASHBOARDS_GROUP_C = [
  'games/vuon-hoa-mua-xuan/src/index.html',
  'games/vuon-hoa-mua-xuan/src/public/index.html',
  'games/bep-an-tap-the/src/index.html',
  'games/bep-an-tap-the/src/public/index.html',
  'games/dua-xe-leo-nui/src/index.html',
  'games/dua-xe-leo-nui/src/public/index.html',
  'games/vong-quay-may-man/src/index.html',
  'games/vong-quay-may-man/src/public/index.html',
  'games/bau-troi-phao-hoa/src/index.html',
  'games/bau-troi-phao-hoa/src/public/index.html',
];

const DASHBOARDS_ALL = [...DASHBOARDS_FULL, ...DASHBOARDS_GROUP_B, ...DASHBOARDS_GROUP_C];

test('dashboard 14 game: hướng dẫn 1 Action duy nhất, KHÔNG còn 6 Action / URL theo sự kiện', () => {
  for (const rel of DASHBOARDS_ALL) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // Không còn dấu vết cách 6 Action.
    assert.ok(!text.includes('Tạo 6 Action'), `${rel}: còn mục tạo 6 Action`);
    assert.ok(!text.includes('6 Action webhook'), `${rel}: còn nhắc 6 Action webhook`);
    assert.ok(!text.includes('mỗi sự kiện 1 URL riêng'), `${rel}: còn câu mỗi sự kiện 1 URL riêng`);
    assert.ok(!text.includes('copyTfEventUrl'), `${rel}: còn hàm sao chép URL theo sự kiện`);
    assert.ok(!text.includes('tikfinity-actions'), `${rel}: còn gọi endpoint bảng 6 Action`);
    assert.ok(!text.includes('actions-body'), `${rel}: còn bảng actions-body 6 Action`);
    for (const key of EVENT_KEYS) {
      assert.ok(!text.includes(`?event=${key}`), `${rel}: còn URL ?event=${key} theo sự kiện`);
      assert.ok(!text.includes(`id="tf-url-${key}"`), `${rel}: còn ô URL sự kiện ${key}`);
    }
    // Cách 1 Action duy nhất phải hiện rõ + link hướng dẫn + thứ tự Go LIVE.
    assert.ok(text.includes('1 Action duy nhất'), `${rel}: thiếu câu chỉ cần 1 Action duy nhất`);
    assert.ok(text.includes('huong-dan-tikfinity'), `${rel}: thiếu link bài hướng dẫn TikFinity`);
    assert.ok(text.includes('Go LIVE'), `${rel}: thiếu thứ tự Go LIVE trước rồi Connect`);
  }
});

test('dashboard 3 game cũ (mục đầy đủ): KHÔNG còn .tfc/body/<pre>, có link hướng dẫn + 1 URL webhook duy nhất + thẻ trạng thái', () => {
  for (const rel of DASHBOARDS_FULL) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!text.includes('.tfc'), `${rel}: còn nhắc file .tfc`);
    assert.ok(!text.includes('Tải file TikFinity'), `${rel}: còn nút tải file .tfc`);
    assert.ok(!text.includes('Import and Export Settings'), `${rel}: còn bước import file`);
    assert.ok(!text.includes('Settings successfully imported'), `${rel}: còn thông báo import file`);
    assert.ok(!PRE_TAG.test(text), `${rel}: còn thẻ <pre>`);
    assert.ok(!text.includes('triggerTypeId'), `${rel}: còn nhắc triggerTypeId`);
    assert.ok(!text.includes('Body JSON mẫu'), `${rel}: còn bảng body JSON mẫu`);
    assert.ok(!text.includes('Tạo Action bằng tay'), `${rel}: còn cách nói 1 Action duy nhất`);
    assert.ok(text.includes('id="tf-guide-link"'), `${rel}: thiếu link bài hướng dẫn`);
    assert.ok(text.includes('href="/huong-dan-tikfinity"'), `${rel}: link hướng dẫn sai đường dẫn`);
    assert.ok(text.includes('huong-dan-tikfinity?game='), `${rel}: link hướng dẫn không điền game+username của phòng`);
    assert.ok(text.includes('id="tf-webhook-url"'), `${rel}: thiếu ô hiển thị webhook URL`);
    assert.ok(text.includes('copyTfWebhook'), `${rel}: thiếu nút sao chép webhook URL`);
    assert.ok(text.includes('Tạo 1 Action webhook duy nhất'), `${rel}: thiếu mục tạo 1 Action duy nhất`);
    assert.ok(!text.includes('không cần cài gì thêm'), `${rel}: còn câu "không cần cài gì thêm" của luật cũ`);
    assert.ok(!text.includes('không cần cài đặt gì'), `${rel}: còn câu "không cần cài đặt gì" của luật cũ`);
    // Thẻ trạng thái kết nối trực tiếp vẫn còn (đếm event TikFinity).
    assert.ok(text.includes('direct-box') || text.includes('directBox'), `${rel}: mất thẻ trạng thái kết nối trực tiếp`);
  }
});

test('dashboard 6 game nhóm B: có link hướng dẫn + ô webhook duy nhất + nút sao chép', () => {
  for (const rel of DASHBOARDS_GROUP_B) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(text.includes('id="tf-guide-link"'), `${rel}: thiếu link bài hướng dẫn`);
    assert.ok(text.includes('huong-dan-tikfinity?game='), `${rel}: link hướng dẫn không điền game+username của phòng`);
    assert.ok(text.includes('id="tf-webhook-url"'), `${rel}: thiếu ô hiển thị webhook URL`);
    assert.ok(text.includes('copyTfWebhook'), `${rel}: thiếu nút sao chép webhook URL`);
    assert.ok(text.includes('Tạo 1 Action webhook duy nhất'), `${rel}: thiếu mục tạo 1 Action duy nhất`);
  }
});

test('landing: nhắc TikFinity + link bài hướng dẫn, KHÔNG còn .tfc/body', () => {
  const text = fs.readFileSync(path.join(ROOT, 'public', 'landing.html'), 'utf8');
  assert.ok(text.includes('TikFinity'), 'landing phải nhắc TikFinity');
  assert.ok(text.includes('/huong-dan-tikfinity'), 'landing phải link bài hướng dẫn cài đặt TikFinity');
  assert.ok(!text.includes('.tfc'), 'landing còn nhắc file .tfc');
  assert.ok(!text.includes('triggerTypeId'), 'landing còn nhắc triggerTypeId');
  assert.ok(text.includes('Go LIVE'), 'landing phải nhắc thứ tự Go LIVE');
  assert.ok(text.includes('/api/rooms/'), 'landing phải còn kiểm tra trạng thái LIVE của room');
});

test('13 game: bản src và bản public đều hướng dẫn 1 Action duy nhất (đồng bộ)', () => {
  for (const game of ['ve-avatar', 'buong-giam', 'keo-co', 'dau-truong-sinh-ton', 'chiem-co', 'dau-tri', 'dua-thuyen-rong', 'di-bar-online', 'vuon-hoa-mua-xuan', 'bep-an-tap-the', 'dua-xe-leo-nui', 'vong-quay-may-man', 'bau-troi-phao-hoa']) {
    const a = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'index.html'), 'utf8');
    const b = fs.readFileSync(path.join(ROOT, 'games', game, 'src', 'public', 'index.html'), 'utf8');
    for (const needle of ['1 Action duy nhất', 'huong-dan-tikfinity', 'Go LIVE']) {
      assert.ok(a.includes(needle) && b.includes(needle), `${game}: ${needle} thiếu ở 1 trong 2 bản`);
    }
    assert.ok(!a.includes('Tạo 6 Action') && !b.includes('Tạo 6 Action'), `${game}: còn mục tạo 6 Action ở 1 trong 2 bản`);
  }
});

// ---------- Hợp đồng URL mới: POST form TikFinity + ?event= ----------
// Dạng body thật TikFinity gửi (form-urlencoded cố định). Username duy nhất
// mỗi lần chạy để phòng test không dính state cũ lưu trên đĩa (data/rooms).
const FORM_USER = 'lan123';
function formBody(key) {
  const values = {
    gift: { value2: 'Hoa hồng', value3: '10' },
    chat: { value2: 'Hà Nội', content: 'Hà Nội' },
    like: {}, follow: {}, share: {}, join: {},
  }[key];
  return new URLSearchParams({
    value1: FORM_USER, value2: '', value3: '', content: '', avatar_url: '', ...values,
  }).toString();
}
// Loại sự kiện engine nhận ra, theo trường trả về của từng engine.
const EXPECTED_KIND = {
  've-avatar': { gift: 'gift', chat: 'comment', like: 'tap', follow: 'follow', share: 'share', join: 'join' },
  'buong-giam': { gift: 'gift', chat: 'chat', like: 'tap', follow: 'follow', share: null, join: 'join' },
  'thap-sang-ban-do': { gift: 'gift', chat: 'chat', like: 'like', follow: 'follow', share: 'share', join: 'join' },
};
const GAME_COMMON_KIND = { gift: 'gift', chat: 'comment', like: 'tap', follow: 'follow', share: 'share', join: 'join' };
const OLD_GAMES = ['ve-avatar', 'buong-giam', 'thap-sang-ban-do', 'vuon-hoa-mua-xuan', 'bep-an-tap-the', 'dua-xe-leo-nui', 'vong-quay-may-man', 'bau-troi-phao-hoa'];

test('POST form TikFinity + ?event= tới webhook 8 game cũ đều được nhận đúng loại', async () => {
  const t = await startTestServer();
  try {
    const roomUser = `formtest${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
    for (const game of OLD_GAMES) {
      for (const key of EVENT_KEYS) {
        const { status, json } = await fetchJson(t.base, `/o/${game}/${roomUser}/api/webhook?event=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody(key),
        });
        assert.equal(status, 200, `${game}/${key}: webhook phải trả 200`);
        assert.ok(json && (json.received === true || json.ok === true),
          `${game}/${key}: engine không nhận webhook (trả ${JSON.stringify(json)})`);
        const expected = (EXPECTED_KIND[game] || GAME_COMMON_KIND)[key];
        const got = game === 'buong-giam' ? json.action : game === 'thap-sang-ban-do' ? json.result : json.kind;
        if (expected === null) {
          // Buồng giam: share chỉ ghi nhận (received:true), không có action riêng.
          assert.equal(json.received, true, `${game}/${key}: share phải được ghi nhận`);
        } else {
          assert.equal(got, expected, `${game}/${key}: engine nhận sai loại (được ${got}, cần ${expected})`);
        }
      }
    }
    // Kiểm chứng riêng: chat "Hà Nội" thắp sáng bản đồ.
    const { json: hnJson } = await fetchJson(t.base, `/o/thap-sang-ban-do/${roomUser}/api/webhook?event=chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody('chat'),
    });
    assert.equal(hnJson && hnJson.ok, true, 'chat "Hà Nội" phải được bản đồ nhận');
    assert.equal(hnJson && hnJson.result, 'chat');
    const st = await fetchJson(t.base, `/o/thap-sang-ban-do/${roomUser}/api/state`);
    assert.equal(st.status, 200);
    const hanoi = (st.json.provinces || []).find((p) => p.num === 12);
    assert.ok(hanoi && hanoi.lit, 'chat "Hà Nội" phải thắp sáng Hà Nội (tỉnh 12)');
  } finally {
    await stopTestServer(t);
  }
});

test('quà form đọc đúng xu từ value3: ve-avatar vipTop 10 xu, buong-giam +50đ', async () => {
  const t = await startTestServer();
  try {
    const roomUser = `formgift${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;
    // Vẽ Avatar: quà Hoa hồng 10 xu phải vào vipTop với đúng 10 xu.
    const va = await fetchJson(t.base, `/o/ve-avatar/${roomUser}/api/webhook?event=gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody('gift'),
    });
    assert.equal(va.json && va.json.kind, 'gift');
    const vaState = await fetchJson(t.base, `/o/ve-avatar/${roomUser}/api/state`);
    const vip = (vaState.json.vipTop || []).find((e) => e.uid === FORM_USER);
    assert.ok(vip, 've-avatar: quà form phải ghi nhận người tặng vào vipTop');
    assert.equal(vip.coins, 10, 've-avatar: quà form 10 xu phải tính đúng 10 xu (không phải 0/không rõ xu)');
    // Buồng Giam: quà Hoa hồng 10 xu = 10 x 5đ = 50đ.
    await fetchJson(t.base, `/o/buong-giam/${roomUser}/api/webhook?event=gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody('gift'),
    });
    const bgState = await fetchJson(t.base, `/o/buong-giam/${roomUser}/api/state`);
    const user = bgState.json.users && bgState.json.users[FORM_USER];
    assert.ok(user, 'buong-giam: quà form phải tạo user lan123');
    assert.equal(user.points, 50, 'buong-giam: quà form 10 xu phải +50đ (không phải 5đ fallback 1 xu)');
  } finally {
    await stopTestServer(t);
  }
});
