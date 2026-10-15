'use strict';
const cloud=require('wx-server-sdk');
const {createRepository}=require('./lib/repository');
const {createService}=require('./lib/service');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const service=createService({repository:createRepository(cloud.database())});
exports.main=async event=>service(event,cloud.getWXContext().OPENID);
