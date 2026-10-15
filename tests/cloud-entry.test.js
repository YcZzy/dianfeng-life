const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validate } = require('../cloudfunctions/peakLifeApi/lib/service');

function entry() {
  const context = {
    exports: {},
    require(name) {
      if (name === 'wx-server-sdk') return {
        DYNAMIC_CURRENT_ENV: 'current', init() {}, database() { return {}; },
        getWXContext() { return { OPENID: 'trusted-owner' }; }
      };
      if (name === './lib/repository') return { createRepository() { return {}; } };
      if (name === './lib/service') return { createService() { return async (event, owner) => {
        // Normalize VM object prototypes to the service's realm.
        const input = JSON.parse(JSON.stringify(event));
        try { validate(input); return { ok: true, input, owner }; }
        catch (error) { return { ok: false, code: error.code }; }
      }; } };
      throw new Error(name);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../cloudfunctions/peakLifeApi/main.js'), 'utf8'), context);
  return context.exports.main;
}

const submit = {
  requestId: 'mv9jtsy5-7h649k7b9p29lvozftzzsam4uk9io89a', quizVersion: 'quiz-v2.1',
  answers: { Q01:'C',Q02:'C',Q03:'B',Q04:'B',Q05:'B',Q06:'B',Q07:'B',Q08:'B',Q09:'B',Q10:'B',Q11:'C',Q12:'C',Q13:'C',Q14:'C',Q15:'D',Q16:'C',Q17:'C',Q18:'C',Q19:'C',Q20:'B',Q21:'B',Q22:'B',Q23:'B',Q24:'B',Q25:'B',Q26:'B' },
  action: 'submit'
};

test('reported submit accepts injected userInfo while using trusted context identity', async () => {
  const main = entry();
  for (const input of [submit, { ...submit, userInfo: { openId: 'untrusted-owner', appId: 'app' }, tcbContext: { uid: 'untrusted-context-owner' } }]) {
    const result = await main(input);
    assert.equal(result.ok, true);
    assert.equal(result.owner, 'trusted-owner');
    assert.equal(result.apiVersion, '2026-10-15.5');
    assert.deepEqual(result.input, submit);
  }
});

test('platform metadata handling preserves rejection of unsupported business fields', async () => {
  const main = entry();
  for (const extra of [{ owner: 'other-owner' }, { score: 100 }, { unexpected: true }]) {
    const result = await main({ ...submit, userInfo: { openId: 'other-owner' }, tcbContext: {}, ...extra });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_INPUT');
    assert.equal(result.apiVersion, '2026-10-15.5');
  }
});
