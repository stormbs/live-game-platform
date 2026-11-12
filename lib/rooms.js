// lib/rooms.js — Quản lý các room (một room = một game + một TikTok username).
// Mỗi room chạy một engine riêng (state, timer, file dữ liệu đều tách biệt),
// một Socket.io riêng, một kết nối TikTok LIVE riêng.
// Room tự hủy sau một lúc không còn người xem (mặc định 30 phút) để đỡ tốn
// RAM trên gói Render free.
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { pathToFileURL } = require('url');
const { normalizeUsername, isValidUsername, roomKey } = require('./normalize');
const { dispatchExpress, dispatchRaw } = require('./dispatch');
const { toWebhookEvent, createTikTokLink } = require('./tiktok');

const GAMES = {
  've-avatar': {
    id: 've-avatar',
    name: 'Vẽ Avatar',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
  'buong-giam': {
    id: 'buong-giam',
    name: 'Buồng Giam',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
  'thap-sang-ban-do': {
    id: 'thap-sang-ban-do',
    name: 'Thắp Sáng Bản Đồ Việt Nam',
    engineFile: 'engine.mjs',
    dashboardFile: 'dashboard.html',
    overlayFile: 'overlay.html',
  },
  'vuon-hoa-mua-xuan': {
    id: 'vuon-hoa-mua-xuan',
    name: 'Vườn Hoa Mùa Xuân',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
  'bep-an-tap-the': {
    id: 'bep-an-tap-the',
    name: 'Bếp Ăn Tập Thể – Nấu Cỗ',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
  'dua-xe-leo-nui': {
    id: 'dua-xe-leo-nui',
    name: 'Đua Xe Leo Núi',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
  'vong-quay-may-man': {
    id: 'vong-quay-may-man',
    name: 'Vòng Quay May Mắn Khổng Lồ',
    engineFile: 'engine.js',
    dashboardFile: 'index.html',
    overlayFile: 'overlay.html',
  },
};

class RoomManager {
  constructor(opts) {
    this.httpServer = opts.httpServer;
    this.root = opts.root; // thư mục gốc của platform
    this.dataRoot = opts.dataRoot || path.join(this.root, 'data', 'rooms');
    this.maxRooms = opts.maxRooms || 8;
    this.idleMs = opts.idleMs || 30 * 60 * 1000;
    this.tiktokEnabled = opts.tiktokEnabled !== false;
    this.rooms = new Map();
    this.sweepTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  gameInfo(game) {
    return GAMES[game] || null;
  }

  listGames() {
    return Object.values(GAMES);
  }

  get(game, username) {
    const u = normalizeUsername(username);
    return this.rooms.get(roomKey(game, u)) || null;
  }

  async getOrCreate(game, rawUsername) {
    const info = this.gameInfo(game);
    if (!info) {
      const e = new Error(`Game không tồn tại: ${game}`);
      e.code = 'BAD_GAME';
      throw e;
    }
    const username = normalizeUsername(rawUsername);
    if (!isValidUsername(username)) {
      const e = new Error(`TikTok username không hợp lệ: ${rawUsername}`);
      e.code = 'BAD_USERNAME';
      throw e;
    }
    const key = roomKey(game, username);
    const existing = this.rooms.get(key);
    if (existing) {
      existing.touch();
      return existing;
    }
    if (this.rooms.size >= this.maxRooms) {
      const e = new Error(`Máy chủ đang đầy (${this.maxRooms} room). Thử lại sau.`);
      e.code = 'ROOM_FULL';
      throw e;
    }

    const prefix = `/o/${game}/${username}`;
    const gameDir = path.join(this.root, 'games', game, 'src');
    const dataDir = path.join(this.dataRoot, `${game}-${username}`, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    // Game bản đồ đọc config.json từ data của room; copy bản mặc định nếu chưa có.
    if (game === 'thap-sang-ban-do') {
      const cfgDst = path.join(dataDir, 'config.json');
      if (!fs.existsSync(cfgDst)) {
        fs.copyFileSync(path.join(gameDir, 'config.json'), cfgDst);
      }
    }

    const io = new Server(this.httpServer, {
      path: `${prefix}/socket.io`,
      cors: { origin: '*' },
    });
    const ctx = {
      router: express.Router(),
      io,
      dataDir,
      gameDir,
      roomPrefix: prefix,
      dead: false,
    };
    const enginePath = path.join(this.root, 'games', game, info.engineFile);
    let createEngine;
    if (info.engineFile.endsWith('.mjs')) {
      createEngine = (await import(pathToFileURL(enginePath).href)).default;
    } else {
      createEngine = require(enginePath);
    }
    const engine = createEngine(ctx);

    const room = {
      game,
      username,
      key,
      prefix,
      info,
      engine,
      io,
      router: ctx.router,
      dataDir,
      gameDir,
      createdAt: Date.now(),
      lastHttpAt: Date.now(),
      overlayClients: 0,
      tiktokState: 'idle',
      tiktokDetail: '',
      tiktok: null,
      touch() { this.lastHttpAt = Date.now(); },
      activity() {
        const sse = (engine.type === 'raw' && typeof engine.sseCount === 'function')
          ? engine.sseCount() : 0;
        return { sockets: this.overlayClients, sse, lastHttpAt: this.lastHttpAt };
      },
    };

    io.on('connection', (socket) => {
      room.overlayClients += 1;
      room.touch();
      socket.on('disconnect', () => {
        room.overlayClients = Math.max(0, room.overlayClients - 1);
        room.touch();
      });
    });

    // Các game mới (và Vẽ Avatar) mặc định bật "chế độ thử" (bỏ qua event
    // thật) để test tay. Room trên nền tảng là room live thật nên tắt chế
    // độ thử ngay khi tạo; streamer vẫn bật lại được trong dashboard của
    // room nếu muốn test.
    if (['ve-avatar', 'vuon-hoa-mua-xuan', 'bep-an-tap-the', 'dua-xe-leo-nui', 'vong-quay-may-man', 'bau-troi-phao-hoa'].includes(game)) {
      try {
        await dispatchExpress(ctx.router, 'POST', '/api/settings', { demoMode: false }, {});
      } catch {}
    }

    if (this.tiktokEnabled) {
      const link = createTikTokLink(
        username,
        (type, data) => {
          const ev = toWebhookEvent(game, type, data);
          if (ev) this.dispatchWebhook(room, ev).catch(() => {});
        },
        (state, detail) => {
          room.tiktokState = state;
          room.tiktokDetail = detail || '';
        },
      );
      room.tiktok = link;
      link.start();
    }

    this.rooms.set(key, room);
    return room;
  }

  // Đưa event (dạng webhook của game) vào engine của room.
  async dispatchWebhook(room, body) {
    if (room.engine.type === 'raw') {
      return dispatchRaw(room.engine.handleRequest, 'POST', '/api/webhook', body);
    }
    return dispatchExpress(room.router, 'POST', '/api/webhook', body, {});
  }

  async getState(room) {
    if (room.engine.type === 'raw') {
      return dispatchRaw(room.engine.handleRequest, 'GET', '/api/state');
    }
    return dispatchExpress(room.router, 'GET', '/api/state', undefined, {});
  }

  destroy(room) {
    try { if (room.tiktok) room.tiktok.stop(); } catch {}
    try { room.engine.destroy(); } catch {}
    try { room.io.close(); } catch {}
    this.rooms.delete(room.key);
  }

  // Hủy room khi không còn client nào (overlay/dashboard/SSE) quá idleMs.
  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.createdAt < 5 * 60 * 1000) continue; // mới tạo, đừng vội hủy
      const a = room.activity();
      if (a.sockets === 0 && a.sse === 0 && now - a.lastHttpAt > this.idleMs) {
        this.destroy(room);
      }
    }
  }

  status(room) {
    return {
      exists: true,
      game: room.game,
      username: room.username,
      overlayUrl: room.prefix,
      roomUrl: `/room/${room.game}/${room.username}`,
      tiktok: { state: room.tiktokState, detail: room.tiktokDetail },
      overlayClients: room.overlayClients,
      createdAt: room.createdAt,
      lastHttpAt: room.lastHttpAt,
    };
  }
}

module.exports = { RoomManager, GAMES };
