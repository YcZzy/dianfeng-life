const fs = require('node:fs');
const path = require('node:path');
const shapes = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h18M17 12h4v5h-4a2.5 2.5 0 0 1 0-5Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  history: '<path d="M3 4v5h5M3 9a9 9 0 1 1 0 6M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  note: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  refresh: '<path d="M20 4v6h-6M4 20v-6h6M20 10a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5"/>'
};
const colors = { ink: '#242B29', muted: '#64706A', accent: '#A63E2C', white: '#FFFFFF' };
const icons = {};
Object.keys(shapes).forEach((name) => {
  icons[name] = {};
  Object.keys(colors).forEach((color) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${colors[color]}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name]}</svg>`;
    icons[name][color] = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  });
});
const dest = path.join(__dirname, '../miniprogram/components/icon/icons.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, 'module.exports = ' + JSON.stringify(icons) + ';\n');
console.log('Generated 18 consistent line icons.');
