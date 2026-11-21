/*
 * platform.js: optional extras from wherever the guide is hosted.
 *
 * On plain static hosting (GitHub Pages, a local preview, the offline file)
 * none of these exist, and the guide falls back to what every browser has.
 * Inside a Claude artifact viewer, `window.claude.use(name)` may offer:
 *
 *   tts     read a lesson aloud in a clear voice
 *   sample  answer a question about the lesson you are reading
 *   db      keep your progress with your account, so phone and laptop agree
 *
 * Each one is requested, may come back null, and the interface only shows
 * a control once the thing behind it is real.
 */
(function () {
  'use strict';
  var GG = window.GG;

  function cap(name) {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
      return Promise.resolve(window.claude.use(name)).then(function (v) { return v || null; }, function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  var platform = (GG.platform = { ask: null, sync: 'off', onReady: [] });

  function notify() {
    platform.onReady.forEach(function (fn) { try { fn(); } catch (e) { /* a listener must not break the others */ } });
  }

  // ---------------------------------------------------------------- read aloud

  var hostVoice = null;
  var synth = null;
  try { synth = 'speechSynthesis' in window ? window.speechSynthesis : null; } catch (e) { synth = null; }
  var speechListener = null;
  var speechState = 'idle';

  function setSpeech(state) {
    speechState = state;
    if (speechListener) speechListener(state);
  }

  /** Split text into pieces a speech engine accepts, at sentence ends. */
  function chunk(lines, limit) {
    var out = [];
    lines.forEach(function (line) {
      line = String(line).trim();
      while (line.length > limit) {
        var cut = line.lastIndexOf('. ', limit);
        if (cut < limit * 0.4) cut = line.lastIndexOf(' ', limit);
        if (cut <= 0) cut = limit;
        out.push(line.slice(0, cut + 1).trim());
        line = line.slice(cut + 1).trim();
      }
      if (line) out.push(line);
    });
    return out;
  }

  GG.speech = {
    available: function () { return !!(hostVoice || synth); },
    state: function () { return speechState; },
    /** One listener at a time: the view that owns the Listen button. */
    onState: function (fn) { speechListener = fn; },

    /** Read lines aloud. Call from a click or key press. */
    speak: function (lines) {
      var rate = GG.store.prefs().rate || 1;
      this.stop();
      if (hostVoice) {
        setSpeech('speaking');
        hostVoice.speak(chunk(lines, 1800).map(function (text) { return { text: text, language: 'en' }; }), { rate: Math.min(1.5, Math.max(0.7, rate)) })
          .then(function () { setSpeech('idle'); }, function (err) {
            setSpeech('idle');
            if (err && err.code === 'not_granted') { hostVoice = null; notify(); }
            else if (err && err.code === 'rate_limited') GG.toast('Read-aloud is busy. Try again in a moment.');
          });
        return;
      }
      if (!synth) return;
      var parts = chunk(lines, 220), index = 0;
      setSpeech('speaking');
      (function next() {
        if (index >= parts.length || speechState !== 'speaking') { setSpeech('idle'); return; }
        var u = new window.SpeechSynthesisUtterance(parts[index++]);
        u.rate = rate;
        u.lang = 'en-US';
        u.onend = next;
        u.onerror = function () { setSpeech('idle'); };
        synth.speak(u);
      })();
    },

    stop: function () {
      if (speechState === 'idle') return;
      setSpeech('idle');
      try {
        if (hostVoice) hostVoice.stop();
        else if (synth) synth.cancel();
      } catch (e) { /* nothing to stop */ }
    }
  };

  cap('tts').then(function (t) {
    if (!t) return;
    hostVoice = t;
    notify();
  });

  // ---------------------------------------------------------------- ask about a lesson

  cap('sample').then(function (sample) {
    if (!sample) return;
    /**
     * Ask a question with the lesson as context. onText receives the whole
     * answer so far each time more arrives.
     */
    platform.ask = function (question, context, onText, signal) {
      var prompt = [
        'You are a patient tutor inside a learning guide about Git and GitHub.',
        'Answer the learner\'s question using the lesson below as your main source.',
        'Rules: plain language, under 170 words, no headings. Use short paragraphs or a short list.',
        'Wrap commands and file names in backticks. Never invent a button name, a command flag or a URL.',
        'If you are not sure, say so and name what to check in the official GitHub documentation.',
        'If the question is outside this lesson, answer briefly and say which topic covers it.',
        '',
        '--- LESSON ---',
        context,
        '--- END LESSON ---',
        '',
        'Learner\'s question: ' + question
      ].join('\n');
      return sample(prompt, {
        onText: function (update) { onText(update.text); },
        signal: signal,
        modelTier: 'default'
      }).then(function (res) { return res.text; });
    };
    notify();
  });

  // ---------------------------------------------------------------- progress sync

  Promise.all([cap('db'), cap('user')]).then(function (caps) {
    var db = caps[0], user = caps[1];
    if (!db || !user) return null;
    return user.id().then(function (uid) {
      if (!uid) return null;
      var ref;
      try { ref = db.doc('data/users/' + uid + '/progress'); } catch (e) { return null; }
      var writing = false, dirty = false;

      // Flashcard ids are built from terms and commands, so they contain
      // spaces, quotes and colons. Field names in the stored document stay
      // plain by keeping the cards as a list of rows.
      function pack(progress) {
        var copy = JSON.parse(JSON.stringify(progress));
        copy.cards = Object.keys(copy.cards || {}).map(function (id) {
          var c = copy.cards[id];
          return { id: id, box: c.box, due: c.due, seen: c.seen };
        });
        return copy;
      }
      function unpack(stored) {
        var copy = JSON.parse(JSON.stringify(stored)), cards = {};
        (Array.isArray(copy.cards) ? copy.cards : []).forEach(function (c) {
          if (c && typeof c.id === 'string') cards[c.id] = { box: c.box || 0, due: c.due || 0, seen: c.seen || 0 };
        });
        copy.cards = cards;
        return copy;
      }

      function push() {
        if (writing) { dirty = true; return; }
        writing = true;
        dirty = false;
        ref.set({ v: 1, progress: pack(GG.store.progress()) }).then(function () {
          writing = false;
          platform.sync = 'on';
          if (dirty) push();
        }, function () {
          writing = false;
          platform.sync = 'error';
          notify();
        });
      }
      var pushSoon = GG.debounce(push, 2500);

      return ref.get().then(function (snap) {
        var remote = snap.exists ? snap.data() : null;
        if (remote && remote.progress) GG.store.mergeIn(unpack(remote.progress));
        platform.sync = 'on';
        notify();
        // send up anything this device has that the account copy lacks
        if (!remote || (GG.store.progress().t || 0) > ((remote.progress || {}).t || 0)) pushSoon();
        GG.store.onChange(function (what) {
          if (what !== 'prefs' && what !== 'last' && what !== 'merge') pushSoon();
        });
      });
    });
  }).catch(function () {
    platform.sync = 'error';
    notify();
  });
})();
