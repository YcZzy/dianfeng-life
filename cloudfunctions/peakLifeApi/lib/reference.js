'use strict';
const bank=require('./questions.json');
const PRIORS=require('./priors.json');
const {SCORE,points,scoreAnswers}=require('./scoring');
const MODEL_VERSION='reference-engineering-v1';
function seeded(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function normal(rng){return Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng());}
function cdf(x){const sign=x<0?-1:1;const z=Math.abs(x)/Math.sqrt(2);const t=1/(1+.3275911*z);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);return (1+sign*erf)/2;}
const NEGATIVE=new Set(['Q03','Q04','Q06','Q10','Q13','Q14','Q16','Q17','Q18']);
const cache=new Map();
function referenceProfiles(age,{count=2048,dependency=.55,seed=211015}={}){
 const key=`${age}:${count}:${dependency}:${seed}`;if(cache.has(key))return cache.get(key);
 if(!PRIORS[age])return [];
 const rng=seeded(seed+age.charCodeAt(0)*7919); const profiles=[];
 for(let i=0;i<count;i++){const common=normal(rng),latent=Object.fromEntries(bank.axes.map(a=>[a.id,normal(rng)]));const profile={};
  for(const q of bank.questions){const axis=q.axis;let u;
   if(axis&&q.id!=='Q12'&&q.id!=='Q15'&&q.id!=='Q20') {let z=.25*common+dependency*latent[axis]+Math.sqrt(1-.25**2-dependency**2)*normal(rng);u=cdf(z);if(NEGATIVE.has(q.id))u=1-u;}else u=rng();
   const probs=PRIORS[age][q.id];let sum=0;const index=probs.findIndex(p=>(sum+=p)>u); profile[q.id]=q.options[index<0?probs.length-1:index].id;
  }profiles.push(Object.freeze(profile));
 }cache.set(key,Object.freeze(profiles));return cache.get(key);
}
function rankAnswers(a,options){const s=scoreAnswers(a);const note='参考模型估算，尚未完成真实样本校准';
 if(!s.comparable||!PRIORS[a.Q01])return {available:false,percent:null,headline:a.Q01==='A'?'未满16岁，暂不提供综合排名':'有效答案或年龄参考不足，暂不排名',note,source:MODEL_VERSION};
 const mask=Object.fromEntries(Object.keys(SCORE).map(id=>[id,points(id,a[id])!==null]));const peers=options?.peers||referenceProfiles(a.Q01,options);
 const eligible=peers.map(peer=>scoreAnswers(peer,mask)).filter(peer=>peer.comparable&&Number.isFinite(peer.rawScore));
 if(!eligible.length)return {available:false,percent:null,headline:'当前年龄参考不足，暂不排名',note,source:MODEL_VERSION};
 const lower=eligible.filter(peer=>peer.rawScore<s.rawScore).length;const percent=Math.floor(lower/eligible.length*100);
 return {available:true,percent,headline:`估算超过 ${percent}% 的同龄人`,note,source:MODEL_VERSION};
}
module.exports={MODEL_VERSION,PRIORS,rankAnswers,referenceProfiles};
