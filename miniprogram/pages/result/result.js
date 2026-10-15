const api = require('../../core/api');
Page({
  data: { loading: true, error: '', report: null, axes: [], secondaryTags: [], expanded: false, completing: false, goalError: '' },
  onLoad(options) {
    this.id = options.id || '';
    wx.hideShareMenu();
    this.fetch();
  },
  onUnload() { this.disposed = true; },
  apply(report) {
    if (this.disposed) return;
    this.setData({ loading: false, error: '', report, secondaryTags: (report.persona.tags || []).filter((tag) => tag.key !== report.persona.key), axes: (report.axes || []).map((a) => Object.assign({}, a, { scoreText: a.score === null ? '—' : Math.round(a.score), bar: a.score === null ? 0 : Math.max(0, Math.min(100, a.score)) })) });
  },
  fetch() {
    this.setData({ loading: true, error: '' });
    api.call('getResult', { id: this.id }).then((r) => this.apply(r.report)).catch((e) => {
      if (!this.disposed) this.setData({ loading: false, error: e.message });
    });
  },
  onExpand() { this.setData({ expanded: !this.data.expanded }); },
  onShareCard() { wx.navigateTo({ url: '/pages/share/share?id=' + encodeURIComponent(this.id) }); },
  onAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  onHome() { wx.reLaunch({ url: '/pages/home/home' }); },
  onCompleteGoal() {
    if (this.data.completing || this.data.report.goal.done) return;
    this.setData({ completing: true, goalError: '' });
    api.call('completeGoal', { id: this.id }).then((r) => this.apply(r.report)).catch((e) => {
      if (!this.disposed) this.setData({ goalError: e.message });
    }).finally(() => { if (!this.disposed) this.setData({ completing: false }); });
  }
});
