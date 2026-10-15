const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/QUESTION_BANK.md'), 'utf8');
const blocks = [...source.matchAll(/^### (Q\d{2})｜([^\n]+)\n([\s\S]*?)(?=\n### |\n## |(?![\s\S]))/gm)];
const questions = blocks.map(([, id, heading, block]) => {
  const title = block.match(/\*\*([^*]+)\*\*/)[1];
  const line = block.split('\n').find((v) => v.startsWith('A. '));
  const options = [...line.matchAll(/([A-N])\. ([\s\S]*?)(?=；[A-N]\. |。?$)/g)]
    .map(([, optionId, text]) => ({ id: optionId, text: text.replace(/。$/, '') }));
  const axis = heading.match(/｜([EGBT RA])\d/);
  const kind = heading.endsWith('·P') ? 'P' : heading.endsWith('·I') ? 'I' : 'C';
  options.push({ id: 'X', text: '记不清／不好判断' }, { id: 'Y', text: '这题先不答' });
  const helpMatch = block.match(/说明：([\s\S]*?)(?:用途：|$)/);
  return { id, title, axis: axis ? axis[1] : null, kind, help: helpMatch ? helpMatch[1].trim() : '', options };
});
if (questions.length !== 26 || questions.some((q) => !q.options.length)) throw new Error('Question source is incomplete');
const axes = [
  { id: 'E', name: '经济底气', icon: 'wallet', short: '收入、储备与偿债余量' },
  { id: 'G', name: '生活支撑', icon: 'compass', short: '来源、进展与自主安排' },
  { id: 'B', name: '身体精力', icon: 'pulse', short: '休息恢复与日常状态' },
  { id: 'T', name: '时间自主', icon: 'clock', short: '留给自己多少空间' },
  { id: 'R', name: '关系支持', icon: 'users', short: '有人可找，也能做自己' },
  { id: 'A', name: '日常应对', icon: 'bolt', short: '启动、回稳与灵活应变' }
];
const content = { version: 'quiz-v2.1', questions, axes };
for (const relative of ['miniprogram/data/questions.js', 'cloudfunctions/peakLifeApi/lib/questions.json']) {
  const dest = path.join(root, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, (relative.endsWith('.js') ? 'module.exports = ' : '') + JSON.stringify(content, null, 2) + (relative.endsWith('.js') ? ';\n' : '\n'));
}
const oldPublicJson = path.join(root, 'miniprogram/data/questions.json');
if (fs.existsSync(oldPublicJson)) fs.unlinkSync(oldPublicJson);
console.log(`Generated ${questions.length} questions; public bundle contains wording only.`);
