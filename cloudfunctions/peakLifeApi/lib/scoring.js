'use strict';
const bank=require('./questions.json');
const SCORE = {
 Q03:[100,75,50,25,0], Q04:[100,75,50,25,0], Q05:[0,10,20,35,50,65,80,90,100],
 Q08:[0,40,70,90,100], Q09:[0,10,25,40,60,75,85,95,100], Q10:[100,75,50,25,0],
 Q11:[0,20,45,70,100,100], Q13:[100,75,50,25,0], Q14:[100,75,50,25,0],
 Q16:[100,85,65,40,15,0,0], Q17:[100,75,50,25,0], Q18:[100,75,50,25,0],
 Q19:[null,0,35,70,100], Q21:[0,50,100,100,100], Q22:[0,25,50,75,100], Q23:[0,25,50,75,100],
 Q24:[0,25,50,75,100], Q25:[0,25,50,75,100], Q26:[0,100,100,100]
};
const GROUPS={E:['Q05','Q09','Q16','Q22'],G:['Q13','Q19','Q23'],B:['Q03','Q10','Q21'],T:['Q11','Q17','Q25'],R:['Q08','Q18','Q24'],A:['Q04','Q14','Q26']};
function points(id,answer){const value=SCORE[id]?.[String(answer).charCodeAt(0)-65];return Number.isFinite(value)?value:null;}
function weighted(items){const valid=items.filter(([v])=>v!==null);return valid.length?valid.reduce((n,[v,w])=>n+v*w,0)/valid.reduce((n,[,w])=>n+w,0):null;}
function scoreAnswers(answers, mask){
 const p=Object.fromEntries(Object.keys(SCORE).map(id=>[id,(!mask||mask[id])?points(id,answers[id]):null]));
 const raw={ E:weighted([[p.Q05,.35],[weighted([[p.Q09,1],[p.Q22,1]]),.25],[p.Q16,.4]]),
 G:weighted(GROUPS.G.map(q=>[p[q],1])), B:weighted([[weighted([[p.Q03,1],[p.Q10,1]]),.8],[p.Q21,.2]]),
 T:weighted(GROUPS.T.map(q=>[p[q],1])), R:weighted(GROUPS.R.map(q=>[p[q],1])), A:weighted(GROUPS.A.map(q=>[p[q],1])) };
 const valid=Object.values(p).filter(v=>v!==null).length;
 const comparable=valid>=16&&Object.values(GROUPS).every(ids=>ids.filter(id=>p[id]!==null).length>=2);
 const rawScore=comparable?Object.values(raw).reduce((n,v)=>n+v,0)/6:null;
 return {score:rawScore===null?null:Math.round(rawScore),rawScore,rawAxes:raw,comparable,completion:{valid,total:19},axes:bank.axes.map(a=>({...a,score:raw[a.id]===null?null:Math.round(raw[a.id])}))};
}
module.exports={SCORE,GROUPS,points,scoreAnswers};
