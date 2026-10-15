const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
const bank=require('../cloudfunctions/peakLifeApi/lib/questions.json');
const servicePath=path.join(__dirname,'../cloudfunctions/peakLifeApi/lib/service.js');
function fixture(){
 assert.ok(fs.existsSync(servicePath),'cloud service must exist');
 const rows=new Map(); let queue=Promise.resolve();
 const ops={async get(c,id){return structuredClone(rows.get(`${c}/${id}`)||null)},async set(c,id,value){rows.set(`${c}/${id}`,structuredClone(value))},async remove(c,id){rows.delete(`${c}/${id}`)},async list(c,where){return [...rows.entries()].filter(([key,v])=>key.startsWith(`${c}/`)&&Object.entries(where).every(([k,w])=>v[k]===w)).map(([,v])=>structuredClone(v))}};
 const repository={...ops,transaction(fn){const result=queue.then(()=>fn(ops));queue=result.catch(()=>{});return result;}};
 let time=Date.parse('2026-10-15T00:00:00Z');
 const service=require(servicePath).createService({repository,now:()=>time});
 const answers=Object.fromEntries(bank.questions.map(q=>[q.id,q.id==='Q01'?'E':q.options[0].id]));
 const submit={action:'submit',requestId:'request-key-0001',quizVersion:bank.version,answers,contribute:false};
 return {service,submit,rows,repository,advance:ms=>{time+=ms}};
}
test('validates all keys and options, version and authenticated owner',async()=>{
 const {service,submit}=fixture();
 for(const bad of [{...submit,answers:{...submit.answers,Q27:'A'}},{...submit,answers:{...submit.answers,Q05:'Z'}},{...submit,quizVersion:'old'},{...submit,requestId:''},{...submit,contribute:true}]) assert.equal((await service(bad,'alice')).ok,false);
 assert.equal((await service(submit,'')).code,'UNAUTHENTICATED');
 assert.equal((await service({...submit,owner:'bob',score:100},'alice')).code,'INVALID_INPUT');
 const unexpected=await service({...submit,owner:'private-owner',score:100},'alice');
 assert.deepEqual(unexpected.unsupportedFields,['owner','score']);
 assert.match(unexpected.message,/owner、score/);
 assert.equal(JSON.stringify(unexpected).includes('private-owner'),false);
});
test('submit is owner scoped and concurrent idempotent, rejects changed payload',async()=>{
 const {service,submit,rows}=fixture();
 const [a,b]=await Promise.all([service(submit,'alice'),service(submit,'alice')]); assert.equal(a.ok,true); assert.equal(a.report.id,b.report.id);
 assert.equal([...rows.keys()].filter(k=>k.startsWith('peak_life_results/')).length,1);
 assert.equal((await service({...submit,answers:{...submit.answers,Q05:'B'}},'alice')).code,'IDEMPOTENCY_CONFLICT');
 assert.notEqual((await service(submit,'bob')).report.id,a.report.id);
 assert.equal((await service({action:'getResult',id:a.report.id},'bob')).code,'NOT_FOUND');
 const list=await service({action:'listResults'},'alice'); assert.equal(list.records.length,1); assert.deepEqual(Object.keys(list.records[0]).sort(),['createdAt','id','personaTitle','rankHeadline','score']);
});
test('share exposes only summary, stores hash, expires and revokes on deletion',async()=>{
 const {service,submit,rows,advance}=fixture(); const {report}=await service(submit,'alice');
 const share=await service({action:'createShare',id:report.id},'alice'); assert.equal(share.ok,true); assert.ok(share.token.length>=32);
 assert.deepEqual(Object.keys(share.summary).sort(),['createdAt','expiresAt','personaLine','personaTitle','rankHeadline','rankNote','score']);
 assert.equal(JSON.stringify([...rows.values()]).includes(share.token),false);
 assert.equal((await service({action:'getShare',token:share.token},'')).ok,true);
 assert.equal((await service({action:'revokeShare',id:report.id},'bob')).code,'NOT_FOUND');
 assert.equal((await service({action:'revokeShare',id:report.id},'alice')).ok,true);
 assert.equal((await service({action:'getShare',token:share.token},'')).code,'SHARE_UNAVAILABLE');
 const exp=await service({action:'createShare',id:report.id},'alice'); advance(7*86400000);
 assert.equal((await service({action:'getShare',token:exp.token},'')).code,'SHARE_UNAVAILABLE');
 const last=await service({action:'createShare',id:report.id},'alice'); await service({action:'deleteResult',id:report.id},'alice');
 assert.equal((await service({action:'getShare',token:last.token},'')).code,'SHARE_UNAVAILABLE');
 assert.equal((await service(submit,'alice')).code,'RESULT_DELETED');
});
test('goal completion is persistent and never changes score or percentile',async()=>{
 const {service,submit}=fixture(); const {report}=await service(submit,'alice');
 assert.equal((await service({action:'completeGoal',id:report.id},'bob')).code,'NOT_FOUND');
 const completed=await service({action:'completeGoal',id:report.id},'alice');
 assert.equal(completed.report.goal.done,true); assert.equal(completed.report.score,report.score); assert.deepEqual(completed.report.rank,report.rank);
 assert.equal((await service({action:'getResult',id:report.id},'alice')).report.goal.done,true);
});

test('retired synthetic ranks are hidden from every existing-report response',async()=>{
 const {service,submit,rows}=fixture();
 const {report}=await service(submit,'alice');
 const share=await service({action:'createShare',id:report.id},'alice');
 for(const [key,row] of rows)if(key.startsWith('peak_life_shares/'))row.summary={...share.summary,rankHeadline:'估算超过 76% 的同龄人',rankNote:'旧模型'};
 const stored=rows.get(`peak_life_results/${report.id}`);
 stored.report.rank={available:true,percent:76,headline:'估算超过 76% 的同龄人',note:'旧模型'};
 for(const row of rows.values())if(row.summary){row.summary.rankHeadline='估算超过 76% 的同龄人';row.summary.rankNote='旧模型';}
 for(const event of [submit,{action:'getResult',id:report.id},{action:'completeGoal',id:report.id}]){
  const response=await service(event,'alice');
  assert.equal(response.report.rank.available,false);
  assert.equal(response.report.rank.percent,null);
  assert.equal(response.report.score,report.score);
  assert.equal(JSON.stringify(response).includes('76%'),false);
 }
 // Restore the current stored row after the goal transaction replaces it.
 rows.get(`peak_life_results/${report.id}`).report.rank={available:true,percent:76,headline:'估算超过 76% 的同龄人',note:'旧模型'};
 for(const event of [{action:'listResults'},{action:'createShare',id:report.id},{action:'getShare',token:share.token}]){
  const response=await service(event,'alice');
  assert.equal(response.ok,true);
  assert.equal(JSON.stringify(response).includes('76%'),false);
 }
});

test('cloud storage retains reports and retry hashes without full answers or duplicate share summaries',async()=>{
 const {service,submit,rows}=fixture();const {report}=await service(submit,'alice');
 const saved=rows.get(`peak_life_results/${report.id}`);
 assert.deepEqual(Object.keys(saved).sort(),['owner','createdAt','shareEpoch','report'].sort());
 assert.deepEqual(saved.report,report);
 assert.deepEqual(Object.keys(rows.get(`peak_life_requests/${report.id}`)).sort(),['owner','fingerprint','createdAt'].sort());
 const shared=await service({action:'createShare',id:report.id},'alice');
 const shareRow=[...rows.entries()].find(([key])=>key.startsWith('peak_life_shares/'))[1];
 assert.deepEqual(Object.keys(shareRow).sort(),['resultId','epoch','expiresAt'].sort());
 assert.deepEqual((await service({action:'getShare',token:shared.token},'')).summary,shared.summary);
 assert.equal(JSON.stringify([...rows.values()]).includes('"answers":'),false);
 assert.equal((await service(submit,'alice')).report.id,report.id);
 assert.equal((await service({...submit,answers:{...submit.answers,Q05:'B'}},'alice')).code,'IDEMPOTENCY_CONFLICT');
});

test('all owner report flows remove legacy raw answers while preserving report and other owners',async()=>{
 for(const action of ['getResult','listResults','submit','revokeShare','createShare','completeGoal']){
  const {service,submit,rows}=fixture();const {report}=await service(submit,'alice');
  const other=await service(submit,'bob');
  for(const id of [report.id,other.report.id])Object.assign(rows.get(`peak_life_results/${id}`),{answers:structuredClone(submit.answers),contribute:false});
  const before=structuredClone(rows.get(`peak_life_results/${report.id}`).report);
  const response=await service(action==='submit'?submit:action==='listResults'?{action}:{action,id:report.id},'alice');
  assert.equal(response.ok,true,action);
  const saved=rows.get(`peak_life_results/${report.id}`);
  assert.equal(Object.hasOwn(saved,'answers'),false,action);
  assert.equal(Object.hasOwn(saved,'contribute'),false,action);
  assert.equal(saved.report.score,before.score,action);
  assert.deepEqual(saved.report.axes,before.axes,action);
  assert.deepEqual(saved.report.persona,before.persona,action);
  assert.equal(Object.hasOwn(rows.get(`peak_life_results/${other.report.id}`),'answers'),true,action);
 }
});

test('legacy cleanup re-reads transaction state without losing goal completion or revocation',async()=>{
 const {service,submit,rows,repository}=fixture();const {report}=await service(submit,'alice');
 Object.assign(rows.get(`peak_life_results/${report.id}`),{answers:submit.answers});
 const transaction=repository.transaction;
 repository.transaction=work=>{
  const concurrent=rows.get(`peak_life_results/${report.id}`);concurrent.report.goal.done=true;concurrent.shareEpoch=5;
  return transaction(work);
 };
 const response=await service({action:'getResult',id:report.id},'alice');
 assert.equal(response.report.goal.done,true);
 assert.equal(rows.get(`peak_life_results/${report.id}`).shareEpoch,5);
 assert.equal(Object.hasOwn(rows.get(`peak_life_results/${report.id}`),'answers'),false);
});

test('legacy share summaries are removed on valid reads without changing public output or expiry',async()=>{
 const {service,submit,rows,advance}=fixture();const {report}=await service(submit,'alice');
 const shared=await service({action:'createShare',id:report.id},'alice');
 const [key,row]=[...rows.entries()].find(([key])=>key.startsWith('peak_life_shares/'));
 row.summary=structuredClone(shared.summary);
 const response=await service({action:'getShare',token:shared.token},'');
 assert.deepEqual(response.summary,shared.summary);
 assert.equal(Object.hasOwn(rows.get(key),'summary'),false);
 advance(7*86400000);
 assert.equal((await service({action:'getShare',token:shared.token},'')).code,'SHARE_UNAVAILABLE');
});
