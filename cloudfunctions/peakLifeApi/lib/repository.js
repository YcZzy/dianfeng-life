'use strict';
// Client database access must be denied. Only this server-side SDK reads these collections.
function createRepository(db){
 function store(database){return {
  async get(collection,id){try{const result=await database.collection(collection).doc(id).get();return result.data||null;}catch(error){
   // Only absent documents are treated as missing; transport/permission errors must propagate.
   if(error.errCode===-1&&/does not exist|not exist|不存在/i.test(error.errMsg||error.message||''))return null;
   if(/DOCUMENT_NOT_FOUND|DATABASE_DOCUMENT_NOT_EXIST/.test(String(error.code||error.errCode)))return null;
   throw error;
  }},
  async set(collection,id,data){const {_id,_openid,...writable}=data;await database.collection(collection).doc(id).set({data:writable});},
  async remove(collection,id){await database.collection(collection).doc(id).remove();}
 };}
 const base=store(db);
 return {...base,async list(collection,where){
  const rows=[];let offset=0;
  // Stable paging avoids silent omission after the native query page limit.
  while(true){const result=await db.collection(collection).where(where).orderBy('createdAt','desc').orderBy('_id','asc').skip(offset).limit(100).get();rows.push(...result.data);if(result.data.length<100)break;offset+=result.data.length;}return rows;
 },transaction(work){return db.runTransaction(tx=>work(store(tx)));}};
}
module.exports={createRepository};
