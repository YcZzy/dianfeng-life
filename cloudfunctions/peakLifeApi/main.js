'use strict';
const cloud=require('wx-server-sdk');
const {createRepository}=require('./lib/repository');
const {createService}=require('./lib/service');
const API_VERSION='2026-10-15.5';
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const service=createService({repository:createRepository(cloud.database())});
exports.main=async event=>{
 // Identity comes from the trusted SDK context, not platform event metadata.
 if(event!==null&&typeof event==='object'&&!Array.isArray(event)){
  const {userInfo,tcbContext,...input}=event;
  event=input;
 }
 const result=await service(event,cloud.getWXContext().OPENID);
 return {...result,apiVersion:API_VERSION};
};
