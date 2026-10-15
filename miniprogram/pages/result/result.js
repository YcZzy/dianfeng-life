const api = require('../../core/api');
Page({
  data: { loading: true, error: '', report: null, axes: [], secondaryTags: [], expanded: false, completing: false, goalError: '', sample: false },
  onLoad(options) {
    this.id = options.id || '';
    this.sample = options.sample === '1';
    wx.hideShareMenu();
    this.fetch();
  },
  onUnload() { this.disposed = true; },
  apply(report) {
    if (this.disposed) return;
    this.setData({ loading: false, error: '', report, sample: this.sample, secondaryTags: (report.persona.tags || []).filter((tag) => tag.key !== report.persona.key), axes: (report.axes || []).map((a) => Object.assign({}, a, { scoreText: a.score === null ? '—' : Math.round(a.score), bar: a.score === null ? 0 : Math.max(0, Math.min(100, a.score)) })) });
  },
  fetch() {
    this.setData({ loading: true, error: '' });
    if (this.sample) { this.apply(JSON.parse(JSON.stringify(require('../../data/sample')))); return; }
    api.call('getResult', { id: this.id }).then((r) => this.apply(r.report)).catch((e) => {
      if (!this.disposed) this.setData({ loading: false, error: e.message });
    });
  },
  onExpand() { this.setData({ expanded: !this.data.expanded }); },
  onShareCard() { wx.navigateTo({ url: '/pages/share/share?' + (this.sample ? 'sample=1' : 'id=' + encodeURIComponent(this.id)) }); },
  onAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  onHome() { wx.reLaunch({ url: '/pages/home/home' }); },
  onCompleteGoal() {
    if (this.data.completing || this.data.report.goal.done) return;
    if (this.sample) { this.setData({ 'report.goal.done': true }); return; }
    this.setData({ completing: true, goalError: '' });
    api.call('completeGoal', { id: this.id }).then((r) => this.apply(r.report)).catch((e) => {
      if (!this.disposed) this.setData({ goalError: e.message });
    }).finally(() => { if (!this.disposed) this.setData({ completing: false }); });
  }
});
