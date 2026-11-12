// lib/buff-routes.js — API buff tương tác trên nền tảng (Railway).
//   GET  /api/buff/services           danh sách dịch vụ (cache, không cần đăng nhập)
//   GET  /api/buff/platforms          tóm tắt nền tảng -> chuyên mục (cho chatbot)
//   GET  /api/buff/config             cấu hình công khai: ví nạp USDT, tỷ giá, hệ số lãi
//   POST /api/buff/quote              báo giá 1 đơn (không cần đăng nhập)
//   GET  /api/buff/wallet             số dư USDT của khách (cần JWT Supabase)
//   POST /api/buff/order              đặt đơn: trừ ví -> gọi panel -> lưu đơn
//   GET  /api/buff/orders             đơn của khách (mới nhất trước)
//   GET  /api/buff/order/:id/status   đồng bộ trạng thái đơn từ panel
//   POST /api/buff/topup              nạp USDT: xác minh giao dịch BSC rồi cộng ví
// Luồng tiền an toàn: KHÔNG bao giờ trừ ví khi panel không đủ tiền (kiểm tra
// số dư panel trước, thiếu thì báo Telegram cho Chủ tịch + trả lỗi, khách
// chưa mất tiền). Panel đặt lỗi sau khi trừ -> hoàn tiền tự động (refund).
// Token panel chỉ nằm ở biến môi trường BUFF_API_KEY, không qua frontend.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const {
  VND_PER_USDT,
  EXPENSIVE_RATE_THRESHOLD_VND,
  MARKUP_EXPENSIVE,
  MARKUP_CHEAP,
  PANEL_LOW_BALANCE_VND,
  FINANCE_WALLET,
  PanelClient,
  quoteFor,
  publicService,
  mapPanelStatus,
  verifyBscUsdtTx,
  signTopup,
} = require('./buff');
const { BuffStore } = require('./buff-store');
const { BuffAlerter } = require('./buff-alert');

const CATALOG_REFRESH_MS = 6 * 60 * 60 * 1000;
const BALANCE_CACHE_MS = 60 * 1000;
const WATCHDOG_MS = 15 * 60 * 1000;

function mountBuffRoutes(app, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const panel = opts.panel || new PanelClient({ fetchImpl });
  const store = opts.store || new BuffStore({ fetchImpl });
  const alerter = opts.alerter || new BuffAlerter();
  const rpcSecret = opts.rpcSecret || process.env.BUFF_RPC_SECRET || '';
  const catalogPath = opts.catalogPath || path.join(__dirname, '..', 'data', 'buff', 'catalog.json');

  let catalog = [];
  let catalogUpdatedAt = null;

  function loadCatalogFromDisk() {
    try {
      const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      if (Array.isArray(raw) && raw.length) {
        catalog = raw.filter((s) => s && s.enable !== 0);
        catalogUpdatedAt = fs.statSync(catalogPath).mtime.toISOString();
        return true;
      }
    } catch { /* chưa có file cache */ }
    return false;
  }

  async function refreshCatalog() {
    try {
      const list = await panel.services();
      if (Array.isArray(list) && list.length) {
        catalog = list.filter((s) => s && s.enable !== 0);
        catalogUpdatedAt = new Date().toISOString();
        try {
          fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
          fs.writeFileSync(catalogPath, JSON.stringify(list, null, 2));
        } catch { /* cache trên đĩa là phụ, bộ nhớ mới là chính */ }
        return true;
      }
    } catch (e) {
      console.error('[buff] refresh catalog lỗi:', e && e.message);
    }
    return false;
  }

  loadCatalogFromDisk();
  if (panel.apiKey) {
    const t = setInterval(() => { refreshCatalog(); }, CATALOG_REFRESH_MS);
    if (t.unref) t.unref();
  }

  // ---- Số dư panel (cache 60s) + watchdog ----
  let panelBalanceCache = { value: null, at: 0 };
  async function getPanelBalance() {
    const now = Date.now();
    if (panelBalanceCache.value !== null && now - panelBalanceCache.at < BALANCE_CACHE_MS) {
      return panelBalanceCache.value;
    }
    const b = await panel.balance();
    panelBalanceCache = { value: Number(b.balance), at: now };
    return panelBalanceCache.value;
  }

  async function watchdogOnce() {
    if (!panel.apiKey) return;
    try {
      const bal = await getPanelBalance();
      if (bal < PANEL_LOW_BALANCE_VND) {
        await alerter.alertLowPanelBalance(bal, PANEL_LOW_BALANCE_VND);
      }
    } catch (e) {
      console.error('[buff] watchdog lỗi:', e && e.message);
    }
  }
  if (panel.apiKey) {
    const t = setInterval(() => { watchdogOnce(); }, WATCHDOG_MS);
    if (t.unref) t.unref();
    setTimeout(() => { watchdogOnce(); }, 30000).unref?.();
  }

  function sendErr(res, status, code, message) {
    return res.status(status).json({ ok: false, error: code, message });
  }

  async function requireAuth(req, res) {
    const h = req.get('authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    try {
      const user = await store.verifyUser(token);
      return user;
    } catch (e) {
      sendErr(res, 401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập để dùng tính năng này.');
      return null;
    }
  }

  function findService(id) {
    const n = Number(id);
    if (!Number.isFinite(n)) return null;
    return catalog.find((s) => Number(s.service) === n) || null;
  }

  function validLink(link) {
    const l = String(link || '').trim();
    if (!l || l.length > 500) return false;
    return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(l) || /^[\w.-]+$/.test(l);
  }

  // ---- Route công khai ----
  app.get('/api/buff/services', (req, res) => {
    res.json({
      ok: true,
      count: catalog.length,
      updated_at: catalogUpdatedAt,
      services: catalog.map(publicService),
    });
  });

  app.get('/api/buff/platforms', (req, res) => {
    const out = {};
    for (const s of catalog) {
      const p = publicService(s);
      out[p.platform] = out[p.platform] || { count: 0, categories: new Set() };
      out[p.platform].count += 1;
      out[p.platform].categories.add(s.category);
    }
    const platforms = Object.fromEntries(
      Object.entries(out).map(([k, v]) => [k, { count: v.count, categories: [...v.categories].sort() }]),
    );
    res.json({ ok: true, platforms });
  });

  app.get('/api/buff/config', (req, res) => {
    res.json({
      ok: true,
      finance_wallet: FINANCE_WALLET,
      finance_network: 'BEP20 (BSC)',
      finance_currency: 'USDT',
      vnd_per_usdt: VND_PER_USDT,
      pricing: {
        expensive_threshold_vnd_per_1000: EXPENSIVE_RATE_THRESHOLD_VND,
        markup_expensive: MARKUP_EXPENSIVE,
        markup_cheap: MARKUP_CHEAP,
      },
      panel_low_balance_vnd: PANEL_LOW_BALANCE_VND,
    });
  });

  app.post('/api/buff/quote', express.json(), (req, res) => {
    const { service_id, quantity } = req.body || {};
    const svc = findService(service_id);
    if (!svc) return sendErr(res, 400, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ này.');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < Number(svc.min) || qty > Number(svc.max)) {
      return sendErr(res, 400, 'BAD_QUANTITY', `Số lượng phải từ ${svc.min} đến ${svc.max}.`);
    }
    res.json({ ok: true, quote: quoteFor(svc, qty) });
  });

  // ---- Route cần đăng nhập ----
  app.get('/api/buff/wallet', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    try {
      const token = req.get('authorization').slice(7).trim();
      const w = await store.ensureWallet(user.id, token);
      res.json({ ok: true, balance_usdt: Number(w.balance_usdt) });
    } catch (e) {
      console.error('[buff] wallet lỗi:', e && e.message);
      sendErr(res, 500, 'WALLET_ERROR', 'Không đọc được số dư, thử lại sau.');
    }
  });

  app.post('/api/buff/order', express.json(), async (req, res) => {
    const { service_id, link, quantity } = req.body || {};
    const svc = findService(service_id);
    if (!svc) return sendErr(res, 400, 'SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ này.');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < Number(svc.min) || qty > Number(svc.max)) {
      return sendErr(res, 400, 'BAD_QUANTITY', `Số lượng phải từ ${svc.min} đến ${svc.max}.`);
    }
    if (!validLink(link)) return sendErr(res, 400, 'BAD_LINK', 'Link cần buff không hợp lệ.');
    const user = await requireAuth(req, res);
    if (!user) return;
    const token = req.get('authorization').slice(7).trim();
    const quote = quoteFor(svc, qty);
    const orderUuid = crypto.randomUUID();

    // 1. Lưu đơn ở trạng thái chờ (chưa trừ tiền).
    let orderRow;
    try {
      orderRow = await store.insertOrder(user.id, token, {
        id: orderUuid,
        service_id: Number(svc.service),
        server: String(svc.name || ''),
        link: String(link).trim(),
        quantity: qty,
        cost_usdt: quote.sell_usdt,
        status: 'created',
        provider_order_id: null,
      });
    } catch (e) {
      console.error('[buff] lưu đơn lỗi:', e && e.message);
      return sendErr(res, 500, 'ORDER_SAVE_ERROR', 'Không lưu được đơn, thử lại sau.');
    }

    // 2. Kiểm tra tiền panel TRƯỚC khi trừ ví khách.
    let panelBal = null;
    try {
      panelBal = await getPanelBalance();
    } catch (e) {
      console.error('[buff] kiểm tra số dư panel lỗi:', e && e.message);
      return sendErr(res, 503, 'PANEL_UNAVAILABLE', 'Panel tạm thời không nối được, thử lại sau ít phút.');
    }
    if (panelBal < quote.panel_cost_vnd) {
      await store.updateOrder(orderUuid, user.id, token, { status: 'failed_panel_balance' }).catch(() => {});
      await alerter.alertOrderBlocked({
        serviceId: svc.service, quantity: qty,
        panelCostVnd: quote.panel_cost_vnd, panelBalanceVnd: panelBal,
      });
      return sendErr(res, 503, 'PANEL_LOW_BALANCE', 'Hệ thống tạm hết tiền panel để chạy đơn này. Công ty đã được báo, bạn thử lại sau.');
    }

    // 3. Trừ ví khách.
    try {
      await store.deduct(user.id, token, quote.sell_usdt, `order:${orderUuid}`);
    } catch (e) {
      await store.updateOrder(orderUuid, user.id, token, { status: 'failed_insufficient_balance' }).catch(() => {});
      if (e.code === 'INSUFFICIENT_BALANCE') {
        return sendErr(res, 402, 'INSUFFICIENT_BALANCE', `Số dư không đủ. Đơn này cần ${quote.sell_usdt} USDT — hãy nạp thêm vào ví.`);
      }
      console.error('[buff] trừ ví lỗi:', e && e.message);
      return sendErr(res, 500, 'DEDUCT_ERROR', 'Không trừ được tiền, thử lại sau.');
    }

    // 4. Đặt đơn lên panel. Lỗi ở đây -> hoàn tiền ngay.
    let provider;
    try {
      provider = await panel.addOrder({ service: svc.service, link: String(link).trim(), quantity: qty });
    } catch (e) {
      console.error('[buff] panel add lỗi:', e && e.message);
      try { await store.refund(user.id, token, quote.sell_usdt, orderUuid); } catch (re) {
        console.error('[buff] HOÀN TIỀN LỖI (cần xử lý tay):', orderUuid, re && re.message);
      }
      await store.updateOrder(orderUuid, user.id, token, { status: 'failed_panel' }).catch(() => {});
      return sendErr(res, 502, 'PANEL_ORDER_FAILED', 'Panel không nhận đơn, tiền đã được hoàn lại ví của bạn.');
    }

    const done = await store.updateOrder(orderUuid, user.id, token, {
      status: 'in_progress', provider_order_id: provider.orderId,
    }).catch(() => null);
    res.json({ ok: true, order: done || { ...orderRow, status: 'in_progress', provider_order_id: provider.orderId }, quote });
  });

  app.get('/api/buff/orders', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    try {
      const token = req.get('authorization').slice(7).trim();
      const rows = await store.listOrders(user.id, token, 20);
      res.json({ ok: true, orders: rows });
    } catch (e) {
      console.error('[buff] list orders lỗi:', e && e.message);
      sendErr(res, 500, 'ORDERS_ERROR', 'Không đọc được danh sách đơn, thử lại sau.');
    }
  });

  app.get('/api/buff/order/:id/status', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    try {
      const token = req.get('authorization').slice(7).trim();
      const order = await store.getOrder(req.params.id, user.id, token);
      if (!order) return sendErr(res, 404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn này.');
      if (!order.provider_order_id) {
        return res.json({ ok: true, order, panel: null });
      }
      const ps = await panel.orderStatus(order.provider_order_id);
      const mapped = mapPanelStatus(ps.status);
      if (mapped !== order.status) {
        await store.updateOrder(order.id, user.id, token, { status: mapped }).catch(() => {});
        order.status = mapped;
      }
      res.json({ ok: true, order, panel: ps });
    } catch (e) {
      console.error('[buff] order status lỗi:', e && e.message);
      sendErr(res, 502, 'PANEL_STATUS_ERROR', 'Không đồng bộ được trạng thái từ panel, thử lại sau.');
    }
  });

  // POST /api/buff/orders/refresh — đồng bộ trạng thái tất cả đơn chưa xong
  // của khách trong 1 lần gọi panel; trả về danh sách đơn kèm thông tin panel
  // (remains/start_count để tính tiến độ đã chạy).
  app.post('/api/buff/orders/refresh', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    try {
      const token = req.get('authorization').slice(7).trim();
      const rows = await store.listOrders(user.id, token, 20);
      const open = rows.filter((o) => o && o.provider_order_id &&
        !['completed', 'canceled', 'partial'].includes(String(o.status || '')));
      if (!open.length) return res.json({ ok: true, orders: rows, refreshed: 0 });
      const ps = await panel.orderStatuses(open.map((o) => o.provider_order_id));
      let refreshed = 0;
      for (const o of open) {
        const p = ps[o.provider_order_id];
        if (!p) continue;
        const mapped = mapPanelStatus(p.status);
        if (mapped !== o.status) {
          await store.updateOrder(o.id, user.id, token, { status: mapped }).catch(() => {});
          o.status = mapped;
        }
        o.panel = p;
        refreshed += 1;
      }
      res.json({ ok: true, orders: rows, refreshed });
    } catch (e) {
      console.error('[buff] refresh orders lỗi:', e && e.message);
      sendErr(res, 502, 'PANEL_STATUS_ERROR', 'Không đồng bộ được trạng thái từ panel, thử lại sau.');
    }
  });

  app.post('/api/buff/topup', express.json(), async (req, res) => {
    const { tx_hash, amount_usdt } = req.body || {};
    const user = await requireAuth(req, res);
    if (!user) return;
    const token = req.get('authorization').slice(7).trim();
    const txHash = String(tx_hash || '').trim();
    const claimed = Number(amount_usdt);
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return sendErr(res, 400, 'BAD_TX_HASH', 'Mã giao dịch (tx hash) không đúng dạng.');
    }
    if (!(claimed > 0)) return sendErr(res, 400, 'BAD_AMOUNT', 'Số USDT nạp phải lớn hơn 0.');

    try {
      if (await store.txExists(`topup:${txHash}`, token)) {
        return sendErr(res, 409, 'TX_ALREADY_USED', 'Giao dịch này đã được cộng tiền rồi.');
      }
      const v = await verifyBscUsdtTx(txHash, fetchImpl);
      if (!v.ok) {
        const msg = {
          invalid_tx_hash: 'Mã giao dịch không đúng dạng.',
          tx_not_found: 'Chưa tìm thấy giao dịch này trên BSC (có thể chưa được xác nhận, đợi vài phút rồi gửi lại).',
          tx_failed: 'Giao dịch này đã thất bại trên BSC, không cộng tiền được.',
          no_usdt_to_finance_wallet: 'Giao dịch này không chuyển USDT tới ví của công ty. Kiểm tra lại mã giao dịch.',
          bsc_rpc_unreachable: 'Tạm thời không kiểm tra được giao dịch trên BSC, thử lại sau ít phút.',
        }[v.reason] || 'Không xác minh được giao dịch.';
        return sendErr(res, 400, 'TX_NOT_VERIFIED', msg);
      }
      if (v.amountUsdt + 1e-9 < claimed) {
        return sendErr(res, 400, 'TX_AMOUNT_MISMATCH', `Giao dịch chỉ chuyển ${v.amountUsdt} USDT tới ví công ty, ít hơn số bạn khai ${claimed} USDT.`);
      }
      if (!store.privileged && !rpcSecret) {
        return sendErr(res, 500, 'TOPUP_NOT_CONFIGURED', 'Chưa cấu hình nạp tiền phía máy chủ, liên hệ công ty.');
      }
      const sig = store.privileged ? '' : signTopup(txHash, v.amountRaw, rpcSecret);
      const newBalance = await store.creditTopup(user.id, token, txHash, v.amountRaw, sig);
      res.json({ ok: true, credited_usdt: Math.round(v.amountUsdt * 1e4) / 1e4, balance_usdt: Number(newBalance), tx_hash: txHash, from: v.from });
    } catch (e) {
      console.error('[buff] topup lỗi:', e && e.message);
      sendErr(res, 500, 'TOPUP_ERROR', 'Không cộng tiền được, thử lại sau hoặc liên hệ công ty.');
    }
  });

  return { refreshCatalog, watchdogOnce, getCatalog: () => catalog };
}

module.exports = { mountBuffRoutes };
