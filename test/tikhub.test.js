// test/tikhub.test.js — Dịch vụ tải video TikTok / Douyin không logo.
// CHỈ dùng dữ liệu giả lập (stub fetch). KHÔNG gọi API TikHub thật,
// KHÔNG dùng key thật, KHÔNG đặt đơn / không tốn lượt gọi nào.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
TikHubClient,
TikHubError,
detectPlatform,
extractCleanUrl,
mapAweme,
findAweme,
filterReasonToCode,
} = require('../lib/tikhub');
const { mountTikHubRoutes} = require('../lib/tikhub-routes');

// ---------- Fixture giả lập (đúng dạng envelope TikHub: {code, router, params, data}) ----------
function tiktokFixture() {
return {
code: 200,
router: '/api/v1/tiktok/app/v3/fetch_one_video_by_share_url',
params: { share_url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'},
data: {
aweme_detail: {
aweme_id: '7502551047378832671',
desc: 'Video test giả lập',
author: {
nickname: 'TacGiaTest',
unique_id: 'tacgiatest',
avatar_thumb: { url_list: ['https://example.com/avatar.jpg']},
},
video: {
duration: 15400,
play_addr: { url_list: ['https://example.com/play-watermark.mp4']},
download_addr: { url_list: ['https://example.com/download-no-watermark.mp4']},
cover: { url_list: ['https://example.com/cover.jpg']},
},
music: { title: 'Nhac test', play_url: { url_list: ['https://example.com/music.mp3']}},
},
},
};
}

function douyinWebFixture() {
return {
code: 200,
router: '/api/v1/douyin/web/fetch_one_video_by_share_url',
params: { share_url: 'https://v.douyin.com/e3x2fjE/'},
data: {
aweme_list: [{
aweme_id: '7512756548356492544',
desc: 'Video Douyin test giả lập',
author: { nickname: 'TacGiaDouyin', unique_id: 'douyinuser'},
video: {
duration: 30000,
play_addr: { url_list: ['https://example.com/douyin-play.mp4']},
cover: { url_list: ['https://example.com/douyin-cover.jpg']},
},
music: { title: 'Nhac Douyin', play_url: { url_list: ['https://example.com/douyin-music.mp3']}},
}],
},
};
}

function stubFetch({ status = 200, body = {}, hang = false} = {}) {
return async (url, opts = {}) => {
if (hang) {
// Giả lập server treo: chỉ reject khi AbortController hủy (giống fetch thật).
return new Promise((resolve, reject) => {
const sig = opts.signal;
if (!sig) return; // không có signal thì treo thật, test timeout phải truyền signal
if (sig.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); return; }
sig.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
});
}
return { ok: status >= 200 && status < 300, status, json: async () => body};
};
}

function sequenceFetch(bodies) {
let i = 0;
return async () => {
const body = bodies[Math.min(i, bodies.length - 1)];
i += 1;
return { ok: true, status: 200, json: async () => body};
};
}

function makeClient(fetchImpl, opts = {}) {
return new TikHubClient({ apiKey: 'test-key-gia-lap', fetchImpl,...opts});
}

async function listen(app) {
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
return { base, close: () => new Promise((r) => server.close(r))};
}

async function postJson(base, path, body) {
const res = await fetch(base + path, {
method: 'POST',
headers: { 'Content-Type': 'application/json'},
body: JSON.stringify(body),
});
return { status: res.status, json: await res.json()};
}

async function getJson(base, path) {
const res = await fetch(base + path);
return { status: res.status, json: await res.json()};
}

// ---------- 1. Nhận diện nền tảng ----------
test('detectPlatform: TikTok đủ dạng link (web, rút gọn, /t/)', () => {
assert.equal(detectPlatform('https://www.tiktok.com/@user/video/7502551047378832671'), 'tiktok');
assert.equal(detectPlatform('https://vt.tiktok.com/ZS123abc/'), 'tiktok');
assert.equal(detectPlatform('https://vm.tiktok.com/ZM123/'), 'tiktok');
assert.equal(detectPlatform('https://www.tiktok.com/t/ZTFNEj8Hk/'), 'tiktok');
assert.equal(detectPlatform('https://m.tiktok.com/v/7502551047378832671'), 'tiktok');
});

test('detectPlatform: Douyin đủ dạng link (web, v.douyin, share text)', () => {
assert.equal(detectPlatform('https://www.douyin.com/video/7512756548356492544'), 'douyin');
assert.equal(detectPlatform('https://v.douyin.com/e3x2fjE/'), 'douyin');
assert.equal(detectPlatform('https://www.iesdouyin.com/share/video/7512756548356492544'), 'douyin');
assert.equal(detectPlatform('8:/ h@O.kP 05/21 长按复制打开抖音 https://v.douyin.com/e3x2fjE/'), 'douyin');
});

test('detectPlatform: từ chối Youtube, Facebook, text thường, rỗng', () => {
assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc123'), null);
assert.equal(detectPlatform('https://www.facebook.com/reel/123'), null);
assert.equal(detectPlatform('https://example.com/video.mp4'), null);
assert.equal(detectPlatform('hello world'), null);
assert.equal(detectPlatform(''), null);
assert.equal(detectPlatform(null), null);
});

test('extractCleanUrl: trích đúng URL trong đoạn share text', () => {
assert.equal(
extractCleanUrl('xem video này nè https://vt.tiktok.com/ZS123abc/ hay lắm'),
'https://vt.tiktok.com/ZS123abc/',
);
assert.equal(extractCleanUrl('https://www.tiktok.com/t/ZTFNEj8Hk/'), 'https://www.tiktok.com/t/ZTFNEj8Hk/');
});

// ---------- 2. Map response TikHub ----------
test('mapAweme: TikTok ưu tiên download_addr (không watermark) hơn play_addr', () => {
const { aweme} = findAweme(tiktokFixture());
const r = mapAweme('tiktok', aweme);
assert.equal(r.platform, 'tiktok');
assert.equal(r.video_id, '7502551047378832671');
assert.equal(r.video_url, 'https://example.com/download-no-watermark.mp4');
assert.equal(r.cover, 'https://example.com/cover.jpg');
assert.equal(r.music_url, 'https://example.com/music.mp3');
assert.equal(r.music_title, 'Nhac test');
assert.equal(r.title, 'Video test giả lập');
assert.equal(r.duration, 15); // 15400ms -> 15s
assert.equal(r.author.nickname, 'TacGiaTest');
assert.equal(r.author.unique_id, 'tacgiatest');
assert.equal(r.author.avatar, 'https://example.com/avatar.jpg');
});

test('mapAweme: không có download_addr thì dùng play_addr (Douyin Web)', () => {
const { aweme} = findAweme(douyinWebFixture());
const r = mapAweme('douyin', aweme);
assert.equal(r.platform, 'douyin');
assert.equal(r.video_url, 'https://example.com/douyin-play.mp4');
assert.equal(r.duration, 30);
assert.equal(r.author.nickname, 'TacGiaDouyin');
});

test('mapAweme: không có link video -> null', () => {
assert.equal(mapAweme('tiktok', { aweme_id: '1', video: {}}), null);
assert.equal(mapAweme('tiktok', null), null);
});

test('filterReasonToCode: mã filter Douyin 8/5/10', () => {
assert.equal(filterReasonToCode(8), 'VIDEO_NOT_FOUND');
assert.equal(filterReasonToCode(5), 'VIDEO_PRIVATE');
assert.equal(filterReasonToCode(10), 'VIDEO_PARTIAL');
assert.equal(filterReasonToCode(99), 'VIDEO_NOT_FOUND');
});

// ---------- 3. Client gọi đúng endpoint ----------
test('client: TikTok gọi fetch_one_video_by_share_url với share_url', async () => {
let calledUrl = '';
const f = async (url) => {
calledUrl = url;
return { ok: true, status: 200, json: async () => tiktokFixture()};
};
const r = await makeClient(f).fetchVideo('https://www.tiktok.com/t/ZTFNEj8Hk/');
assert.match(calledUrl, /api\.tikhub\.io\/api\/v1\/tiktok\/app\/v3\/fetch_one_video_by_share_url/);
assert.match(calledUrl, /share_url=https%3A%2F%2Fwww\.tiktok\.com%2Ft%2FZTFNEj8Hk%2F/);
assert.equal(r.video_url, 'https://example.com/download-no-watermark.mp4');
});

test('client: Douyin App V3 rỗng thì thử lại Web', async () => {
const urls = [];
const f = async (url) => {
urls.push(url);
return { ok: true, status: 200, json: async () => (urls.length === 1? { code: 200, data: {}}: douyinWebFixture())};
};
const r = await makeClient(f).fetchVideo('https://v.douyin.com/e3x2fjE/');
assert.equal(urls.length, 2);
assert.match(urls[0], /douyin\/app\/v3\/fetch_one_video_by_share_url/);
assert.match(urls[1], /douyin\/web\/fetch_one_video_by_share_url/);
assert.equal(r.platform, 'douyin');
});

test('client: Douyin filter reason 5 -> VIDEO_PRIVATE', async () => {
const body = { code: 200, data: { filter_list: [{ reason: 5}]}};
await assert.rejects(
makeClient(stubFetch({ body})).fetchVideo('https://v.douyin.com/e3x2fjE/'),
(e) => e instanceof TikHubError && e.code === 'VIDEO_PRIVATE',
);
});

test('client: 401 key sai -> INVALID_API_KEY (không lộ key)', async () => {
await assert.rejects(
makeClient(stubFetch({ status: 401, body: { code: 401}})).fetchVideo('https://www.tiktok.com/t/ZTFNEj8Hk/'),
(e) => e instanceof TikHubError && e.code === 'INVALID_API_KEY',
);
});

test('client: 404 -> VIDEO_NOT_FOUND; timeout -> TIMEOUT', async () => {
await assert.rejects(
makeClient(stubFetch({ status: 404, body: { code: 404}})).fetchVideo('https://www.tiktok.com/t/ZTFNEj8Hk/'),
(e) => e instanceof TikHubError && e.code === 'VIDEO_NOT_FOUND',
);
await assert.rejects(
makeClient(stubFetch({ hang: true}), { timeoutMs: 50}).fetchVideo('https://www.tiktok.com/t/ZTFNEj8Hk/'),
(e) => e instanceof TikHubError && e.code === 'TIMEOUT',
);
});

test('client: thiếu key -> NOT_CONFIGURED; link không hỗ trợ -> UNSUPPORTED_URL', async () => {
const noKey = new TikHubClient({ apiKey: '', fetchImpl: stubFetch({ body: tiktokFixture()})});
await assert.rejects(noKey.fetchVideo('https://www.tiktok.com/t/ZTFNEj8Hk/'),
(e) => e instanceof TikHubError && e.code === 'NOT_CONFIGURED');
await assert.rejects(makeClient(stubFetch({ body: tiktokFixture()})).fetchVideo('https://www.youtube.com/watch?v=abc'),
(e) => e instanceof TikHubError && e.code === 'UNSUPPORTED_URL');
});

// ---------- 4. Route HTTP ----------
function mountApp(client) {
const app = express();
mountTikHubRoutes(app, { client});
return app;
}

test('route: POST /api/download thành công trả đủ trường', async () => {
const app = mountApp(makeClient(stubFetch({ body: tiktokFixture()})));
const { base, close} = await listen(app);
try {
const { status, json} = await postJson(base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(status, 200);
assert.equal(json.ok, true);
assert.equal(json.platform, 'tiktok');
assert.equal(json.video_url, 'https://example.com/download-no-watermark.mp4');
assert.equal(json.title, 'Video test giả lập');
assert.equal(json.author.nickname, 'TacGiaTest');
} finally { await close();}
});

test('route: link sai định dạng -> 400, link Youtube -> 400 UNSUPPORTED_URL', async () => {
const app = mountApp(makeClient(stubFetch({ body: tiktokFixture()})));
const { base, close} = await listen(app);
try {
const empty = await postJson(base, '/api/download', { url: ''});
assert.equal(empty.status, 400);
assert.equal(empty.json.error, 'INVALID_URL');
const yt = await postJson(base, '/api/download', { url: 'https://www.youtube.com/watch?v=abc'});
assert.equal(yt.status, 400);
assert.equal(yt.json.error, 'UNSUPPORTED_URL');
} finally { await close();}
});

test('route: thiếu key -> 503 NOT_CONFIGURED', async () => {
const app = mountApp(new TikHubClient({ apiKey: '', fetchImpl: stubFetch({ body: tiktokFixture()})}));
const { base, close} = await listen(app);
try {
const { status, json} = await postJson(base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(status, 503);
assert.equal(json.error, 'NOT_CONFIGURED');
assert.equal(json.message.includes('test-key'), false);
} finally { await close();}
});

test('route: TikHub 401 -> 503, không lộ chi tiết key', async () => {
const app = mountApp(makeClient(stubFetch({ status: 401, body: { code: 401}})));
const { base, close} = await listen(app);
try {
const { status, json} = await postJson(base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(status, 503);
assert.equal(json.error, 'INVALID_API_KEY');
assert.equal(JSON.stringify(json).includes('test-key-gia-lap'), false);
} finally { await close();}
});

test('route: TikHub 404 -> 404 VIDEO_NOT_FOUND; timeout -> 504', async () => {
const app404 = mountApp(makeClient(stubFetch({ status: 404, body: { code: 404}})));
const s1 = await listen(app404);
try {
const r = await postJson(s1.base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(r.status, 404);
assert.equal(r.json.error, 'VIDEO_NOT_FOUND');
} finally { await s1.close();}

const appTimeout = mountApp(makeClient(stubFetch({ hang: true}), { timeoutMs: 50}));
const s2 = await listen(appTimeout);
try {
const r = await postJson(s2.base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(r.status, 504);
assert.equal(r.json.error, 'TIMEOUT');
} finally { await s2.close();}
});

test('route: quá 10 request/phút/IP -> 429', async () => {
const app = mountApp(makeClient(stubFetch({ body: tiktokFixture()})));
const { base, close} = await listen(app);
try {
for (let i = 0; i < 10; i++) {
const r = await postJson(base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(r.status, 200);
}
const over = await postJson(base, '/api/download', { url: 'https://www.tiktok.com/t/ZTFNEj8Hk/'});
assert.equal(over.status, 429);
assert.equal(over.json.error, 'RATE_LIMITED');
} finally { await close();}
});

test('route: GET /api/download/health có key -> 200 ok, thiếu key -> 503', async () => {
const appOk = mountApp(makeClient(stubFetch({ body: tiktokFixture()})));
const s1 = await listen(appOk);
try {
const r = await getJson(s1.base, '/api/download/health');
assert.equal(r.status, 200);
assert.equal(r.json.ok, true);
assert.equal(r.json.configured, true);
} finally { await s1.close();}

const appNoKey = mountApp(new TikHubClient({ apiKey: '', fetchImpl: stubFetch({ body: {}})}));
const s2 = await listen(appNoKey);
try {
const r = await getJson(s2.base, '/api/download/health');
assert.equal(r.status, 503);
assert.equal(r.json.ok, false);
assert.equal(r.json.configured, false);
} finally { await s2.close();}
});
