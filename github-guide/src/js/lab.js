/*
 * lab.js: the practice lab.
 *
 * A terminal wired to the Git simulator (gitsim.js), a live picture of the
 * commit graph for your clone and for the pretend GitHub remote, a file
 * panel with an editor, and guided steps that check themselves.
 *
 * Everything runs in memory in this tab. No real repository is involved.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  GG.views = GG.views || {};

  var STATE_LABEL = { clean: 'clean', modified: 'modified', staged: 'staged', untracked: 'untracked', conflict: 'conflict', ignored: 'ignored' };

  var PLAN_HELP = [
    ['pick', 'keep the commit as it is'],
    ['reword', 'keep it, with a new message'],
    ['squash', 'fold it into the line above and keep both messages'],
    ['fixup', 'fold it into the line above and keep that line\u2019s message'],
    ['drop', 'leave the commit out']
  ];

  GG.views.lab = function (labId) {
    var lab = GG.app.lab(labId), sim, stepIndex, ranThisStep, lastAfter, finished, history = [], historyAt = 0;
    var track = GG.app.track(lab.track), lesson = GG.app.lessonForLab(lab.id);
    document.title = lab.title + ' · Practice lab';

    var stepBox = h('section.lab-step.card.stack', { 'aria-live': 'polite', 'aria-label': 'Current step' });
    var graphBox = h('section.lab-graphs.stack', { 'aria-label': 'Commit graphs' });
    var out = h('div.term-out', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output', tabindex: '0' });
    var prompt = h('label.term-prompt.mono', { for: 'term-input' }, '$');
    var input = h('input#term-input.mono', {
      type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      enterkeyhint: 'go', 'aria-label': 'Type a command', placeholder: 'git status',
      onkeydown: function (e) {
        if (e.key === 'ArrowUp' && history.length) {
          e.preventDefault();
          historyAt = Math.max(0, historyAt - 1);
          input.value = history[historyAt];
        } else if (e.key === 'ArrowDown' && history.length) {
          e.preventDefault();
          historyAt = Math.min(history.length, historyAt + 1);
          input.value = history[historyAt] || '';
        }
      }
    });
    var filesBox = h('div.stack');
    var editorBox = h('div.stack');
    var planBox = h('section.plan.card.stack', { hidden: true, 'aria-label': 'Rebase plan editor' });
    var planRows = [], planFor = null;

    function print(text, cls) {
      if (!text) return;
      out.appendChild(h('pre.term-line.' + cls, null, text));
      while (out.childNodes.length > 250) out.removeChild(out.firstChild);
      out.scrollTop = out.scrollHeight;
    }

    function paintPrompt() {
      var branch = sim.currentBranch();
      prompt.textContent = (sim.initialized ? '(' + (branch || 'detached') + ') ' : '') + '$';
    }

    function paintGraphs() {
      GG.clear(graphBox);
      var local = sim.graph('local');
      if (!local.commits.length) {
        graphBox.appendChild(h('p.muted.small', null, 'No commits yet. The graph appears after your first commit.'));
        return;
      }
      graphBox.appendChild(GG.graph.render(local, { title: 'Your clone', scrollEnd: true }));
      var server = sim.graph('server');
      if (server && server.commits.length) graphBox.appendChild(GG.graph.render(server, { title: 'On GitHub (origin)', scrollEnd: true }));
    }

    function openEditor(path, isNew) {
      var id = GG.uid('ed');
      var area = h('textarea', { id: id, rows: '8', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' });
      area.value = isNew ? '' : (sim.readFile(path) || '');
      GG.clear(editorBox);
      editorBox.appendChild(h('div.editor.card.stack', null,
        h('label.mono.small', { for: id }, (isNew ? 'New file: ' : 'Editing: ') + path),
        area,
        h('div.row', null,
          h('button.btn.primary.sm', { type: 'button', onclick: function () {
            sim.writeFile(path, area.value);
            print('(saved ' + path + ' in the editor)', 'note');
            GG.clear(editorBox);
            afterAction();
          } }, 'Save file'),
          h('button.btn.sm', { type: 'button', onclick: function () { GG.clear(editorBox); } }, 'Cancel'))));
      area.focus();
    }

    function paintFiles() {
      GG.clear(filesBox);
      var files = sim.files();
      if (!files.length) filesBox.appendChild(h('p.muted.small', null, 'The working tree is empty.'));
      files.forEach(function (f) {
        filesBox.appendChild(h('button.file-row', { type: 'button', 'aria-label': 'Edit ' + f.path + ', ' + STATE_LABEL[f.state], onclick: function () { openEditor(f.path, false); } },
          GG.icon('file'), h('span.mono', null, f.path), h('span.badge.' + f.state, null, STATE_LABEL[f.state])));
      });
      var nameId = GG.uid('nf');
      var name = h('input.mono', { id: nameId, type: 'text', placeholder: 'notes.md', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
      filesBox.appendChild(h('form.row.new-file', { onsubmit: function (e) {
        e.preventDefault();
        var path = name.value.trim().replace(/^\.\//, '');
        if (!path || /\s/.test(path)) { GG.toast('Give the file a name with no spaces.'); return; }
        openEditor(path, sim.readFile(path) === undefined);
      } }, h('label.vh', { for: nameId }, 'New file name'), name, h('button.btn.sm', { type: 'submit' }, 'New file')));
    }

    /**
     * The rebase plan editor. Real Git opens this list as text in your
     * editor: one line per commit, a verb at the start of each line.
     */
    function paintPlan(focusRow) {
      var plan = sim.todoPlan;
      planBox.hidden = !plan;
      GG.clear(planBox);
      if (!plan) { planFor = null; return; }
      if (planFor !== plan) {
        planFor = plan;
        planRows = plan.items.map(function (i) { return { sha: i.sha, action: i.action, message: i.message }; });
      }
      var alert = h('p.small', { role: 'alert', style: 'color:var(--bad)' });
      var step = !lab.free && !finished ? lab.steps[stepIndex] : null;
      function move(from, to) {
        var row = planRows.splice(from, 1)[0];
        planRows.splice(to, 0, row);
        GG.toast('Moved \u201c' + sim.subject(row.sha) + '\u201d to line ' + (to + 1));
        paintPlan(to);
      }
      var list = h('ol.plan-rows', null, planRows.map(function (row, n) {
        var subject = sim.subject(row.sha), short = sim.short(row.sha);
        var label = 'line ' + (n + 1) + ', ' + subject;
        var messageId = GG.uid('pm');
        var message = h('input.mono', {
          id: messageId, type: 'text', 'aria-label': 'New message for ' + label, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
          hidden: row.action !== 'reword' || null,
          oninput: function (e) { row.message = e.target.value; }
        });
        message.value = row.message.split('\n')[0];
        var text = h('span.plan-subject', { hidden: row.action === 'reword' || null }, subject);
        var select = h('select', {
          'aria-label': 'Action for ' + label,
          onchange: function (e) {
            row.action = e.target.value;
            message.hidden = row.action !== 'reword';
            text.hidden = row.action === 'reword';
            item.setAttribute('data-action', row.action);
            if (row.action === 'reword') message.focus();
          }
        }, PLAN_HELP.map(function (a) { return h('option', { value: a[0], selected: a[0] === row.action || null }, a[0]); }));
        var up = h('button.icon-btn', { type: 'button', 'aria-label': 'Move up: ' + label, disabled: n === 0 || null, onclick: function () { move(n, n - 1); } }, GG.icon('left'));
        var down = h('button.icon-btn', { type: 'button', 'aria-label': 'Move down: ' + label, disabled: n === planRows.length - 1 || null, onclick: function () { move(n, n + 1); } }, GG.icon('right'));
        var item = h('li', { 'data-action': row.action }, select, h('span.mono.xs.muted', null, short), text, message, h('span.plan-move', null, up, down));
        return item;
      }));
      planBox.appendChild(h('div', null,
        h('h2', { style: 'font-size:var(--t-m)' }, 'Rebase plan'),
        h('p.small.muted', null, 'Oldest commit first. Git replays them from the top down, doing what each line says.')));
      planBox.appendChild(list);
      planBox.appendChild(h('dl.plan-help.xs.muted', null, PLAN_HELP.map(function (a) { return [h('dt.mono', null, a[0]), h('dd', null, a[1])]; })));
      planBox.appendChild(alert);
      planBox.appendChild(h('div.row', null,
        h('button.btn.primary', { type: 'button', onclick: function () {
          var res;
          try { res = sim.startPlan(planRows); }
          catch (e) { alert.textContent = e.message; return; }
          print('(started the rebase from the plan editor)', 'note');
          print(typeof res === 'string' ? res : res.out, typeof res === 'string' || !res.err ? 'out' : 'err');
          ranThisStep.push('(start rebase plan)');
          afterAction();
          input.focus();
        } }, GG.icon('play'), 'Start rebase'),
        h('button.btn', { type: 'button', onclick: function () {
          print(sim.cancelPlan(), 'note');
          afterAction();
        } }, 'Cancel'),
        step && step.plan && step.plan !== 'default' ? h('button.btn.quiet', { type: 'button', onclick: function () {
          try { planRows = sim.planFromSpec(step.plan); } catch (e) { alert.textContent = e.message; return; }
          GG.toast('Plan filled in. Read it, then start the rebase.');
          paintPlan();
        } }, 'Fill in the suggested plan') : null));
      if (typeof focusRow === 'number') {
        var rows = list.querySelectorAll('li');
        if (rows[focusRow]) rows[focusRow].querySelector('select').focus();
      }
    }

    function paintStep() {
      GG.clear(stepBox);
      if (lab.free) {
        stepBox.appendChild(h('h2', null, 'Free play'));
        stepBox.appendChild(h('p', null, GG.inline(lab.outro)));
        stepBox.appendChild(h('p.small.muted', null, 'Type ', h('code', null, 'help'), ' to see what this terminal supports.'));
        return;
      }
      var steps = lab.steps;
      stepBox.appendChild(h('div.spread', null,
        h('span.eyebrow', null, finished ? 'Lab complete' : 'Step ' + (stepIndex + 1) + ' of ' + steps.length),
        h('div.dots', { 'aria-hidden': 'true' }, steps.map(function (s, n) {
          return h('span', { class: n < stepIndex || finished ? 'is-done' : n === stepIndex ? 'is-now' : '' });
        }))));
      if (lastAfter) {
        stepBox.appendChild(h('div.callout.kind-tip', { role: 'note' }, GG.icon('check'), h('span.kind', null, 'Done'), h('div.body', null, GG.inline(lastAfter))));
      }
      if (finished) {
        stepBox.appendChild(h('h2', null, 'You finished the lab'));
        stepBox.appendChild(h('p', null, GG.inline(lab.outro)));
        stepBox.appendChild(h('div.row', null,
          lesson ? h('a.btn.primary', { href: '#' + lesson.id }, 'Back to the lesson') : null,
          h('button.btn', { type: 'button', onclick: start }, 'Run it again'),
          h('a.btn', { href: '#lab-playground' }, 'Free play')));
        return;
      }
      var step = steps[stepIndex];
      var hintBox = h('p.small', { hidden: true }, GG.inline(step.hint || 'Try the first suggested command below.'));
      stepBox.appendChild(h('h2', null, GG.inline(step.goal)));
      stepBox.appendChild(h('p', null, GG.inline(step.say)));
      if (step.suggest.length) {
        stepBox.appendChild(h('div.stack', null,
          h('span.xs.muted', null, 'Tap to run, or type it yourself for practice'),
          h('div.suggest', null, step.suggest.map(function (cmd) {
            return h('button.chip.cmd', { type: 'button', onclick: function () { runCommand(cmd); } }, cmd);
          }))));
      }
      if (step.plan) {
        stepBox.appendChild(h('p.small.muted', null, step.suggest.length
          ? 'The command opens the plan editor. Finish the step there.'
          : 'Work in the plan editor, which is open below.'));
      }
      stepBox.appendChild(h('div', null, h('button.btn.quiet.sm', { type: 'button', 'aria-expanded': 'false', onclick: function (e) {
        hintBox.hidden = !hintBox.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!hintBox.hidden));
      } }, 'Stuck? Show a hint')));
      stepBox.appendChild(hintBox);
    }

    function runBefore() {
      var step = lab.steps[stepIndex];
      (step && step.before || []).forEach(function (line) { sim.run(line, { silent: true }); });
    }

    function checkStep() {
      if (lab.free || finished) return;
      var step = lab.steps[stepIndex];
      // One step per action, so each explanation gets read.
      if (!step || !GG.gitsim.evaluate(step.check, sim, ranThisStep)) return;
      lastAfter = step.after || 'Step complete.';
      stepIndex++;
      ranThisStep = [];
      if (stepIndex >= lab.steps.length) {
        finished = true;
        GG.store.setLab(lab.id);
      } else {
        runBefore();
      }
      paintStep();
    }

    function afterAction() {
      paintPrompt();
      paintGraphs();
      paintFiles();
      checkStep();
      paintPlan();
    }

    function runCommand(line) {
      line = String(line).trim();
      if (!line) return;
      history.push(line);
      historyAt = history.length;
      print(prompt.textContent + ' ' + line, 'cmd');
      var res = sim.run(line);
      if (res.clear) GG.clear(out);
      print(res.out, res.err ? 'err' : 'out');
      ranThisStep.push(line);
      afterAction();
    }

    function start() {
      sim = GG.gitsim.fromSetup(lab.setup);
      stepIndex = 0;
      ranThisStep = [];
      lastAfter = '';
      finished = false;
      if (!lab.free) runBefore();
      GG.clear(out);
      GG.clear(editorBox);
      print('Practice terminal. Nothing here touches a real repository. Type help for the command list.', 'note');
      paintPrompt();
      paintStep();
      paintGraphs();
      paintFiles();
      paintPlan();
    }

    var picker = h('select', { id: 'lab-pick', onchange: function (e) { GG.app.go(e.target.value); } },
      GG.data.tracks.map(function (t) {
        var labs = GG.data.labs.filter(function (l) { return l.track === t.id; });
        return labs.length ? h('optgroup', { label: t.title }, labs.map(function (l) {
          return h('option', { value: l.id, selected: l.id === lab.id || null }, l.title);
        })) : null;
      }));

    var root = h('div.page.lab-page.t-' + track.id, null,
      h('header.stack', null,
        h('p.eyebrow', null, h('span.roundel.sm', null, track.letter), h('span', null, 'Practice lab'), lab.free ? null : h('span', null, 'about ' + lab.minutes + ' min')),
        h('h1', null, lab.title),
        h('p.lede', null, GG.inline(lab.intro)),
        h('div.row', null,
          h('label.vh', { for: 'lab-pick' }, 'Choose a lab'), h('div.pick', null, picker),
          h('button.btn', { type: 'button', onclick: function () { start(); GG.toast('Lab reset'); } }, GG.icon('refresh'), 'Reset'),
          lesson ? h('a.btn.quiet', { href: '#' + lesson.id }, GG.icon('book'), 'Lesson') : null)),
      h('div.lab', null,
        stepBox,
        planBox,
        graphBox,
        h('section.term', { 'aria-label': 'Terminal' },
          out,
          h('form.term-form', { onsubmit: function (e) { e.preventDefault(); var v = input.value; input.value = ''; runCommand(v); } },
            prompt, input, h('button.btn.primary.sm', { type: 'submit' }, 'Run'))),
        h('section.files.card.stack', { 'aria-label': 'Files' },
          h('h2', { style: 'font-size:var(--t-base)' }, 'Files in your working tree'),
          h('p.xs.muted', null, 'Tap a file to edit it. The badge shows what Git thinks of it.'),
          filesBox, editorBox)));
    start();
    return root;
  };

  /** The list of labs. */
  GG.views.labs = function () {
    document.title = 'Practice lab · ' + GG.data.site.title;
    var done = GG.store.progress().labs;
    var free = GG.app.lab('lab-playground');
    return h('div.page', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Practice lab'),
        h('h1', null, 'A terminal where nothing can break'),
        h('p.lede', null, 'Type real Git commands against a simulated repository and watch the commit graph change. Guided labs check each step. Free play has no rules.'),
        free ? h('div', null, h('a.btn.primary', { href: '#' + free.id }, GG.icon('terminal'), 'Open free play')) : null),
      GG.data.tracks.map(function (t) {
        var labs = GG.data.labs.filter(function (l) { return l.track === t.id && !l.free; });
        if (!labs.length) return null;
        return h('section.stack.t-' + t.id, null,
          h('h2', null, h('span.roundel.sm', { style: 'vertical-align:middle;margin-right:.5rem' }, t.letter), t.title),
          h('div.grid', null, labs.map(function (l) {
            var lesson = GG.app.lessonForLab(l.id);
            return h('a.card.link.lined', { href: '#' + l.id },
              h('div.spread', null, h('h3', null, l.title), done[l.id] ? h('span.badge.done', null, 'Done') : h('span.badge', null, l.minutes + ' min')),
              h('p.small.muted', null, lesson ? 'Goes with: ' + lesson.title : GG.plain(l.intro)));
          })));
      }));
  };
})();
