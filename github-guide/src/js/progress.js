/*
 * progress.js: pure functions over the learner's progress record.
 *
 * No DOM and no storage, so the same file runs in the browser and under
 * Node (see tests/progress.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.GG = root.GG || {}).progress = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function empty() {
    return { lessons: {}, cards: {}, drills: {}, labs: {}, placement: null, t: 0 };
  }

  /**
   * Combine two progress records, for example the phone's and the laptop's.
   * Nothing a learner has earned is ever lost: finished stays finished, a
   * correct answer stays correct, and for flashcards the more recent review
   * wins.
   */
  function merge(a, b) {
    a = a || empty();
    b = b || empty();
    var out = empty();

    var ids = Object.keys(Object.assign({}, a.lessons, b.lessons));
    ids.forEach(function (id) {
      var x = (a.lessons || {})[id] || {}, y = (b.lessons || {})[id] || {};
      var quiz = {}, mission = {};
      [x.quiz || {}, y.quiz || {}].forEach(function (q) {
        Object.keys(q).forEach(function (k) { quiz[k] = Math.max(quiz[k] || 0, q[k] ? 1 : 0); });
      });
      [x.mission || {}, y.mission || {}].forEach(function (m) {
        Object.keys(m).forEach(function (k) { if (m[k]) mission[k] = 1; });
      });
      out.lessons[id] = {
        done: Math.max(x.done || 0, y.done || 0),
        seen: Math.max(x.seen || 0, y.seen || 0),
        quiz: quiz,
        mission: mission
      };
    });

    Object.keys(Object.assign({}, a.cards, b.cards)).forEach(function (id) {
      var x = (a.cards || {})[id], y = (b.cards || {})[id];
      out.cards[id] = !x ? y : !y ? x : (y.seen || 0) > (x.seen || 0) ? y : x;
    });

    Object.keys(Object.assign({}, a.drills, b.drills)).forEach(function (id) {
      var x = (a.drills || {})[id], y = (b.drills || {})[id];
      out.drills[id] = !x ? y : !y ? x : (y.best || 0) > (x.best || 0) ? y : x;
    });

    Object.keys(Object.assign({}, a.labs, b.labs)).forEach(function (id) {
      out.labs[id] = Math.max((a.labs || {})[id] || 0, (b.labs || {})[id] || 0);
    });

    var pa = a.placement, pb = b.placement;
    out.placement = !pa ? pb || null : !pb ? pa : (pb.ts || 0) > (pa.ts || 0) ? pb : pa;
    out.t = Math.max(a.t || 0, b.t || 0);
    return out;
  }

  // Spaced repetition, Leitner style: five boxes, longer gaps as you climb.
  var INTERVALS = [0, 1, 3, 7, 16];

  /** The next state of a flashcard after a review. `today` is a day number. */
  function review(card, correct, today, now) {
    var box = correct ? Math.min(((card && card.box) || 0) + 1, INTERVALS.length - 1) : 0;
    return { box: box, due: today + INTERVALS[box], seen: now };
  }

  function isDue(card, today) {
    return !card || card.due <= today;
  }

  /** Completion numbers for one track. */
  function trackStats(track, lessons, progress) {
    var total = 0, done = 0, quizRight = 0, quizTotal = 0, next = null;
    track.lessons.forEach(function (id) {
      var lesson = lessons[id];
      if (!lesson || lesson.stub) return;
      total++;
      var rec = (progress.lessons || {})[id] || {};
      if (rec.done) done++;
      else if (!next) next = id;
      quizTotal += (lesson.quiz || []).length;
      Object.keys(rec.quiz || {}).forEach(function (k) { if (rec.quiz[k]) quizRight++; });
    });
    return {
      total: total, done: done, next: next,
      percent: total ? Math.round((done / total) * 100) : 0,
      quizRight: quizRight, quizTotal: quizTotal
    };
  }

  /**
   * Turn placement-check answers into a suggested starting track: the first
   * track where the learner missed a question.
   */
  function placeFrom(questions, answers, trackOrder) {
    for (var t = 0; t < trackOrder.length; t++) {
      var missed = questions.some(function (q, i) {
        return q.track === trackOrder[t] && answers[i] !== q.answer;
      });
      if (missed) return trackOrder[t];
    }
    return trackOrder[trackOrder.length - 1];
  }

  return { empty: empty, merge: merge, review: review, isDue: isDue, trackStats: trackStats, placeFrom: placeFrom, INTERVALS: INTERVALS };
});
