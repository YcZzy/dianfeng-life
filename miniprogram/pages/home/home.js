const draft = require('../../core/draft');
const content = require('../../data/questions');
Page({
  data: { count: content.questions.length, hasDraft: false, answered: 0, cloudReady: false, error: '', axes: content.axes },
  onShow() {
    const d = draft.read();
    this.setData({ hasDraft: !!d, answered: d ? Object.keys(d.answers || {}).length : 0, cloudReady: getApp().globalData.cloudReady });
  },
  onStart() {
    if (!this.data.cloudReady) { this.setData({ error: '云环境尚未连接。可以先体验答题流程，或按照项目 README 配置微信云开发。' }); return; }
    getApp().globalData.sampleMode = false;
    wx.navigateTo({ url: '/pages/quiz/quiz' });
  },
  onSampleQuiz() { getApp().globalData.sampleMode = true; wx.navigateTo({ url: '/pages/quiz/quiz?sample=1' }); },
  onSampleReport() { wx.navigateTo({ url: '/pages/result/result?sample=1' }); },
  onRecords() { wx.navigateTo({ url: '/pages/records/records' }); },
  onAbout() { wx.navigateTo({ url: '/pages/about/about' }); }
});
