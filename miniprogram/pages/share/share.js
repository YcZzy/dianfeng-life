const api = require('../../core/api');
const poster = require('../../core/poster');
Page({
  data: { loading: true, error: '', summary: null, publicView: false, token: '', creating: false, generating: false, revoked: false, actionError: '' },
  onLoad(options) {
    wx.hideShareMenu();
    this.id = options.id || '';
    this.incomingToken = options.token || '';
    this.fetch();
  },
  onUnload() { this.disposed = true; },
  fetch() {
    this.setData({ loading: true, error: '' });
    const action = this.incomingToken ? 'getShare' : 'getResult';
    api.call(action, this.incomingToken ? { token: this.incomingToken } : { id: this.id }).then((r) => {
      if (this.disposed) return;
      this.setData({ loading: false, summary: this.incomingToken ? r.summary : poster.publicSummary(r.report), publicView: !!this.incomingToken, token: this.incomingToken });
      if (this.incomingToken) wx.showShareMenu({ menus: ['shareAppMessage'] });
    }).catch((e) => { if (!this.disposed) this.setData({ loading: false, error: e.message, publicView: !!this.incomingToken }); });
  },
  onCreate() {
    if (this.data.creating) return;
    this.setData({ creating: true, actionError: '' });
    api.call('createShare', { id: this.id }).then((r) => {
      if (this.disposed) return;
      this.setData({ token: r.token, summary: r.summary, revoked: false });
      wx.showShareMenu({ menus: ['shareAppMessage'] });
    }).catch((e) => { if (!this.disposed) this.setData({ actionError: e.message }); }).finally(() => { if (!this.disposed) this.setData({ creating: false }); });
  },
  onShareAppMessage() {
    if (!this.data.token || this.data.revoked) return { title: '你的人生，是什么配置？', path: '/pages/home/home' };
    return { title: '我是「' + this.data.summary.personaTitle + '」，你呢？', path: '/pages/share/share?token=' + encodeURIComponent(this.data.token) };
  },
  onImage() {
    if (this.data.generating) return;
    this.setData({ generating: true, actionError: '' });
    poster.createPoster(this, this.data.summary).then((url) => {
      if (!this.disposed) wx.previewImage({ current: url, urls: [url] });
    }).catch((e) => { if (!this.disposed) this.setData({ actionError: e.message }); }).finally(() => { if (!this.disposed) this.setData({ generating: false }); });
  },
  onRevoke() {
    wx.showModal({ title: '撤销公开分享？', content: '这份报告已有的分享链接都会失效，已保存的图片无法远程撤回。', confirmText: '撤销分享', confirmColor: '#A63E2C', success: (r) => {
      if (!r.confirm || this.disposed) return;
      api.call('revokeShare', { id: this.id }).then(() => {
        if (!this.disposed) { this.setData({ token: '', revoked: true }); wx.hideShareMenu(); }
      }).catch((e) => { if (!this.disposed) this.setData({ actionError: e.message }); });
    } });
  },
  onStart() { wx.reLaunch({ url: '/pages/home/home' }); }
});
