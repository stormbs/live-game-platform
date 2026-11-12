// server.js — Nền tảng live-game host tập trung kiểu Livecade.
// Một service Node duy nhất:
//  - GET /                       trang chính: nhập TikTok username + chọn game -> lấy link overlay
//  - GET /o/<game>/<username>    overlay 1080x1920 của room (dán vào TikTok LIVE Studio)
//  - GET /huong-dan-tikfinity    bài hướng dẫn cài đặt TikFinity (tạo Action bằng tay;
//                                ?game=<game>&username=<user> để hiện đúng link webhook của phòng)
//  - GET /room/<game>/<username> dashboard của streamer (cài đặt, event thử, reset)
//  - POST /api/rooms             tạo room, trả link overlay
//  - GET /api/rooms/:game/:username/status   trạng thái LIVE của room
//  - GET /healthz                kiểm tra sống (Render health check)
// Mỗi room là một engine riêng (state/timer/file tách biệt) + một Socket.io
// riêng + một kết nối TikTok LIVE riêng. Event TikTok đi thẳng vào engine
// của room (gọi trực tiếp, không qua webhook vòng lại).
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { RoomManager } = require('./lib/rooms');
const { transformText } = require('./lib/transform');
const { mountBuffRoutes } = require('./lib/buff-routes');

const ROOT = __dirname;
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '8', 10);
const IDLE_MINUTES = parseInt(process.env.ROOM_IDLE_MINUTES || '30', 10);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function createApp(opts = {}) {
  const app = express();
  const server = http.createServer(app);
  // Socket.io chính ở path mặc định — chỉ để phục vụ file client
  // /socket.io/socket.io.js. Mỗi room có một Server riêng ở path của nó.
  const mainIo = new Server(server, { cors: { origin: '*' } });
  void mainIo;

  const rooms = new RoomManager({
    httpServer: server,
    root: ROOT,
    maxRooms: opts.maxRooms || MAX_ROOMS,
    idleMs: (opts.idleMinutes || IDLE_MINUTES) * 60 * 1000,
    tiktokEnabled: opts.tiktokEnabled !== false,
  });

  // ---- API buff tương tác (dịch vụ mạng xã hội, USDT) ----
  mountBuffRoutes(app);

  // ---- Trang chính + API của platform ----
  app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'public', 'landing.html'));
  });

  app.get('/healthz', (req, res) => {
    res.json({ ok: true, rooms: rooms.rooms.size, uptime: Math.round(process.uptime()) });
  });

  app.get('/api/games', (req, res) => {
    res.json(rooms.listGames().map((g) => ({ id: g.id, name: g.name })));
  });

  app.post('/api/rooms', express.json(), async (req, res) => {
    const { game, username } = req.body || {};
    try {
      const room = await rooms.getOrCreate(game, username);
      res.json({ ok: true, ...rooms.status(room) });
    } catch (e) {
      res.status(e.code === 'ROOM_FULL' ? 503 : 400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/rooms/:game/:username/status', (req, res) => {
    const room = rooms.get(req.params.game, req.params.username);
    if (!room) {
      return res.json({
        exists: false,
        game: req.params.game,
        username: req.params.username,
        tiktok: { state: 'idle', detail: '' },
      });
    }
    res.json(rooms.status(room));
  });

  // ---- Bài hướng dẫn cài đặt TikFinity (tạo Action bằng tay) ----
  // Trang độc lập, không cần tạo room. ?game=<game>&username=<user> để hiện
  // đúng link webhook của phòng đó; không có query thì hiện trang chung
  // (giải thích link riêng + chọn game + bảng body cả 3 game).
  // Quyết định 2026-11-12: KHÔNG làm file .tfc nữa (định dạng export của
  // TikFinity được mã hóa, mật khẩu không công khai) — chỉ hướng dẫn tay.
  app.get('/huong-dan-tikfinity', (req, res) => {
    const { buildGuideHtml } = require('./lib/guide');
    const { publicBaseUrl } = require('./lib/webhook-bodies');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buildGuideHtml({
      game: req.query.game,
      username: req.query.username,
      baseUrl: publicBaseUrl(req),
    }));
  });

  // ---- Dispatcher cho room ----
  // Express đã cắt prefix /o/<game>/<username> (hoặc /room/...) khỏi req.url
  // trước khi gọi middleware này, nên engine của room thấy đúng đường dẫn
  // gốc như khi chạy localhost (vd. /api/webhook, /overlay.html).
  async function roomDispatcher(kind, req, res, next) {
    const { game, username } = req.params;
    let room;
    try {
      room = await rooms.getOrCreate(game, username);
    } catch (e) {
      const code = e.code === 'ROOM_FULL' ? 503 : 400;
      return res.status(code).send(
        `<h1>Không tạo được room</h1><p>${escapeHtml(e.message)}</p><p><a href="/">Quay lại trang chính</a></p>`,
      );
    }
    room.touch();

    let rel = req.url || '/';
    const q = rel.indexOf('?');
    let relPath = (q >= 0 ? rel.slice(0, q) : rel) || '/';
    if (relPath === '/') relPath = kind === 'room' ? `/${room.info.dashboardFile}` : `/${room.info.overlayFile}`;
    if (relPath === '/dashboard') relPath = `/${room.info.dashboardFile}`;

    // Ảnh khung custom của Vẽ Avatar: lưu trong data riêng của room.
    if (relPath.startsWith('/assets/frames/')) {
      const f = path.join(room.dataDir, 'frames', decodeURIComponent(relPath.slice('/assets/frames/'.length)));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return res.sendFile(f);
      return res.status(404).send('not found');
    }

    // File text (html/js/css): đọc từ public của game, viết lại URL theo
    // prefix của room rồi gửi. File nhị phân để engine tự phục vụ.
    if (/\.(html|js|css)$/.test(relPath)) {
      const f = path.join(room.gameDir, 'public', decodeURIComponent(relPath));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        const text = fs.readFileSync(f, 'utf8');
        const out = transformText(text, room.prefix);
        const type = relPath.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : relPath.endsWith('.js')
            ? 'text/javascript; charset=utf-8'
            : 'text/html; charset=utf-8';
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'no-store');
        return res.send(out);
      }
    }

    // Còn lại: API, static, SSE... để engine của room tự xử lý.
    try {
      if (room.engine.type === 'raw') {
        room.engine.handleRequest(req, res);
      } else {
        room.router(req, res, next);
      }
    } catch (e) {
      next(e);
    }
  }

  app.use('/o/:game/:username', (req, res, next) => roomDispatcher('overlay', req, res, next));
  app.use('/room/:game/:username', (req, res, next) => roomDispatcher('room', req, res, next));

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[platform]', err && err.message);
    res.status(500).json({ error: 'internal error' });
  });

  return { app, server, rooms };
}

function start(port) {
  const { app, server, rooms } = createApp();
  const p = port || parseInt(process.env.PORT || '3000', 10);
  server.listen(p, () => {
    console.log(`live-game-platform chạy tại http://localhost:${p} (tối đa ${MAX_ROOMS} room, hủy room sau ${IDLE_MINUTES} phút không có người xem)`);
  });
  return { app, server, rooms };
}

if (require.main === module) start();

module.exports = { createApp, start };
