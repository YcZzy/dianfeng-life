const test=require('node:test');const assert=require('node:assert/strict');
const {createRepository}=require('../cloudfunctions/peakLifeApi/lib/repository');
test('native adapter strips read-only DB metadata when persisting goal or revocation updates',async()=>{
 let written;
 const doc={async set({data}){written=data;}};
 const repo=createRepository({collection:()=>({doc:()=>doc})});
 await repo.set('peak_life_results','id',{_id:'id',_openid:'legacy',owner:'alice',shareEpoch:1});
 assert.deepEqual(written,{owner:'alice',shareEpoch:1});
});
test('native adapter distinguishes missing documents from infrastructure failures',async()=>{
 const db=error=>({collection:()=>({doc:()=>({async get(){throw error}})})});
 assert.equal(await createRepository(db({errCode:-1,message:'document with _id abc does not exist'})).get('peak_life_results','abc'),null);
 await assert.rejects(()=>createRepository(db(new Error('transport unavailable'))).get('peak_life_results','abc'),/transport/);
});
test('native adapter pages all history records and delegates atomic callback return value',async()=>{
 const data=Array.from({length:205},(_,id)=>({id,owner:'alice'}));let offset=0;const collection={where(){return this},orderBy(){return this},skip(n){offset=n;return this},limit(){return this},async get(){return {data:data.slice(offset,offset+100)}}};
 const db={collection:()=>collection,runTransaction:async callback=>callback({collection:()=>({doc:()=>({async get(){return {data:{value:7}}}})})})};
 const repo=createRepository(db);assert.equal((await repo.list('peak_life_results',{owner:'alice'})).length,205);
 assert.equal(await repo.transaction(async tx=>(await tx.get('c','id')).value),7);
});
