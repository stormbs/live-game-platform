// lib/tikhub.js — Client gọi TikHub API để lấy link tải video TikTok / Douyin
// KHÔNG watermark (link gốc do nền tảng trả về, không tự tách watermark).
//
// Tài liệu chính thức (TikHub OpenAPI V5.3.2, 2026-06-22):
//   - Spec: https://api.tikhub.io/openapi.json
//   - Swagger: https://api.tikhub.io/docs  |  Văn bản: https://docs.tikhub.io
//   - Base: https://api.tikhub.io
//   - Auth: header `Authorization: Bearer <token>`
//   - Giới hạn mặc định: 10 request/giây; tính phí theo lượt gọi
//     (từ $0,001/lượt; xem docs/tikhub-integration.md).
//
// Endpoint dùng (đều nhận thẳng share_url — không cần tự resolve link rút gọn):
//   - TikTok: GET /api/v1/tiktok/app/v3/fetch_one_video_by_share_url?share_url=<url>
//     (App V3 được TikHub khuyên dùng vì ổn định nhất; Web chỉ là dự phòng.)
//   - Douyin: GET /api/v1/douyin/app/v3/fetch_one_video_by_share_url?share_url=<url>
//     Nếu App V3 trả rỗng -> thử lại bằng Web:
//     GET /api/v1/douyin/web/fetch_one_video_by_share_url?share_url=<url>
//     (Web trả chất lượng cao hơn nhưng ít trường hơn.)
//
// Link không watermark: theo FAQ TikHub, video-detail trả về play addresses,
// trong đó trường `downloadAddr` là link KHÔNG watermark, tải trực tiếp được.
// Link App không cần cookie; link Web cần cookie tt_chain_token và hết hạn
// sau ~24h (gặp 403 thì gọi lại để lấy link mới).
//
// CẤU TRÚC RESPONSE — LƯU Ý KIỂM CHỨNG:
// TikHub chỉ ghi tài liệu endpoint + tham số, không ghi chi tiết từng key
// trong payload (FAQ: "responses are large and vary per platform").
// Mapper dưới đây thử NHIỀU dạng dữ liệu (aweme_detail / aweme_list[0] /
// item / data trực tiếp) và NHIỀU trường URL (download_addr rồi mới tới
// play_addr), nên đúng với cả App V3 lẫn Web. Khi CEO kiểm chứng bằng link
// thật, nếu thấy trường nào lệch thì sửa đúng chỗ đó trong mapAweme(),
// không đổi endpoint hay luồng gọi.
// Key chỉ lấy từ biến môi trường TIKHUB_API_KEY — KHÔNG hardcode, KHÔNG log.
'use strict';

const TIKHUB_BASE = 'https://api.tikhub.io';
const DEFAULT_TIMEOUT_MS = 15000;

// Các host được chấp nhận (kể cả link rút gọn hay link share).
const TIKTOK_HOSTS = new Set([
  'tiktok.com', 'www.tiktok.com', 'm.tiktok.com',
  'vt.tiktok.com', 'vm.tiktok.com',
]);
const DOUYIN_HOSTS = new Set([
  'douyin.com', 'www.douyin.com', 'v.douyin.com',
  'iesdouyin.com', 'www.iesdouyin.com',
]);

// Nhận diện nền tảng từ link người dùng dán vào (kể cả đoạn text share có
// chứa link, ví dụ text copy từ Douyin kèm "https://v.douyin.com/xxx/").
function detectPlatform(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!m) return null;
  let u;
  try { u = new URL(m[0]); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (TIKTOK_HOSTS.has(host)) return 'tiktok';
  if (DOUYIN_HOSTS.has(host)) return 'douyin';
  return null;
}

// Trích URL sạch (bỏ text thừa xung quanh) để gửi cho TikHub.
function extractCleanUrl(raw) {
  const m = String(raw || '').trim().match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : String(raw || '').trim();
}

function firstUrl(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  const list = obj.url_list || obj.urlList || obj.urls;
  if (Array.isArray(list) && list.length) return String(list[0]);
  if (typeof obj.url === 'string') return obj.url;
  return null;
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}

// Mã lỗi Douyin: $.data.filter_list[0].reason
//   8 = hạn chế bản quyền ở nước ngoài HOẶC video không tồn tại/đã xóa
//   5 = nội dung riêng tư, không có quyền xem công khai
//   10 = chỉ một số người được tác giả chọn mới xem được
function filterReasonToCode(reason) {
  if (reason === 5) return 'VIDEO_PRIVATE';
  if (reason === 10) return 'VIDEO_PARTIAL';
  return 'VIDEO_NOT_FOUND'; // 8 và mọi mã khác: coi như không tải được
}

function mapAwemeError(code) {
  const map = {
    VIDEO_PRIVATE: 'VIDEO_PRIVATE',
    VIDEO_PARTIAL: 'VIDEO_PARTIAL',
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  };
  return map[code] || 'VIDEO_NOT_FOUND';
}

// Map 1 object aweme (TikTok App V3 / Douyin App V3 / Douyin Web) thành
// kết quả chuẩn của Strom. Trả null nếu không có video_url.
function mapAweme(platform, aweme) {
  if (!aweme || typeof aweme !== 'object') return null;
  const video = aweme.video || {};
  // Ưu tiên download_addr (không watermark) rồi mới tới play_addr.
  const videoUrl = firstUrl(video.download_addr) || firstUrl(video.play_addr)
    || firstUrl(video.downloadAddr) || firstUrl(video.playAddr)
    || (typeof video.play_url === 'string' ? video.play_url : null);
  if (!videoUrl) return null;
  const cover = firstUrl(video.cover) || firstUrl(video.origin_cover)
    || firstUrl(video.originCover) || firstUrl(aweme.cover) || null;
  const music = aweme.music || {};
  const author = aweme.author || {};
  const durationMs = Number(video.duration) || 0;
  return {
    platform,
    video_id: String(pick(aweme, 'aweme_id', 'item_id', 'id') || ''),
    video_url: videoUrl,
    cover,
    music_url: firstUrl(music.play_url) || firstUrl(music.playUrl) || null,
    music_title: pick(music, 'title') || null,
    title: pick(aweme, 'desc', 'title') || '',
    duration: durationMs > 0 ? Math.round(durationMs / 1000) : null,
    author: {
      nickname: pick(author, 'nickname') || '',
      unique_id: pick(author, 'unique_id', 'uniqueId') || '',
      avatar: firstUrl(author.avatar_thumb) || firstUrl(author.avatar_larger)
        || firstUrl(author.avatar) || null,
    },
  };
}

// Tìm object aweme trong payload TikHub (nhiều dạng envelope khác nhau).
function findAweme(payload) {
  const data = payload && payload.data;
  if (!data || typeof data !== 'object') return { aweme: null, filterReason: null };
  const filterList = Array.isArray(data.filter_list) ? data.filter_list : [];
  const filterReason = filterList.length ? Number(filterList[0].reason) : null;
  if (data.aweme_detail) return { aweme: data.aweme_detail, filterReason };
  if (Array.isArray(data.aweme_list) && data.aweme_list.length) {
    return { aweme: data.aweme_list[0], filterReason };
  }
  if (data.item) return { aweme: data.item, filterReason };
  if (data.aweme) return { aweme: data.aweme, filterReason };
  // Một số endpoint trả thẳng object aweme ở data.
  if (data.video) return { aweme: data, filterReason };
  return { aweme: null, filterReason };
}

class TikHubError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status || 0;
  }
}

class TikHubClient {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || process.env.TIKHUB_API_KEY || '';
    this.base = (opts.base || TIKHUB_BASE).replace(/\/+$/, '');
    this.timeoutMs = Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl || fetch;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async call(path) {
    const url = this.base + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetchImpl(url, {
        headers: { Authorization: 'Bearer ' + this.apiKey, Accept: 'application/json' },
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new TikHubError('TIMEOUT', 'TikHub phản hồi quá chậm (quá ' + Math.round(this.timeoutMs / 1000) + 's).');
      }
      throw new TikHubError('UPSTREAM_UNAVAILABLE', 'Không nối được TikHub.');
    } finally {
      clearTimeout(timer);
    }
    let body = null;
    try { body = await res.json(); } catch { /* body không phải JSON */ }
    if (res.status === 401) throw new TikHubError('INVALID_API_KEY', 'Key TikHub không hợp lệ.', 401);
    if (res.status === 402) throw new TikHubError('INSUFFICIENT_BALANCE', 'Tài khoản TikHub hết lượt gọi.', 402);
    if (res.status === 404) throw new TikHubError('VIDEO_NOT_FOUND', 'Không tìm thấy video.', 404);
    if (res.status === 429) throw new TikHubError('RATE_LIMITED', 'TikHub đang giới hạn lượt gọi.', 429);
    if (res.status === 422) throw new TikHubError('BAD_REQUEST', 'TikHub từ chối tham số gửi lên.', 422);
    if (!res.ok) throw new TikHubError('UPSTREAM_ERROR', 'TikHub trả lỗi HTTP ' + res.status + '.', res.status);
    if (body && typeof body.code === 'number' && body.code !== 200) {
      if (body.code === 404) throw new TikHubError('VIDEO_NOT_FOUND', 'Không tìm thấy video.', 404);
      throw new TikHubError('UPSTREAM_ERROR', 'TikHub trả mã ' + body.code + '.', body.code);
    }
    return body;
  }

  async fetchTikTok(shareUrl) {
    const body = await this.call(
      '/api/v1/tiktok/app/v3/fetch_one_video_by_share_url?share_url=' + encodeURIComponent(shareUrl),
    );
    return this.fromPayload('tiktok', body);
  }

  async fetchDouyin(shareUrl) {
    // App V3 trước (nhiều trường + có mã filter rõ ràng); rỗng thì thử Web.
    const appBody = await this.call(
      '/api/v1/douyin/app/v3/fetch_one_video_by_share_url?share_url=' + encodeURIComponent(shareUrl),
    );
    const appResult = this.fromPayload('douyin', appBody, { allowEmpty: true });
    if (appResult) return appResult;
    const webBody = await this.call(
      '/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=' + encodeURIComponent(shareUrl),
    );
    return this.fromPayload('douyin', webBody);
  }

  // allowEmpty: trả null thay vì ném lỗi khi không có video (để thử endpoint khác).
  fromPayload(platform, body, opts = {}) {
    const { aweme, filterReason } = findAweme(body);
    if (!aweme) {
      if (opts.allowEmpty) return null;
      if (filterReason !== null && filterReason !== undefined) {
        throw new TikHubError(
          filterReasonToCode(filterReason),
          'Video không tải được (mã filter ' + filterReason + ').',
        );
      }
      throw new TikHubError('VIDEO_NOT_FOUND', 'Không tìm thấy video trong kết quả TikHub.');
    }
    const mapped = mapAweme(platform, aweme);
    if (!mapped) {
      if (opts.allowEmpty) return null;
      if (filterReason !== null && filterReason !== undefined) {
        throw new TikHubError(
          filterReasonToCode(filterReason),
          'Video không tải được (mã filter ' + filterReason + ').',
        );
      }
      throw new TikHubError('VIDEO_NOT_FOUND', 'Kết quả TikHub không có link video.');
    }
    return mapped;
  }

  // Entry chính: nhận link người dùng dán -> trả kết quả chuẩn.
  async fetchVideo(rawUrl) {
    if (!this.isConfigured()) {
      throw new TikHubError('NOT_CONFIGURED', 'Chưa cấu hình key TikHub.');
    }
    const platform = detectPlatform(rawUrl);
    if (!platform) {
      throw new TikHubError('UNSUPPORTED_URL', 'Link không phải TikTok hoặc Douyin.');
    }
    const shareUrl = extractCleanUrl(rawUrl);
    if (platform === 'tiktok') return this.fetchTikTok(shareUrl);
    return this.fetchDouyin(shareUrl);
  }
}

module.exports = {
  TikHubClient,
  TikHubError,
  detectPlatform,
  extractCleanUrl,
  mapAweme,
  findAweme,
  filterReasonToCode,
  TIKHUB_BASE,
  DEFAULT_TIMEOUT_MS,
};
