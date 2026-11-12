// lib/buff-store.js — Lưu trữ ví / đơn buff / giao dịch trên Supabase.
// Hai chế độ (chọn theo biến môi trường):
//   1. RPC mode (mặc định, không cần service_role key): backend dùng JWT của
//      chính khách hàng để gọi PostgREST/RPC. Trừ tiền qua hàm SECURITY DEFINER
//      deduct_wallet (chỉ trừ được ví của mình, có kiểm tra số dư); cộng tiền
//      nạp qua credit_wallet có chữ ký HMAC (xem signTopup trong lib/buff.js,
//      bí mật chung BUFF_RPC_SECRET đặt cả ở Railway env và bảng buff_settings).
//      RLS khóa hẳn UPDATE trực tiếp bảng wallets nên khách không tự sửa số dư.
//   2. Privileged mode (khi có SUPABASE_SERVICE_KEY trên Railway): backend
//      dùng service key để ghi trực tiếp (vượt RLS), vẫn xác minh JWT khách
//      qua /auth/v1/user trước khi làm gì.
// Supabase URL + anon key mặc định là của project cong-ty-agent (anon key là
// khóa công khai theo thiết kế Supabase, đã có sẵn trong code web); có thể
// ghi đè bằng biến môi trường SUPABASE_URL / SUPABASE_ANON_KEY.
'use strict';

const DEFAULT_SUPABASE_URL = 'https://tjsxqwnvjwmqlcyvlcim.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3hxd252andtcWxjeXZsY2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NzA3MTksImV4cCI6MjExMDA0NjcxOX0.xvLJPkPZhh246OiSeLCD8I3L1p5SdNxYq4W7kLMGp_s';

class BuffStore {
  constructor({ supabaseUrl, anonKey, serviceKey, fetchImpl } = {}) {
    this.supabaseUrl = (supabaseUrl || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
    this.anonKey = anonKey || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    this.serviceKey = serviceKey || process.env.SUPABASE_SERVICE_KEY || '';
    this.privileged = Boolean(this.serviceKey);
    this.fetchImpl = fetchImpl || fetch;
  }

  _headers(userToken) {
    const h = {
      apikey: this.anonKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    if (this.privileged) h.Authorization = `Bearer ${this.serviceKey}`;
    else if (userToken) h.Authorization = `Bearer ${userToken}`;
    return h;
  }

  async _rest(method, path, userToken, body) {
    const res = await this.fetchImpl(`${this.supabaseUrl}/rest/v1${path}`, {
      method,
      headers: this._headers(userToken),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* giữ text thô */ }
    if (!res.ok) {
      const e = new Error(`Supabase ${method} ${path} -> HTTP ${res.status}: ${(json && (json.message || json.hint)) || text.slice(0, 200)}`);
      e.code = 'SUPABASE_ERROR';
      e.status = res.status;
      throw e;
    }
    return json;
  }

  async _rpc(fn, userToken, body) {
    return this._rest('POST', `/rpc/${fn}`, userToken, body);
  }

  // Xác minh JWT của khách qua Auth API, trả {id, email}.
  async verifyUser(accessToken) {
    if (!accessToken) {
      const e = new Error('Thiếu token đăng nhập');
      e.code = 'UNAUTHENTICATED';
      throw e;
    }
    const res = await this.fetchImpl(`${this.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: this.anonKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const e = new Error('Token đăng nhập không hợp lệ hoặc đã hết hạn');
      e.code = 'UNAUTHENTICATED';
      e.status = res.status;
      throw e;
    }
    const u = await res.json();
    if (!u || !u.id) {
      const e = new Error('Token đăng nhập không hợp lệ');
      e.code = 'UNAUTHENTICATED';
      throw e;
    }
    return { id: u.id, email: u.email || '' };
  }

  async getWallet(userId, userToken) {
    const rows = await this._rest('GET', `/wallets?select=*&user_id=eq.${encodeURIComponent(userId)}`, userToken);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async ensureWallet(userId, userToken) {
    let w = await this.getWallet(userId, userToken);
    if (w) return w;
    const rows = await this._rest('POST', '/wallets', userToken, { user_id: userId, balance_usdt: 0 });
    if (Array.isArray(rows) && rows.length) return rows[0];
    // Có thể trigger on auth.users đã tạo ví giữa chừng -> đọc lại.
    w = await this.getWallet(userId, userToken);
    if (!w) throw new Error('Không tạo được ví cho khách');
    return w;
  }

  // Trừ tiền mua đơn. ref duy nhất cho mỗi lần trừ (vd. order:<uuid>).
  // Trả số dư mới. Hết tiền -> lỗi INSUFFICIENT_BALANCE.
  async deduct(userId, userToken, amountUsdt, ref) {
    const amount = Number(amountUsdt);
    if (!(amount > 0)) throw new Error('Số tiền trừ phải > 0');
    if (this.privileged) {
      const w = await this.ensureWallet(userId, userToken);
      const bal = Number(w.balance_usdt);
      if (bal < amount) {
        const e = new Error('Số dư không đủ');
        e.code = 'INSUFFICIENT_BALANCE';
        throw e;
      }
      const rows = await this._rest(
        'PATCH',
        `/wallets?user_id=eq.${encodeURIComponent(userId)}&balance_usdt=gte.${amount}`,
        userToken,
        { balance_usdt: Math.round((bal - amount) * 1e4) / 1e4, updated_at: new Date().toISOString() },
      );
      if (!Array.isArray(rows) || !rows.length) {
        const e = new Error('Số dư không đủ (đã thay đổi)');
        e.code = 'INSUFFICIENT_BALANCE';
        throw e;
      }
      await this._rest('POST', '/transactions', userToken, {
        user_id: userId, type: 'deduct', amount_usdt: -amount, ref,
      });
      return Number(rows[0].balance_usdt);
    }
    // RPC mode: hàm SECURITY DEFINER tự kiểm tra số dư + ghi transaction.
    // Hàm SQL RAISE lỗi khi không đủ tiền -> map lại thành INSUFFICIENT_BALANCE.
    let out;
    try {
      out = await this._rpc('deduct_wallet', userToken, { p_amount: amount, p_ref: ref });
    } catch (e) {
      if (/insufficient/i.test(e.message || '')) {
        const err = new Error('Số dư không đủ');
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
      }
      throw e;
    }
    if (out && out.error) {
      const e = new Error(String(out.error));
      e.code = /insufficient/i.test(out.error) ? 'INSUFFICIENT_BALANCE' : 'SUPABASE_ERROR';
      throw e;
    }
    const bal = Array.isArray(out) ? out[0] : out;
    if (bal === null || bal === undefined) throw new Error('Trừ tiền thất bại (không rõ lý do)');
    return Number(typeof bal === 'object' ? (bal.balance_usdt ?? bal.deduct_wallet) : bal);
  }

  // Cộng tiền nạp đã xác minh trên BSC (chỉ dùng sau khi verifyBscUsdtTx OK).
  async creditTopup(userId, userToken, txHash, amountRaw, sig) {
    if (this.privileged) {
      const w = await this.ensureWallet(userId, userToken);
      const amountUsdt = Number(amountRaw) / 1e18;
      const rows = await this._rest(
        'PATCH',
        `/wallets?user_id=eq.${encodeURIComponent(userId)}`,
        userToken,
        { balance_usdt: Math.round((Number(w.balance_usdt) + amountUsdt) * 1e4) / 1e4, updated_at: new Date().toISOString() },
      );
      await this._rest('POST', '/transactions', userToken, {
        user_id: userId, type: 'topup', amount_usdt: Math.round(amountUsdt * 1e4) / 1e4, ref: `topup:${txHash}`,
      });
      return Number(rows && rows[0] ? rows[0].balance_usdt : Number(w.balance_usdt) + amountUsdt);
    }
    const out = await this._rpc('credit_wallet', userToken, {
      p_tx_hash: txHash, p_amount_raw: String(amountRaw), p_sig: sig,
    });
    if (out && out.error) throw new Error(String(out.error));
    const bal = Array.isArray(out) ? out[0] : out;
    if (bal === null || bal === undefined) throw new Error('Cộng tiền thất bại (không rõ lý do)');
    return Number(typeof bal === 'object' ? (bal.balance_usdt ?? bal.credit_wallet) : bal);
  }

  // Hoàn tiền khi panel đặt đơn lỗi sau khi đã trừ (ref 'refund:<order-uuid>').
  // Dùng chung đường credit có chữ ký để không mở lối tự cộng tiền.
  async refund(userId, userToken, amountUsdt, orderUuid) {
    const amount = Number(amountUsdt);
    if (!(amount > 0)) return null;
    if (this.privileged) {
      const w = await this.ensureWallet(userId, userToken);
      const rows = await this._rest(
        'PATCH',
        `/wallets?user_id=eq.${encodeURIComponent(userId)}`,
        userToken,
        { balance_usdt: Math.round((Number(w.balance_usdt) + amount) * 1e4) / 1e4, updated_at: new Date().toISOString() },
      );
      await this._rest('POST', '/transactions', userToken, {
        user_id: userId, type: 'refund', amount_usdt: amount, ref: `refund:${orderUuid}`,
      });
      return Number(rows && rows[0] ? rows[0].balance_usdt : Number(w.balance_usdt) + amount);
    }
    const out = await this._rpc('refund_wallet', userToken, { p_amount: amount, p_ref: `refund:${orderUuid}` });
    if (out && out.error) throw new Error(String(out.error));
    const bal = Array.isArray(out) ? out[0] : out;
    return bal === null || bal === undefined ? null : Number(typeof bal === 'object' ? (bal.balance_usdt ?? bal.refund_wallet) : bal);
  }

  async insertOrder(userId, userToken, order) {
    const rows = await this._rest('POST', '/buff_orders', userToken, { user_id: userId, ...order });
    if (!Array.isArray(rows) || !rows.length) throw new Error('Không lưu được đơn buff');
    return rows[0];
  }

  async updateOrder(orderId, userId, userToken, patch) {
    const rows = await this._rest(
      'PATCH',
      `/buff_orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`,
      userToken,
      patch,
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async getOrder(orderId, userId, userToken) {
    const rows = await this._rest(
      'GET',
      `/buff_orders?select=*&id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`,
      userToken,
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async listOrders(userId, userToken, limit = 20) {
    const rows = await this._rest(
      'GET',
      `/buff_orders?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${limit}`,
      userToken,
    );
    return Array.isArray(rows) ? rows : [];
  }

  async txExists(ref, userToken) {
    const rows = await this._rest('GET', `/transactions?select=id&ref=eq.${encodeURIComponent(ref)}&limit=1`, userToken);
    return Array.isArray(rows) && rows.length > 0;
  }
}

module.exports = { BuffStore, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY };
