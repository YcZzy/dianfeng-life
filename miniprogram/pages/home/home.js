const draft = require('../../core/draft');
const content = require('../../data/questions');
Page({
  data: { count: content.questions.length, hasDraft: false, answered: 0, cloudReady: false, error: '', axes: content.axes },
  onShow() {
    const d = draft.read();
    this.setData({ hasDraft: !!d, answered: d ? Object.keys(d.answers || {}).length : 0, cloudReady: getApp().globalData.cloudReady });
  },
  onStart() {
    if (!this.data.cloudReady) { this.setData({ error: getApp().globalData.bootError || '服务暂时无法连接，请稍后重试。' }); return; }
    wx.navigateTo({ url: '/pages/quiz/quiz' });
  },
  onRecords() { wx.navigateTo({ url: '/pages/records/records' }); },
  onAbout() { wx.navigateTo({ url: '/pages/about/about' }); }
});
