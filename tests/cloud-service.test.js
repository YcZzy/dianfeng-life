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
 return {service,submit,rows,advance:ms=>{time+=ms}};
}
test('validates all keys and options, version and authenticated owner',async()=>{
 const {service,submit}=fixture();
 for(const bad of [{...submit,answers:{...submit.answers,Q27:'A'}},{...submit,answers:{...submit.answers,Q05:'Z'}},{...submit,quizVersion:'old'},{...submit,requestId:''}]) assert.equal((await service(bad,'alice')).ok,false);
 assert.equal((await service(submit,'')).code,'UNAUTHENTICATED');
 assert.equal((await service({...submit,owner:'bob',score:100},'alice')).code,'INVALID_INPUT');
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
