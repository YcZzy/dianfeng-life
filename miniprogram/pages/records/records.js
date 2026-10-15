const api = require('../../core/api');
Page({
  data: { loading: true, error: '', records: [], deleting: '' },
  onShow() { this.fetch(); },
  onUnload() { this.disposed = true; },
  fetch() {
    this.setData({ loading: true, error: '' });
    api.call('listResults').then((r) => {
      if (!this.disposed) this.setData({ loading: false, records: (r.records || []).map((v) => Object.assign({}, v, { dateText: v.createdAt ? new Date(v.createdAt).toLocaleDateString('zh-CN') : '', scoreText: v.score === null ? '—' : v.score })) });
    }).catch((e) => { if (!this.disposed) this.setData({ loading: false, error: e.message }); });
  },
  onOpen(e) { wx.navigateTo({ url: '/pages/result/result?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
  onStart() { wx.reLaunch({ url: '/pages/home/home' }); },
  onDelete(e) {
    if (this.data.deleting) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除这份报告？', content: '报告及相关公开分享将失效。删除后无法恢复。', confirmText: '删除报告', confirmColor: '#A63E2C', success: (r) => {
      if (!r.confirm || this.disposed) return;
      this.setData({ deleting: id, error: '' });
      api.call('deleteResult', { id }).then(() => this.fetch()).catch((err) => { if (!this.disposed) this.setData({ error: err.message }); }).finally(() => { if (!this.disposed) this.setData({ deleting: '' }); });
    } });
  }
});
