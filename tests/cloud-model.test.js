const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modelPath = path.join(__dirname, '../cloudfunctions/peakLifeApi/lib/model.js');
function model() { assert.ok(fs.existsSync(modelPath), 'server scoring model must exist'); return require(modelPath); }
function answers(patch = {}) {
  return Object.assign(Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`Q${String(i + 1).padStart(2,'0')}`, 'A'])), { Q01:'E', Q19:'B' }, patch);
}
module.exports.answers = answers;
test('reports only expose answer scores and never synthesize peer rankings', () => {
  const { reportFor } = model();
  for (const age of ['A', 'E', 'X', 'Y']) {
    const a = answers({ Q01: age });
    const report = reportFor(a, 'report', '2026-10-15T00:00:00Z');
    assert.equal(report.rank.available, false);
    assert.equal(report.rank.percent, null);
    assert.equal(report.modelVersion, 'scoring-v1');
    assert.match(report.rank.headline, new RegExp(String(report.score)));
  }
});
test('six-axis scoring preserves group weights, caps and missing normalization', () => {
  const { scoreAnswers } = model();
  const s = scoreAnswers(answers({Q05:'I',Q09:'I',Q16:'A',Q22:'E',Q19:'E',Q23:'E',Q21:'C',Q11:'F',Q25:'E',Q08:'E',Q24:'E',Q26:'D'}));
  assert.equal(s.score, 100); assert.equal(s.rawScore,100); assert.equal(s.completion.valid,19);
  const sparse = scoreAnswers(answers({Q09:'Y',Q22:'E',Q05:'I',Q16:'A',Q21:'Y',Q26:'N'}));
  assert.equal(sparse.axes.find(a=>a.id==='E').score,100);
  assert.equal(sparse.completion.valid,16); assert.equal(sparse.comparable,true);
  assert.equal(scoreAnswers(answers({Q09:'Y',Q22:'Y',Q16:'Y'})).comparable,false);
  assert.equal(scoreAnswers(answers({Q09:'Y',Q22:'Y',Q16:'Y'})).score,null);
});
test('all missing answers remain unknown and never manufacture a persona', () => {
  const { scoreAnswers, personaFor } = model();
  const a = answers(Object.fromEntries(Array.from({length:24},(_,i)=>[`Q${String(i+3).padStart(2,'0')}`,'Y'])));
  const s = scoreAnswers(a); assert.equal(s.score,null); assert.ok(s.axes.every(a=>a.score===null));
  assert.equal(personaFor(a).key,'mixed'); assert.equal(personaFor(a).evidence.length,0);
});
test('persona priority uses complete evidence and fallback preserves answers', () => {
  const { personaFor }=model();
  const a=answers({Q05:'G',Q03:'D',Q11:'A',Q12:'A',Q17:'D',Q18:'D'});
  assert.equal(personaFor(a).key,'battery'); assert.ok(personaFor(a).evidence.length>=3);
  assert.equal(personaFor({...a,Q05:'Y',Q09:'Y'}).key,'service');
  assert.equal(personaFor({...a,Q05:'Y',Q09:'Y',Q12:'Y'}).key,'mixed');
});
test('internal raw axis values retain fractional precision before overall rounding',()=>{
 const {scoreAnswers}=model();const s=scoreAnswers(answers({Q05:'B',Q09:'C',Q22:'B',Q16:'B'}));
 assert.ok(s.rawAxes,'internal exact axes are available for model audits');assert.equal(s.rawAxes.E,43.75);assert.equal(s.axes.find(a=>a.id==='E').score,44);
});
test('all eight persona rules require every specified evidence condition',()=>{
 const {personaFor}=model();const empty=answers(Object.fromEntries(Array.from({length:24},(_,i)=>[`Q${String(i+3).padStart(2,'0')}`,'Y'])));
 const cases=[['battery',{Q05:'G',Q03:'D',Q11:'A'}],['service',{Q12:'A',Q17:'C',Q18:'C'}],['overtime',{Q04:'D',Q18:'C'}],['planner',{Q07:'B',Q14:'C',Q19:'B'}],['lowpower',{Q03:'D',Q10:'C',Q06:'E'}],['buffer',{Q22:'D',Q16:'A',Q11:'D'}],['schedule',{Q11:'D',Q25:'D',Q23:'D'}],['patch',{Q26:'B',Q19:'D',Q14:'A'}]];
 for(const [key,patch] of cases){const a={...empty,...patch};const persona=personaFor(a);assert.equal(persona.key,key);assert.equal(persona.evidence.length,Object.keys(patch).length);for(const id of Object.keys(patch))assert.equal(personaFor({...a,[id]:'Y'}).key,'mixed');}
});
test('insights explain concrete evidence combinations without blaming or diagnosing',()=>{
 const {insightsFor}=model();const a=answers({Q05:'G',Q09:'B',Q11:'A',Q17:'D',Q03:'D',Q06:'F'});
 const insights=insightsFor(a);assert.equal(insights.length,3);
 assert.match(insights[0].body,/收入还没有完全转化成现金储备/);
 assert.match(insights[0].body,/30万至不足50万元/);assert.match(insights[0].body,/大于0至不足1万元/);
 assert.match(insights[1].body,/休息/);assert.match(insights[2].body,/恢复/);
 assert.equal(/大手大脚|天生|讨好型|疾病诊断/.test(insights.map(i=>i.body).join('')),false);
});
test('persona preserves all matching tags in priority order with valid evidence',()=>{
 const {personaFor}=model();const p=personaFor(answers({Q05:'G',Q03:'D',Q11:'A',Q12:'A',Q17:'D',Q18:'D',Q04:'D'}));
 assert.ok(Array.isArray(p.tags),'persona includes all matching tags');
 assert.deepEqual(p.tags.map(t=>t.key),['battery','service','overtime']);
 assert.equal(p.key,p.tags[0].key);assert.ok(p.tags.every(t=>t.evidence.length>=2));
 assert.deepEqual(personaFor(answers()).tags,[]);
});
test('background skipping is valid and never changes score',async()=>{
 const {scoreAnswers}=model();const {validate}=require('../cloudfunctions/peakLifeApi/lib/service');const bank=require('../cloudfunctions/peakLifeApi/lib/questions.json');
 const a=answers();for(const id of ['Q01','Q02'])for(const value of ['X','Y']){
  const skipped={...a,[id]:value};assert.doesNotThrow(()=>validate({action:'submit',requestId:'background-test',quizVersion:bank.version,answers:skipped,contribute:false}));
  assert.equal(scoreAnswers(skipped).score,scoreAnswers(a).score);
 }
});
