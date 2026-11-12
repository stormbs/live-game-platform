// lib/buff.js — Dịch vụ buff tương tác (panel bufflikenhanh.com).
// Quy tắc tính giá (Chủ tịch chốt 2026-11-12, thay mức +50% mặc định):
//   - Tiêu chí phân loại DUY NHẤT: đơn giá gốc của panel (rate, VND / 1000 đơn vị).
//   - Dịch vụ ĐẮT  (rate >= EXPENSIVE_RATE_THRESHOLD_VND): lãi 20%  -> giá bán = gốc x 1.20
//   - Dịch vụ RẺ   (rate <  EXPENSIVE_RATE_THRESHOLD_VND): lãi 30%  -> giá bán = gốc x 1.30
//     (Chủ tịch chốt 2026-11-12: rẻ lãi 30%; Tài chính
//     chỉ chỉnh 2 hằng số MARKUP_CHEAP / MARKUP_EXPENSIVE dưới đây, không sửa
//     rải rác chỗ khác.)
//   - Giá gốc panel tính bằng VND, giá bán tính bằng USDT theo tỷ giá cố định
//     VND_PER_USDT (một hằng số duy nhất, Tài chính chỉnh sau khi cần).
//   - Giá bán luôn làm tròn LÊN tới 4 chữ số thập phân để công ty không bao giờ
//     bán dưới giá vốn do làm tròn.
// KHÔNG bao giờ ghi API token vào file/log — token chỉ qua biến môi trường
// BUFF_API_KEY (đặt trên Railway), code này chỉ đọc process.env.
'use strict';

const crypto = require('crypto');

// ---- Hằng số cấu hình duy nhất cho giá (Tài chính chỉnh tại đây) ----
const VND_PER_USDT = 26000; // tỷ giá cố định VND/USDT để đổi giá panel (VND) sang USDT
const EXPENSIVE_RATE_THRESHOLD_VND = 100000; // rate >= 100.000 VND/1000 đơn vị => dịch vụ ĐẮT
const MARKUP_EXPENSIVE = 1.20; // dịch vụ đắt: lãi 20%
const MARKUP_CHEAP = 1.30; // dịch vụ rẻ: lãi 30% (Chủ tịch chốt 2026-11-12)

const PANEL_API_URL = 'https://bufflikenhanh.com/api/v2';
const PANEL_LOW_BALANCE_VND = 500000; // dưới mức này thì gửi cảnh báo Telegram
const FINANCE_WALLET = '0x1104DB8596dF727FB21a1a5a5A19cc540067720c'; // ví USDT BEP20 phòng kế toán
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // hợp đồng USDT trên BSC (18 decimals)
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
const USDT_DECIMALS = 18;

// Chuẩn hóa tên nền tảng (dữ liệu panel có lỗi chính tả: Instargam, Goolge).
function normalizePlatform(category) {
  const raw = String(category || '').split('|')[0].trim();
  const map = { Instargam: 'Instagram', Goolge: 'Google' };
  return map[raw] || raw || 'Khác';
}

function isExpensive(rateVndPer1000) {
  return Number(rateVndPer1000) >= EXPENSIVE_RATE_THRESHOLD_VND;
}

function markupFor(rateVndPer1000) {
  return isExpensive(rateVndPer1000) ? MARKUP_EXPENSIVE : MARKUP_CHEAP;
}

// Giá vốn panel (VND) cho một số lượng. rate panel tính theo 1000 đơn vị.
function panelCostVnd(rateVndPer1000, quantity) {
  return (Number(rateVndPer1000) * Number(quantity)) / 1000;
}

// Giá bán (USDT), làm tròn LÊN 4 chữ số thập phân.
// Trừ 1e-9 trước khi ceil để khử nhiễu float: (1180000/26000)*1.3 ra
// 59.00000000000001, ceil thẳng sẽ thành 59.0001 trong khi giá đúng là 59.
function sellPriceUsdt(rateVndPer1000, quantity) {
  const costVnd = panelCostVnd(rateVndPer1000, quantity);
  const markup = markupFor(rateVndPer1000);
  const raw = (costVnd / VND_PER_USDT) * markup;
  return Math.ceil((raw - 1e-9) * 1e4) / 1e4;
}

function quoteFor(service, quantity) {
  const rate = Number(service.rate);
  const panelVnd = panelCostVnd(rate, quantity);
  return {
    service_id: service.service,
    name: service.name,
    category: service.category,
    platform: normalizePlatform(service.category),
    quantity: Number(quantity),
    rate_vnd_per_1000: rate,
    tier: isExpensive(rate) ? 'expensive' : 'cheap',
    markup: markupFor(rate),
    panel_cost_vnd: Math.round(panelVnd * 100) / 100,
    sell_usdt: sellPriceUsdt(rate, quantity),
    currency: 'USDT',
  };
}

// Dịch vụ panel -> dạng công khai cho chatbot (không lộ gì nội bộ).
// price = giá bán theo 1.000 lượt, tính bằng USDT (rate panel là VND/1000).
function publicService(s) {
  return {
    service: s.service,
    name: s.name,
    category: s.category,
    platform: normalizePlatform(s.category),
    type: s.type,
    rate: Number(s.rate),
    price: sellPriceUsdt(Number(s.rate), 1000),
    min: Number(s.min),
    max: Number(s.max),
  };
}

// ---- Panel client (SMM API chuẩn: POST form, action=balance/services/add/status) ----
class PanelClient {
  constructor({ apiKey, baseUrl, fetchImpl } = {}) {
    this.apiKey = apiKey || process.env.BUFF_API_KEY || '';
    this.baseUrl = baseUrl || PANEL_API_URL;
    this.fetchImpl = fetchImpl || fetch;
  }

  async call(action, extra = {}) {
    if (!this.apiKey) {
      const e = new Error('Chưa cấu hình BUFF_API_KEY (token API panel)');
      e.code = 'PANEL_NO_KEY';
      throw e;
    }
    const body = new URLSearchParams({ key: this.apiKey, action, ...extra });
    let res;
    try {
      res = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (e) {
      const err = new Error(`Không nối được API panel: ${e.message}`);
      err.code = 'PANEL_UNREACHABLE';
      throw err;
    }
    let data;
    try {
      data = await res.json();
    } catch {
      const err = new Error(`API panel trả về không phải JSON (HTTP ${res.status})`);
      err.code = 'PANEL_BAD_RESPONSE';
      throw err;
    }
    if (data && typeof data.error === 'string' && data.error) {
      const err = new Error(`API panel báo lỗi: ${data.error}`);
      err.code = 'PANEL_ERROR';
      err.panelError = data.error;
      throw err;
    }
    return data;
  }

  async balance() {
    const d = await this.call('balance');
    return { balance: Number(d.balance), currency: d.currency || 'VND' };
  }

  async services() {
    const d = await this.call('services');
    if (!Array.isArray(d)) throw new Error('API panel trả danh sách dịch vụ không đúng dạng');
    return d;
  }

  async addOrder({ service, link, quantity }) {
    const d = await this.call('add', {
      service: String(service),
      link: String(link),
      quantity: String(quantity),
    });
    if (d.order === undefined || d.order === null) {
      throw new Error('API panel không trả mã đơn (order)');
    }
    return { orderId: String(d.order) };
  }

  async orderStatus(orderId) {
    const d = await this.call('status', { order: String(orderId) });
    return {
      status: String(d.status || ''),
      charge: d.charge !== undefined ? Number(d.charge) : null,
      currency: d.currency || 'VND',
      remains: d.remains !== undefined ? Number(d.remains) : null,
      startCount: d.start_count !== undefined ? Number(d.start_count) : null,
    };
  }

  // Trạng thái hàng loạt: 1 lần gọi panel cho nhiều đơn.
  // Trả về map { providerOrderId: {status, charge, currency, remains, startCount} }.
  async orderStatuses(orderIds) {
    const ids = (Array.isArray(orderIds) ? orderIds : []).map(String).filter(Boolean);
    if (!ids.length) return {};
    const d = await this.call('status', { orders: ids.join(',') });
    const out = {};
    for (const id of ids) {
      const v = d && d[id];
      if (!v || typeof v !== 'object') continue;
      out[id] = {
        status: String(v.status || ''),
        charge: v.charge !== undefined ? Number(v.charge) : null,
        currency: v.currency || 'VND',
        remains: v.remains !== undefined ? Number(v.remains) : null,
        startCount: v.start_count !== undefined ? Number(v.start_count) : null,
      };
    }
    return out;
  }
}

// Chuẩn hóa trạng thái panel -> trạng thái nội bộ.
function mapPanelStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('complete')) return 'completed';
  if (v.includes('partial')) return 'partial';
  if (v.includes('cancel')) return 'canceled';
  if (v.includes('progress') || v.includes('processing') || v.includes('running')) return 'in_progress';
  if (v.includes('pending') || v.includes('await') || v.includes('queue')) return 'pending';
  return 'in_progress';
}

// ---- Xác minh giao dịch USDT (BEP20) trên BSC qua RPC công khai ----
// Đọc receipt, cộng mọi log Transfer USDT về ví kế toán trong giao dịch đó.
async function verifyBscUsdtTx(txHash, fetchImpl) {
  const f = fetchImpl || fetch;
  const hash = String(txHash || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return { ok: false, reason: 'invalid_tx_hash' };
  }
  let receipt;
  try {
    const res = await f(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash], id: 1 }),
    });
    const data = await res.json();
    receipt = data && data.result;
  } catch (e) {
    return { ok: false, reason: 'bsc_rpc_unreachable', detail: e.message };
  }
  if (!receipt) return { ok: false, reason: 'tx_not_found' };
  if (String(receipt.status) !== '0x1') return { ok: false, reason: 'tx_failed' };
  const walletPadded = '0x000000000000000000000000' + FINANCE_WALLET.slice(2).toLowerCase();
  let totalRaw = 0n;
  let from = '';
  for (const log of receipt.logs || []) {
    if (!log || String(log.address || '').toLowerCase() !== USDT_BSC.toLowerCase()) continue;
    const topics = log.topics || [];
    if (topics.length < 3) continue;
    if (String(topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(topics[2]).toLowerCase() !== walletPadded) continue;
    if (!from && topics[1]) from = '0x' + String(topics[1]).slice(-40);
    try {
      totalRaw += BigInt(String(log.data || '0x0'));
    } catch { /* bỏ qua log lỗi */ }
  }
  if (totalRaw <= 0n) return { ok: false, reason: 'no_usdt_to_finance_wallet' };
  const amountUsdt = Number(totalRaw) / 10 ** USDT_DECIMALS;
  return { ok: true, amountRaw: totalRaw.toString(), amountUsdt, from: from || '' };
}

// Chữ ký HMAC cho RPC credit_wallet (backend ký, SQL kiểm tra lại).
function signTopup(txHash, amountRaw, secret) {
  return crypto.createHmac('sha256', String(secret)).update(`${txHash}:${amountRaw}`).digest('hex');
}

module.exports = {
  VND_PER_USDT,
  EXPENSIVE_RATE_THRESHOLD_VND,
  MARKUP_EXPENSIVE,
  MARKUP_CHEAP,
  PANEL_API_URL,
  PANEL_LOW_BALANCE_VND,
  FINANCE_WALLET,
  USDT_BSC,
  BSC_RPC_URL,
  normalizePlatform,
  isExpensive,
  markupFor,
  panelCostVnd,
  sellPriceUsdt,
  quoteFor,
  publicService,
  PanelClient,
  mapPanelStatus,
  verifyBscUsdtTx,
  signTopup,
};
