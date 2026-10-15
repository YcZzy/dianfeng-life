const test = require('node:test');
const assert = require('node:assert/strict');
const { publicSummary, wrapText } = require('../miniprogram/core/poster');
test('poster projection never includes private report or answer fields', () => {
  const publicData = publicSummary({ persona: { title: '人间客服', line: '自己的需求排队' }, score: 70, rank: { headline: '综合生活指数 70 / 100', note: '暂无真实同龄样本，不提供排名' }, answers: { Q05: 'I' }, owner: 'private', axes: [1], createdAt: 10 });
  assert.deepEqual(Object.keys(publicData).sort(), ['createdAt', 'personaLine', 'personaTitle', 'rankHeadline', 'rankNote', 'score'].sort());
  assert.equal(JSON.stringify(publicData).includes('private'), false);
});
test('long Chinese result lines wrap to the actual canvas width', () => {
  const context = { measureText: (s) => ({ width: [...s].length * 20 }) };
  const lines = wrapText(context, '自己的需求排队别人的需求秒回', 100);
  assert.ok(lines.length >= 3);
  assert.equal(lines.join(''), '自己的需求排队别人的需求秒回');
  assert.ok(lines.every((s) => context.measureText(s).width <= 100));
});
