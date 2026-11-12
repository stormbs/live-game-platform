// scripts/build-engines.js — Sinh engine đa-room cho nền tảng live-game từ code gốc.
// Đọc code gốc của 3 game (vendor vào games/<game>/src/), rồi sinh ra
// games/<game>/engine.js (.mjs cho game bản đồ vì source gốc là ESM) dạng
// factory createEngine(ctx) — mỗi lần gọi là một room độc lập, state không
// chia sẻ với room khác. KHÔNG sửa code gốc: mọi thay đổi nằm trong file
// engine đã sinh, có ghi chú rõ. Chạy lại sau mỗi lần cập nhật code gốc:
//   npm run build
// Kiểm tra: mỗi pattern thay thế đều phải khớp đúng số lần dự kiến, nếu
// không khớp thì dừng và báo lỗi (code gốc đã đổi thì phải xem lại tay).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GAMES = [
  {
    id: 've-avatar',
    name: 'Vẽ Avatar',
    srcDir: '/tmp/ve-avatar',
    type: 'cjs',
    engineFile: 'engine.js',
  },
  {
    id: 'buong-giam',
    name: 'Buồng Giam',
    srcDir: '/tmp/buong-giam',
    type: 'cjs',
    engineFile: 'engine.js',
  },
  {
    id: 'thap-sang-ban-do',
    name: 'Thắp Sáng Bản Đồ Việt Nam',
    srcDir: '/home/hatch/workspace/game-thap-sang-ban-do',
    type: 'esm',
    engineFile: 'engine.mjs',
  },
];

// Thư mục/file KHÔNG vendor vào repo (test, script chạy tay, dữ liệu tạm).
const VENDOR_SKIP = [
  'node_modules', '.git', 'data',
  'scripts', // buong-giam: script đồng bộ avatar / cầu nối chạy tay, server không require
  'test_',
  'audit_suite.js', 'populate_test_state.js',
  'CHAY_VE_AVATAR.bat', 'CHAY_BUONG_GIAM.bat', 'start.bat',
  'gen-music.py', 'gen-voice.py', 'gen-voice-gtts.py',
  'server.log',
];
function vendorSkip(rel) {
  const base = path.basename(rel);
  if (VENDOR_SKIP.some((s) => rel === s || rel.startsWith(s + '/') || base === s)) return true;
  if (base.startsWith('_tmp_')) return true;
  if (base.startsWith('media-generation-') && base.endsWith('.json')) return true;
  if (base.endsWith('.log')) return true;
  if (/^test_.*\.js$/.test(base)) return true;
  return false;
}

function copyTree(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = entry.name;
    if (vendorSkip(rel)) continue;
    const s = path.join(srcDir, rel);
    const d = path.join(dstDir, rel);
    if (entry.isDirectory()) copyTree(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

// Thay thế bắt buộc: pattern phải khớp đúng `count` lần, nếu không thì lỗi.
function mustReplace(text, pattern, replacement, count, label) {
  const re = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g') : null;
  let found = 0;
  let out;
  if (re) {
    out = text.replace(re, (m) => { found += 1; return typeof replacement === 'function' ? replacement(m) : replacement; });
  } else {
    const parts = text.split(pattern);
    found = parts.length - 1;
    out = parts.join(replacement);
  }
  if (found !== count) {
    throw new Error(`[${label}] pattern khớp ${found} lần, cần đúng ${count} lần: ${String(pattern).slice(0, 120)}`);
  }
  return out;
}

const FACTORY_HEAD = `function createEngine(ctx) {
  // ctx do platform cấp mỗi room: { router, io, dataDir, gameDir, roomPrefix }
  // __dirname: trỏ về thư mục code gốc của game (đọc asset tĩnh).
  const __dirname = ctx.gameDir;
  // Theo dõi timer để hủy room dọn sạch (game gốc dùng setInterval/setTimeout
  // khắp nơi: autosave, phát voice, dọn user idle...). Nếu room đã chết thì
  // không cho đặt timer mới nữa (chặn vòng lặp tự hẹn giờ như StreamerBot).
  const __timers = new Set();
  const setInterval = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setInterval(fn, ms, ...a);
    __timers.add(id);
    return id;
  };
  const setTimeout = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setTimeout(fn, ms, ...a);
    __timers.add(id);
    return id;
  };
  const clearInterval = (id) => { __timers.delete(id); return global.clearInterval(id); };
  const clearTimeout = (id) => { __timers.delete(id); return global.clearTimeout(id); };
`;

const DESTROY_METHOD = `
    destroy() {
      // Dừng mọi timer của room để tiến trình platform không bị giữ sống.
      ctx.dead = true;
      for (const id of __timers) {
        try { global.clearTimeout(id); } catch {}
        try { global.clearInterval(id); } catch {}
      }
      __timers.clear();
    },
`;

function buildCjs(game, srcServer) {
  let body = srcServer;
  // Router + Socket.io của room (do platform cấp) thay cho app/server riêng.
  body = mustReplace(body, 'const app = express();', 'const app = ctx.router;', 1, game.id);
  body = mustReplace(body, 'const server = http.createServer(app);', '', 1, game.id);
  body = mustReplace(body, /const io = new Server\(server, \{[\s\S]*?\}\);/, 'const io = ctx.io;', 1, game.id);
  // Dữ liệu phiên (settings/session/cache) tách riêng từng room.
  body = mustReplace(body, "const DATA_DIR = path.join(__dirname, 'data');", 'const DATA_DIR = ctx.dataDir;', 1, game.id);

  if (game.id === 've-avatar') {
    // Ảnh khung custom: lưu vào data của room, URL trả về mang prefix của room
    // (state trả qua API nên HTML transform không chạm tới được).
    body = mustReplace(body, "const FRAMES_DIR = path.join(__dirname, 'public', 'assets', 'frames');",
      "const FRAMES_DIR = path.join(ctx.dataDir, 'frames');", 1, game.id);
    body = mustReplace(body, 'frames[t].customImage = `/assets/frames/${fileName}?v=${Date.now()}`;',
      'frames[t].customImage = `${ctx.roomPrefix}/assets/frames/${fileName}?v=${Date.now()}`;', 1, game.id);
    // Bỏ server.listen — engine chạy trong tiến trình platform; giữ lại
    // pumpQueue() vốn được gọi khi server bắt đầu lắng nghe.
    body = mustReplace(body, `server.listen(PORT, () => {
  console.log(\`[VE-AVATAR] Bảng điều khiển http://localhost:\${PORT} | Màn hình live http://localhost:\${PORT}/overlay.html\`);
  pumpQueue();
});`, 'pumpQueue(); // (platform) bỏ server.listen — engine chạy trong tiến trình platform', 1, game.id);
  }

  if (game.id === 'buong-giam') {
    // Avatar cache /avatars/*.webp là cache chung (đọc file đã có); URL trong
    // state và redirect phải mang prefix của room để overlay tải đúng.
    body = mustReplace(body, '`/avatars/', '`${ctx.roomPrefix}/avatars/', 10, game.id);
    body = mustReplace(body, "startsWith('/avatars/')", "startsWith(ctx.roomPrefix + '/avatars/')", 1, game.id);
    body = mustReplace(body, "'/assets/default_avatar.png'", "'${ctx.roomPrefix}/assets/default_avatar.png'", 1, game.id);
    // Bỏ toàn bộ đoạn cuối file: startServer + server3002 dự phòng (cổng
    // 3002 cố định sẽ đụng nhau khi có nhiều room; platform không cần).
    const lines = body.split('\n');
    const cutIdx = lines.findIndex((l) => l.trim() === '// START SERVER');
    if (cutIdx < 0) throw new Error(`[${game.id}] không tìm thấy '// START SERVER' để cắt đuôi file`);
    body = lines.slice(0, cutIdx).join('\n');
  }

  const head = `// GENERATED — đừng sửa tay. Sinh từ code gốc bằng: npm run build
// Nguồn: ${game.srcDir}/server.js
// Thay đổi so với bản gốc (giữ nguyên luật chơi):
//  - Toàn bộ code gốc nằm trong createEngine(ctx): mỗi lần gọi là 1 room
//    mới, state (gameState/session/settings/timer) không chia sẻ.
//  - app/io/server riêng được thay bằng ctx.router / ctx.io của platform.
//  - DATA_DIR trỏ về thư mục data riêng của room.
//  - Timer được theo dõi để hủy room dọn sạch.
'use strict';

`;
  const tail = `
  return {
    type: 'express',
    router: app,
    io,
${DESTROY_METHOD}  };
}
`;
  const out = head + FACTORY_HEAD + body + tail + '\nmodule.exports = createEngine;\n';
  return out;
}

function buildEsm(game, srcServer) {
  // Giữ nguyên các dòng import ở đầu module (ESM bắt buộc), còn lại đưa vào factory.
  const lines = srcServer.split('\n');
  let lastImport = -1;
  lines.forEach((l, i) => { if (/^import\s/.test(l)) lastImport = i; });
  if (lastImport < 0) throw new Error(`[${game.id}] không tìm thấy dòng import`);
  const top = lines.slice(0, lastImport + 1).join('\n');
  let body = lines.slice(lastImport + 1).join('\n');

  body = mustReplace(body, 'const __dirname = path.dirname(fileURLToPath(import.meta.url));', '', 1, game.id);
  body = mustReplace(body, "const CONFIG_PATH = path.join(ROOT, 'config.json');",
    "const CONFIG_PATH = path.join(ctx.dataDir, 'config.json');", 1, game.id);
  body = mustReplace(body, "const VOICE_CACHE_DIR = path.join(PUBLIC, 'voice', 'cache');",
    "const VOICE_CACHE_DIR = path.join(ctx.dataDir, 'voice-cache');", 1, game.id);
  body = mustReplace(body, "const url = '/voice/cache/' + file;", "const url = ctx.roomPrefix + '/voice/cache/' + file;", 2, game.id);
  body = mustReplace(body, 'const server = http.createServer(async (req, res) => {',
    'const handleRequest = async (req, res) => {', 1, game.id);
  body = mustReplace(body, `});

server.listen(config.port, () => {
  log('server', \`Thắp Sáng Bản Đồ chạy tại http://localhost:\${config.port}/ (overlay) và /dashboard\`);
});`, '};', 1, game.id);

  const head = `// GENERATED — đừng sửa tay. Sinh từ code gốc bằng: npm run build
// Nguồn: ${game.srcDir}/server.js
// Thay đổi so với bản gốc (giữ nguyên luật chơi):
//  - Toàn bộ code gốc nằm trong createEngine(ctx): mỗi lần gọi là 1 room
//    mới, state (game/config/timer/SSE) không chia sẻ.
//  - http.createServer riêng được thay bằng handleRequest do platform gọi.
//  - CONFIG_PATH + VOICE_CACHE_DIR trỏ về thư mục data riêng của room.
//  - URL voice cache trả về mang prefix của room.
//  - Timer được theo dõi để hủy room dọn sạch.
`;
  const tail = `
  return {
    type: 'raw',
    handleRequest,
    // Số client SSE đang mở — platform dùng để biết room còn người xem không.
    sseCount() { return sseClients.size; },
${DESTROY_METHOD}  };
}
`;
  return head + top + '\n' + FACTORY_HEAD + body + tail + '\nexport default createEngine;\n';
}

function checkSyntax(file) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`Lỗi cú pháp ${file}:\n${r.stderr || r.stdout}`);
  }
}

function main() {
  const report = [];
  for (const game of GAMES) {
    const gameDir = path.join(ROOT, 'games', game.id);
    const srcDir = path.join(gameDir, 'src');
    // 1. Vendor code gốc vào games/<game>/src/
    fs.rmSync(srcDir, { recursive: true, force: true });
    copyTree(game.srcDir, srcDir);
    // 2. Sinh engine từ src/server.js
    const srcServer = fs.readFileSync(path.join(srcDir, 'server.js'), 'utf8');
    const engine = game.type === 'cjs' ? buildCjs(game, srcServer) : buildEsm(game, srcServer);
    const enginePath = path.join(gameDir, game.engineFile);
    fs.writeFileSync(enginePath, engine, 'utf8');
    checkSyntax(enginePath);
    report.push(`${game.id}: src vendor xong, ${game.engineFile} đã sinh + kiểm tra cú pháp OK (${engine.split('\n').length} dòng)`);
  }
  console.log(report.join('\n'));
  console.log('Xong. Chạy "npm test" để kiểm tra các room.');
}

main();
