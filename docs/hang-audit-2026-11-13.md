# Audit: silent hangs of live-game-platform on Railway (2026-11-13)

Date: 2026-11-13 (audit run ~09:30 +07, after the third hang)
Repo: `~/workspace/live-game-platform`, branch `main`
Scope: read-only audit. No code was changed, nothing committed/pushed/deployed.

## TL;DR

**Root cause (confirmed by code + two local reproductions): `RoomManager.destroy()`
calls `room.io.close()`, and Socket.IO `Server.close()` closes the HTTP server
it was attached to. Every room shares ONE `httpServer`, so the first time the
sweeper destroys an idle room, the platform's only HTTP listener dies. The
Node process stays alive with a healthy event loop — no crash, no OOM, no log
output — while Railway's proxy gets connection-refused on every route
(502 "Application failed to respond"). Manual Restart creates a fresh
container, which is why it always "fixed" it.**

**Second, independent bug (also confirmed): the event-loop watchdog
(`lib/loop-watchdog.js`, commit 6fbbccc) cannot work as designed.
`process.exit(1)` called inside a `worker_threads` worker terminates ONLY
that worker, not the process. The watchdog "fires", the worker dies with
code 1, and the frozen main process keeps running forever. This did not
cause these hangs (the loop was never frozen — see below), but it removes
the safety net for a genuine freeze.**

Fix order (highest value first): §5.

---

## 1. Evidence (verified facts used as input)

- Three silent hangs in one day, ~02:35, ~08:21, ~09:19 +07: every route
  (including `/healthz`) returned 502 "Application failed to respond";
  Railway dashboard kept showing ACTIVE/Online; no crash, no OOM, no
  restart. Manual Restart in the dashboard fixed it every time.
- Watchdog deployed 08:33 (commit 6fbbccc): worker pings main every 2s,
  no pong for 20s (after 60s grace) → `process.exit(1)`. It did NOT fire
  during the 09:19 hang. `/healthz` showed `watchdog:"active"` before
  and after (never readable *during* a hang — see §3.5).
- Railway logs for the 09:19 hang: startup 08:33:54, then ONLY one
  repeating line, 123× from 08:36:35 to 09:08:58 —
  `[AUTOSAVE ERROR]: ENOENT ... open '/app/games/buong-giam/src/data/session_state_autosave.json'` —
  then total silence until the manual restart at 09:22. Grepping logs for
  watchdog/unresponsive/exit/event-loop found nothing.
- ~08:36–08:38 the CEO's verification opened 7 demo overlay rooms
  (user `strom`: ve-avatar, buong-giam, thap-sang-ban-do, vuon-hoa-mua-xuan,
  bep-an-tap-the, dua-xe-leo-nui, vong-quay-may-man), filling the server to
  its 8-room cap (`MAX_ROOMS=8`). Rooms expire after 30 min idle
  (`ROOM_IDLE_MINUTES=30`). Last autosave error 09:08:58 ≈ 30 min after
  those rooms were created.
- Earlier hangs also fit the same clock: the 02:35 incident notes the app
  "hung silently ~01:30–01:31" with the last log at 01:29:46 — rooms
  created during verification ~00:15–01:00 hit 30-min idle at ~01:30.
- The autosave bug itself is ALREADY FIXED on main (later commit:
  `AUTOSAVE_FILE` in `games/buong-giam/engine.js` now uses `ctx.dataDir`
  instead of `__dirname/data`). Not re-fixed here.
- `games/buong-giam/engine.js` is GENERATED (header: source
  `/tmp/buong-giam/server.js`, which no longer exists). Regeneration is
  impossible; direct edits are the only path for that file.

## 2. Code read

- `lib/rooms.js` — `RoomManager`: one shared `httpServer`; each room gets
  its own Socket.IO `Server` attached to it (`new Server(this.httpServer,
  { path: prefix + '/socket.io' })`). `sweep()` every 5 min destroys rooms
  with no sockets/SSE and `lastHttpAt` older than `idleMs`, unless created
  < 5 min ago. `destroy(room)`: `room.tiktok.stop()`,
  `room.engine.destroy()`, **`room.io.close()`**, delete from map.
- `lib/loop-watchdog.js` — worker thread pings main every 2s; on 20s of
  missed pongs (after 60s grace) the worker calls `process.exit(1)`.
  `worker.on('exit')` sets `status='disabled'` + warns; `worker.on('error')`
  warns. `/healthz` reports `loopWatchdog.status`.
- `server.js` — no `uncaughtException`/`unhandledRejection` handlers.
  `createApp()` builds the watchdog handle; `start()` starts it after
  listen. `/healthz` is a plain Express route (needs a live listener AND
  a live loop to answer).
- `games/buong-giam/engine.js` — shadowed `setInterval`/`setTimeout`
  tracked in `__timers` (a `Set`); `destroy()` sets `ctx.dead = true`,
  then clears every id in `__timers`. No `while` loops anywhere in the
  file. Autosave is `setInterval(saveSessionAutosave, 10000)` — in the
  deployed build it wrote to the nonexistent `src/data/` path, hence the
  repeating ENOENT (one per tick).
- `lib/game-common.js` — same timer-tracking pattern (`withTimers`,
  `clearAll()` sets `ctx.dead`, clears the set). Same shape, same
  (non-)issue.
- `lib/buff-routes.js` — global intervals are all async (`refreshCatalog`
  every 6h, `watchdogOnce` every 15 min + once at 30s), all `unref()`'d.
  No sync block. `lib/buff-alert.js` auto-disables when the Telegram
  helper is absent (Railway). Not a freeze candidate.
- `lib/tiktok.js` — reconnect retry timer cleared on `stop()`; `stop()`
  is called in `destroy()`. Not a freeze candidate.
- `process.exit` appears nowhere else in the codebase except the watchdog.

## 3. Experiments (all local, bounded, in /tmp)

### 3.1 Experiment A — does the watchdog kill a frozen process? NO.

`/tmp/wd-test.js`: start watchdog (production `exitMode`), then busy-block
the main thread for 75 s (t=3 s → t=78 s). Worker grace ends ~t=60 s, so a
working watchdog must exit the process at ~t=60–62 s.

Observed (Node v24.22.1, `timeout 90 node wd-test.js`):

```text
t=0 watchdog started, status= active
t=3 BLOCKING main thread for 75s...
t=78 block finished (x=241927415) — WATCHDOG FAILED TO FIRE
EXIT_CODE=0
stderr: [loop-watchdog] worker đã dừng (code 1) — watchdog tắt.
```

The worker DID fire (it exited with code 1 — the only code-1 path in
`runWorkerLoop` is `process.exit(1)`), but the process survived, finished
the 75 s busy loop, and exited normally with code 0.

Minimal confirmation (`/tmp/wd-min.js` — a worker whose only job is
`process.exit(1)`):

```text
worker exited, code = 1
MAIN STILL ALIVE after 3s — process.exit() in a worker does NOT kill the process
```

**Conclusion: `process.exit()` inside a `worker_threads` worker terminates
only that worker. The watchdog's core mechanism is broken by design.**
Its 11 unit tests never caught this because they all use `exitMode:
'notify'` and stub the exit — no end-to-end test ever froze a real
process and checked that it died.

### 3.2 Experiment B — reproduce the 09:19 scenario: mass room destroy. SERVER DIED.

`/tmp/room-destroy-test.js`: start the platform locally (TikTok disabled),
create the same 7 rooms, start demo where possible, wait 90 s, force
`createdAt`/`lastHttpAt` back 31 min, call `rooms.sweep()`.

Observed (abridged):

```text
listening on 45357 watchdog: active
create ve-avatar -> 200 ... (7 rooms created)
rooms: 7 watchdog: active
healthz: {"ok":true,"rooms":7,"uptime":8,...,"watchdog":"active"}
waiting 90s for demo timers to accumulate...
healthz pre-sweep: {"ok":true,"rooms":7,"uptime":98,...}
SWEEP took 3 ms; rooms left: 0 watchdog: active
TEST ERROR [TypeError: fetch failed] { cause: Error: connect ECONNREFUSED 127.0.0.1:45357 }
```

The sweep took **3 ms** and destroyed all 7 rooms — destroy itself does
NOT freeze the loop. But the very next `GET /healthz` failed with
**ECONNREFUSED**: the HTTP server had stopped listening while the process
was still alive (the test script itself kept running). The only thing that
ran between the working pre-sweep healthz and the refused post-sweep
healthz was `rooms.sweep()` → `destroy()` → `room.io.close()`.

Fidelity caveat: only the map game's demo actually started in this test
(the other six returned 400 "Bật chế độ thử trước khi thử" — `rooms.js`
sets `demoMode:false` at creation and the curl-driven test could not flip
it the way a browser overlay does with `?demo=1`). The destroy path does
not depend on demo mode (the buong-giam autosave interval runs from engine
creation regardless), so this does not weaken the conclusion.

### 3.3 Experiment C — minimal isolation of `io.close()`.

`/tmp/io-close-test.js`: one HTTP server, two Socket.IO servers attached
on different paths; close one.

```text
before io1.close(): OK
after io1.close(): FAIL
```

Socket.IO 4.7.5 source (`node_modules/socket.io/dist/index.js`,
`Server.close()`, ~line 488–493) confirms why:

```js
this.engine.close();
// ...
if (this.httpServer) {
    this.httpServer.close(fn);   // <-- closes the SHARED http server
}
```

By contrast, engine.io 6.5.5 `Server.close()` only closes clients +
`cleanup()` — it never touches the HTTP server. So
`room.io.engine.close()` closes just that room's sockets, while
`room.io.close()` kills the whole platform's listener.

### 3.4 Why the test suite never caught it

`test/helpers.js:19` calls `rooms.destroy(room)` — but only in teardown.
No test ever makes an HTTP request on the same server instance *after* a
destroy. Every test file builds a fresh server, so the dead listener is
never observed.

## 4. Ranked hypotheses

### H1 — `room.io.close()` closes the shared HTTP server. CONFIRMED. Rank 1.

Evidence for — fits every item:
- (a) **Log silence after 09:08:58.** After the listener dies, no HTTP
  request reaches the app, so nothing logs. The remaining periodic work
  (sweep, lag tracker, buff watchdog) logs only on error; the buff
  alerter is disabled on Railway; catalog refresh is 6-hourly. The
  buong-giam autosave errors stop exactly when its room is destroyed
  (its interval is cleared in `destroy()`).
- (b) **Watchdog never fired.** The event loop was never frozen — pongs
  kept flowing, so the worker correctly did nothing. (And per §3.1, even
  a frozen loop would not have been saved — separate bug, H2.)
- (c) **Railway shows ACTIVE.** The process is alive; deployment status
  is not listener liveness. Restart Policy On Failure only triggers on
  process exit; the process never exits.
- (d) **~30-min correlation.** Rooms created 08:36–08:38 → idle 30 min →
  first sweep after 09:08 destroys them → listener dies → last autosave
  error 09:08:58 (4 s after the 09:08:54 sweep tick; log-pipeline lag or
  the last tick before destroy) → user notices 09:19.
- (e) **Idle-hours hangs (02:35, 08:21).** Same clock: rooms created
  during verification hit 30-min idle and the first sweep-destroy kills
  the listener; the app then sits silently for hours until someone
  notices. The 02:35 incident's own note — "app hung silently
  ~01:30–01:31", last log 01:29:46 — matches rooms created ~00:15–01:00
  expiring at ~01:30.
- Reproduced end-to-end locally (§3.2) and in isolation (§3.3), and
  confirmed in Socket.IO's source.

Evidence against — none found.

### H2 — Watchdog design flaw: `process.exit()` in a worker only kills the worker. CONFIRMED as a bug, but NOT the cause of these hangs. Rank 2 (as a fix priority).

- Proved by §3.1 (both the full-watchdog test and the minimal repro).
- It did not cause the 09:19 hang: the loop was alive (H1 explains the
  silence), so there was nothing for the watchdog to do — correctly.
- It matters because it removes the safety net for a *genuine* loop
  freeze. Any future real freeze would behave exactly like these hangs
  (silent, no restart) even with the watchdog "active".
- Fixing H2 alone would NOT have prevented any of the three hangs.

### H3 — Railway proxy/routing failure with a healthy app. POSSIBLE in principle, NOT needed. Rank 3.

- Would also produce 502s on all routes, an ACTIVE dashboard, and silence
  in app logs, and would also be "fixed" by a manual restart (new
  container, new route).
- Against: it requires the proxy to fail three times, each time shortly
  after a room-expiry window (twice with a ~30-min correlation, once
  with the 01:30 note) — too coincidental. H1 explains the timing
  exactly, with a reproduced mechanism.
- Distinguishing evidence we do not have: whether Railway's own
  healthcheck (if it probes the container directly, bypassing the public
  proxy) passed during a hang. If a future hang occurs *after* the H1
  fix, H3 becomes the prime suspect — which is why fix #4 (§5) is an
  external public-URL health monitor.

### H4 — Room-destroy cleanup looping forever (`__timers` growth / self-rescheduling timers). REFUTED.

- Experiment B: sweeping 7 rooms took **3 ms**. `ctx.dead` IS set before
  clearing (`engine.js:2832`, `game-common.js:214`). No `while` loops in
  `games/buong-giam/engine.js`. Fired one-shot timeouts do stay in
  `__timers` forever (they are only removed on explicit clear), so the
  set grows over a room's life — but clearing a few thousand entries is
  milliseconds, and the sweep measurement proves it.
- Residual note: the unbounded `__timers` growth is still worth bounding
  (see fix #5), it is just not a hang cause.

### H5 — Synchronous infinite loop in a game engine. NO EVIDENCE. Rank 4 (residual).

- Would freeze the loop — but then (had the watchdog worked) it should
  have fired, and the 02:35 hang happened with no rooms/live activity
  for hours, i.e. no engine trigger. Not testable exhaustively across all
  14 engines here; H1 makes it unnecessary. Keep as a residual only.

### H6 — Worker-thread death leaving a stale `"active"` status. REFUTED as a cause.

- Code: `worker.on('exit')` sets `status='disabled'` and logs a warning
  — but only if the main loop is alive to run the handler. No such warn
  line appears in the Railway logs. And `/healthz` reporting `"active"`
  is only meaningful when `/healthz` itself answers (it needs the
  listener + the loop); the pre/post-hang `"active"` readings came from
  healthy moments and say nothing about the hang window. The status
  field is trustworthy exactly when it is least needed.

### Open minor question (does not affect the conclusion)

123 autosave errors over 08:36:35–09:08:58 (≈1 per 15.8 s) vs the 10 s
autosave interval (≈194 expected). Possibilities: Railway log sampling /
dedup of identical lines, or the buong-giam room was created later than
08:36 (a 08:48 creation fits 123 ticks almost exactly). Either way the
first/last timestamps bracket the room's life and the last error sits at
the destroy window.

## 5. Fix proposals (ordered by expected value)

### Fix 1 — stop `destroy()` from killing the listener (fixes the actual hangs)

**File:** `lib/rooms.js`, `RoomManager.destroy()`.

```js
// BEFORE (kills the shared HTTP server — socket.io close() closes httpServer):
try { room.io.close(); } catch {}

// AFTER — close only this room's engine (its socket clients), never the
// shared listener (engine.io 6.5.5 close() only closes clients + cleanup):
try { room.io.engine.close(); } catch {}
```

- `room.io.engine.close()` is per-room (each room has its own engine
  instance for its own path) and never touches `httpServer`.
- Caveat: engine.io `cleanup()` does not remove the room's `request`
  listener from the shared server, so destroyed rooms leave one stale
  path-check listener each — cheap (`check(req)` returns false for
  non-matching paths) but unbounded over many room cycles. If that
  bothers, explicitly remove it, or (bigger refactor) use ONE shared
  Socket.IO server with a namespace per room and disconnect the
  namespace on destroy (`io.of(prefix).disconnectSockets(true)`).
- **Regression test (add to the suite):** create a room on a live
  server → `rooms.destroy(room)` → `GET /` and `GET /healthz` must still
  return 200, and a new room must be creatable afterwards. The current
  suite only destroys in teardown, which is why this shipped.

### Fix 2 — make the watchdog able to kill a frozen process (restores the safety net)

The worker-thread design cannot work: no in-worker call can terminate
the main process (`process.exit` only kills the worker; there is no
worker API to kill the parent). Replace it with a **supervisor child
process**:

- `server.js` `start()`: `child_process.fork()` a small supervisor
  (e.g. `lib/loop-supervisor.js`) that polls the parent every 2 s via
  HTTP `GET /healthz` (or IPC ping) and, after 20 s of no response (60 s
  grace), kills the parent with `process.kill(parentPid, 'SIGKILL')`
  and exits itself, so Railway's Restart Policy restarts the container.
  The supervisor must also exit if its parent dies first (poll parent
  pid / listen for `disconnect`), or it becomes an orphan.
- Alternative (simpler, less robust): keep the worker for *detection*,
  but have it signal unresponsiveness out-of-band — e.g. the worker
  writes a timestamp file / touches a `FROZEN` marker, and an external
  monitor (fix #4) restarts the service. Do not rely on the main thread
  to act on the signal: a frozen main thread cannot run the handler.
- Add the missing end-to-end test: spawn the real server as a child,
  block its loop (e.g. via a test-only endpoint or by requiring the
  engine in-process), assert the child process exits within ~30 s.
  The existing 11 watchdog unit tests all stub the exit and therefore
  cannot catch this class of bug.

### Fix 3 — main-thread lag self-exit (cheap extra net for slow-loop cases)

In `LagTracker`'s tick (main thread, `lib/loop-watchdog.js`): if
`lagMs` exceeds a large threshold (e.g. 30 000 ms) for consecutive
ticks, call `process.exit(1)` **from the main thread** (which does kill
the process). This catches severe loop *slowness* but not a hard freeze
(a frozen loop never runs the tick). Keep thresholds conservative to
avoid killing live rooms on a GC pause.

### Fix 4 — external public-URL health monitor (covers proxy-side failures too)

A cron (or a tiny external uptime check) that hits
`https://live-game-platform-production.up.railway.app/healthz` through
the public URL every 1–2 min; on N consecutive failures, restart the
Railway service via the Railway API (or alert the CEO). This is the only
check that sees what users see, and the only one that would catch an
H3-style proxy failure, which no in-process watchdog can ever detect.

### Fix 5 — bound `__timers` growth (hygiene, not a hang fix)

In `games/buong-giam/engine.js` (and `lib/game-common.js`
`withTimers`): wrap one-shot `setTimeout` callbacks so the id is
removed from the set when it fires (fired timeouts currently stay in
the set forever). Same note applies to the generated buong-giam file:
direct edits only, regeneration is impossible (source
`/tmp/buong-giam/server.js` is gone).

## 6. What NOT to do

- Do not "fix" the autosave path again — already fixed on main.
- Do not add more in-worker `process.exit` calls, `worker.terminate()`
  from the main thread on suspicion, or a second worker watching the
  first — none of these can terminate a frozen main process.
- Do not rely on Railway's healthcheck/restart policy as the only net:
  it did not restart the service in any of the three hangs (the process
  never exited, so "On Failure" never triggered).

## 7. Appendix — exact reproduction commands

```bash
# A: watchdog vs frozen loop (run from /tmp; file /tmp/wd-test.js)
timeout 90 node wd-test.js
# observed: "WATCHDOG FAILED TO FIRE", exit 0; worker exited code 1

# A2: minimal proof that process.exit() in a worker kills only the worker
timeout 15 node /tmp/wd-min.js
# observed: "worker exited, code = 1" then "MAIN STILL ALIVE after 3s"

# B: mass room destroy (file /tmp/room-destroy-test.js)
timeout 180 node room-destroy-test.js
# observed: "SWEEP took 3 ms; rooms left: 0" then fetch /healthz
# -> "connect ECONNREFUSED 127.0.0.1:45357"

# C: minimal io.close() isolation (file /tmp/io-close-test.js)
timeout 20 node /tmp/io-close-test.js
# observed: "before io1.close(): OK" / "after io1.close(): FAIL"
```

Node v24.22.1, socket.io 4.7.5, engine.io 6.5.5 (versions installed in the repo).
