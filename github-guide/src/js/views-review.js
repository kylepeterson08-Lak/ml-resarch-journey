/*
 * views-review.js: drills, flashcards, the cheat sheet and the glossary.
 *
 * The cheat sheet, the glossary and the flashcard deck are not written
 * separately. They are assembled from the `commands` and `terms` every
 * lesson already declares, so they can never drift out of date.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  GG.views = GG.views || {};

  var VERDICT = { best: 'Best choice', ok: 'Workable', bad: 'Risky' };

  // ---------------------------------------------------------------- drills

  GG.views.drills = function () {
    document.title = 'Drills · ' + GG.data.site.title;
    var progress = GG.store.progress();
    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Drills'),
        h('h1', null, 'Something has gone wrong'),
        h('p.lede', null, 'Short incidents with decision points. Pick what you would do, see what happens, and learn the principle behind the best move. Being wrong here costs nothing.')),
      GG.data.tracks.map(function (t) {
        var drills = GG.data.drills.filter(function (d) { return d.track === t.id; });
        if (!drills.length) return null;
        return h('section.stack.t-' + t.id, null,
          h('h2', null, h('span.roundel.sm', { style: 'vertical-align:middle;margin-right:.5rem' }, t.letter), t.title),
          h('div.grid', null, drills.map(function (d) {
            var best = progress.drills[d.id];
            return h('a.card.link.lined', { href: '#' + d.id },
              h('div.spread', null, h('h3', null, d.title), best ? h('span.badge.done', null, best.best + ' of ' + best.of) : h('span.badge', null, d.minutes + ' min')),
              h('p.small.muted', null, GG.plain(d.situation).slice(0, 150) + '…'));
          })));
      }));
  };

  GG.views.drill = function (id) {
    var drill = GG.app.drill(id), track = GG.app.track(drill.track), lesson = GG.app.lesson(drill.lesson);
    document.title = drill.title + ' · Drill';
    var body = h('div.stack', { 'aria-live': 'polite' });
    var index = 0, bestCount = 0;

    function finish() {
      GG.store.setDrill(drill.id, bestCount, drill.steps.length);
      GG.clear(body);
      body.appendChild(h('div.card.stack', null,
        h('p.eyebrow', null, 'Debrief'),
        h('h2', null, bestCount + ' of ' + drill.steps.length + ' best choices'),
        h('p', null, GG.inline(drill.debrief)),
        h('div.row', null,
          lesson ? h('a.btn.primary', { href: '#' + lesson.id }, GG.icon('book'), 'Read: ' + lesson.title) : null,
          h('button.btn', { type: 'button', onclick: function () { index = 0; bestCount = 0; paint(); } }, 'Run it again'),
          h('a.btn.quiet', { href: '#drills' }, 'All drills'))));
    }

    function paint() {
      var step = drill.steps[index];
      var feedback = h('div.stack');
      var buttons = step.choices.map(function (choice, ci) {
        return h('button.choice', { type: 'button', onclick: function () { choose(ci); } },
          h('span.mark', { 'aria-hidden': 'true' }, 'ABCD'.charAt(ci)), h('span', null, GG.inline(choice.text)));
      });
      function choose(ci) {
        var picked = step.choices[ci];
        buttons.forEach(function (b, i) {
          b.disabled = true;
          if (step.choices[i].verdict === 'best') b.classList.add('is-right');
        });
        if (picked.verdict === 'best') bestCount++;
        else buttons[ci].classList.add(picked.verdict === 'bad' ? 'is-wrong' : 'is-ok');
        GG.clear(feedback);
        feedback.appendChild(h('div.why', null, h('span.badge.' + picked.verdict, null, VERDICT[picked.verdict]), ' ', GG.inline(picked.feedback)));
        if (picked.verdict !== 'best') {
          var best = step.choices.filter(function (c) { return c.verdict === 'best'; })[0];
          feedback.appendChild(h('div.why', null, h('span.badge.best', null, 'Best choice'), ' ', h('strong', null, GG.inline(best.text)), ' ', GG.inline(best.feedback)));
        }
        var last = index === drill.steps.length - 1;
        var nextBtn = h('button.btn.primary', { type: 'button', onclick: function () { if (last) finish(); else { index++; paint(); } } },
          last ? 'See the debrief' : 'Next decision', GG.icon('right'));
        feedback.appendChild(h('div', null, nextBtn));
        nextBtn.focus();
      }
      GG.clear(body);
      body.appendChild(h('fieldset.q', null,
        h('legend', null, h('span.muted.mono.xs', null, 'Decision ' + (index + 1) + ' of ' + drill.steps.length + ' '), GG.inline(step.prompt)),
        h('div.choices', null, buttons)));
      body.appendChild(feedback);
    }

    paint();
    return h('div.page.t-' + track.id, null,
      h('header.stack', null,
        h('p.eyebrow', null, h('span.roundel.sm', null, track.letter), h('span', null, 'Drill'), h('span', null, drill.minutes + ' min')),
        h('h1', null, drill.title),
        h('div.callout.kind-warn', { role: 'note' }, GG.icon('warn'), h('span.kind', null, 'The situation'), h('div.body', null, GG.inline(drill.situation)))),
      h('div.prose', { style: 'max-width:46rem' }, body));
  };

  // ---------------------------------------------------------------- flashcards

  /** Every card in the guide, in curriculum order, without repeats. */
  function deck() {
    var cards = [], seen = {};
    GG.app.order.forEach(function (id) {
      var lesson = GG.app.lesson(id);
      if (lesson.stub) return;
      lesson.terms.forEach(function (t) {
        var key = 't:' + t.term.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        cards.push({ id: key, kind: 'Term', front: t.term, back: t.def, lesson: lesson, code: false });
      });
      lesson.commands.forEach(function (c) {
        var key = 'c:' + c.cmd;
        if (seen[key]) return;
        seen[key] = true;
        cards.push({ id: key, kind: c.kind === 'key' ? 'Shortcut' : 'Command', front: c.cmd, back: c.does, lesson: lesson, code: true });
      });
    });
    return cards;
  }
  GG.deck = deck;

  GG.views.cards = function () {
    document.title = 'Flashcards · ' + GG.data.site.title;
    var all = deck(), today = GG.today(), filter = 'all';
    var stage = h('div.stack', { 'aria-live': 'polite' });
    var summary = h('p.small.muted', { role: 'status' });

    function pool() {
      return all.filter(function (c) { return filter === 'all' || c.lesson.track === filter; });
    }

    function counts() {
      var due = 0, fresh = 0, strong = 0;
      pool().forEach(function (c) {
        var rec = GG.store.card(c.id);
        if (!rec) fresh++;
        else { if (rec.due <= today) due++; if (rec.box >= 3) strong++; }
      });
      summary.textContent = due + ' due today · ' + fresh + ' not seen yet · ' + strong + ' well learned · ' + pool().length + ' cards in this set';
      return { due: due, fresh: fresh };
    }

    function session() {
      var cards = pool();
      var due = cards.filter(function (c) { var r = GG.store.card(c.id); return r && r.due <= today; });
      var fresh = cards.filter(function (c) { return !GG.store.card(c.id); });
      var queue = due.slice(0, 10).concat(fresh.slice(0, Math.max(0, 10 - due.length))), at = 0, right = 0;

      function done() {
        counts();
        GG.clear(stage);
        stage.appendChild(h('div.card.stack', null,
          h('h2', null, queue.length ? right + ' of ' + queue.length + ' on the first try' : 'Nothing is due'),
          h('p', null, queue.length
            ? 'Cards you knew move to a longer gap. Cards you missed come back today.'
            : 'You are caught up on this set. Come back tomorrow, or pick another track above.'),
          h('div.row', null,
            h('button.btn.primary', { type: 'button', onclick: session }, 'Another round'),
            h('a.btn', { href: '#glossary' }, 'Browse the glossary'))));
      }

      function show() {
        if (at >= queue.length) { done(); return; }
        var card = queue[at], revealed = false;
        var back = h('div.fc-back.stack', { hidden: true },
          h('p', null, GG.inline(card.back)),
          h('p.xs.muted', null, 'From ', h('a', { href: '#' + card.lesson.id }, card.lesson.title)));
        var controls = h('div.row');
        function grade(ok) {
          GG.store.setCard(card.id, GG.progress.review(GG.store.card(card.id), ok, today, Date.now()));
          if (ok) right++;
          at++;
          show();
        }
        function reveal() {
          if (revealed) return;
          revealed = true;
          back.hidden = false;
          GG.clear(controls);
          var notYet = h('button.btn', { type: 'button', onclick: function () { grade(false); } }, 'Not yet');
          controls.appendChild(notYet);
          controls.appendChild(h('button.btn.primary', { type: 'button', onclick: function () { grade(true); } }, GG.icon('check'), 'I knew it'));
          notYet.focus();
        }
        var showBtn = h('button.btn.primary', { type: 'button', onclick: reveal }, 'Show the answer');
        controls.appendChild(showBtn);
        GG.clear(stage);
        stage.appendChild(h('div.flashcard.card.stack.t-' + card.lesson.track, null,
          h('div.spread', null, h('span.eyebrow', null, card.kind), h('span.xs.muted.mono', null, 'Card ' + (at + 1) + ' of ' + queue.length)),
          h('p.fc-front', null, card.code ? h('code', null, card.front) : card.front),
          h('p.small.muted', null, card.code ? 'What does it do?' : 'What does it mean?'),
          back, controls));
        showBtn.focus({ preventScroll: true });
      }
      show();
    }

    var tracks = [{ id: 'all', label: 'All tracks' }].concat(GG.data.tracks.map(function (t) { return { id: t.id, label: t.title }; }));
    var root = h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Flashcards'),
        h('h1', null, 'Terms and commands, on a schedule'),
        h('p.lede', null, 'Recall beats rereading. Each card you know waits longer before it returns: one day, then three, then a week, then about two weeks.'),
        GG.segmented('Cards from', tracks, filter, function (id) { filter = id; counts(); session(); }),
        summary),
      h('div', { style: 'max-width:40rem' }, stage));
    counts();
    session();
    return root;
  };

  // ---------------------------------------------------------------- cheat sheet

  GG.views.cheatsheet = function () {
    document.title = 'Cheat sheet · ' + GG.data.site.title;
    var rows = [], seen = {};
    GG.app.order.forEach(function (id) {
      var lesson = GG.app.lesson(id);
      if (lesson.stub) return;
      lesson.commands.forEach(function (c) {
        if (seen[c.cmd]) return;
        seen[c.cmd] = true;
        rows.push({ c: c, lesson: lesson, hay: (c.cmd + ' ' + GG.plain(c.does) + ' ' + lesson.title).toLowerCase() });
      });
    });
    var query = '', kind = 'all', risk = 'all';
    var list = h('div.stack'), count = h('p.small.muted', { role: 'status' });

    function paint() {
      var q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      var hits = rows.filter(function (r) {
        return (kind === 'all' || r.c.kind === kind) && (risk === 'all' || r.c.risk === risk) &&
          q.every(function (word) { return r.hay.indexOf(word) !== -1; });
      });
      count.textContent = hits.length + ' of ' + rows.length + ' entries';
      GG.clear(list);
      GG.data.tracks.forEach(function (t) {
        var mine = hits.filter(function (r) { return r.lesson.track === t.id; });
        if (!mine.length) return;
        list.appendChild(h('section.stack.t-' + t.id, null,
          h('h2', { style: 'font-size:var(--t-m)' }, h('span.roundel.sm', { style: 'vertical-align:middle;margin-right:.5rem' }, t.letter), t.title),
          h('ul.cmd-list', null, mine.map(function (r) {
            return h('li', null,
              h('div.cmd-line', null,
                r.c.kind === 'key' ? h('kbd', null, r.c.cmd) : h('code', null, r.c.cmd),
                r.c.kind === 'key' ? null : GG.copyButton(function () { return r.c.cmd; }, 'Copy ' + r.c.cmd)),
              h('p.small', null, GG.inline(r.c.does)),
              h('p.row.xs', null, h('span.badge.' + r.c.risk, null, r.c.risk), h('span.badge', null, r.c.kind), h('a', { href: '#' + r.lesson.id }, r.lesson.title)));
          }))));
      });
      if (!hits.length) list.appendChild(h('p.muted', null, 'Nothing matches. Try a shorter search, or clear the filters.'));
    }

    var kinds = [{ id: 'all', label: 'All' }, { id: 'git', label: 'git' }, { id: 'gh', label: 'gh' }, { id: 'shell', label: 'shell' }, { id: 'key', label: 'Keys' }, { id: 'search', label: 'Search' }, { id: 'web', label: 'URLs' }];
    var risks = [{ id: 'all', label: 'Any risk' }, { id: 'safe', label: 'Safe' }, { id: 'caution', label: 'Caution' }, { id: 'danger', label: 'Danger' }];
    var search = h('input', { id: 'cs-q', type: 'search', placeholder: 'undo, branch, rebase…', autocomplete: 'off', oninput: function (e) { query = e.target.value; paint(); } });
    paint();
    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Cheat sheet'),
        h('h1', null, 'Every command in the guide'),
        h('p.lede', null, 'Each entry carries a risk rating. Safe means read-only or easily undone. Caution changes local history. Danger can destroy work or rewrite history other people have.'),
        h('div.stack', { style: 'max-width:40rem' },
          h('label', { for: 'cs-q', class: 'small' }, 'Filter by word'), search,
          GG.segmented('Kind', kinds, kind, function (id) { kind = id; paint(); }),
          GG.segmented('Risk', risks, risk, function (id) { risk = id; paint(); }),
          count)),
      list);
  };

  // ---------------------------------------------------------------- glossary

  GG.views.glossary = function () {
    document.title = 'Glossary · ' + GG.data.site.title;
    var terms = [], seen = {};
    GG.app.order.forEach(function (id) {
      var lesson = GG.app.lesson(id);
      if (lesson.stub) return;
      lesson.terms.forEach(function (t) {
        var key = t.term.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        terms.push({ t: t, lesson: lesson, hay: (t.term + ' ' + GG.plain(t.def)).toLowerCase() });
      });
    });
    terms.sort(function (a, b) { return a.t.term.toLowerCase().localeCompare(b.t.term.toLowerCase()); });
    var list = h('div.stack'), count = h('p.small.muted', { role: 'status' }), query = '';

    function paint() {
      var q = query.trim().toLowerCase();
      var hits = terms.filter(function (x) { return !q || x.hay.indexOf(q) !== -1; });
      count.textContent = hits.length + ' of ' + terms.length + ' terms';
      GG.clear(list);
      var letter = '', dl = null;
      hits.forEach(function (x) {
        var first = x.t.term.replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase() || '#';
        if (first !== letter) {
          letter = first;
          dl = h('dl.terms');
          list.appendChild(h('section.stack', null, h('h2.gloss-letter', null, letter), dl));
        }
        dl.appendChild(h('dt', null, x.t.term));
        dl.appendChild(h('dd', null, GG.inline(x.t.def), ' ', h('a.xs', { href: '#' + x.lesson.id, class: 't-' + x.lesson.track }, x.lesson.title)));
      });
      if (!hits.length) list.appendChild(h('p.muted', null, 'No term matches that. Try the search in the top bar, which also looks inside lessons.'));
    }
    paint();
    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Glossary'),
        h('h1', null, 'Every term, defined once'),
        h('div.stack', { style: 'max-width:40rem' },
          h('label', { for: 'gl-q', class: 'small' }, 'Filter terms'),
          h('input', { id: 'gl-q', type: 'search', placeholder: 'rebase, fork, ref…', autocomplete: 'off', oninput: function (e) { query = e.target.value; paint(); } }),
          count)),
      h('div.prose', { style: 'max-width:46rem' }, list));
  };
})();
