'use strict';
const bank=require('./questions.json');
const scoring=require('./scoring');
const personas=require('./personas');
const {scoreAnswers}=scoring;
const {personaFor,goalFor,insightsFor}=personas;
const MODEL_VERSION='scoring-v1';
function rankForScore(score){return {available:false,percent:null,headline:Number.isFinite(score)?`综合生活指数 ${score} / 100`:'有效答案不足，暂不提供综合指数',note:'指数由本次有效作答计算；暂无真实同龄样本，不提供排名',source:MODEL_VERSION};}
// Existing reports may contain retired synthetic percentiles; never expose them.
function presentReport(report){return {...report,rank:rankForScore(report.score)};}
function reportFor(a,id,createdAt){const s=scoreAnswers(a);return {id,createdAt,score:s.score,rank:rankForScore(s.score),axes:s.axes,persona:personaFor(a),insights:insightsFor(a),goal:goalFor(a),completion:s.completion,modelVersion:MODEL_VERSION,quizVersion:bank.version};}
module.exports={...scoring,...personas,MODEL_VERSION,presentReport,reportFor};
