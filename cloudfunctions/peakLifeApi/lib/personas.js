'use strict';
const bank=require('./questions.json');
const {GROUPS}=require('./scoring');
const questions=Object.fromEntries(bank.questions.map(q=>[q.id,q]));
const has=(a,id,set)=>set.includes(a[id]);
function evidence(ids,a){return [...new Set(ids)].filter(id=>questions[id]&&!['X','Y','N'].includes(a[id])&&!(id==='Q19'&&a[id]==='A')).map(id=>({questionId:id,title:questions[id].title,answer:questions[id].options.find(o=>o.id===a[id])?.text||''}));}
const PERSONAS=[
 {key:'battery',title:'人生满配，电量告急',line:'钱包攒下了底气，电量还没跟上进度。',description:'你报告的收入或现金储备较充足，同时近期恢复感不足、休息余量较少。这是近期状态的组合，不是健康诊断。',test:a=>(has(a,'Q05','GHI')||has(a,'Q09','GHI'))&&has(a,'Q03','DE')&&(has(a,'Q11','AB')||has(a,'Q17','DE')),ids:a=>[has(a,'Q05','GHI')?'Q05':'Q09','Q03',has(a,'Q11','AB')?'Q11':'Q17']},
 {key:'service',title:'人间客服',line:'别人的需求秒回，自己的需求排队。',description:'你更常先接下临时请求；休息安排和关系消耗也多次影响自己的事。这里描述最近的作答，不代表固定性格。',test:a=>a.Q12==='A'&&has(a,'Q17','CDE')&&has(a,'Q18','CDE'),ids:()=>['Q12','Q17','Q18']},
 {key:'overtime',title:'脑内加班员',line:'事情已经下班，脑子还在续会。',description:'已结束的小事和关系相处仍多次影响眼前安排，可以观察哪些事情还需要处理。这不构成任何心理诊断。',test:a=>has(a,'Q04','DE')&&has(a,'Q18','CDE'),ids:()=>['Q04','Q18']},
 {key:'planner',title:'计划界劳模',line:'明天的安排很充实，今天主要负责安排明天。',description:'你想学的东西尚未完整启动，也报告了有时间时仍没开始和目标尚未形成进展。可以先尝试一个更小的起步动作。',test:a=>has(a,'Q07','BC')&&has(a,'Q14','CDE')&&has(a,'Q19','BC'),ids:()=>['Q07','Q14','Q19']},
 {key:'lowpower',title:'低电量硬撑员',line:'日程还在运行，电池已经开始省电。',description:'近期恢复感、身体影响和必要事务占用同时带来负担。这里观察自述状态，不推断疾病或长期身体状况。',test:a=>has(a,'Q03','DE')&&has(a,'Q10','CDE')&&has(a,'Q06','EFG'),ids:()=>['Q03','Q10','Q06']},
 {key:'buffer',title:'缓冲区守护者',line:'不一定每局都赢，但给自己留了退出键。',description:'你自述有一定现金缓冲、较少偿债压力和可安排时间。缓冲描述当前情况，不保证未来没有风险。',test:a=>has(a,'Q22','DE')&&has(a,'Q16','AB')&&has(a,'Q11','DEF'),ids:()=>['Q22','Q16','Q11']},
 {key:'schedule',title:'生活有自己的班表',line:'别人替生活打卡，你给生活排班。',description:'你的时间余量、短时暂停和事务优先级都有较多自主空间。这不评价生活身份，也不把空闲直接等同于人生更好。',test:a=>has(a,'Q11','DEF')&&has(a,'Q25','DE')&&has(a,'Q23','DE'),ids:()=>['Q11','Q25','Q23']},
 {key:'patch',title:'临场补丁师',line:'计划偶尔掉线，你总能先补一块。',description:'你描述过找到替代办法，也完成了在意的事情的小步骤，近期启动阻碍较少。这是一次回忆期内的行动，不夸大为稳定能力。',test:a=>has(a,'Q26','BCD')&&has(a,'Q19','DE')&&has(a,'Q14','AB'),ids:()=>['Q26','Q19','Q14']}
];
function personaFor(a){
 const matches=PERSONAS.filter(rule=>rule.test(a));
 const tags=matches.map(rule=>({key:rule.key,title:rule.title,line:rule.line,evidence:evidence(rule.ids(a),a)}));
 const rule=matches[0];
 if(rule)return {key:rule.key,title:rule.title,line:rule.line,description:rule.description,evidence:evidence(rule.ids(a),a),tags};
 return {key:'mixed',title:'生活混合模式',line:'你没有按同一种方式处理所有事情，得拆开看。',description:'目前没有完整符合某一个类型的答案组合。下面只呈现有效作答中的差异；未知部分保留未知。',evidence:evidence(['Q03','Q11','Q23','Q24'],a),tags};
}
function goalFor(a){let goal;
 if(has(a,'Q07','BC')&&has(a,'Q14','CDE'))goal=['start','把开始缩到两分钟','把一件想做的事写成一个两分钟内能开始的动作。',2];
 else if(a.Q12==='A'&&has(a,'Q17','CDE'))goal=['boundary','先留一句缓冲回复','保存这句回复：我看一下今天的安排，再告诉你能不能接。',2];
 else if(has(a,'Q04','CDE'))goal=['close','给一件小事标记下一步','写下：这件事还有哪一步需要我处理？没有下一步就先标记结束。',3];
 else if(has(a,'Q09','XY')||has(a,'Q22','XY'))goal=['cash','查一个自己的储备范围','查看本人账户与必要月支出，先得到一个储备范围。',5];
 else goal=['pause','给自己留两分钟','选择一个方便的时候，写下今天愿意留给自己的一件小事。',2];
 return {id:goal[0],title:goal[1],description:goal[2],minutes:goal[3],done:false};
}
function insightsFor(a){
 const insights=[];
 function add(title,ids,observation,interpretation){
  const ev=evidence(ids,a);if(ev.length!==ids.length)return;
  const details=ev.map(e=>`“${e.answer}”`).join('；');
  insights.push({title,body:`${observation}你的两条回答是：${details}。${interpretation}`});
 }
 if(has(a,'Q05','FGHI')&&has(a,'Q09','ABC'))add('收入与储备还没同步',['Q05','Q09'],'收入还没有完全转化成现金储备。','具体原因可能与支出安排或积累时间有关，答案本身无法判断。可结合还款和必要支出，再看当前缓冲。');
 if(has(a,'Q11','AB')&&has(a,'Q17','CDE'))add('休息空间需要被看见',['Q11','Q17'],'可自由安排的时间较少，原定休息也多次被临时事务占用。','累可能同时来自时间总量和安排被打断；如果条件允许，可先为一次短休息留出明确边界。这里说的是近期安排。');
 if(has(a,'Q03','DE')&&(has(a,'Q06','EFG')||has(a,'Q10','CDE'))){const other=has(a,'Q06','EFG')?'Q06':'Q10';add('日程在跑，恢复需要空间',['Q03',other],'你近期较多天没恢复过来，也报告了较长的必要事务占用或身体对日常的影响。','恢复可能需要和任务安排一起考虑，不只看睡了多久。这不能判断长期身体状况，也不替代专业评估。');}
 if(has(a,'Q08','BCDE')&&has(a,'Q24','CDE'))add('帮助与理解是两种支撑',['Q08','Q24'],'你能联系到愿意提供实际帮助的人，也有一定表达真实感受的空间。','实际帮忙和被理解各有作用；可以记住这些具体联系，而不用要求某一个人解决所有事。');
 if(has(a,'Q07','BC')&&has(a,'Q14','CDE'))add('愿望已经有了，开始可以更小',['Q07','Q14'],'想学的事情还没形成一次完整练习，有可用时间时也多次没开始。','如果你仍想推进，可把第一步缩到两分钟以内。一次启动困难不代表缺乏能力，也不否定资源和精力的限制。');
 if(has(a,'Q19','DE')&&has(a,'Q14','AB'))add('小步骤已经落地',['Q19','Q14'],'你在在意的事情上完成了进展，近期有时间却没开始的情况较少。','可以保留这次有效的小步骤，下一次再尝试复用；这是一段时间内的行动，不是对永久行动力的判定。');
 if(has(a,'Q04','DE')&&has(a,'Q18','CDE'))add('有些消耗在事情结束之后',['Q04','Q18'],'已经结束的小事和相处后的疲惫，都多次影响了眼前安排。','可以区分仍有下一步要处理的事与暂时不用处理的事。这段观察不解释性格或成长经历。');
 // Concrete combinations lead. Remaining slots retain two observations without inventing a cause.
 for(const axis of bank.axes){if(insights.length>=3)break;const ev=evidence(GROUPS[axis.id],a).slice(0,2);if(ev.length<2)continue;
  insights.push({title:`${axis.name}：先看看当前安排`,body:`在这个方面，你分别选择了“${ev[0].answer}”和“${ev[1].answer}”。它们对应“${ev[0].title}”与“${ev[1].title}”，描述的是两种不同体验。可以先留意哪一项更影响眼前生活，再决定是否调整；答案不足以推断长期原因。`});
 }
 return insights.slice(0,3);
}
module.exports={personaFor,goalFor,insightsFor};
