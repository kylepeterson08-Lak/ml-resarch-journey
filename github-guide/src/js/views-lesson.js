/*
 * views-lesson.js: one lesson, readable four ways.
 *
 *   Skim   the takeaway, the core idea, the commands
 *   Learn  the whole lesson in order
 *   Do     steps for your tools, the practice lab, the mission
 *   Test   questions and key terms
 *
 * Every part of the lesson is in the page at once. A mode only decides
 * which parts are shown, so switching is instant and nothing is lost.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  GG.views = GG.views || {};

  var MODES = [
    { id: 'skim', label: 'Skim', hint: 'The takeaway, the core idea and the commands. About a minute.' },
    { id: 'learn', label: 'Learn', hint: 'The whole lesson, in order.' },
    { id: 'do', label: 'Do', hint: 'Steps for your tools, the practice lab and the mission.' },
    { id: 'test', label: 'Test', hint: 'Questions and key terms only.' }
  ];

  function part(name, modes, title) {
    var id = 'part-' + name;
    return h('section.part.stack', { 'data-part': name, 'data-modes': modes, 'aria-labelledby': id },
      h('h2', { id: id }, title),
      Array.prototype.slice.call(arguments, 3));
  }

  /** A row of mutually exclusive buttons. */
  function segmented(label, options, current, onPick) {
    var buttons = options.map(function (opt) {
      return h('button', {
        type: 'button', 'aria-pressed': String(opt.id === current), title: opt.blurb || null,
        onclick: function () {
          buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(options[i].id === opt.id)); });
          onPick(opt.id);
        }
      }, opt.label);
    });
    return h('div.seg', { role: 'group', 'aria-label': label }, buttons);
  }
  GG.segmented = segmented;

  // ---------------------------------------------------------------- strip map

  function stripMap(track, currentId) {
    var progress = GG.store.progress();
    return h('nav.stripmap.t-' + track.id, { 'aria-label': 'Lessons in the ' + track.title + ' track' },
      h('ol', null, track.lessons.map(function (id, n) {
        var lesson = GG.app.lesson(id), done = !!(progress.lessons[id] || {}).done;
        return h('li', null, h('a', {
          href: '#' + id, class: done ? 'is-done' : '',
          'aria-current': id === currentId ? 'page' : null,
          'aria-label': 'Lesson ' + (n + 1) + ': ' + lesson.title + (done ? ' (complete)' : ''),
          title: lesson.title
        }, String(n + 1)));
      })));
  }

  // ---------------------------------------------------------------- parts

  function lensPart(lesson) {
    var lenses = GG.data.lenses, prefs = GG.store.prefs(), box = h('div.stack');
    function paint() {
      GG.clear(box);
      if (prefs.allLenses) {
        lenses.forEach(function (lens) {
          box.appendChild(h('div.card.lens-card', null, h('h3', null, lens.label), h('p', { 'data-speak': true }, GG.inline(lesson.lenses[lens.id]))));
        });
      } else {
        box.appendChild(h('p.lens-text', { 'data-speak': true }, GG.inline(lesson.lenses[prefs.lens] || lesson.lenses.everyday)));
      }
    }
    var seg = segmented('Explain it as', lenses, prefs.lens, function (id) { GG.store.setPref('lens', id); paint(); });
    var allId = GG.uid('all');
    var all = h('label.check.small', { for: allId, style: 'min-height:0;border:0;padding:0;background:none' },
      h('input', { id: allId, type: 'checkbox', checked: prefs.allLenses || null, onchange: function (e) { GG.store.setPref('allLenses', e.target.checked); seg.hidden = e.target.checked; paint(); } }),
      h('span', { style: 'text-decoration:none;color:inherit' }, 'Show all four side by side'));
    seg.hidden = !!prefs.allLenses;
    paint();
    return part('lens', 'skim learn', 'The core idea, four ways', h('div.row', null, seg, all), box);
  }

  function howtoPart(lesson) {
    var tools = GG.data.tools, box = h('div.stack');
    function paint() {
      var tool = GG.store.prefs().tool;
      GG.clear(box);
      lesson.howto.forEach(function (task) {
        box.appendChild(h('div.card.stack', null,
          h('h3', null, GG.inline(task.task)),
          h('ol.steps', null, (task[tool] || []).map(function (step) { return h('li', { 'data-speak': true }, GG.inline(step)); }))));
      });
    }
    paint();
    return part('howto', 'learn do', 'Do it with your tools',
      segmented('Show steps for', tools, GG.store.prefs().tool, function (id) { GG.store.setPref('tool', id); paint(); }),
      box);
  }

  function pitfallsPart(lesson) {
    return part('pitfalls', 'skim learn', 'Where people slip',
      h('div.stack', null, lesson.pitfalls.map(function (p) {
        return h('div.pitfall', null,
          h('p', { 'data-speak': true }, h('span.badge.danger', null, 'Trap'), ' ', GG.inline(p.trap)),
          h('p', { 'data-speak': true }, h('span.badge.safe', null, 'Fix'), ' ', GG.inline(p.fix)));
      })));
  }

  function labPart(lesson) {
    var lab = GG.app.lab(lesson.lab);
    if (!lab) return null;
    var done = !!GG.store.progress().labs[lab.id];
    return part('lab', 'learn do', 'Practice it safely',
      h('div.card.lined.stack', null,
        h('div.spread', null,
          h('h3', null, lab.title),
          done ? h('span.badge.done', null, 'Completed') : h('span.badge', null, 'About ' + lab.minutes + ' min')),
        h('p', null, GG.inline(lab.intro)),
        h('div', null, h('a.btn.primary', { href: '#' + lab.id }, GG.icon('terminal'), done ? 'Run the lab again' : 'Open the practice lab'))));
  }

  function missionPart(lesson) {
    var rec = GG.store.lesson(lesson.id), m = lesson.mission;
    return part('mission', 'learn do', 'Mission: ' + m.title,
      m.where ? h('p.muted.small', null, GG.inline(m.where)) : null,
      h('ul.checklist', null, m.steps.map(function (step, i) {
        var id = GG.uid('m');
        return h('li', null, h('label.check', { for: id },
          h('input', { id: id, type: 'checkbox', checked: rec.mission[i] ? true : null, onchange: function (e) { GG.store.setMission(lesson.id, i, e.target.checked); } }),
          h('span', null, GG.inline(step))));
      })));
  }

  function quizPart(lesson) {
    var score = h('p.small.muted', { role: 'status' });
    function paintScore() {
      var rec = GG.store.lesson(lesson.id), right = 0;
      Object.keys(rec.quiz).forEach(function (k) { if (rec.quiz[k]) right++; });
      score.textContent = right + ' of ' + lesson.quiz.length + ' answered correctly';
    }
    var questions = lesson.quiz.map(function (q, qi) {
      var why = h('div.why', { hidden: true, role: 'status' });
      var buttons = q.choices.map(function (choice, ci) {
        return h('button.choice', { type: 'button', 'aria-pressed': 'false', onclick: function () { pick(ci); } },
          h('span.mark', { 'aria-hidden': 'true' }, 'ABCDE'.charAt(ci)),
          h('span', null, GG.inline(choice)));
      });
      function show(right, revealed) {
        GG.clear(why);
        why.hidden = false;
        if (right || revealed) {
          why.appendChild(h('strong', null, right ? 'Correct. ' : 'Answer: ' + 'ABCDE'.charAt(q.answer) + '. '));
          why.appendChild(GG.inline(q.why));
          buttons[q.answer].classList.add('is-right');
        } else {
          why.appendChild(h('strong', null, 'Not quite. '));
          why.appendChild(document.createTextNode('Try another choice, or '));
          why.appendChild(h('button.btn.sm', { type: 'button', onclick: function () { show(false, true); } }, 'show the answer'));
        }
      }
      function pick(ci) {
        var right = ci === q.answer;
        buttons.forEach(function (b, i) {
          b.classList.remove('is-right', 'is-wrong');
          b.setAttribute('aria-pressed', String(i === ci));
        });
        buttons[ci].classList.add(right ? 'is-right' : 'is-wrong');
        GG.store.setQuiz(lesson.id, qi, right);
        show(right, false);
        paintScore();
      }
      return h('fieldset.q', null,
        h('legend', null, h('span.muted.mono.xs', null, 'Q' + (qi + 1) + ' '), GG.inline(q.q)),
        h('div.choices', null, buttons), why);
    });
    paintScore();
    return part('quiz', 'learn test', 'Check yourself', score, questions);
  }

  function commandsPart(lesson) {
    var KIND = { git: 'git', gh: 'gh', shell: 'shell', key: 'key', search: 'search', web: 'URL' };
    return part('commands', 'skim learn do', 'Commands from this lesson',
      h('div.table-wrap', { tabindex: '0', role: 'region', 'aria-label': 'Commands from this lesson' },
        h('table.cmd-table', null,
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Command'), h('th', { scope: 'col' }, 'What it does'), h('th', { scope: 'col' }, 'Risk'))),
          h('tbody', null, lesson.commands.map(function (c) {
            return h('tr', null,
              h('td', null, h('div.cmd-cell', null,
                c.kind === 'key' ? h('kbd', null, c.cmd) : h('code', null, c.cmd),
                h('span.badge', null, KIND[c.kind] || c.kind))),
              h('td', null, GG.inline(c.does)),
              h('td', null, h('span.badge.' + c.risk, null, c.risk)));
          })))),
      h('p.xs.muted', null, 'Every command in the guide is collected in the ', h('a', { href: '#cheatsheet' }, 'cheat sheet'), '.'));
  }

  function termsPart(lesson) {
    return part('terms', 'skim learn test', 'Words from this lesson',
      h('dl.terms', null, lesson.terms.map(function (t) {
        return [h('dt', null, t.term), h('dd', { 'data-speak': true }, GG.inline(t.def))];
      })));
  }

  function lessonContext(lesson) {
    var lens = GG.store.prefs().lens, out = [lesson.title, GG.plain(lesson.summary), GG.plain(lesson.lenses[lens] || '')];
    lesson.sections.forEach(function (s) {
      out.push('## ' + s.heading);
      s.blocks.forEach(function (b) { out.push(GG.blocks.text(b)); });
    });
    lesson.pitfalls.forEach(function (p) { out.push('Pitfall: ' + GG.plain(p.trap) + ' Fix: ' + GG.plain(p.fix)); });
    lesson.commands.forEach(function (c) { out.push(c.cmd + ': ' + GG.plain(c.does)); });
    return out.join('\n').slice(0, 14000);
  }

  /** Render a tutor answer: paragraphs and simple lists, nothing else. */
  function renderAnswer(target, text) {
    GG.clear(target);
    var list = null;
    text.split('\n').forEach(function (line) {
      var item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
      if (item) {
        if (!list) { list = h('ul'); target.appendChild(list); }
        list.appendChild(h('li', null, GG.inline(item[1])));
      } else {
        list = null;
        if (line.trim()) target.appendChild(h('p', null, GG.inline(line.trim())));
      }
    });
  }

  function askPart(lesson) {
    var answer = h('div.stack.ask-answer', { role: 'status', 'aria-live': 'polite' });
    var input = h('textarea', { id: GG.uid('ask'), rows: '2', maxlength: '500', placeholder: 'For example: when would I rebase instead?' });
    var busy = false;
    var button = h('button.btn.primary', { type: 'submit' }, GG.icon('chat'), 'Ask');
    var form = h('form.stack', {
      onsubmit: function (e) {
        e.preventDefault();
        var question = input.value.trim();
        if (!question || busy || !GG.platform.ask) return;
        busy = true;
        button.disabled = true;
        GG.clear(answer).appendChild(h('p.muted', null, 'Thinking…'));
        GG.platform.ask(question, lessonContext(lesson), function (text) { renderAnswer(answer, text); })
          .then(function (text) { renderAnswer(answer, text); }, function (err) {
            GG.clear(answer).appendChild(h('p.muted', null,
              err && err.code === 'rate_limited' ? 'The tutor is busy. Try again in a minute.'
                : err && err.code === 'not_granted' ? 'The tutor is turned off for this page.'
                  : 'The tutor could not answer just now.'));
          })
          .then(function () { busy = false; button.disabled = false; });
      }
    }, h('label', { for: input.id, class: 'small' }, 'Your question about this lesson'), input, h('div', null, button));
    var section = part('ask', 'learn do test', 'Ask about this lesson',
      h('p.small.muted', null, 'Answers come from an AI tutor that is given this lesson as context. It can be wrong. Check anything important against the linked documentation.'),
      form, answer);
    section.setAttribute('data-needs', 'ask');
    section.hidden = !GG.platform.ask;
    return section;
  }

  function linksPart(lesson) {
    return part('links', 'learn', 'Go to the source',
      h('ul', null, lesson.links.map(function (l) { return h('li', null, GG.link(l.url, l.label)); })));
  }

  // ---------------------------------------------------------------- the view

  GG.views.lesson = function (id) {
    var lesson = GG.app.lesson(id), track = GG.app.trackOf(id), prefs = GG.store.prefs();
    var order = GG.app.order, at = order.indexOf(id);
    var prev = at > 0 ? GG.app.lesson(order[at - 1]) : null, next = at < order.length - 1 ? GG.app.lesson(order[at + 1]) : null;
    document.title = lesson.title + ' · ' + GG.data.site.title;

    if (lesson.stub) {
      return h('div.page.t-' + track.id, null, stripMap(track, id),
        h('h1', null, lesson.title),
        h('p.lede', null, 'This lesson is planned and not written yet.'),
        h('p', null, h('a.btn', { href: '#track-' + track.id }, 'Back to the ' + track.title + ' track')));
    }
    GG.store.markSeen(id);

    var root = h('article.lesson.page.t-' + track.id, { 'data-mode': prefs.mode });
    var hint = h('p.small.muted.mode-hint');
    function setMode(mode) {
      root.setAttribute('data-mode', mode);
      hint.textContent = MODES.filter(function (m) { return m.id === mode; })[0].hint;
      GG.store.setPref('mode', mode);
    }
    hint.textContent = MODES.filter(function (m) { return m.id === prefs.mode; })[0].hint;

    // Read aloud
    var listenLabel = h('span', null, 'Listen');
    var listen = h('button.btn.sm', {
      type: 'button', 'data-needs': 'tts', hidden: !GG.speech.available() || null,
      onclick: function () {
        if (GG.speech.state() !== 'idle') { GG.speech.stop(); return; }
        var lines = [lesson.title, GG.plain(lesson.summary)];
        root.querySelectorAll('[data-speak]').forEach(function (el) {
          if (el.offsetParent !== null) lines.push(el.textContent);
        });
        GG.speech.speak(lines);
      }
    }, GG.icon('speaker'), listenLabel);
    GG.speech.onState(function (state) { listenLabel.textContent = state === 'idle' ? 'Listen' : 'Stop'; });

    var focusBtn = h('button.btn.sm', {
      type: 'button', 'aria-pressed': String(prefs.focus === 'on'),
      onclick: function () {
        var on = GG.store.prefs().focus !== 'on';
        GG.store.setPref('focus', on ? 'on' : 'off');
        GG.app.applyPrefs();
        focusBtn.setAttribute('aria-pressed', String(on));
      }
    }, GG.icon('eye'), 'Focus');

    // Completion
    var doneBtn = h('button.btn.primary', { type: 'button', onclick: function () {
      var nowDone = !GG.store.lesson(id).done;
      GG.store.setDone(id, nowDone);
      paintDone();
      if (nowDone) GG.toast(next ? 'Lesson complete. Next: ' + next.title : 'Lesson complete. That was the last one.');
    } });
    function paintDone() {
      var done = !!GG.store.lesson(id).done;
      GG.clear(doneBtn);
      doneBtn.appendChild(GG.icon(done ? 'check' : 'right'));
      doneBtn.appendChild(document.createTextNode(done ? 'Completed. Undo?' : 'Mark lesson complete'));
      doneBtn.setAttribute('aria-pressed', String(done));
      root.classList.toggle('is-done', done);
    }
    paintDone();

    var prereqs = (lesson.prereqs || []).map(function (p) { return GG.app.lesson(p); }).filter(Boolean);

    root.appendChild(stripMap(track, id));
    root.appendChild(h('header.lesson-head.stack', null,
      h('p.eyebrow', null,
        h('a.roundel.sm', { href: '#track-' + track.id, 'aria-label': track.title + ' track' }, track.letter),
        h('span', null, track.title + ' · lesson ' + lesson.position + ' of ' + track.lessons.length),
        h('span.raw', { title: 'A hash of this lesson’s content. Edit the lesson and it changes, as a Git object id would.' }, lesson.sha),
        h('span', null, lesson.minutes + ' min')),
      h('h1', null, lesson.title),
      h('p.lede', { 'data-speak': false }, GG.inline(lesson.summary)),
      prereqs.length ? h('p.small.muted', null, 'Builds on: ', prereqs.map(function (p, i) {
        return [i ? ', ' : '', h('a', { href: '#' + p.id }, p.title)];
      })) : null,
      h('div.lesson-tools.stack', null,
        h('div.row', null, segmented('Reading mode', MODES, prefs.mode, setMode), listen, focusBtn),
        hint)));

    root.appendChild(part('outcomes', 'skim learn', 'After this you can',
      h('ul', null, lesson.outcomes.map(function (o) { return h('li', { 'data-speak': true }, GG.inline(o)); }))));
    root.appendChild(lensPart(lesson));

    lesson.sections.forEach(function (sec, n) {
      root.appendChild(h('section.part.stack.body', { 'data-part': 'section', 'data-modes': 'learn' },
        h('h2', { id: 'sec-' + (n + 1), 'data-speak': true }, sec.heading),
        sec.blocks.map(GG.blocks.render)));
    });

    [howtoPart(lesson), pitfallsPart(lesson), lesson.lab ? labPart(lesson) : null, missionPart(lesson),
      quizPart(lesson), commandsPart(lesson), termsPart(lesson), askPart(lesson), linksPart(lesson)]
      .forEach(function (el) { if (el) root.appendChild(el); });

    root.appendChild(h('footer.lesson-nav.stack', null,
      h('div', null, doneBtn),
      h('div.spread', null,
        prev ? h('a.btn', { href: '#' + prev.id }, GG.icon('left'), h('span', null, h('span.xs.muted', { style: 'display:block' }, 'Previous'), prev.title)) : h('span'),
        next ? h('a.btn', { href: '#' + next.id, style: 'text-align:right' }, h('span', null, h('span.xs.muted', { style: 'display:block' }, 'Next'), next.title), GG.icon('right')) : h('span'))));
    return root;
  };
})();
