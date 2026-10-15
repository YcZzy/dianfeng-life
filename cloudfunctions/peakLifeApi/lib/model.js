'use strict';
const bank=require('./questions.json');
const scoring=require('./scoring');
const personas=require('./personas');
const reference=require('./reference');
const {scoreAnswers}=scoring;
const {personaFor,goalFor,insightsFor}=personas;
const {MODEL_VERSION,rankAnswers}=reference;
function reportFor(a,id,createdAt){const s=scoreAnswers(a);return {id,createdAt,score:s.score,rank:rankAnswers(a),axes:s.axes,persona:personaFor(a),insights:insightsFor(a),goal:goalFor(a),completion:s.completion,modelVersion:MODEL_VERSION,quizVersion:bank.version};}
module.exports={...scoring,...personas,...reference,reportFor};
