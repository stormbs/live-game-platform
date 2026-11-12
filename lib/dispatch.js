// lib/dispatch.js — Gọi trực tiếp route của room mà không qua HTTP vòng lại.
//  - Game Express (ve-avatar, buong-giam): chạy router của room với req/res
//    giả. Body đã parse sẵn nên đặt req._body = true để body-parser bỏ qua.
//  - Game bản đồ (raw http): gọi handleRequest với req là stream chứa body.
// Chỉ dùng cho gọi nội bộ (adapter TikTok, test, platform). Không thay thế
// đường HTTP công khai — browser/overlay vẫn đi qua dispatcher bình thường.
'use strict';

const { Readable } = require('stream');

function mockRes(capture) {
  const res = {
    statusCode: 200,
    _headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { capture(this.statusCode, obj); return this; },
    send(b) { capture(this.statusCode, b); return this; },
    end(b) { capture(this.statusCode, b); return this; },
    write() { return true; },
    writeHead(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; },
    getHeader(k) { return this._headers[String(k).toLowerCase()]; },
    set(k, v) { if (typeof k === 'object') Object.assign(this._headers, k); else this._headers[String(k).toLowerCase()] = v; return this; },
    get(k) { return this._headers[String(k).toLowerCase()]; },
    redirect(loc) { this.statusCode = 302; capture(302, { redirect: loc }); return this; },
  };
  return res;
}

// Gọi router Express của room. Trả { status, body }.
function dispatchExpress(router, method, urlPath, body, query) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (status, payload) => {
      if (settled) return;
      settled = true;
      resolve({ status, body: payload });
    };
    const headers = { 'content-type': 'application/json' };
    const req = {
      method,
      url: urlPath,
      originalUrl: urlPath,
      headers,
      query: query || {},
      body: body === undefined ? {} : body,
      _body: true, // body đã có sẵn — body-parser của game bỏ qua
      params: {},
      get(name) { return headers[String(name).toLowerCase()]; },
      header(name) { return this.get(name); },
      ip: '127.0.0.1',
      protocol: 'http',
      secure: false,
    };
    const res = mockRes(done);
    try {
      router.handle(req, res, () => done(404, { error: 'not found' }));
    } catch (e) {
      done(500, { error: e.message });
    }
    // Phòng route không trả gì (vd. SSE): trả về sau 1s thay vì treo.
    setTimeout(() => done(200, { dispatched: true }), 1000).unref();
  });
}

// Gọi handleRequest thô của game bản đồ. Trả { status, body }.
function dispatchRaw(handleRequest, method, urlPath, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from([payload]);
  req.method = method;
  req.url = urlPath;
  req.originalUrl = urlPath;
  req.headers = { 'content-type': 'application/json' };
  return new Promise((resolve) => {
    let settled = false;
    let status = 200;
    const chunks = [];
    const done = (s, payloadOut) => {
      if (settled) return;
      settled = true;
      resolve({ status: s, body: payloadOut });
    };
    const res = {
      writeHead(code) { status = code; },
      setHeader() {},
      write(c) {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
        return true;
      },
      end(c) {
        if (c !== undefined && c !== null) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch { /* giữ nguyên chuỗi */ }
        done(status, parsed);
      },
    };
    try {
      handleRequest(req, res);
    } catch (e) {
      done(500, { error: e.message });
    }
    setTimeout(() => done(status, { dispatched: true }), 1000).unref();
  });
}

module.exports = { dispatchExpress, dispatchRaw };
