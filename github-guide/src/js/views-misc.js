/*
 * views-misc.js: progress, the placement check, the "how it is built" page,
 * and the three dialogs (search, display settings, the phone's More menu).
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  GG.views = GG.views || {};
  GG.ui = GG.ui || {};

  // ---------------------------------------------------------------- dialogs

  function sheet(id, title, body) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var dlg = h('dialog.sheet', { id: id, 'aria-labelledby': id + '-h' },
      h('div.sheet-head', null,
        h('h2', { id: id + '-h', style: 'font-size:var(--t-m)' }, title),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close', onclick: function () { close(); } }, GG.icon('x'))),
      h('div.sheet-body', null, body));
    function close() {
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
      dlg.remove();
    }
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.closeSheet = close;
    return dlg;
  }

  function field(label, hint, options, current, onPick) {
    return h('fieldset.field', null,
      h('legend', null, label),
      hint ? h('span.hint', null, hint) : null,
      GG.segmented(label, options, current, onPick));
  }

  GG.ui.openPrefs = function () {
    var p = GG.store.prefs();
    function set(key) { return function (value) { GG.store.setPref(key, value); GG.app.applyPrefs(); }; }
    var body = [
      field('Theme', null, [{ id: 'auto', label: 'Match device' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], p.theme, set('theme')),
      field('Contrast', 'More contrast uses pure black and white with heavier borders.', [{ id: 'normal', label: 'Standard' }, { id: 'more', label: 'More' }], p.contrast, set('contrast')),
      field('Text size', null, [{ id: 's', label: 'Small' }, { id: 'm', label: 'Medium' }, { id: 'l', label: 'Large' }, { id: 'xl', label: 'Extra large' }], p.size, set('size')),
      field('Spacing', 'Roomy widens the gaps between lines, letters, words and paragraphs.', [{ id: 'normal', label: 'Standard' }, { id: 'relaxed', label: 'Roomy' }], p.spacing, set('spacing')),
      field('Typeface', 'The legible faces load from Google Fonts. System uses fonts already on your device and makes no outside request.', [{ id: 'default', label: 'Legible' }, { id: 'system', label: 'System' }], p.font, set('font')),
      field('Motion', null, [{ id: 'auto', label: 'Match device' }, { id: 'reduce', label: 'Reduced' }], p.motion, set('motion'))
    ];
    if (GG.speech.available()) {
      body.push(field('Read-aloud speed', 'Used by the Listen button in each lesson.',
        [{ id: 0.8, label: 'Slower' }, { id: 1, label: 'Normal' }, { id: 1.2, label: 'Faster' }, { id: 1.4, label: 'Fastest' }], p.rate, set('rate')));
    }
    body.push(h('p.xs.muted', null, 'These settings stay on this device. The explanation lens, tool and reading mode are set on the home page or inside any lesson.'));
    sheet('prefs', 'Display and reading', body);
  };

  GG.ui.openMore = function () {
    var links = [
      ['drills', 'target', 'Drills'], ['workflow', 'file', 'Workflow reader'], ['cheatsheet', 'list', 'Cheat sheet'], ['glossary', 'az', 'Glossary'],
      ['progress', 'chart', 'Progress'], ['placement', 'compass', 'Find your starting point'], ['about', 'layers', 'How this guide is built']
    ];
    var dlg = sheet('more', 'More', [
      h('ul.nav', null, links.map(function (l) {
        return h('li', null, h('a', { href: '#' + l[0], onclick: function () { dlg.closeSheet(); } }, GG.icon(l[1]), l[2]));
      })),
      h('button.btn', { type: 'button', onclick: function () { dlg.closeSheet(); GG.ui.openPrefs(); } }, GG.icon('sliders'), 'Display and reading')
    ]);
  };

  // ---------------------------------------------------------------- search

  var searchIndex = null;

  function buildIndex() {
    var out = [];
    GG.app.order.forEach(function (id) {
      var l = GG.app.lesson(id);
      if (l.stub) return;
      var body = [l.summary].concat(l.outcomes, l.sections.map(function (s) {
        return s.heading + ' ' + s.blocks.map(GG.blocks.text).join(' ');
      })).join(' ');
      out.push({ kind: 'Lesson', title: l.title, text: GG.plain(body), route: l.id, w: 3 });
      l.terms.forEach(function (t) { out.push({ kind: 'Term', title: t.term, text: GG.plain(t.def), route: l.id, w: 2 }); });
      l.commands.forEach(function (c) { out.push({ kind: 'Command', title: c.cmd, text: GG.plain(c.does), route: l.id, w: 2 }); });
    });
    GG.data.labs.forEach(function (l) { out.push({ kind: 'Lab', title: l.title, text: GG.plain(l.intro), route: l.id, w: 1 }); });
    [
      ['lab', 'Practice lab', 'A terminal with a simulated Git repository and a live commit graph'],
      ['workflow', 'Workflow reader', 'Paste a GitHub Actions workflow YAML file to have it explained and checked for risks'],
      ['drills', 'Drills', 'Short incidents with decision points'],
      ['cards', 'Flashcards', 'Terms and commands on a spaced repetition schedule'],
      ['cheatsheet', 'Cheat sheet', 'Every command in the guide with a risk rating'],
      ['glossary', 'Glossary', 'Every term defined once'],
      ['placement', 'Find your starting point', 'A placement check that suggests which track to start with'],
      ['progress', 'Progress', 'What you have finished, with export and import between devices'],
      ['about', 'How this guide is built', 'Languages, pipeline, accessibility and privacy']
    ].forEach(function (t) { out.push({ kind: 'Page', title: t[1], text: t[2], route: t[0], w: 2 }); });
    GG.data.drills.forEach(function (d) { out.push({ kind: 'Drill', title: d.title, text: GG.plain(d.situation), route: d.id, w: 1 }); });
    out.forEach(function (e) { e.lt = e.title.toLowerCase(); e.lx = e.text.toLowerCase(); });
    return out;
  }

  function search(query) {
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    searchIndex = searchIndex || buildIndex();
    var hits = [];
    searchIndex.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], inTitle = e.lt.indexOf(w);
        if (inTitle === 0) score += 8;
        else if (inTitle > 0) score += 5;
        else if (e.lx.indexOf(w) !== -1) score += 1;
        else return;
      }
      hits.push({ e: e, score: score * e.w });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 24).map(function (x) { return x.e; });
  }

  GG.ui.openSearch = function () {
    var results = h('div.search-results', { role: 'region', 'aria-live': 'polite', 'aria-label': 'Search results' });
    var dlg;
    function paint(q) {
      GG.clear(results);
      if (!q.trim()) { results.appendChild(h('p.small.muted', null, 'Search lessons, terms, commands, labs and drills.')); return; }
      var hits = search(q);
      if (!hits.length) { results.appendChild(h('p.small.muted', null, 'No matches. Try one word, such as rebase or secret.')); return; }
      hits.forEach(function (e) {
        var snippet = e.text.length > 110 ? e.text.slice(0, 110) + '…' : e.text;
        results.appendChild(h('a', { href: '#' + e.route, onclick: function () { dlg.closeSheet(); } },
          h('span.kind', null, e.kind), h('strong', null, e.title), h('span.small.muted', { style: 'display:block' }, snippet)));
      });
    }
    var input = h('input', { id: 'search-q', type: 'search', autocomplete: 'off', placeholder: 'Search the guide', oninput: function (e) { paint(e.target.value); } });
    dlg = sheet('search', 'Search', [h('label.vh', { for: 'search-q' }, 'Search the guide'), input, results]);
    paint('');
    input.focus();
  };

  // ---------------------------------------------------------------- progress

  GG.views.progress = function () {
    document.title = 'Progress · ' + GG.data.site.title;
    var progress = GG.store.progress(), counts = GG.data.build.counts;
    var doneLessons = 0, quizRight = 0, strong = 0;
    Object.keys(progress.lessons).forEach(function (id) {
      var rec = progress.lessons[id];
      if (!GG.app.lesson(id)) return;
      if (rec.done) doneLessons++;
      Object.keys(rec.quiz || {}).forEach(function (k) { if (rec.quiz[k]) quizRight++; });
    });
    Object.keys(progress.cards).forEach(function (k) { if (progress.cards[k].box >= 3) strong++; });
    var labsDone = Object.keys(progress.labs).filter(function (id) { return GG.app.lab(id); }).length;
    var drillsDone = Object.keys(progress.drills).filter(function (id) { return GG.app.drill(id); }).length;

    function tile(value, of, label) {
      return h('div.card.tile', null, h('p.tile-num', null, String(value), h('span.muted', null, ' / ' + of)), h('p.small.muted', null, label));
    }

    var storage = GG.platform.sync === 'on'
      ? 'Saved in this browser and with your account, so your other devices see it.'
      : GG.store.isPersistent()
        ? 'Saved in this browser only. To move it to another device, use Export and Import below.'
        : 'This browser is not letting the guide save. Progress lasts until you close the tab. Use Export below to keep a copy.';

    var exportBox = h('textarea', { id: 'exp', rows: '3', readonly: true, 'aria-label': 'Your progress as text' });
    exportBox.value = GG.store.exportText();
    var importBox = h('textarea', { id: 'imp', rows: '3', placeholder: 'Paste an export here' });
    var armed = false;
    var resetBtn = h('button.btn', { type: 'button', onclick: function () {
      if (!armed) {
        armed = true;
        resetBtn.textContent = 'Tap again to erase all progress';
        setTimeout(function () { armed = false; resetBtn.textContent = 'Erase all progress'; }, 5000);
        return;
      }
      GG.store.resetProgress();
      GG.toast('Progress erased');
      GG.app.rerender();
    } }, 'Erase all progress');

    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Progress'),
        h('h1', null, 'Where you are'),
        h('p.muted', { 'data-needs': 'sync' }, storage)),
      h('div.grid.tiles', null,
        tile(doneLessons, counts.lessons, 'lessons complete'),
        tile(quizRight, counts.quiz, 'quiz questions right'),
        tile(labsDone, counts.labs, 'labs finished'),
        tile(drillsDone, counts.drills, 'drills run'),
        tile(strong, counts.terms + counts.commands, 'flashcards well learned')),
      h('section.stack', null,
        h('h2', null, 'By track'),
        h('div.stack', null, GG.data.tracks.map(function (t) {
          var st = GG.progress.trackStats(t, GG.data.lessons, progress), next = st.next && GG.app.lesson(st.next);
          return h('div.card.lined.stack.t-' + t.id, null,
            h('div.spread', null,
              h('span.row', null, h('span.roundel.sm', { 'aria-hidden': 'true' }, t.letter), h('h3', null, h('a', { href: '#track-' + t.id }, t.title))),
              h('span.mono.small', null, st.done + ' / ' + st.total)),
            h('div.bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.total), 'aria-valuenow': String(st.done), 'aria-label': t.title + ' progress' },
              h('span', { style: 'width:' + st.percent + '%' })),
            next ? h('p.small', null, 'Next: ', h('a', { href: '#' + next.id }, next.title)) : h('p.small.muted', null, 'Every lesson complete.'));
        }))),
      h('section.stack', { style: 'max-width:40rem' },
        h('h2', null, 'Carry it between devices'),
        h('p.small.muted', null, 'Export gives you your progress as a line of text. Paste it into Import on another device. Importing merges and never removes anything you have earned.'),
        h('label', { for: 'exp', class: 'small' }, 'Export'), exportBox,
        h('div', null, h('button.btn.sm', { type: 'button', onclick: function () {
          GG.copy(exportBox.value).then(function (ok) { GG.toast(ok ? 'Progress copied' : 'Copy was blocked. Select the text and copy it by hand.'); });
        } }, GG.icon('copy'), 'Copy export')),
        h('label', { for: 'imp', class: 'small' }, 'Import'), importBox,
        h('div', null, h('button.btn.sm', { type: 'button', onclick: function () {
          try { GG.store.importText(importBox.value.trim()); GG.toast('Progress merged'); GG.app.rerender(); }
          catch (e) { GG.toast('That text is not a progress export from this guide.'); }
        } }, 'Merge this in'))),
      h('section.stack', null, h('h2', null, 'Start over'), h('div', null, resetBtn)));
  };

  // ---------------------------------------------------------------- placement

  GG.views.placement = function () {
    document.title = 'Find your starting point · ' + GG.data.site.title;
    var data = GG.data.placement, answers = {}, result = h('div.stack', { 'aria-live': 'polite' });
    var order = GG.data.tracks.map(function (t) { return t.id; });

    var fields = data.questions.map(function (q, qi) {
      var name = 'pq' + qi;
      return h('fieldset.q', null,
        h('legend', null, h('span.muted.mono.xs', null, (qi + 1) + ' of ' + data.questions.length + ' '), GG.inline(q.q)),
        h('div.choices', null, q.choices.map(function (choice, ci) {
          var id = name + '-' + ci;
          return h('label.check', { for: id },
            h('input', { id: id, type: 'radio', name: name, value: String(ci), onchange: function () { answers[qi] = ci; } }),
            h('span', { style: 'text-decoration:none;color:inherit' }, GG.inline(choice)));
        }).concat([
          h('label.check', { for: name + '-skip' },
            h('input', { id: name + '-skip', type: 'radio', name: name, value: 'skip', onchange: function () { answers[qi] = -1; } }),
            h('span.muted', { style: 'text-decoration:none' }, 'Not sure'))
        ])));
    });

    function submit(e) {
      e.preventDefault();
      var trackId = GG.progress.placeFrom(data.questions, answers, order), track = GG.app.track(trackId);
      var right = data.questions.filter(function (q, i) { return answers[i] === q.answer; }).length;
      GG.store.setPlacement(trackId);
      GG.clear(result);
      result.appendChild(h('div.card.lined.stack.t-' + trackId, null,
        h('p.eyebrow', null, right + ' of ' + data.questions.length + ' right'),
        h('div.row', null, h('span.roundel.lg', { 'aria-hidden': 'true' }, track.letter), h('h2', null, 'Start with ' + track.title)),
        h('p', null, right === data.questions.length
          ? 'You answered everything. Start at Expert and use Skim mode on earlier tracks to check for gaps.'
          : 'This is the first track where a question got past you. Earlier tracks are still worth a pass in Skim mode.'),
        h('div', null, h('a.btn.primary', { href: '#track-' + trackId }, 'Open the ' + track.title + ' track', GG.icon('right')))));
      result.appendChild(h('div.stack', null, data.questions.map(function (q, i) {
        var ok = answers[i] === q.answer;
        return h('div.why', null, h('span.badge.' + (ok ? 'best' : 'bad'), null, ok ? 'Right' : 'Review'), ' ',
          h('strong', null, GG.inline(q.q)), ' ', GG.inline(q.why));
      })));
      result.scrollIntoView({ block: 'start' });
    }

    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Placement check'),
        h('h1', null, 'Find your starting point'),
        h('p.lede', null, GG.inline(data.intro))),
      h('form.stack', { style: 'max-width:46rem', onsubmit: submit }, fields,
        h('div', null, h('button.btn.primary', { type: 'submit' }, 'Show my starting point'))),
      h('div', { style: 'max-width:46rem' }, result));
  };

  // ---------------------------------------------------------------- about

  GG.views.about = function () {
    document.title = 'How this guide is built · ' + GG.data.site.title;
    var c = GG.data.build.counts, b = GG.data.build;
    var stack = [
      ['HTML', 'src/index.html', 'One page shell: landmarks, navigation, the dialogs.'],
      ['CSS', 'src/css/', 'Design tokens, light and dark themes, layout, every component.'],
      ['JavaScript', 'src/js/', 'Renders lessons from data, runs the Git simulator, draws the graphs, keeps your progress. No framework.'],
      ['JSON', 'content/', 'Every lesson, lab, drill and question. The site is driven by data, so fixing a typo is a one-line change.'],
      ['Python', 'tools/, tests/', 'Validates the content, builds the site, serves a local preview, and tests the color contrast.'],
      ['YAML', '.github/workflows/guide.yml', 'Tells GitHub Actions to test, build and deploy on every push to main.'],
      ['Markdown', 'README.md, docs/', 'Documentation that GitHub renders in the repository.'],
      ['SVG', 'drawn by graph.js', 'Commit graphs and the track map, generated from data and described in text.'],
      ['Bash', 'inside lessons and labs', 'The git and gh commands you type.']
    ];
    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Under the hood'),
        h('h1', null, 'How this guide is built'),
        h('p.lede', null, 'The guide is its own worked example. It lives in a GitHub repository, its content is reviewed through pull requests, and GitHub Actions tests and publishes it. Reading its source is a lesson in itself.')),
      h('section.stack', null,
        h('h2', null, 'Nine languages, one job each'),
        h('div.table-wrap', { tabindex: '0', role: 'region', 'aria-label': 'Languages used in this guide' },
          h('table', null,
            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Language'), h('th', { scope: 'col' }, 'Where'), h('th', { scope: 'col' }, 'Its job'))),
            h('tbody', null, stack.map(function (r) { return h('tr', null, h('th', { scope: 'row', style: 'text-transform:none;letter-spacing:0;font-size:var(--t-s);color:var(--ink)' }, r[0]), h('td', null, h('code', null, r[1])), h('td', null, r[2])); }))))),
      h('section.stack', null,
        h('h2', null, 'From an edit to a live page'),
        GG.blocks.render({ type: 'flow', caption: 'The same loop the lessons teach: branch, pull request, checks, merge, deploy.', steps: [
          { label: 'Edit a JSON file', note: 'On a branch, in any tool' },
          { label: 'Open a pull request', via: 'push', note: 'The diff is the proposal' },
          { label: 'Checks run', via: 'Actions', note: 'Validate, test, build' },
          { label: 'Merge to main', via: 'review', note: 'Only if checks pass' },
          { label: 'Site updates', via: 'deploy', note: 'GitHub Pages serves it' }
        ] })),
      h('section.stack.prose', null,
        h('h2', null, 'What is in it'),
        h('p', null, c.lessons + ' lessons in ' + c.tracks + ' tracks, about ' + c.words.toLocaleString() + ' words. ' + c.quiz + ' quiz questions, ' + c.labs + ' guided labs, ' + c.drills + ' drills, ' + c.terms + ' glossary terms and ' + c.commands + ' cheat-sheet entries. The glossary, the cheat sheet and the flashcards are generated from the lessons, so they cannot fall out of step.'),
        h('p', null, 'Two parts of the guide are small programs in their own right. The practice lab simulates Git, including three-way merges, interactive rebase, ignore rules and GitHub\u2019s file size limit. The Workflow reader parses a GitHub Actions file and checks it against the risks the lessons describe. Both run entirely in your browser, and both are tested on every push.'),
        h('h2', null, 'Accessibility'),
        h('p', null, 'Built to WCAG 2.2 AA targets. Text and control colors are checked for contrast by an automated test in both themes. Everything works from a keyboard with a visible focus ring. Nothing depends on color alone: every track has a letter, every status has a word. Diagrams carry a text version. Text size, spacing, contrast, motion and typeface are adjustable under Display. If something gets in your way, that is a defect, and an issue on the repository is welcome.'),
        h('h2', null, 'Privacy'),
        h('p', null, 'Your progress stays in your browser. In a Claude viewer it is also kept in a private per-account store so your devices agree. Nothing is sent to the author. The legible typefaces load from Google Fonts; choose System under Display to make no outside request at all.'),
        h('h2', null, 'Limits'),
        h('p', null, GG.data.site.disclaimer + ' GitHub changes often. When the interface disagrees with a lesson, trust the interface and the linked official documentation, and treat the difference as a pull request waiting to be opened.'),
        h('p.small.muted.mono', null, 'version ' + b.version + (b.commit ? ' · commit ' + b.commit : '') + ' · built ' + b.date + ' · content reviewed ' + GG.data.site.reviewed)));
  };
})();
