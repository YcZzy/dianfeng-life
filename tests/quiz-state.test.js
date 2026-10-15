const test = require('node:test');
const assert = require('node:assert/strict');
const { createQuiz } = require('../miniprogram/core/quiz-state');
const questions = [{ id: 'Q01', options: [{ id: 'A' }, { id: 'B' }] }, { id: 'Q02', options: [{ id: 'A' }] }];

test('one choice records answer; advancing needs no second user action', () => {
  const quiz = createQuiz(questions);
  const ticket = quiz.select('Q01', 'B');
  assert.equal(quiz.state.answers.Q01, 'B');
  assert.equal(quiz.state.cursor, 0);
  assert.equal(quiz.advance(ticket), true);
  assert.equal(quiz.state.cursor, 1);
});
test('double taps and taps from stale rendered question cannot answer next question', () => {
  const quiz = createQuiz(questions);
  const ticket = quiz.select('Q01', 'A');
  assert.equal(quiz.select('Q01', 'B'), null);
  quiz.advance(ticket);
  assert.equal(quiz.select('Q01', 'A'), null);
  assert.deepEqual(quiz.state.answers, { Q01: 'A' });
});
test('backgrounding invalidates an outstanding advance but keeps selected answer', () => {
  const quiz = createQuiz(questions);
  const ticket = quiz.select('Q01', 'A');
  quiz.pause();
  assert.equal(quiz.advance(ticket), false);
  assert.equal(quiz.state.cursor, 0);
  assert.equal(quiz.state.answers.Q01, 'A');
  assert.notEqual(quiz.select('Q01', 'B'), null);
});
test('back permits changing previous answer without deleting future answers', () => {
  const quiz = createQuiz(questions);
  quiz.advance(quiz.select('Q01', 'A'));
  quiz.back();
  quiz.advance(quiz.select('Q01', 'B'));
  assert.equal(quiz.state.answers.Q01, 'B');
  assert.equal(quiz.state.cursor, 1);
});
test('last answer creates ready state; restored final draft remains ready for retry', () => {
  const quiz = createQuiz(questions, { requestId: 'stable-id' });
  quiz.advance(quiz.select('Q01', 'A'));
  quiz.advance(quiz.select('Q02', 'A'));
  assert.equal(quiz.state.phase, 'ready');
  const restored = createQuiz(questions, quiz.snapshot());
  assert.equal(restored.state.phase, 'ready');
  assert.equal(restored.state.requestId, 'stable-id');
  restored.back();
  assert.equal(restored.state.cursor, 1);
  assert.equal(restored.state.phase, 'answering');
});
test('invalid options and malformed cached answers are rejected', () => {
  const quiz = createQuiz(questions, { cursor: 500, answers: { Q01: 'forged', Q99: 'A' } });
  assert.deepEqual(quiz.state.answers, {});
  assert.equal(quiz.state.cursor, 0);
  assert.equal(quiz.select('Q01', 'forged'), null);
});
test('editing an attempted submission invalidates its idempotency key; retry preserves it', () => {
  const saved = { cursor: 2, answers: { Q01: 'A', Q02: 'A' }, submittedAnswers: { Q01: 'A', Q02: 'A' }, requestId: 'attempted-id' };
  const quiz = createQuiz(questions, saved);
  assert.equal(quiz.snapshot().requestId, 'attempted-id');
  assert.deepEqual(quiz.snapshot().submittedAnswers, saved.answers);
  quiz.back();
  quiz.back();
  quiz.select('Q01', 'B');
  assert.equal(quiz.state.requestId, '');
  assert.equal(quiz.snapshot().submittedAnswers, null);
});
