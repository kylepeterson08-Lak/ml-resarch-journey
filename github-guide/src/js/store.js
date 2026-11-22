/*
 * store.js: the learner's preferences and progress.
 *
 * Preferences stay on the device, because text size on a phone and on a
 * laptop are different decisions. Progress is saved on the device too and,
 * where the host offers a per-person store, synced through platform.js so a
 * lesson finished on the phone shows as finished on the laptop.
 *
 * Storage can be missing or blocked. Every access is wrapped, and the guide
 * works in memory when nothing can be saved.
 */
(function () {
  'use strict';
  var GG = window.GG;
  var KEY = 'gg-inside-out:v1';

  // lens 'rotate', tool 'auto' and mode 'auto' let the guide decide from context.
  // pv is the version of these defaults, so older saved choices can be upgraded once.
  var DEFAULT_PREFS = {
    theme: 'auto', contrast: 'normal', size: 'm', font: 'default', spacing: 'normal', motion: 'auto',
    lens: 'rotate', tool: 'auto', mode: 'auto', pace: 'scroll', stepTip: false,
    rate: 1, focus: 'off', allLenses: false, pv: 2
  };

  /**
   * Version 1 had fixed defaults (Everyday, Browser, Learn) and saved them
   * whether or not anyone chose them. Treat exactly those three values as
   * "never chosen" and move them to the adaptive defaults. Anything else
   * was a deliberate choice and is kept.
   */
  function upgradePrefs(saved) {
    var prefs = Object.assign({}, DEFAULT_PREFS, saved || {});
    if (!saved || saved.pv) return prefs;
    if (saved.lens === 'everyday') prefs.lens = 'rotate';
    if (saved.tool === 'browser') prefs.tool = 'auto';
    if (saved.mode === 'learn') prefs.mode = 'auto';
    prefs.pv = DEFAULT_PREFS.pv;
    return prefs;
  }

  // places: where you stopped inside each lesson in Step view. Kept on this device only.
  var state = { v: 1, prefs: Object.assign({}, DEFAULT_PREFS), progress: GG.progress.empty(), last: '', places: {} };
  var listeners = [];
  var persistent = true;

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || saved.v !== 1) return;
      state.prefs = upgradePrefs(saved.prefs);
      state.progress = GG.progress.merge(GG.progress.empty(), saved.progress);
      state.last = saved.last || '';
      state.places = saved.places || {};
    } catch (e) {
      persistent = false;
    }
  }

  var write = GG.debounce(function () {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
    } catch (e) {
      persistent = false;
    }
  }, 150);

  function changed(what) {
    if (what !== 'prefs' && what !== 'last') state.progress.t = Date.now();
    write();
    listeners.forEach(function (fn) { fn(what); });
  }

  function lessonRec(id) {
    var rec = state.progress.lessons[id];
    if (!rec) rec = state.progress.lessons[id] = { done: 0, seen: 0, quiz: {}, mission: {} };
    return rec;
  }

  try { window.localStorage.getItem(KEY); } catch (e) { persistent = false; }
  read();

  GG.store = {
    prefs: function () { return state.prefs; },
    progress: function () { return state.progress; },
    isPersistent: function () { return persistent; },
    onChange: function (fn) { listeners.push(fn); },

    setPref: function (key, value) {
      if (state.prefs[key] === value) return;
      state.prefs[key] = value;
      changed('prefs');
    },

    setLast: function (route) { state.last = route; changed('last'); },
    last: function () { return state.last; },

    place: function (lessonId) { return state.places[lessonId] || null; },
    setPlace: function (lessonId, key) {
      if (state.places[lessonId] === key) return;
      state.places[lessonId] = key;
      write(); // a bookmark, not progress: no listeners, no sync
    },

    lesson: function (id) { return state.progress.lessons[id] || { done: 0, seen: 0, quiz: {}, mission: {} }; },
    markSeen: function (id) { lessonRec(id).seen = Date.now(); changed('seen'); },
    setDone: function (id, done) { lessonRec(id).done = done ? Date.now() : 0; changed('lesson'); },
    setQuiz: function (id, index, correct) {
      var rec = lessonRec(id);
      // a right answer, once given, stays right
      rec.quiz[index] = rec.quiz[index] ? 1 : correct ? 1 : 0;
      changed('quiz');
    },
    setMission: function (id, index, done) {
      var rec = lessonRec(id);
      if (done) rec.mission[index] = 1; else delete rec.mission[index];
      changed('mission');
    },

    card: function (id) { return state.progress.cards[id]; },
    setCard: function (id, rec) { state.progress.cards[id] = rec; changed('card'); },
    setDrill: function (id, best, of) {
      var old = state.progress.drills[id];
      if (!old || best >= old.best) state.progress.drills[id] = { best: best, of: of, ts: Date.now() };
      changed('drill');
    },
    setLab: function (id) { state.progress.labs[id] = Date.now(); changed('lab'); },
    setPlacement: function (track) { state.progress.placement = { track: track, ts: Date.now() }; changed('placement'); },

    /** Fold in progress from somewhere else (another device, or a pasted export). */
    mergeIn: function (other) {
      var before = JSON.stringify(state.progress);
      state.progress = GG.progress.merge(state.progress, other);
      if (JSON.stringify(state.progress) !== before) {
        write();
        listeners.forEach(function (fn) { fn('merge'); });
        return true;
      }
      return false;
    },

    exportText: function () {
      return JSON.stringify({ app: 'github-inside-out', v: 1, progress: state.progress });
    },

    importText: function (text) {
      var data = JSON.parse(text);
      if (!data || data.app !== 'github-inside-out' || !data.progress) throw new Error('That text is not a progress export from this guide.');
      this.mergeIn(data.progress);
    },

    resetProgress: function () {
      state.progress = GG.progress.empty();
      changed('reset');
    }
  };
})();
