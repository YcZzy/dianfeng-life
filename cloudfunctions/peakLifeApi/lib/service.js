'use strict';
const crypto=require('node:crypto');
const bank=require('./questions.json');
const {reportFor,presentReport}=require('./model');
const RESULTS='peak_life_results', REQUESTS='peak_life_requests', SHARES='peak_life_shares';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
class ApiError extends Error { constructor(code,message,unsupportedFields){super(message);this.code=code;this.unsupportedFields=unsupportedFields;} }
const fail=(code,message)=>{throw new ApiError(code,message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const idValid=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
function validate(event){
 if(!plain(event)||typeof event.action!=='string')fail('INVALID_INPUT','请求格式不正确');
 const fields={submit:['requestId','quizVersion','answers','contribute'],getResult:['id'],listResults:[],deleteResult:['id'],createShare:['id'],getShare:['token'],revokeShare:['id'],completeGoal:['id']};
 const allowed=fields[event.action];if(!allowed)fail('UNKNOWN_ACTION','未知操作');
 const unsupported=Object.keys(event).filter(key=>key!=='action'&&!allowed.includes(key));
 if(unsupported.length)throw new ApiError('INVALID_INPUT','请求包含不支持的字段：'+unsupported.join('、'),unsupported);
 if(allowed.includes('id')&&!idValid(event.id))fail('INVALID_INPUT','结果编号不正确');
 if(event.action==='getShare'&&(typeof event.token!=='string'||!/^[a-f0-9]{48}$/.test(event.token)))fail('SHARE_UNAVAILABLE','分享不存在或已失效');
 if(event.action!=='submit')return;
 if(typeof event.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(event.requestId))fail('INVALID_INPUT','提交编号不正确，请保留本次提交编号重试');
 if(event.quizVersion!==bank.version)fail('VERSION_MISMATCH','题库已更新，请重新开始');
 // Older clients send false; calibration collection is not supported.
 if(event.contribute!==undefined&&event.contribute!==false)fail('INVALID_INPUT','当前不支持校准数据贡献');
 if(!plain(event.answers)||Object.keys(event.answers).length!==26||bank.questions.some(q=>!Object.prototype.hasOwnProperty.call(event.answers,q.id)||!q.options.some(o=>o.id===event.answers[q.id])))fail('INVALID_INPUT','请完整提交26道题的有效选项，跳过请使用跳过选项');
}
function summary(savedReport,expiresAt){const report=presentReport(savedReport);return {personaTitle:report.persona.title,personaLine:report.persona.line,score:report.score,rankHeadline:report.rank.headline,rankNote:report.rank.note,createdAt:report.createdAt,expiresAt};}
const hasRawAnswers=record=>Object.prototype.hasOwnProperty.call(record,'answers')||Object.prototype.hasOwnProperty.call(record,'contribute');
function compactRecord(record){const {answers,contribute,...retained}=record;return retained;}
function createService({repository,now=()=>Date.now(),randomBytes=crypto.randomBytes}){
 async function owned(store,id,owner){const record=await store.get(RESULTS,id);if(!record||record.owner!==owner)fail('NOT_FOUND','结果不存在或无权访问');return record;}
 async function cleanOwned(id,owner){return repository.transaction(async tx=>{
  // Re-read in the transaction so cleanup never overwrites a concurrent goal,
  // share revocation, or deletion with an older copy of the report.
  const record=await owned(tx,id,owner);
  if(hasRawAnswers(record))await tx.set(RESULTS,id,compactRecord(record));
  return compactRecord(record);
 });}
 return async function service(event,owner){
  try {
   validate(event);
   if(event.action!=='getShare'&&(typeof owner!=='string'||!owner))fail('UNAUTHENTICATED','请在微信内重新打开');
   if(event.action==='submit'){
    const id=hash(`${owner}\0${event.requestId}`);const normalized=Object.fromEntries(bank.questions.map(q=>[q.id,event.answers[q.id]]));
    // Preserve the existing fingerprint format for retries from older clients.
    const fingerprint=hash(JSON.stringify({quizVersion:event.quizVersion,answers:normalized,contribute:false}));
    return await repository.transaction(async tx=>{
     const previous=await tx.get(REQUESTS,id);
     if(previous){if(previous.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','同一提交编号不能用于不同答案');const record=await tx.get(RESULTS,id);if(!record)fail('RESULT_DELETED','该结果已删除，请重新开始一次测评');if(hasRawAnswers(record))await tx.set(RESULTS,id,compactRecord(record));return {ok:true,report:presentReport(record.report)};}
     const createdAt=new Date(now()).toISOString();const report=reportFor(normalized,id,createdAt);
     await tx.set(RESULTS,id,{owner,createdAt,shareEpoch:0,report});
     await tx.set(REQUESTS,id,{owner,fingerprint,createdAt});return {ok:true,report};
    });
   }
   if(event.action==='getResult'){
    let record=await owned(repository,event.id,owner);
    if(hasRawAnswers(record))record=await cleanOwned(event.id,owner);
    return {ok:true,report:presentReport(record.report)};
   }
   if(event.action==='listResults'){
    const rows=await repository.list(RESULTS,{owner});
    for(let i=0;i<rows.length;i++)if(hasRawAnswers(rows[i])){
     try{rows[i]=await cleanOwned(rows[i].report.id,owner);}
     catch(error){if(error instanceof ApiError&&error.code==='NOT_FOUND'){rows.splice(i--,1);}else throw error;}
    }
    return {ok:true,records:rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(row=>{const report=presentReport(row.report);return {id:report.id,createdAt:report.createdAt,score:report.score,personaTitle:report.persona.title,rankHeadline:report.rank.headline};})};
   }
   if(event.action==='getShare')return await repository.transaction(async tx=>{
    const shareId=hash(event.token);const share=await tx.get(SHARES,shareId);
    if(!share||share.expiresAt<=now())fail('SHARE_UNAVAILABLE','分享不存在或已失效');
    const record=await tx.get(RESULTS,share.resultId);
    if(!record||record.shareEpoch!==share.epoch)fail('SHARE_UNAVAILABLE','分享不存在或已失效');
    if(Object.prototype.hasOwnProperty.call(share,'summary')){const {summary:oldSummary,...retained}=share;await tx.set(SHARES,shareId,retained);}
    return {ok:true,summary:summary(record.report,new Date(share.expiresAt).toISOString())};
   });
   return await repository.transaction(async tx=>{
    const savedRecord=await owned(tx,event.id,owner);const record=compactRecord(savedRecord);
    if(event.action==='deleteResult'){await tx.remove(RESULTS,event.id);return {ok:true};}
    if(event.action==='revokeShare'){await tx.set(RESULTS,event.id,{...record,shareEpoch:record.shareEpoch+1});return {ok:true};}
    if(event.action==='completeGoal'){
     record.report=presentReport(record.report);record.report.goal.done=true;await tx.set(RESULTS,event.id,record);return {ok:true,report:record.report};
    }
    if(event.action==='createShare'){
     if(hasRawAnswers(savedRecord))await tx.set(RESULTS,event.id,record);
     const token=randomBytes(24).toString('hex');const expiresAt=now()+7*86400000;const safe=summary(record.report,new Date(expiresAt).toISOString());
     await tx.set(SHARES,hash(token),{resultId:event.id,epoch:record.shareEpoch,expiresAt});return {ok:true,token,summary:safe};
    }
    fail('UNKNOWN_ACTION','未知操作');
   });
  }catch(error){if(error instanceof ApiError)return {ok:false,code:error.code,message:error.message,...(error.unsupportedFields?{unsupportedFields:error.unsupportedFields}:{})};return {ok:false,code:'INTERNAL_ERROR',message:'服务暂时不可用，请保留本次提交编号后重试'};}
 };
}
module.exports={createService,validate,ApiError};
