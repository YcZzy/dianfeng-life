function createQuiz(questions, saved) {
  saved = saved || {};
  const answers = {};
  questions.forEach((q) => {
    if (q.options.some((o) => o.id === (saved.answers || {})[q.id])) answers[q.id] = saved.answers[q.id];
  });
  const firstUnanswered = questions.findIndex((q) => !answers[q.id]);
  const complete = firstUnanswered < 0;
  const validCursor = Number.isInteger(saved.cursor) && saved.cursor >= 0 && saved.cursor <= questions.length;
  const cursor = complete && saved.cursor === questions.length ? questions.length
    : Math.min(validCursor ? saved.cursor : Math.max(0, firstUnanswered), complete ? questions.length - 1 : firstUnanswered);
  const state = { cursor, answers, locked: false, phase: cursor === questions.length ? 'ready' : 'answering', requestId: saved.requestId || '', submittedAnswers: saved.submittedAnswers ? Object.assign({}, saved.submittedAnswers) : null };
  let sequence = 0;
  let active = null;
  return {
    state,
    select(qid, oid) {
      const q = questions[state.cursor];
      if (state.locked || state.phase !== 'answering' || !q || q.id !== qid || !q.options.some((o) => o.id === oid)) return null;
      if (state.submittedAnswers && state.submittedAnswers[qid] !== oid) {
        state.requestId = '';
        state.submittedAnswers = null;
      }
      state.answers[qid] = oid;
      state.locked = true;
      active = ++sequence;
      return active;
    },
    advance(ticket) {
      if (active === null || ticket !== active || !state.locked) return false;
      active = null;
      state.locked = false;
      state.cursor += 1;
      state.phase = state.cursor === questions.length ? 'ready' : 'answering';
      return true;
    },
    pause() { active = null; state.locked = false; sequence += 1; },
    back() {
      this.pause();
      state.cursor = Math.max(0, state.cursor - 1);
      state.phase = 'answering';
    },
    snapshot() { return { cursor: state.cursor, answers: Object.assign({}, state.answers), requestId: state.requestId, submittedAnswers: state.submittedAnswers ? Object.assign({}, state.submittedAnswers) : null }; }
  };
}
module.exports = { createQuiz };
