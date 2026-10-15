const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
const all = files(root);
for (const file of all.filter((v) => v.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${path.relative(root, file)}: ${r.stderr}`);
}
for (const file of all.filter((v) => v.endsWith('.json'))) JSON.parse(fs.readFileSync(file, 'utf8'));
const app = require('../miniprogram/app.json');
assert.equal(app.pages.length, 6);
assert.ok(!app.permission && !app.requiredPrivateInfos, 'No authorization scopes may be declared');
const bank = require('../miniprogram/data/questions');
const serverBank = require('../cloudfunctions/peakLifeApi/lib/questions.json');
assert.deepEqual(bank, serverBank);
assert.equal(bank.questions.length, 26);
assert.equal(new Set(bank.questions.map((q) => q.id)).size, 26);
assert.equal(bank.questions.filter(q => q.kind === 'P').length, 19);
assert.equal(bank.questions.filter(q => q.kind === 'I').length, 5);
assert.equal(bank.questions.filter(q => q.kind === 'C').length, 2);
assert.ok(bank.questions.every(q => q.options.every(o => !o.text.includes('\r'))), 'Question text must not contain CRLF artifacts');
assert.ok(!/"score"\s*:|"probabilities"\s*:/.test(JSON.stringify(bank)), 'Client questions must not hold scores/model priors');
const miniFiles = all.filter((v) => v.startsWith(path.join(root, 'miniprogram')));
for (const file of miniFiles.filter((v) => /\.(js|wxml|wxss)$/.test(v))) {
  const s = fs.readFileSync(file, 'utf8');
  assert.ok(!/\p{Extended_Pictographic}/u.test(s), `${file}: Emoji is not permitted`);
  assert.ok(!/wx\.(?:getUserProfile|getUserInfo|authorize|requestSubscribeMessage|saveImageToPhotosAlbum|login)\s*\(/.test(s), `${file}: Unrequested auth/login API`);
  assert.ok(!/require\([^)]*\.json['"]\)/.test(s), `${file}: Native mini-program cannot require JSON modules`);
}
for (const page of app.pages) {
  const base = path.join(root, 'miniprogram', page);
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) assert.ok(fs.existsSync(base + ext), `Missing ${page}${ext}`);
  const wxml = fs.readFileSync(base + '.wxml', 'utf8');
  const js = fs.readFileSync(base + '.js', 'utf8');
  for (const [, name] of wxml.matchAll(/(?:bind|catch)(?::)?(?:tap|change|confirm)="([A-Za-z_$][\w$]*)"/g)) {
    assert.ok(new RegExp(`\\b${name}\\s*\\(`).test(js), `${page}: Missing event handler ${name}`);
  }
  assert.ok(!/<(?:br|div|span|h1|p)\b/.test(wxml), `${page}: Use native WXML elements`);
}
const quiz = fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.wxml'), 'utf8');
assert.ok(!/bindtap="onNext"|>下一题<|>生成报告</.test(quiz), 'Answer selection must auto-advance');
const compilerDir = '/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec';
for (const [binary, ext] of [['wcc', '.wxml'], ['wcsc', '.wxss']]) {
  const executable = path.join(compilerDir, binary);
  if (!fs.existsSync(executable)) { console.log(`Native ${binary} compiler unavailable; static checks completed.`); continue; }
  const targets = miniFiles.filter((v) => v.endsWith(ext));
  const result = spawnSync(executable, targets, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  assert.equal(result.status, 0, `${binary} compilation failed: ${result.stderr}\n${result.stdout.slice(0, 2000)}`);
  console.log(`Native ${binary}: ${targets.length} files compiled.`);
}
console.log('Project checks passed: 6 routes, 26 public questions, matching server content, valid handlers, no login/auth/Emoji, server-only scores.');
