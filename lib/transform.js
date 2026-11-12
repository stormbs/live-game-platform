// lib/transform.js — Viết lại URL trong HTML/JS/CSS của game để chạy dưới
// prefix của room (/o/<game>/<username>) thay vì gốc của máy chủ.
// Game gốc viết mọi đường dẫn dạng tuyệt đối từ gốc (/api/..., /assets/...,
// io() nối Socket.io ở gốc) vì hồi đó mỗi game chạy một server riêng.
// Ở nền tảng này nhiều room chung một máy chủ nên phải gắn prefix vào:
//  - io()            -> io({ path: '<prefix>/socket.io' }) (Socket.io riêng từng room)
//  - '/api/...'      -> '<prefix>/api/...' (state, webhook, tts, test...)
//  - '/assets/...', '/voice/...', '/music/...', '/avatars/...', '/audio/...',
//    '/provinces.json', '/islands.json', '/overlay.html', '/dashboard', ...
//    -> gắn prefix tương tự.
//  - url(/assets/...) trong CSS -> gắn prefix.
// Không chạm tới URL ngoài (https://...) hay đường dẫn tương đối.
'use strict';

const TEXT_PATHS = ['/api/', '/provinces.json', '/islands.json', '/assets/', '/voice/',
  '/music/', '/avatars/', '/audio/', '/css/', '/js/', '/overlay.html',
  '/index.html', '/dashboard', '/socket.io/'];

function transformText(text, prefix) {
  let out = String(text);
  // Socket.io: nối đúng namespace đường dẫn của room.
  out = out.replace(/\bio\(\)/g, `io({ path: '${prefix}/socket.io' })`);
  // Đường dẫn tuyệt đối trong chuỗi '...' "..." `...`
  out = out.replace(/(['"`])\/(socket\.io|api|provinces\.json|islands\.json|assets|voice|music|avatars|audio|css|js|overlay\.html|index\.html|dashboard)(?=[/?'"`#])/g,
    `$1${prefix}/$2`);
  // url(/assets/...) trong CSS.
  out = out.replace(/url\(\s*\/(assets|voice|music|avatars|audio|css|js)\//g, `url(${prefix}/$1/`);
  return out;
}

module.exports = { transformText, TEXT_PATHS };
