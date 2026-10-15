const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const bank = require('../miniprogram/data/questions');
function harness({ saved = null, call = () => Promise.reject(new Error('offline')) } = {}) {
  let page;
  let timer;
  const navigations = [];
  const snapshots = [];
  const cleared = [];
  const context = {
    require(name) {
      if (name.includes('data/questions')) return bank;
      if (name.includes('quiz-state')) return require('../miniprogram/core/quiz-state');
      if (name.includes('core/draft')) return { read: () => saved, save: (s) => { saved = structuredClone(s); snapshots.push(s); }, clear: () => { saved = null; cleared.push(true); }, requestId: () => 'new-request-123' };
      if (name.includes('core/api')) return { call };
      throw new Error(name);
    },
    Page(value) { page = value; page.data = structuredClone(value.data); page.setData = function(value) { Object.assign(this.data, value); }; },
    wx: { pageScrollTo() {}, redirectTo: (options) => navigations.push(options.url) },
    setTimeout(fn) { timer = fn; return 1; }, clearTimeout() { /* Keep callback to emulate an already queued stale task. */ }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/pages/quiz/quiz.js'), 'utf8'), context);
  return { page, navigations, snapshots, cleared, getDraft: () => saved, replaceDraft: (d) => { saved = d; }, fire: () => timer && timer() };
}
function choose(page, qid, oid) { page.onChoose({ currentTarget: { dataset: { qid, oid } } }); }
test('actual quiz page advances after a single tap and ignores the old rendered event', () => {
  const h = harness(); h.page.onLoad({ sample: '1' });
  choose(h.page, 'Q01', 'D');
  choose(h.page, 'Q01', 'E');
  h.fire();
  assert.equal(h.page.data.question.id, 'Q02');
  assert.equal(h.page.quiz.state.answers.Q01, 'D');
  choose(h.page, 'Q01', 'E');
  assert.equal(h.page.quiz.state.answers.Q02, undefined);
});
test('actual page hide prevents timer from moving an unseen question', () => {
  const h = harness(); h.page.onLoad({ sample: '1' });
  choose(h.page, 'Q01', 'D'); h.page.onHide(); h.fire();
  assert.equal(h.page.quiz.state.cursor, 0);
  h.page.onShow(); choose(h.page, 'Q01', 'E'); h.fire();
  assert.equal(h.page.quiz.state.cursor, 1);
});
test('last sample answer automatically opens fixed example and never calls cloud', () => {
  let calls = 0;
  const h = harness({ call: () => { calls += 1; return Promise.resolve({}); } });
  h.page.onLoad({ sample: '1' }); h.page.quiz.state.cursor = 25; h.page.render();
  choose(h.page, 'Q26', 'B'); h.fire();
  assert.deepEqual(h.navigations, ['/pages/result/result?sample=1']);
  assert.equal(calls, 0);
  assert.equal(h.snapshots.length, 0);
});
test('cloud response while hidden waits until foreground before opening report', async () => {
  const answers = Object.fromEntries(bank.questions.map((q) => [q.id, q.options[0].id]));
  let resolve;
  const response = new Promise((done) => { resolve = done; });
  const h = harness({ saved: { cursor: 26, answers, requestId: 'stable-request-123' }, call: () => response });
  h.page.onLoad({}); h.page.onHide(); resolve({ report: { id: 'private-id' } });
  await new Promise((done) => setImmediate(done));
  assert.deepEqual(h.navigations, []);
  h.page.onShow();
  assert.deepEqual(h.navigations, ['/pages/result/result?id=private-id']);
});
test('failed submit retry preserves requestId while intentional edit changes it', async () => {
  const answers = Object.fromEntries(bank.questions.map((q) => [q.id, q.options[0].id]));
  const calls = [];
  const h = harness({ saved: { cursor: 26, answers, requestId: 'stable-request-123' }, call: (action, payload) => { calls.push(structuredClone(payload)); return Promise.reject(new Error('offline')); } });
  h.page.onLoad({}); await new Promise((done) => setImmediate(done));
  assert.equal(h.page.data.phase, 'failed'); h.page.onRetry(); await new Promise((done) => setImmediate(done));
  assert.equal(calls[0].requestId, calls[1].requestId);
  h.page.onPrev(); choose(h.page, 'Q26', 'B'); h.fire(); await new Promise((done) => setImmediate(done));
  assert.notEqual(calls[2].requestId, calls[0].requestId);
  assert.equal(calls[2].answers.Q26, 'B');
});
test('successful redirect lifecycle does not recreate the completed draft', async () => {
  const answers = Object.fromEntries(bank.questions.map((q) => [q.id, q.options[0].id]));
  const h = harness({ saved: { cursor: 26, answers, requestId: 'completed-request-123' }, call: () => Promise.resolve({ report: { id: 'saved-report' } }) });
  h.page.onLoad({}); await new Promise((done) => setImmediate(done));
  assert.equal(h.getDraft(), null);
  h.page.onHide(); h.page.onUnload();
  assert.equal(h.getDraft(), null);
});
test('late success from an unloaded page does not erase a different newer draft', async () => {
  const answers = Object.fromEntries(bank.questions.map((q) => [q.id, q.options[0].id]));
  let resolve;
  const h = harness({ saved: { cursor: 26, answers, requestId: 'old-request-123' }, call: () => new Promise((done) => { resolve = done; }) });
  h.page.onLoad({}); h.page.onUnload();
  h.replaceDraft({ cursor: 3, answers: { Q01: 'C' }, requestId: 'newer-request-456' });
  resolve({ report: { id: 'old-report' } }); await new Promise((done) => setImmediate(done));
  assert.equal(h.getDraft().requestId, 'newer-request-456');
  assert.deepEqual(h.navigations, []);
});
