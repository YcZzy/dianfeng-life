const content = require('../../data/questions');
const { createQuiz } = require('../../core/quiz-state');
const draft = require('../../core/draft');
const api = require('../../core/api');
Page({
  data: { question: null, options: [], skips: [], selected: '', number: 1, total: content.questions.length, progress: 0, phase: 'answering', error: '', helpOpen: false, storageError: '' },
  onLoad() {
    this.visible = true;
    const saved = draft.read();
    this.quiz = createQuiz(content.questions, saved || { requestId: draft.requestId() });
    if (!this.quiz.state.requestId) this.quiz.state.requestId = draft.requestId();
    this.render();
    if (this.quiz.state.phase === 'ready') this.submit();
  },
  onShow() { this.visible = true; if (this.resultReadyId) this.openResult(); },
  onHide() { this.visible = false; this.cancelAdvance(); },
  onUnload() { this.visible = false; this.disposed = true; this.cancelAdvance(); },
  cancelAdvance() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.quiz) { this.quiz.pause(); this.persist(); }
  },
  persist() {
    if (!this.quiz || this.completed) return;
    try { draft.save(this.quiz.snapshot()); }
    catch (_) { if (!this.disposed) this.setData({ storageError: '本机暂时无法保存进度，请保持页面打开直至提交完成。' }); }
  },
  render() {
    const state = this.quiz.state;
    const q = content.questions[state.cursor] || null;
    this.setData({
      question: q,
      options: q ? q.options.filter((o) => o.id !== 'X' && o.id !== 'Y') : [],
      skips: q ? q.options.filter((o) => o.id === 'X' || o.id === 'Y') : [],
      selected: q ? state.answers[q.id] || '' : '',
      number: Math.min(state.cursor + 1, content.questions.length),
      progress: 100 * state.cursor / content.questions.length,
      phase: state.phase, helpOpen: false
    });
  },
  onChoose(event) {
    if (!this.visible || this.sending || this.data.phase === 'failed') return;
    const ticket = this.quiz.select(event.currentTarget.dataset.qid, event.currentTarget.dataset.oid);
    if (ticket === null) return;
    if (!this.quiz.state.requestId) this.quiz.state.requestId = draft.requestId();
    this.setData({ selected: this.quiz.state.answers[event.currentTarget.dataset.qid] });
    this.persist();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.visible || this.disposed || !this.quiz.advance(ticket)) return;
      this.persist();
      this.render();
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      if (this.quiz.state.phase === 'ready') this.submit();
    }, 180);
  },
  onPrev() {
    if (this.sending || !this.quiz || this.quiz.state.cursor === 0) return;
    this.cancelAdvance();
    this.quiz.back();
    this.setData({ error: '' });
    this.persist();
    this.render();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onHelp() { this.setData({ helpOpen: !this.data.helpOpen }); },
  onRetry() { this.submit(); },
  submit() {
    if (this.sending || this.disposed) return;
    this.sending = true;
    this.quiz.state.submittedAnswers = Object.assign({}, this.quiz.state.answers);
    const submittedId = this.quiz.state.requestId;
    this.setData({ phase: 'submitting', error: '' });
    this.persist();
    api.call('submit', { requestId: this.quiz.state.requestId, quizVersion: content.version, answers: this.quiz.state.answers }).then((r) => {
      this.sending = false;
      this.completed = true;
      try {
        const activeDraft = draft.read();
        if (activeDraft && activeDraft.requestId === submittedId) draft.clear();
      } catch (_) { /* Result is safely stored in cloud; retry remains idempotent. */ }
      if (this.disposed) return;
      this.resultReadyId = r.report.id;
      if (this.visible) this.openResult();
    }).catch((e) => {
      this.sending = false;
      if (!this.disposed) this.setData({ phase: 'failed', error: e.message || '提交未完成，答案已保留。' });
    });
  },
  openResult() {
    const id = this.resultReadyId;
    this.resultReadyId = '';
    wx.redirectTo({ url: '/pages/result/result?id=' + encodeURIComponent(id) });
  }
});
