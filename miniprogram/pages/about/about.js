Page({
  onClearDraft() {
    wx.showModal({ title: '清除本机答题进度？', content: '只清除这台设备上的未完成答案，不删除云端报告。', success: (r) => {
      if (r.confirm) { require('../../core/draft').clear(); wx.showToast({ title: '已清除进度', icon: 'none' }); }
    } });
  }
});
