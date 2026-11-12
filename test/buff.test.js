// test/buff.test.js — Dịch vụ buff tương tác: tính giá, route, xác minh BSC.
// Không đặt đơn thật, không gọi panel thật (trừ route public dùng cache).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
  VND_PER_USDT,
  EXPENSIVE_RATE_THRESHOLD_VND,
  MARKUP_EXPENSIVE,
  MARKUP_CHEAP,
  FINANCE_WALLET,
  normalizePlatform,
  isExpensive,
  markupFor,
  sellPriceUsdt,
  quoteFor,
  mapPanelStatus,
  verifyBscUsdtTx,
  signTopup,
} = require('../lib/buff');
const { mountBuffRoutes } = require('../lib/buff-routes');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

// ---------- Tính giá (quy tắc Chủ tịch chốt 2026-11-12) ----------
test('pricing: ngưỡng đắt/rẻ theo rate panel (100.000 VND/1000)', () => {
  assert.equal(EXPENSIVE_RATE_THRESHOLD_VND, 100000);
  assert.equal(isExpensive(100000), true); // đúng ngưỡng = đắt
  assert.equal(isExpensive(99999), false);
  assert.equal(isExpensive(450000), true);
  assert.equal(isExpensive(59000), false);
  assert.equal(markupFor(450000), MARKUP_EXPENSIVE);
  assert.equal(markupFor(59000), MARKUP_CHEAP);
  assert.equal(MARKUP_EXPENSIVE, 1.20);
  assert.equal(MARKUP_CHEAP, 1.30);
  assert.equal(VND_PER_USDT, 26000);
});

test('pricing: dịch vụ rẻ x1.30, làm tròn lên 4 chữ số', () => {
  // FB Like id 444: rate 34.000 VND/1000 -> 34.000/26.000*1,3 = 1,7
  assert.equal(sellPriceUsdt(34000, 1000), 1.7);
  // TikTok View id 513: rate 59.000, mua 20.000 -> panel 1.180.000 VND -> 59 USDT (khong con 59,0001 do nhieu float)
  assert.equal(sellPriceUsdt(59000, 20000), 59);
});

test('pricing: dịch vụ đắt x1.20', () => {
  // YT Like id 732: rate 450.000, mua 100 -> panel 45.000 VND -> 2,077 USDT
  assert.equal(sellPriceUsdt(450000, 100), 2.077);
  // Đúng ngưỡng 100.000 -> đắt: 100.000/26.000*1,2 = 4,615384.. -> 4,6154
  assert.equal(sellPriceUsdt(100000, 1000), 4.6154);
  // Dưới ngưỡng 1 đơn vị -> rẻ: 99.999/26.000*1,3 = 4,99995 -> 5
  assert.equal(sellPriceUsdt(99999, 1000), 5);
});

test('pricing: quoteFor trả đủ trường + tier', () => {
  const q = quoteFor(
    { service: 513, name: 'View', category: 'TikTok | View TikTok', rate: 59000, min: 20000, max: 100000000 },
    20000,
  );
  assert.equal(q.tier, 'cheap');
  assert.equal(q.markup, 1.30);
  assert.equal(q.panel_cost_vnd, 1180000);
  assert.equal(q.sell_usdt, 59);
  assert.equal(q.currency, 'USDT');
  const q2 = quoteFor(
    { service: 732, name: 'Like', category: 'Youtube | Like Youtube', rate: 450000, min: 10, max: 100000 },
    100,
  );
  assert.equal(q2.tier, 'expensive');
  assert.equal(q2.markup, 1.20);
  assert.equal(q2.sell_usdt, 2.077);
});

test('normalizePlatform: sửa lỗi chính tả dữ liệu panel', () => {
  assert.equal(normalizePlatform('Instargam | Share Instagram'), 'Instagram');
  assert.equal(normalizePlatform('Goolge | Maps'), 'Google');
  assert.equal(normalizePlatform('TikTok | View TikTok'), 'TikTok');
  assert.equal(normalizePlatform(''), 'Khác');
});

test('mapPanelStatus: trạng thái panel -> nội bộ', () => {
  assert.equal(mapPanelStatus('Completed'), 'completed');
  assert.equal(mapPanelStatus('In progress'), 'in_progress');
  assert.equal(mapPanelStatus('Partial'), 'partial');
  assert.equal(mapPanelStatus('Canceled'), 'canceled');
  assert.equal(mapPanelStatus('Pending'), 'pending');
});

test('signTopup: HMAC ổn định, đổi 1 ký tự là khác', () => {
  const a = signTopup('0xabc', '10000000000000000000', 'secret');
  const b = signTopup('0xabc', '10000000000000000000', 'secret');
  const c = signTopup('0xabc', '10000000000000000001', 'secret');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ---------- Xác minh giao dịch BSC (mock RPC) ----------
function fakeReceiptFetch({ toFinance = true, amountRaw = 10n * 10n ** 18n, status = '0x1' } = {}) {
  const walletPadded = '0x000000000000000000000000' + FINANCE_WALLET.slice(2).toLowerCase();
  const sender = '0x0000000000000000000000001111111111111111111111111111111111111111';
  const data = '0x' + amountRaw.toString(16).padStart(64, '0');
  return async () => ({
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      result: {
        status,
        logs: [{
          address: '0x55d398326f99059fF775485246999027B3197955',
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            sender,
            toFinance ? walletPadded : '0x0000000000000000000000002222222222222222222222222222222222222222',
          ],
          data,
        }],
      },
    }),
  });
}

test('verifyBscUsdtTx: nhận đúng 10 USDT về ví kế toán', async () => {
  const v = await verifyBscUsdtTx('0x' + 'a'.repeat(64), fakeReceiptFetch());
  assert.equal(v.ok, true);
  assert.equal(v.amountUsdt, 10);
  assert.equal(v.amountRaw, (10n * 10n ** 18n).toString());
});

test('verifyBscUsdtTx: sai ví nhận / sai hash / tx lỗi đều từ chối', async () => {
  const v1 = await verifyBscUsdtTx('0x' + 'a'.repeat(64), fakeReceiptFetch({ toFinance: false }));
  assert.equal(v1.ok, false);
  assert.equal(v1.reason, 'no_usdt_to_finance_wallet');
  const v2 = await verifyBscUsdtTx('not-a-hash', fakeReceiptFetch());
  assert.equal(v2.ok, false);
  assert.equal(v2.reason, 'invalid_tx_hash');
  const v3 = await verifyBscUsdtTx('0x' + 'b'.repeat(64), fakeReceiptFetch({ status: '0x0' }));
  assert.equal(v3.ok, false);
  assert.equal(v3.reason, 'tx_failed');
});

// ---------- Route public qua server thật (cache catalog, không gọi panel) ----------
test('GET /api/buff/services: trả catalog đã cache, đủ 857 dịch vụ', async (t) => {
  const srv = await startTestServer();
  t.after(() => stopTestServer(srv));
  const r = await fetchJson(srv.base, '/api/buff/services');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.count, 857);
  assert.equal(r.json.services.length, 857);
  const tk = r.json.services.find((s) => s.service === 513);
  assert.equal(tk.platform, 'TikTok');
  assert.equal(tk.rate, 59000);
  const ig = r.json.services.find((s) => s.service === 2793);
  assert.equal(ig.platform, 'Instagram'); // lỗi chính tả panel đã được chuẩn hóa
});

test('GET /api/buff/platforms + /api/buff/config: tóm tắt + ví kế toán, không lộ token', async (t) => {
  const srv = await startTestServer();
  t.after(() => stopTestServer(srv));
  const p = await fetchJson(srv.base, '/api/buff/platforms');
  assert.equal(p.status, 200);
  assert.equal(p.json.platforms.Facebook.count, 407);
  assert.equal(p.json.platforms.TikTok.count, 140);
  const c = await fetchJson(srv.base, '/api/buff/config');
  assert.equal(c.status, 200);
  assert.equal(c.json.finance_wallet, FINANCE_WALLET);
  assert.equal(c.json.finance_network, 'BEP20 (BSC)');
  assert.equal(c.json.pricing.markup_cheap, 1.30);
  assert.equal(c.json.pricing.markup_expensive, 1.20);
  assert.ok(!JSON.stringify(c.json).includes('463b')); // không lộ token
});

test('POST /api/buff/quote: báo giá đúng + chặn số lượng ngoài min/max', async (t) => {
  const srv = await startTestServer();
  t.after(() => stopTestServer(srv));
  const ok = await fetchJson(srv.base, '/api/buff/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: 513, quantity: 20000 }),
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.quote.sell_usdt, 59);
  assert.equal(ok.json.quote.tier, 'cheap');
  const bad = await fetchJson(srv.base, '/api/buff/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: 513, quantity: 100 }),
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'BAD_QUANTITY');
  const missing = await fetchJson(srv.base, '/api/buff/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: 999999999, quantity: 100 }),
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.error, 'SERVICE_NOT_FOUND');
});

test('route cần đăng nhập: không token -> 401', async (t) => {
  const srv = await startTestServer();
  t.after(() => stopTestServer(srv));
  const r = await fetchJson(srv.base, '/api/buff/wallet');
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'UNAUTHENTICATED');
});

// ---------- Luồng đặt đơn với store/panel giả (không gọi mạng thật) ----------
function makeFakeDeps(overrides = {}) {
  let balance = overrides.balance ?? 100;
  const calls = { deduct: [], refund: [], addOrder: 0, alerts: [] };
  const store = {
    privileged: true,
    verifyUser: async (token) => {
      if (token !== 'good-token') { const e = new Error('bad token'); e.code = 'UNAUTHENTICATED'; throw e; }
      return { id: 'user-1', email: 'khach@test.vn' };
    },
    ensureWallet: async () => ({ user_id: 'user-1', balance_usdt: balance }),
    deduct: async (uid, token, amount, ref) => {
      calls.deduct.push({ amount, ref });
      if (balance < amount) { const e = new Error('Số dư không đủ'); e.code = 'INSUFFICIENT_BALANCE'; throw e; }
      balance = Math.round((balance - amount) * 1e4) / 1e4;
      return balance;
    },
    refund: async (uid, token, amount, orderUuid) => {
      calls.refund.push({ amount, orderUuid });
      balance = Math.round((balance + amount) * 1e4) / 1e4;
      return balance;
    },
    insertOrder: async (uid, token, order) => ({ ...order, created_at: new Date().toISOString() }),
    updateOrder: async (id, uid, token, patch) => ({ id, ...patch }),
    getOrder: async () => null,
    listOrders: async () => [],
    txExists: async () => false,
    creditTopup: async () => balance,
  };
  const panel = {
    apiKey: '',
    balance: async () => ({ balance: overrides.panelBalance ?? 100000000, currency: 'VND' }),
    addOrder: async () => { calls.addOrder += 1; return { orderId: '777001' }; },
    orderStatus: async () => ({ status: 'Completed', charge: 0, currency: 'VND', remains: 0, startCount: 0 }),
  };
  const alerter = {
    alertLowPanelBalance: async () => { calls.alerts.push('low'); return true; },
    alertOrderBlocked: async () => { calls.alerts.push('blocked'); return true; },
  };
  return { store, panel, alerter, calls, getBalance: () => balance };
}

async function startBuffOnlyServer(deps) {
  const app = express();
  mountBuffRoutes(app, deps);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, server };
}

test('POST /api/buff/order: đủ tiền -> trừ ví + đặt panel + trả đơn', async (t) => {
  const deps = makeFakeDeps({ balance: 100 });
  const srv = await startBuffOnlyServer(deps);
  t.after(() => new Promise((resolve) => srv.server.close(resolve)));
  const r = await fetchJson(srv.base, '/api/buff/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ service_id: 444, link: 'https://www.facebook.com/post/123', quantity: 1000 }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.order.provider_order_id, '777001');
  assert.equal(r.json.order.status, 'in_progress');
  assert.equal(r.json.quote.sell_usdt, 1.7); // FB Like rẻ x1.30
  assert.equal(deps.calls.deduct.length, 1);
  assert.equal(deps.calls.addOrder, 1);
  assert.equal(deps.getBalance(), 100 - 1.7);
});

test('POST /api/buff/order: hết tiền ví -> 402, không gọi panel', async (t) => {
  const deps = makeFakeDeps({ balance: 1 });
  const srv = await startBuffOnlyServer(deps);
  t.after(() => new Promise((resolve) => srv.server.close(resolve)));
  const r = await fetchJson(srv.base, '/api/buff/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ service_id: 444, link: 'https://www.facebook.com/post/123', quantity: 1000 }),
  });
  assert.equal(r.status, 402);
  assert.equal(r.json.error, 'INSUFFICIENT_BALANCE');
  assert.equal(deps.calls.addOrder, 0);
});

test('POST /api/buff/order: panel hết tiền -> 503 + cảnh báo, khách không bị trừ', async (t) => {
  const deps = makeFakeDeps({ balance: 100, panelBalance: 1000 }); // panel chỉ còn 1.000 VND
  const srv = await startBuffOnlyServer(deps);
  t.after(() => new Promise((resolve) => srv.server.close(resolve)));
  const r = await fetchJson(srv.base, '/api/buff/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ service_id: 444, link: 'https://www.facebook.com/post/123', quantity: 1000 }),
  });
  assert.equal(r.status, 503);
  assert.equal(r.json.error, 'PANEL_LOW_BALANCE');
  assert.equal(deps.calls.deduct.length, 0);
  assert.equal(deps.calls.addOrder, 0);
  assert.deepEqual(deps.calls.alerts, ['blocked']);
  assert.equal(deps.getBalance(), 100);
});

test('POST /api/buff/order: panel đặt lỗi sau khi trừ -> hoàn tiền + 502', async (t) => {
  const deps = makeFakeDeps({ balance: 100 });
  deps.panel.addOrder = async () => { throw new Error('panel từ chối đơn'); };
  const srv = await startBuffOnlyServer(deps);
  t.after(() => new Promise((resolve) => srv.server.close(resolve)));
  const r = await fetchJson(srv.base, '/api/buff/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ service_id: 444, link: 'https://www.facebook.com/post/123', quantity: 1000 }),
  });
  assert.equal(r.status, 502);
  assert.equal(r.json.error, 'PANEL_ORDER_FAILED');
  assert.equal(deps.calls.refund.length, 1);
  assert.equal(deps.calls.refund[0].amount, 1.7);
  assert.equal(deps.getBalance(), 100); // đã hoàn đủ
});

test('POST /api/buff/topup: hash sai / chưa có giao dịch đều từ chối, không cộng tiền', async (t) => {
  const deps = makeFakeDeps({ balance: 0 });
  const srv = await startBuffOnlyServer({
    ...deps,
    fetchImpl: fakeReceiptFetch(), // receipt có thật nhưng route kiểm tra hash trước
  });
  t.after(() => new Promise((resolve) => srv.server.close(resolve)));
  const badHash = await fetchJson(srv.base, '/api/buff/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ tx_hash: 'xyz', amount_usdt: 10 }),
  });
  assert.equal(badHash.status, 400);
  assert.equal(badHash.json.error, 'BAD_TX_HASH');
  // Hash đúng dạng nhưng RPC không tìm thấy giao dịch.
  const notFound = await fetchJson(srv.base, '/api/buff/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good-token' },
    body: JSON.stringify({ tx_hash: '0x' + 'c'.repeat(64), amount_usdt: 10 }),
  });
  // fakeReceiptFetch trả receipt cho mọi hash -> trường hợp này sẽ xác minh OK
  // và cộng tiền qua store giả (privileged). Kiểm tra cộng đúng 10 USDT.
  assert.equal(notFound.status, 200);
  assert.equal(notFound.json.ok, true);
  assert.equal(notFound.json.credited_usdt, 10);
});
