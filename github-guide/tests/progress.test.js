// Tests for the progress record: merging between devices and flashcard scheduling.
// Run with:  node --test github-guide/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/js/progress.js');

test('merging never loses a finished lesson or a right answer', () => {
  const phone = P.empty();
  phone.lessons['basics-commits'] = { done: 100, seen: 100, quiz: { 0: 1, 1: 0 }, mission: { 0: 1 } };
  const laptop = P.empty();
  laptop.lessons['basics-commits'] = { done: 0, seen: 200, quiz: { 1: 1, 2: 0 }, mission: { 2: 1 } };
  laptop.lessons['basics-branches'] = { done: 300, seen: 300, quiz: {}, mission: {} };

  const merged = P.merge(phone, laptop);
  assert.equal(merged.lessons['basics-commits'].done, 100);
  assert.equal(merged.lessons['basics-commits'].seen, 200);
  assert.deepEqual(merged.lessons['basics-commits'].quiz, { 0: 1, 1: 1, 2: 0 });
  assert.deepEqual(merged.lessons['basics-commits'].mission, { 0: 1, 2: 1 });
  assert.equal(merged.lessons['basics-branches'].done, 300);
});

test('merging is symmetric and tolerates missing data', () => {
  const a = P.empty();
  a.cards['t:commit'] = { box: 2, due: 10, seen: 50 };
  a.labs['lab-first-commit'] = 10;
  const b = P.empty();
  b.cards['t:commit'] = { box: 0, due: 12, seen: 90 };
  b.drills['drill-leaked-secret'] = { best: 3, of: 4, ts: 5 };

  assert.deepEqual(P.merge(a, b), P.merge(b, a));
  assert.deepEqual(P.merge(a, b).cards['t:commit'], { box: 0, due: 12, seen: 90 }, 'the more recent review wins');
  assert.deepEqual(P.merge(null, a).labs, a.labs);
  assert.deepEqual(P.merge(a, undefined).cards, a.cards);
});

test('a flashcard climbs one box when known and drops to the start when missed', () => {
  let card;
  card = P.review(card, true, 100, 1);
  assert.deepEqual(card, { box: 1, due: 101, seen: 1 });
  card = P.review(card, true, 101, 2);
  assert.deepEqual(card, { box: 2, due: 104, seen: 2 });
  card = P.review(card, true, 104, 3);
  assert.equal(card.due, 111);
  card = P.review(card, true, 111, 4);
  card = P.review(card, true, 127, 5);
  assert.equal(card.box, 4, 'the top box is the ceiling');
  card = P.review(card, false, 143, 6);
  assert.deepEqual(card, { box: 0, due: 143, seen: 6 });
});

test('a card is due when new or when its day has come', () => {
  assert.equal(P.isDue(undefined, 5), true);
  assert.equal(P.isDue({ box: 1, due: 6 }, 5), false);
  assert.equal(P.isDue({ box: 1, due: 5 }, 5), true);
});

test('track statistics count finished lessons and skip planned ones', () => {
  const track = { lessons: ['a', 'b', 'c'] };
  const lessons = { a: { quiz: [1, 2] }, b: { quiz: [1] }, c: { stub: true } };
  const progress = P.empty();
  progress.lessons.a = { done: 1, seen: 1, quiz: { 0: 1, 1: 0 }, mission: {} };
  assert.deepEqual(P.trackStats(track, lessons, progress), {
    total: 2, done: 1, next: 'b', percent: 50, quizRight: 1, quizTotal: 3
  });
});

test('placement picks the first track where a question was missed', () => {
  const order = ['basics', 'intermediate', 'advanced', 'expert'];
  const questions = [
    { track: 'basics', answer: 0 }, { track: 'intermediate', answer: 1 },
    { track: 'advanced', answer: 2 }, { track: 'expert', answer: 3 }
  ];
  assert.equal(P.placeFrom(questions, { 0: 0, 1: 1, 2: 2, 3: 3 }, order), 'expert');
  assert.equal(P.placeFrom(questions, { 0: 0, 1: 0, 2: 2, 3: 3 }, order), 'intermediate');
  assert.equal(P.placeFrom(questions, {}, order), 'basics', 'unanswered counts as missed');
  assert.equal(P.placeFrom(questions, { 0: 0, 1: 1, 2: -1, 3: 3 }, order), 'advanced', '"Not sure" counts as missed');
});

test('the rotating lens walks through all four and wraps around', () => {
  const seen = [0, 1, 2, 3, 4, 5].map(i => P.resolveLens('rotate', i));
  assert.deepEqual(seen, ['everyday', 'legal', 'ml', 'technical', 'everyday', 'legal']);
  assert.equal(P.resolveLens('ml', 0), 'ml', 'a pinned lens ignores the position');
  assert.equal(P.resolveLens('nonsense', 3), 'everyday', 'an unknown value falls back safely');
  assert.equal(P.resolveLens('rotate', -1), 'technical', 'a lesson that is not in the order still gets a lens');
});

test('the automatic tool follows the screen, and a chosen tool does not', () => {
  assert.equal(P.resolveTool('auto', true), 'phone');
  assert.equal(P.resolveTool('auto', false), 'browser');
  assert.equal(P.resolveTool('cli', true), 'cli');
});

test('the automatic reading mode opens in Skim only when the full text is probably not wanted', () => {
  assert.deepEqual(P.resolveMode('auto', { done: false, trackIndex: 1, placedIndex: null }), { mode: 'learn', why: '' });
  assert.deepEqual(P.resolveMode('auto', { done: true, trackIndex: 1, placedIndex: null }), { mode: 'skim', why: 'done' });
  assert.deepEqual(P.resolveMode('auto', { done: false, trackIndex: 0, placedIndex: 2 }), { mode: 'skim', why: 'below' });
  assert.deepEqual(P.resolveMode('auto', { done: false, trackIndex: 2, placedIndex: 2 }), { mode: 'learn', why: '' }, 'your own track is read in full');
  assert.deepEqual(P.resolveMode('auto', { done: false, trackIndex: 3, placedIndex: 2 }), { mode: 'learn', why: '' });
  assert.deepEqual(P.resolveMode('test', { done: true, trackIndex: 0, placedIndex: 3 }), { mode: 'test', why: '' }, 'a fixed choice always wins');
});
