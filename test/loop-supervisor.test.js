// test/loop-supervisor.test.js — Test supervisor child process thật:
// SIGKILL parent không trả /healthz, tự thoát khi parent chết trước, và
// end-to-end: server thật bị SIGSTOP -> supervisor SIGKILL trong 30s.
// Đây là test còn thiếu ở thiết kế watchdog cũ: test cũ chỉ stub exit,
// chưa bao giờ đóng băng một process thật rồi kiểm tra nó có chết không.
//
// Bỏ qua test SIGSTOP trên Windows (không có SIGSTOP/SIGKILL).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const SUPERVISOR = path.join(__dirname, '..', 'lib', 'loop-supervisor.js');
const REPO_ROOT = path.join(__dirname, '..');

async function freePort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}

async function waitFor(cond, timeoutMs, stepMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return cond();
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('supervisor SIGKILL parent không trả /healthz rồi tự thoát', async () => {
  // Tiến trình giả làm parent: sống 120s, không phục vụ HTTP gì cả.
  const parent = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 120000)'], { stdio: 'ignore' });
  const port = await freePort(); // không ai nghe -> mọi poll đều miss
  let sup;
  let supErr = '';
  try {
    sup = spawn(process.execPath, [SUPERVISOR, String(parent.pid), String(port), '200', '300', '600', '500'], { stdio: 'pipe' });
    sup.stderr.on('data', (d) => { supErr += d.toString(); });
    // Ân hạn 300ms + miss 600ms + nhịp poll 200ms -> parent phải chết trong ~5s.
    const parentDead = await waitFor(() => !pidAlive(parent.pid), 8000);
    assert.ok(parentDead, 'supervisor phải SIGKILL parent không trả /healthz');
    const supExited = await waitFor(() => sup.exitCode !== null, 5000);
    assert.ok(supExited, 'supervisor phải tự thoát sau khi giết parent');
    assert.equal(sup.exitCode, 0);
    assert.match(supErr, /SIGKILL/, 'log supervisor phải ghi rõ đã SIGKILL');
  } finally {
    try { parent.kill('SIGKILL'); } catch {}
    try { sup && sup.kill('SIGKILL'); } catch {}
  }
});

test('supervisor tự thoát khi parent chết trước (không thành orphan)', async () => {
  const parent = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 120000)'], { stdio: 'ignore' });
  const port = await freePort();
  // Server nhỏ trả 200 /healthz để supervisor không giết parent.
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  let sup;
  try {
    sup = spawn(process.execPath, [SUPERVISOR, String(parent.pid), String(port), '200', '1000', '5000', '500'], { stdio: 'pipe' });
    await new Promise((r) => setTimeout(r, 1200)); // để supervisor poll thành công vài lần
    assert.equal(sup.exitCode, null, 'supervisor phải còn sống khi parent còn sống và /healthz trả 200');
    parent.kill('SIGTERM');
    const supExited = await waitFor(() => sup.exitCode !== null, 5000);
    assert.ok(supExited, 'parent chết thì supervisor phải tự thoát, không chạy mồ côi');
    assert.equal(sup.exitCode, 0);
  } finally {
    try { parent.kill('SIGKILL'); } catch {}
    try { sup && sup.kill('SIGKILL'); } catch {}
    await new Promise((r) => srv.close(r));
  }
});

test('supervisor tham số sai -> thoát code 2, không giết nhầm ai', async () => {
  const bad = spawn(process.execPath, [SUPERVISOR, 'khong-phai-so', '99999'], { stdio: 'pipe' });
  let err = '';
  bad.stderr.on('data', (d) => { err += d.toString(); });
  const code = await new Promise((resolve) => bad.once('exit', resolve));
  assert.equal(code, 2);
  assert.match(err, /tham số sai/);
});

test('end-to-end: server thật bị SIGSTOP -> supervisor SIGKILL trong 30s', async (t) => {
  if (process.platform === 'win32') {
    t.skip('SIGSTOP không có trên Windows');
    return;
  }
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    LOOP_SUPERVISOR_POLL_MS: '500',
    LOOP_SUPERVISOR_GRACE_MS: '2000',
    LOOP_SUPERVISOR_MAX_MISSED_MS: '3000',
    LOOP_SUPERVISOR_HEALTHZ_TIMEOUT_MS: '1000',
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const drain = (d) => {
    out += d.toString();
    if (out.length > 4000) out = out.slice(-4000);
  };
  child.stdout.on('data', drain);
  child.stderr.on('data', drain);
  try {
    // Đợi server lên và watchdog báo active.
    let healthy = false;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        const json = await res.json();
        if (res.status === 200 && json.watchdog === 'active') { healthy = true; break; }
      } catch { /* chưa lên, thử lại */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(healthy, `server phải lên và watchdog active; log:\n${out}`);

    // Đóng băng toàn bộ process (tương đương event loop treo cứng).
    child.kill('SIGSTOP');
    const exited = await new Promise((resolve) => {
      const to = setTimeout(() => resolve(false), 30000);
      child.once('exit', () => { clearTimeout(to); resolve(true); });
    });
    assert.ok(exited, `supervisor phải SIGKILL server bị đóng băng trong 30s; log:\n${out}`);
    assert.equal(child.signalCode, 'SIGKILL', 'server phải chết bởi SIGKILL từ supervisor');
  } finally {
    try { child.kill('SIGKILL'); } catch {}
  }
});
