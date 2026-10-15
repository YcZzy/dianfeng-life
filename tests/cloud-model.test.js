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
test('ranking is deterministic, uses strict lower raw scores and user missing mask', () => {
  const { rankAnswers, scoreAnswers, referenceProfiles, PRIORS }=model();
  const a=answers({Q09:'Y',Q21:'Y',Q26:'N'});
  const peers=referenceProfiles('E');
  assert.deepEqual(peers,referenceProfiles('E'));
  const score=scoreAnswers(a);
  const lower=peers.filter(p=>scoreAnswers({...p,Q09:'Y',Q21:'Y',Q26:'N'}).rawScore<score.rawScore).length;
  assert.equal(rankAnswers(a).percent,Math.floor(lower/peers.length*100));
  assert.match(rankAnswers(a).headline,/^估算超过 \d+%/); assert.match(rankAnswers(a).note,/尚未完成真实样本校准/);
  assert.equal(rankAnswers({...a,Q01:'A'}).available,false);
  assert.equal(rankAnswers(answers({Q03:'Y',Q10:'Y'})).available,false);
  for(const age of Object.keys(PRIORS)) for(const probabilities of Object.values(PRIORS[age])) assert.ok(Math.abs(probabilities.reduce((s,p)=>s+p,0)-1)<1e-9);
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
test('identical reference profile is excluded from strictly lower comparison',()=>{
 const {referenceProfiles,rankAnswers,scoreAnswers}=model();const peers=referenceProfiles('E');const a=peers[1024];const raw=scoreAnswers(a).rawScore;
 const strict=peers.filter(p=>scoreAnswers(p).rawScore<raw).length;const inclusive=peers.filter(p=>scoreAnswers(p).rawScore<=raw).length;
 assert.ok(inclusive>strict);assert.equal(rankAnswers(a).percent,Math.floor(strict/peers.length*100));
});
test('every age prior includes every bank option and has probabilities in bounds',()=>{
 const {PRIORS}=model();const bank=require('../cloudfunctions/peakLifeApi/lib/questions.json');
 for(const table of Object.values(PRIORS)){assert.equal(Object.keys(table).length,26);for(const q of bank.questions){assert.equal(table[q.id].length,q.options.length);assert.ok(table[q.id].every(p=>Number.isFinite(p)&&p>=0&&p<=1));}}
});
test('insights explain concrete evidence combinations without blaming or diagnosing',()=>{
 const {insightsFor}=model();const a=answers({Q05:'G',Q09:'B',Q11:'A',Q17:'D',Q03:'D',Q06:'F'});
 const insights=insightsFor(a);assert.equal(insights.length,3);
 assert.match(insights[0].body,/收入还没有完全转化成现金储备/);
 assert.match(insights[0].body,/30万至不足50万元/);assert.match(insights[0].body,/大于0至不足1万元/);
 assert.match(insights[1].body,/休息/);assert.match(insights[2].body,/恢复/);
 assert.equal(/大手大脚|天生|讨好型|疾病诊断/.test(insights.map(i=>i.body).join('')),false);
});
test('rank excludes noncomparable peers and uses eligible denominator',()=>{
 const {rankAnswers}=model();const a=answers();
 const low=answers({Q03:'E',Q04:'E',Q05:'A',Q08:'A',Q09:'A',Q10:'E',Q11:'A',Q13:'E',Q14:'E',Q16:'G',Q17:'E',Q18:'E',Q19:'B',Q21:'A',Q22:'A',Q23:'A',Q24:'A',Q25:'A',Q26:'A'});
 const missing=answers({Q03:'N',Q10:'N'});
 assert.equal(rankAnswers(a,{peers:[low,a,missing]}).percent,50);
 assert.equal(rankAnswers(a,{peers:[missing]}).available,false);
});
test('persona preserves all matching tags in priority order with valid evidence',()=>{
 const {personaFor}=model();const p=personaFor(answers({Q05:'G',Q03:'D',Q11:'A',Q12:'A',Q17:'D',Q18:'D',Q04:'D'}));
 assert.ok(Array.isArray(p.tags),'persona includes all matching tags');
 assert.deepEqual(p.tags.map(t=>t.key),['battery','service','overtime']);
 assert.equal(p.key,p.tags[0].key);assert.ok(p.tags.every(t=>t.evidence.length>=2));
 assert.deepEqual(personaFor(answers()).tags,[]);
});
test('background skipping is valid, skipped age hides rank, identity never changes score',async()=>{
 const {scoreAnswers,rankAnswers}=model();const {validate}=require('../cloudfunctions/peakLifeApi/lib/service');const bank=require('../cloudfunctions/peakLifeApi/lib/questions.json');
 const a=answers();for(const id of ['Q01','Q02'])for(const value of ['X','Y']){
  const skipped={...a,[id]:value};assert.doesNotThrow(()=>validate({action:'submit',requestId:'background-test',quizVersion:bank.version,answers:skipped,contribute:false}));
  assert.equal(scoreAnswers(skipped).score,scoreAnswers(a).score);
  if(id==='Q01')assert.equal(rankAnswers(skipped).available,false);else assert.deepEqual(rankAnswers(skipped),rankAnswers(a));
 }
});
