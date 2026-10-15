// Fixed UI example. Never calculated from personal answers, uploaded, or counted as a real result.
module.exports = {
  id: 'sample', sample: true, score: 72,
  rank: { available: true, percent: 76, headline: '估算超过 76%', note: '示例数字，仅用于预览界面', source: 'sample' },
  persona: { key: 'buffer', title: '缓冲区守护者', line: '不一定每局都赢，但给自己留了退出键。', description: '你给生活留了些回旋空间。未必每件事都追求最快，但关键时候，你更希望自己有得选。', evidence: [] },
  axes: require('./questions').axes.map((a, i) => Object.assign({}, a, { score: [65, 72, 58, 85, 76, 78][i] })),
  insights: [
    { title: '有余量，是你的隐藏装备', body: '这是一份固定示例报告，用于展示答案依据与解释的呈现方式。它不会根据你的作答改变，也不会记录为你的真实成绩。' },
    { title: '生活不用每一项都满分', body: '真实报告会根据你的答案组合，分别解释已有的底气与近期的消耗。' }
  ],
  goal: { id: 'sample-goal', title: '给一件小事留两分钟', description: '选一件一直惦记的小事，把它拆成现在就能开始的一步。', minutes: 2, done: false },
  completion: { valid: 19, total: 19 }, quizVersion: 'quiz-v2.1', modelVersion: 'sample'
};
