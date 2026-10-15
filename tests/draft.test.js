const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const version = require('../miniprogram/data/questions').version;
function load(initial) {
  let stored = initial;
  const context = { module: { exports: {} }, require: () => ({ version }), Date: { now: () => 2000000000000 }, wx: { getStorageSync: () => stored, setStorageSync: (_, data) => { stored = data; }, removeStorageSync: () => { stored = null; } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/core/draft.js'), 'utf8'), context);
  return { draft: context.module.exports, stored: () => stored };
}
test('expired sensitive answers are removed rather than merely hidden', () => {
  const h = load({ version, updatedAt: 2000000000000 - 8 * 86400000, answers: { Q05: 'G' } });
  assert.equal(h.draft.read(), null);
  assert.equal(h.stored(), null);
});
test('old-version and invalid-clock drafts are removed while valid draft survives', () => {
  for (const initial of [{ version: 'old', updatedAt: 2000000000000 }, { version, updatedAt: 2000001000000 }]) {
    const h = load(initial); assert.equal(h.draft.read(), null); assert.equal(h.stored(), null);
  }
  const valid = { version, updatedAt: 2000000000000, answers: { Q01: 'C' } };
  assert.deepEqual(load(valid).draft.read(), valid);
});
