const VERSION = require('../data/questions').version;
const KEY = 'life-v2-draft';
const TTL = 7 * 24 * 60 * 60 * 1000;
function read() {
  try {
    const d = wx.getStorageSync(KEY);
    if (!d) return null;
    if (d.version !== VERSION || !Number.isFinite(d.updatedAt) || Date.now() - d.updatedAt >= TTL || d.updatedAt > Date.now() + 60000) {
      wx.removeStorageSync(KEY);
      return null;
    }
    return d;
  } catch (_) { return null; }
}
function save(state) {
  wx.setStorageSync(KEY, Object.assign({}, state, { version: VERSION, updatedAt: Date.now() }));
}
function clear() { wx.removeStorageSync(KEY); }
function requestId() { return Date.now().toString(36) + '-' + Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join(''); }
module.exports = { read, save, clear, requestId };
