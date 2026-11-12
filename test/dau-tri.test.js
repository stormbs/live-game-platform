// test/dau-tri.test.js — Test game Đấu Trí (game 13/13):
// trả lời đúng +10, đúng đầu tiên +5; 1 người chỉ tính 1 lần/câu; sai = 0;
// quà 10 xu = +20 điểm đội; quà lạ = 0 + WARN; hết 10 câu đội nhiều điểm
// thắng; hòa xét số lần đúng đầu tiên; ngân hàng câu hỏi mặc định đủ 10,
// dashboard thêm/sửa được; demo start/stop + từ chối khi đã có event thật;
// overlay/dashboard 200; tikfinity-actions 6 URL riêng.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GAME = 'dau-tri';

let _n = 0;
const uniq = (b) => `${b}_${Date.now().toString(36).slice(-4)}${(++_n).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getState(t, user) {
  const s = await fetchJson(t.base, `/o/${GAME}/${user}/api/state`);
  assert.equal(s.status, 200, 'state 200');
  return s.json;
}
async function setSettings(t, user, body) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200, 'setSettings 200');
  return r.json.settings;
}
async function enableDemo(t, user) {
  return setSettings(t, user, { demoMode: true });
}
async function postApi(t, user, path, body) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r;
}
async function waitFor(t, user, pred, tries = 20, ms = 500) {
  for (let i = 0; i < tries; i += 1) {
    const st = await getState(t, user);
    if (pred(st)) return st;
    await sleep(ms);
  }
  return getState(t, user);
}
async function getBank(t, user) {
  const r = await fetchJson(t.base, `/o/${GAME}/${user}/api/questions`);
  assert.equal(r.status, 200, 'bank 200');
  return r.json.questions;
}
async function correctLetter(t, user) {
  const st = await getState(t, user);
  assert.ok(st.current, 'đang có câu hỏi mở');
  const bank = await getBank(t, user);
  const q = bank.find((x) => x.id === st.current.questionId);
  assert.ok(q, 'tìm thấy câu hỏi trong bank');
  return q.correct;
}
async function answer(t, room, uid, name, letter) {
  const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: uid, nickname: name, content: letter });
  assert.equal(w.status, 200, 'webhook 200');
  return w.body;
}
async function joinTeam(t, room, uid, name, teamWord) {
  const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: uid, nickname: name, content: teamWord });
  assert.equal(w.status, 200, 'webhook 200');
  return w.body;
}

test('dau-tri: trả lời đúng +10, đúng đầu tiên +5; 1 người 1 lần/câu; sai = 0; tự chốt hết giờ', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_answer');
    await setSettings(t, user, { questionS: 2, revealS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    const nq = await postApi(t, user, '/api/question/next', {});
    assert.equal(nq.json.ok, true, 'mở câu 1');
    const correct = await correctLetter(t, user);
    const wrong = ['a', 'b', 'c', 'd'].find((l) => l !== correct);
    await joinTeam(t, room, 'u-a', 'AnhA', 'đội a');
    await joinTeam(t, room, 'u-b', 'BanB', 'đội b');
    // A đúng đầu tiên: +10 +5 = 15. B đúng sau: +10.
    await answer(t, room, 'u-a', 'AnhA', correct);
    let st = await getState(t, user);
    assert.equal(st.points.a, 15, 'đúng đầu tiên +10 +5');
    assert.equal(st.current.firstCorrect.uid, 'u-a');
    await answer(t, room, 'u-b', 'BanB', correct);
    st = await getState(t, user);
    assert.equal(st.points.b, 10, 'đúng sau chỉ +10');
    // A trả lời lần 2 -> bị bỏ qua, điểm không đổi.
    const r2 = await answer(t, room, 'u-a', 'AnhA', wrong);
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, 'already-answered');
    st = await getState(t, user);
    assert.equal(st.points.a, 15, 'trả lời lần 2 không tính');
    // C chưa chọn đội trả lời đúng: không cộng điểm đội, nhưng đếm vào cột.
    await answer(t, room, 'u-c', 'ChiC', correct);
    st = await getState(t, user);
    assert.equal(st.points.a, 15);
    assert.equal(st.points.b, 10);
    assert.equal(st.current.counts[correct], 3, '3 người chọn đáp án đúng');
    // D trả lời sai: 0 điểm.
    await answer(t, room, 'u-d', 'DungD', wrong);
    st = await getState(t, user);
    assert.equal(st.current.counts[wrong], 1, '1 người chọn đáp án sai');
    assert.equal(st.points.a, 15);
    assert.equal(st.points.b, 10);
    // Hết 2s tự chốt đáp án -> reveal, hiện đáp án đúng.
    const st2 = await waitFor(t, user, (s) => s.phase === 'reveal', 10, 500);
    assert.equal(st2.phase, 'reveal', 'hết giờ tự chốt');
    assert.equal(st2.current.locked, true);
    assert.equal(st2.current.correct, correct, 'reveal hiện đáp án đúng');
    // Hết reveal 1s -> chờ câu kế (auto tắt).
    const st3 = await waitFor(t, user, (s) => s.phase === 'between', 10, 500);
    assert.equal(st3.phase, 'between', 'sau reveal chờ câu kế');
  } finally { await stopTestServer(t); }
});

test('dau-tri: quà 10 xu = +20 điểm đội; quà không rõ xu = 0 + log WARN', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_gift');
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'đội a');
    const w = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Hoa hong', diamondCount: 10 });
    assert.equal(w.body.ok, true);
    let st = await getState(t, user);
    assert.equal(st.points.a, 20, 'quà 10 xu = +20 điểm');
    assert.equal(st.stats.gifts, 1);
    const w2 = await t.rooms.dispatchWebhook(room, { triggerTypeId: 3, userId: 'u-a', nickname: 'AnhA', giftName: 'Qua la' });
    assert.equal(w2.body.ok, false);
    assert.equal(w2.body.reason, 'unknown-coins');
    st = await getState(t, user);
    assert.equal(st.stats.giftsUnknown, 1);
    assert.equal(st.points.a, 20, 'quà lạ không cộng điểm');
  } finally { await stopTestServer(t); }
});

test('dau-tri: hết 3 câu hòa điểm -> xét số lần đúng đầu tiên (A thắng 2-0)', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_tie');
    await setSettings(t, user, { questionsPerMatch: 3, questionS: 30, revealS: 1, spotlightS: 1 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'đội a');
    await joinTeam(t, room, 'u-b', 'BanB', 'đội b');
    // Câu 1: A đúng đầu (+15), B đúng (+10).
    await postApi(t, user, '/api/question/next', {});
    let correct = await correctLetter(t, user);
    await answer(t, room, 'u-a', 'AnhA', correct);
    await answer(t, room, 'u-b', 'BanB', correct);
    await postApi(t, user, '/api/question/next', {}); // chốt -> reveal
    await postApi(t, user, '/api/question/next', {}); // mở câu 2
    // Câu 2: A đúng đầu (+15), B đúng (+10).
    correct = await correctLetter(t, user);
    await answer(t, room, 'u-a', 'AnhA', correct);
    await answer(t, room, 'u-b', 'BanB', correct);
    await postApi(t, user, '/api/question/next', {});
    await postApi(t, user, '/api/question/next', {}); // mở câu 3
    // Câu 3: D (không đội) đúng đầu tiên (không điểm), B đúng (+10).
    correct = await correctLetter(t, user);
    await answer(t, room, 'u-d', 'DungD', correct);
    await answer(t, room, 'u-b', 'BanB', correct);
    await postApi(t, user, '/api/question/next', {}); // chốt -> reveal
    const st = await postApi(t, user, '/api/question/next', {}); // hết 3 câu -> spotlight
    const st2 = await getState(t, user);
    assert.equal(st2.phase, 'spotlight', 'hết 3 câu -> spotlight');
    // A: 15+15 = 30 (2 đúng, 2 lần đầu). B: 10+10+10 = 30 (3 đúng, 0 lần đầu).
    assert.equal(st2.points.a, 30);
    assert.equal(st2.points.b, 30);
    assert.equal(st2.winner.team, 'a', 'hòa điểm -> A thắng vì 2 lần đúng đầu tiên (B 0 lần)');
    assert.ok(st2.winner.top3.length >= 1, 'có top 3 cá nhân');
    // Hết spotlight 1s -> trận mới.
    const st3 = await waitFor(t, user, (s) => s.phase === 'lobby' && s.matchNo === 2, 10, 500);
    assert.equal(st3.matchNo, 2, 'sang trận mới');
    assert.equal(st3.points.a, 0);
  } finally { await stopTestServer(t); }
});

test('dau-tri: ngân hàng câu hỏi mặc định đủ 10; thêm/sửa/xóa được', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_bank');
    await t.rooms.getOrCreate(GAME, user);
    let bank = await getBank(t, user);
    assert.equal(bank.length, 10, 'mặc định 10 câu');
    assert.ok(bank.every((q) => q.text && q.options.length === 4 && ['a', 'b', 'c', 'd'].includes(q.correct)), 'mỗi câu đủ 4 đáp án + đáp án đúng');
    // Thêm.
    const add = await postApi(t, user, '/api/questions', { text: '1 + 1 bằng mấy?', options: ['1', '2', '3', '4'], correct: 'b' });
    assert.equal(add.json.success, true);
    const newId = add.json.question.id;
    bank = await getBank(t, user);
    assert.equal(bank.length, 11, 'thêm -> 11 câu');
    // Sửa.
    const edit = await fetchJson(t.base, `/o/${GAME}/${user}/api/questions/${newId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '2 + 2 bằng mấy?' }),
    });
    assert.equal(edit.json.question.text, '2 + 2 bằng mấy?');
    // Thêm sai (thiếu đáp án) -> 400.
    const bad = await postApi(t, user, '/api/questions', { text: 'Câu lỗi', options: ['A', 'B'], correct: 'a' });
    assert.equal(bad.status, 400, 'thiếu đáp án -> 400');
    // Xóa.
    const del = await fetchJson(t.base, `/o/${GAME}/${user}/api/questions/${newId}`, { method: 'DELETE' });
    assert.equal(del.json.success, true);
    bank = await getBank(t, user);
    assert.equal(bank.length, 10, 'xóa -> lại 10 câu');
  } finally { await stopTestServer(t); }
});

test('dau-tri: demo start -> điểm 2 đội tăng; stop -> dừng; từ chối khi đã có event thật', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_demo');
    await enableDemo(t, user);
    const r = await postApi(t, user, '/api/demo/start', {});
    assert.equal(r.json.success, true, 'demo start ok');
    const st = await waitFor(t, user, (s) => s.demoActive && (s.points.a + s.points.b > 0), 24, 500);
    assert.equal(st.demoActive, true);
    assert.ok(st.points.a + st.points.b > 0, 'demo làm điểm tăng');
    assert.equal(st.phase, 'question', 'demo tự mở câu hỏi');
    const r2 = await postApi(t, user, '/api/demo/stop', {});
    assert.equal(r2.json.success, true);
    const after = await getState(t, user);
    assert.equal(after.demoActive, false);
    // Số câu đúng của người demo không tăng thêm sau khi dừng.
    const demoCorrect = (s) => s.players.filter((p) => p.uid.startsWith('demo_')).reduce((a, p) => a + (p.correct || 0), 0);
    const c0 = demoCorrect(after);
    await sleep(2500);
    const after2 = await getState(t, user);
    assert.equal(demoCorrect(after2), c0, 'demo dừng thì số câu đúng demo không tăng');
    // Phòng đã có event thật -> demo bị từ chối.
    const user2 = uniq('dautri_demo2');
    await enableDemo(t, user2);
    const room2 = await t.rooms.getOrCreate(GAME, user2);
    await t.rooms.dispatchWebhook(room2, { triggerTypeId: 11, userId: 'u-real', nickname: 'NguoiThat', content: 'đội a' });
    const r3 = await postApi(t, user2, '/api/demo/start', {});
    assert.equal(r3.json.success, false);
    assert.equal(r3.json.reason, 'real-events-present');
  } finally { await stopTestServer(t); }
});

test('dau-tri: endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_ep');
    await enableDemo(t, user);
    const d = await postApi(t, user, '/api/test/demo', {});
    assert.equal(d.json.ok, true);
    const st = await getState(t, user);
    assert.ok(st.players.length >= 6, 'demo 1 lượt tạo >= 6 người');
    assert.ok(st.current, 'demo 1 lượt tự mở câu hỏi');
    assert.ok(st.teamCounts.a >= 1 && st.teamCounts.b >= 1, 'cả 2 đội đều có người');
    const ov = await fetchJson(t.base, `/o/${GAME}/${user}?demo=1`);
    assert.equal(ov.status, 200, 'overlay 200');
    assert.ok(ov.text.includes('ĐẤU TRÍ'), 'overlay phải có tiêu đề game');
    const db = await fetchJson(t.base, `/room/${GAME}/${user}`);
    assert.equal(db.status, 200, 'dashboard 200');
    assert.ok(db.text.includes('Đấu Trí'), 'dashboard phải có tiêu đề game');
    const guide = await fetchJson(t.base, `/huong-dan-tikfinity?game=${GAME}&username=${user}`);
    assert.equal(guide.status, 200, 'guide 200');
    assert.ok(String(guide.text || '').includes('Dau Tri'), 'guide nhắc tới Dau Tri');
    const acts = await fetchJson(t.base, `/o/${GAME}/${user}/api/tikfinity-actions`);
    assert.equal(acts.status, 200);
    assert.equal(acts.json.actions.length, 6, 'đủ 6 action');
    for (const a of acts.json.actions) {
      assert.ok(a.url.includes('?event='), 'mỗi action 1 URL riêng ?event=');
      assert.ok(!/body/i.test(JSON.stringify(a)), 'không nhắc tới body');
    }
    // Nút test: bulk-join 100 người (chia 2 đội). Phòng đã có 6 người demo
    // trước đó (3+3) nên mỗi đội = 53.
    const bulk = await postApi(t, user, '/api/test/bulk-join', { count: 100 });
    assert.equal(bulk.json.count, 100);
    assert.equal(bulk.json.teamCounts.a, 53);
    assert.equal(bulk.json.teamCounts.b, 53);
  } finally { await stopTestServer(t); }
});

test('dau-tri: settings chặn giá trị vượt giới hạn; room A không lọt sang room B', async () => {
  const t = await startTestServer();
  try {
    const userA = uniq('dautri_setA');
    const userB = uniq('dautri_setB');
    const r = await setSettings(t, userA, { correctPoints: 0, questionS: 1, questionsPerMatch: 999 });
    assert.equal(r.correctPoints, 1, 'correctPoints kẹp tối thiểu 1');
    assert.equal(r.questionS, 2, 'questionS kẹp tối thiểu 2');
    assert.equal(r.questionsPerMatch, 50, 'questionsPerMatch kẹp tối đa 50');
    const roomA = await t.rooms.getOrCreate(GAME, userA);
    await joinTeam(t, roomA, 'u-a', 'AnhA', 'đội a');
    const stB = await getState(t, userB);
    assert.equal(stB.players.length, 0, 'room B không thấy người của room A');
    assert.equal(stB.matchNo, 1);
  } finally { await stopTestServer(t); }
});

test('dau-tri: đổi đội bị chặn giữa trận; trả lời không đội không tính điểm đội', async () => {
  const t = await startTestServer();
  try {
    const user = uniq('dautri_team');
    await setSettings(t, user, { questionS: 30 });
    const room = await t.rooms.getOrCreate(GAME, user);
    await joinTeam(t, room, 'u-a', 'AnhA', 'đội a');
    await joinTeam(t, room, 'u-b', 'BanB', 'đội b');
    await postApi(t, user, '/api/question/next', {});
    let st = await getState(t, user);
    assert.equal(st.phase, 'question', 'câu 1 đang mở');
    // A đang trong trận, bình luận "đội b" -> không đổi đội.
    await t.rooms.dispatchWebhook(room, { triggerTypeId: 11, userId: 'u-a', nickname: 'AnhA', content: 'đội b' });
    st = await getState(t, user);
    assert.equal(st.players.find((p) => p.uid === 'u-a').team, 'a', 'giữa trận không đổi đội');
    // C chưa chọn đội trả lời đúng ĐẦU TIÊN: không cộng điểm đội nào,
    // nhưng tên vẫn hiện là người đúng đầu tiên.
    const correct = await correctLetter(t, user);
    await answer(t, room, 'u-c', 'ChiC', correct);
    st = await getState(t, user);
    assert.equal(st.points.a, 0);
    assert.equal(st.points.b, 0);
    assert.equal(st.current.firstCorrect.uid, 'u-c', 'tên người đúng đầu tiên vẫn hiện');
    assert.equal(st.current.firstCorrect.team, null);
    // A trả lời đúng sau: +10 (không có thưởng đầu tiên vì C đã chiếm).
    await answer(t, room, 'u-a', 'AnhA', correct);
    st = await getState(t, user);
    assert.equal(st.points.a, 10, 'đúng sau chỉ +10, không thưởng đầu tiên');
    assert.equal(st.firstCounts.a, 0, 'thưởng đầu tiên thuộc về C (không đội) nên A không có');
  } finally { await stopTestServer(t); }
});
