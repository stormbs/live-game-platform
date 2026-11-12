// lib/buff-alert.js — Cảnh báo Telegram cho Chủ tịch khi tiền panel không đủ
// mua đơn cho khách (hoặc số dư panel xuống thấp).
// Gửi qua bot @hethong_manh_bot bằng helper của connector custom.telegram
// (token nằm trong secure storage, helper tự gắn — code này KHÔNG đọc token).
// Chống spam: mỗi loại cảnh báo tối đa 1 tin / 60 phút (mặc định).
// Chat nhận cảnh báo: TELEGRAM_ALERT_CHAT_ID, mặc định là chat whitelist của
// Chủ tịch (1617048347). Tắt hẳn bằng TELEGRAM_ALERTS_ENABLED=false.
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const HELPER = path.join(
  __dirname, '..', '..', 'custom-connectors', 'custom.telegram', 'bin', 'telegram.py',
);
// Helper Telegram chỉ có trên máy dev/VM của công ty, KHÔNG có trong container
// Railway (ở đó cũng không có python3). Nếu không có helper thì cảnh báo
// Telegram không thể gửi được — tắt hẳn để khỏi spawn lỗi mỗi 15 phút
// ([buff-alert] spawn python3 ENOENT lặp lại trong log, và là lỗi duy nhất
// còn lại trong log lúc app treo âm thầm ~01:30 ngày 2026-11-13).
const HELPER_EXISTS = fs.existsSync(HELPER);
const DEFAULT_CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID || '1617048347';

class BuffAlerter {
  constructor({ chatId, enabled, minIntervalMs, sender } = {}) {
    this.chatId = chatId || DEFAULT_CHAT_ID;
    // Không có sender riêng mà cũng không có helper trên máy này (vd: Railway)
    // thì không gửi được — tắt hẳn thay vì spawn python3 lỗi mỗi lần.
    const canSend = sender || HELPER_EXISTS;
    this.enabled = enabled !== undefined
      ? enabled
      : process.env.TELEGRAM_ALERTS_ENABLED !== 'false';
    if (this.enabled && !canSend) {
      this.enabled = false;
      console.error('[buff-alert] helper Telegram không có trên máy này — tắt cảnh báo Telegram.');
    }
    this.minIntervalMs = minIntervalMs || 60 * 60 * 1000;
    this.sender = sender || null; // hàm (chatId, text) -> Promise, dùng cho test
    this.lastSent = new Map(); // reason -> timestamp
  }

  _due(reason) {
    const last = this.lastSent.get(reason) || 0;
    return Date.now() - last >= this.minIntervalMs;
  }

  _send(chatId, text) {
    if (this.sender) return this.sender(chatId, text);
    return new Promise((resolve, reject) => {
      execFile(
        'python3',
        [HELPER, 'sendMessage', '--chat-id', String(chatId), '--text', text],
        { timeout: 20000 },
        (err, stdout) => {
          if (err) return reject(err);
          try {
            const out = JSON.parse(stdout);
            if (out && out.ok) return resolve(true);
            return reject(new Error(`Telegram trả về không ok: ${String(stdout).slice(0, 200)}`));
          } catch {
            return resolve(true); // helper in ra JSON; không parse được vẫn coi là đã gửi nếu không lỗi tiến trình
          }
        },
      );
    });
  }

  // Gửi 1 cảnh báo (rate-limited theo reason). Trả true nếu đã gửi, false nếu bỏ qua.
  async alert(reason, text) {
    if (!this.enabled) return false;
    if (!this._due(reason)) return false;
    this.lastSent.set(reason, Date.now());
    try {
      await this._send(this.chatId, text);
      return true;
    } catch (e) {
      // Gửi lỗi thì xóa mốc để lần sau thử lại, nhưng không làm vỡ luồng chính.
      this.lastSent.delete(reason);
      console.error('[buff-alert]', e && e.message);
      return false;
    }
  }

  alertLowPanelBalance(balanceVnd, thresholdVnd) {
    return this.alert(
      'low_panel_balance',
      `⚠️ [Buff] Số dư panel bufflikenhanh chỉ còn ${Number(balanceVnd).toLocaleString('vi-VN')} VND (ngưỡng cảnh báo ${Number(thresholdVnd).toLocaleString('vi-VN')} VND). Nạp thêm tiền vào panel để còn mua đơn cho khách.`,
    );
  }

  alertOrderBlocked({ serviceId, quantity, panelCostVnd, panelBalanceVnd }) {
    return this.alert(
      'order_blocked_low_panel',
      `⛔ [Buff] Không đặt được đơn cho khách vì tiền panel không đủ: cần ${Number(panelCostVnd).toLocaleString('vi-VN')} VND cho dịch vụ #${serviceId} x${quantity}, panel chỉ còn ${Number(panelBalanceVnd).toLocaleString('vi-VN')} VND. Khách chưa bị trừ tiền. Nạp tiền panel ngay.`,
    );
  }
}

module.exports = { BuffAlerter, DEFAULT_CHAT_ID };
