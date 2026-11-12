// lib/tikhub-routes.js — API tải video TikTok / Douyin không logo, không
// watermark (dịch vụ miễn phí, không cần đăng nhập).
//   GET  /api/download/health   trạng thái dịch vụ (có key TikHub hay chưa)
//   POST /api/download          {url} -> link tải không watermark + thông tin video
// Key TikHub chỉ nằm ở biến môi trường TIKHUB_API_KEY, không qua frontend.
// KHÔNG log URL hay dữ liệu người dùng (chỉ log nền tảng + mã lỗi khi lỗi).
// Giới hạn nhẹ: 10 request/phút/IP (bộ nhớ trong) để chống spam.
'use strict';

const express = require('express');
const { TikHubClient, TikHubError, detectPlatform } = require('./tikhub');

const RATE_LIMIT_MAX = 10; // request
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // mỗi phút
const RATE_LIMIT_MAX_IPS = 1000; // chặn map phình to vô hạn

// Map lỗi nội bộ -> HTTP + thông báo thân thiện cho người dùng.
const ERROR_MAP = {
  UNSUPPORTED_URL: [400, 'Link này không phải TikTok hoặc Douyin. Hãy dán link video TikTok hoặc Douyin.'],
  VIDEO_NOT_FOUND: [404, 'Không tìm thấy video này — có thể video đã bị xóa, link sai, hoặc bị hạn chế bản quyền.'],
  VIDEO_PRIVATE: [404, 'Video này đang ở chế độ riêng tư nên không tải được.'],
  VIDEO_PARTIAL: [404, 'Video này chỉ hiển thị với một số người xem nên không tải được.'],
  INVALID_API_KEY: [503, 'Dịch vụ tải video tạm thời gặp lỗi cấu hình. Thử lại sau ít phút.'],
  INSUFFICIENT_BALANCE: [503, 'Dịch vụ tạm hết lượt gọi TikHub. Công ty sẽ nạp thêm, bạn thử lại sau.'],
  RATE_LIMITED: [502, 'TikHub đang giới hạn lượt gọi. Thử lại sau ít phút.'],
  TIMEOUT: [504, 'TikTok / Douyin phản hồi chậm quá. Thử lại sau ít phút.'],
  UPSTREAM_UNAVAILABLE: [502, 'Tạm thời không nối được TikHub. Thử lại sau ít phút.'],
  UPSTREAM_ERROR: [502, 'TikHub trả lỗi. Thử lại sau ít phút.'],
  BAD_REQUEST: [400, 'Link video không hợp lệ. Kiểm tra lại link rồi thử lại.'],
  NOT_CONFIGURED: [503, 'Dịch vụ tải video chưa sẵn sàng. Thử lại sau.'],
};

function mountTikHubRoutes(app, opts = {}) {
  const client = opts.client || new TikHubClient({
    apiKey: opts.apiKey,
    timeoutMs: opts.timeoutMs,
    fetchImpl: opts.fetchImpl,
  });
  const rateMax = Number(opts.rateLimitMax) || RATE_LIMIT_MAX;
  const rateWindowMs = Number(opts.rateLimitWindowMs) || RATE_LIMIT_WINDOW_MS;

  // ---- Giới hạn 10 request/phút/IP (bộ nhớ trong) ----
  const buckets = new Map(); // ip -> { count, windowStart }
  function checkRateLimit(req) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = fwd || req.ip || 'unknown';
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now - b.windowStart >= rateWindowMs) {
      b = { count: 0, windowStart: now };
      buckets.set(ip, b);
      if (buckets.size > RATE_LIMIT_MAX_IPS) {
        const oldest = buckets.keys().next().value;
        buckets.delete(oldest);
      }
    }
    b.count += 1;
    return { allowed: b.count <= rateMax, ip };
  }

  function sendErr(res, status, code, message) {
    return res.status(status).json({ ok: false, error: code, message });
  }

  function sendTikHubErr(res, err) {
    const [status, message] = ERROR_MAP[err.code] || ERROR_MAP.UPSTREAM_ERROR;
    return sendErr(res, status, err.code, message);
  }

  app.get('/api/download/health', (req, res) => {
    if (!client.isConfigured()) {
      return res.status(503).json({ ok: false, configured: false, error: 'NOT_CONFIGURED', message: 'Dịch vụ tải video chưa sẵn sàng.' });
    }
    return res.json({ ok: true, configured: true });
  });

  app.post('/api/download', express.json(), async (req, res) => {
    const url = String((req.body && req.body.url) || '').trim();
    if (!url || url.length > 2000) {
      return sendErr(res, 400, 'INVALID_URL', 'Hãy dán link video TikTok hoặc Douyin vào ô trên.');
    }
    if (!detectPlatform(url)) {
      return sendErr(res, 400, 'UNSUPPORTED_URL', 'Link này không phải TikTok hoặc Douyin. Hãy dán link video TikTok hoặc Douyin.');
    }
    const rl = checkRateLimit(req);
    if (!rl.allowed) {
      return sendErr(res, 429, 'RATE_LIMITED', 'Bạn gửi yêu cầu quá nhanh. Đợi 1 phút rồi thử lại.');
    }
    if (!client.isConfigured()) {
      return sendErr(res, 503, 'NOT_CONFIGURED', 'Dịch vụ tải video chưa sẵn sàng. Thử lại sau.');
    }
    try {
      const result = await client.fetchVideo(url);
      return res.json({ ok: true, ...result });
    } catch (e) {
      // Chỉ log nền tảng + mã lỗi, KHÔNG log URL người dùng.
      console.error('[tikhub] lỗi:', detectPlatform(url), e && e.code ? e.code : 'unknown');
      if (e instanceof TikHubError) return sendTikHubErr(res, e);
      return sendErr(res, 502, 'UPSTREAM_ERROR', 'TikHub trả lỗi. Thử lại sau ít phút.');
    }
  });

  return { client };
}

module.exports = { mountTikHubRoutes, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS };
