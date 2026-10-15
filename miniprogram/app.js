const config = require('./config');
App({
  globalData: { cloudReady: false, bootError: '' },
  onLaunch() {
    if (!config.cloudEnv) {
      this.globalData.bootError = '云开发环境尚未配置';
      return;
    }
    if (!wx.cloud) {
      this.globalData.bootError = '请更新微信后重试';
      return;
    }
    wx.cloud.init({ env: config.cloudEnv, traceUser: false });
    this.globalData.cloudReady = true;
  }
});
