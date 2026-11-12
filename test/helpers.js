// test/helpers.js — Dụng cụ dùng chung cho test: khởi động server thật trên
// cổng tạm, tiktokEnabled=false để không nối TikTok khi test.
'use strict';

const { createApp } = require('../server');

async function startTestServer(opts = {}) {
  const { app, server, rooms } = createApp({
    tiktokEnabled: false,
    maxRooms: opts.maxRooms || 20,
    idleMinutes: 60,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, server, rooms, app };
}

async function stopTestServer(t) {
  for (const room of [...t.rooms.rooms.values()]) t.rooms.destroy(room);
  await new Promise((resolve) => t.server.close(resolve));
}

async function fetchJson(base, path, opts) {
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { res, status: res.status, text, json };
}

module.exports = { startTestServer, stopTestServer, fetchJson };
