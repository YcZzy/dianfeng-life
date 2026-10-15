const config = require('../config');
function call(action, data) {
  if (!getApp().globalData.cloudReady) return Promise.reject(new Error('云开发环境尚未配置，请先配置环境后重试。'));
  return wx.cloud.callFunction({ name: config.functionName, config: { env: config.cloudEnv }, data: Object.assign({}, data, { action }) }).then((response) => {
    const r = response.result;
    if (!r || !r.ok) {
      const e = new Error(r && r.message ? r.message : '暂时无法完成，请稍后重试');
      e.code = r && r.code;
      throw e;
    }
    return r;
  }).catch((e) => {
    if (e && typeof e.message === 'string') throw e;
    throw new Error('网络连接未完成，答案已保留，请重试。');
  });
}
module.exports = { call };
