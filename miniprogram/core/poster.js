function publicSummary(report) {
  return { personaTitle: report.persona.title, personaLine: report.persona.line, score: report.score, rankHeadline: report.rank.headline, rankNote: report.rank.note, createdAt: report.createdAt || '' };
}
function wrapText(context, text, maxWidth) {
  const lines = [];
  let current = '';
  Array.from(String(text || '')).forEach((char) => {
    if (char === '\n') { lines.push(current); current = ''; return; }
    if (current && context.measureText(current + char).width > maxWidth) { lines.push(current); current = char; }
    else current += char;
  });
  if (current) lines.push(current);
  return lines;
}
function drawPoster(canvas, summary, dpr) {
  const width = 600;
  const height = 900;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#F5F4EF'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#242B29'; ctx.font = '22px sans-serif';
  ctx.fillText('巅峰人生 / LIFE INDEX', 44, 62);
  ctx.strokeStyle = '#DDDCD3'; ctx.beginPath(); ctx.moveTo(44, 88); ctx.lineTo(556, 88); ctx.stroke();
  ctx.fillStyle = '#64706A'; ctx.font = '21px sans-serif'; ctx.fillText('我的生活配置报告', 44, 138);
  if (Number.isFinite(summary.score)) {
    ctx.fillStyle = '#A63E2C'; ctx.font = '126px sans-serif'; ctx.fillText(String(summary.score), 38, 282);
    ctx.fillStyle = '#242B29'; ctx.font = '27px sans-serif'; ctx.fillText('综合生活指数 / 100', 44, 330);
  } else {
    ctx.fillStyle = '#242B29'; ctx.font = '32px sans-serif';
    wrapText(ctx, summary.rankHeadline, 510).forEach((line, i) => ctx.fillText(line, 44, 220 + i * 46));
  }
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(32, 380, 536, 310);
  ctx.fillStyle = '#64706A'; ctx.font = '20px sans-serif'; ctx.fillText('我的生活类型', 56, 422);
  ctx.fillStyle = '#242B29'; ctx.font = 'bold 38px sans-serif';
  const titleLines = wrapText(ctx, summary.personaTitle, 488);
  titleLines.forEach((line, i) => ctx.fillText(line, 56, 478 + i * 50));
  ctx.font = '25px sans-serif';
  wrapText(ctx, summary.personaLine, 488).forEach((line, i) => ctx.fillText(line, 56, 540 + (titleLines.length - 1) * 50 + i * 36));
  ctx.fillStyle = '#64706A'; ctx.font = '18px sans-serif';
  wrapText(ctx, summary.rankNote, 510).forEach((line, i) => ctx.fillText(line, 44, 738 + i * 28));
  ctx.fillStyle = '#242B29'; ctx.font = '24px sans-serif'; ctx.fillText('你是什么配置？也来测一次。', 44, 826);
  ctx.fillStyle = '#64706A'; ctx.font = '17px sans-serif'; ctx.fillText('娱乐性自述测试 · 不代表现实成就', 44, 866);
}
function createPoster(page, summary) {
  return new Promise((resolve, reject) => {
    page.createSelectorQuery().select('#poster').fields({ node: true, size: true }).exec((res) => {
      const canvas = res && res[0] && res[0].node;
      if (!canvas) { reject(new Error('图片画布尚未准备好，请重试')); return; }
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        drawPoster(canvas, summary, Math.min(info.pixelRatio || 2, 3));
        wx.canvasToTempFilePath({ canvas, fileType: 'png', success: (r) => resolve(r.tempFilePath), fail: () => reject(new Error('图片生成未完成，请重试')) }, page);
      } catch (_) { reject(new Error('当前微信暂不支持生成图片，请更新微信后重试')); }
    });
  });
}
module.exports = { publicSummary, wrapText, drawPoster, createPoster };
