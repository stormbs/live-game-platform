// test/no-tikfinity.test.js — Luật "chỉ kết nối trực tiếp": không file
// dashboard/overlay/landing HTML nào được nhắc tới phần mềm trung gian cũ
// (TikFinity) — người dùng chỉ cần dán link overlay vào TikTok LIVE Studio
// và Go LIVE. Quét cả file nguồn lẫn file public được serve (transform.js
// chỉ viết lại URL, không xóa chữ — nên quét file gốc là đủ).
// Lưu ý: code comment trong engine.js/server.js giải thích định dạng cũ
// được giữ (không hiện UI) nên test này KHÔNG quét *.js.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function collectHtml(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectHtml(full, out);
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  }
}

test('no-tikfinity: dashboard/overlay/landing HTML không chứa "TikFinity"', () => {
  const files = [];
  // Dashboard + overlay của 3 game (cả bản src và bản public được serve).
  for (const game of ['ve-avatar', 'buong-giam', 'thap-sang-ban-do']) {
    collectHtml(path.join(ROOT, 'games', game, 'src'), files);
  }
  // Trang chính nền tảng (người dùng nhìn thấy đầu tiên).
  files.push(path.join(ROOT, 'public', 'landing.html'));

  assert.ok(files.length >= 7, `cần quét ít nhất 7 file HTML, thấy ${files.length}`);
  const bad = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const idx = text.toLowerCase().indexOf('tikfinity');
    if (idx >= 0) {
      const line = text.slice(0, idx).split('\n').length;
      bad.push(`${path.relative(ROOT, f)}:${line}`);
    }
  }
  assert.deepEqual(bad, [], `còn nhắc TikFinity trong HTML: ${bad.join(', ')}`);
});
