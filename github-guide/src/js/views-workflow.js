/*
 * views-workflow.js: the Workflow reader.
 *
 * You read workflow files far more often than you write one from nothing:
 * every project you join has them, and every pull request that touches one
 * deserves a careful look. This page reads a pasted workflow, says in plain
 * words what it does, flags the risks the lessons teach, and shows which
 * jobs would run for a chosen event.
 *
 * yaml.js parses the text, workflow.js analyzes it, and this file draws
 * the result. Nothing is sent anywhere and nothing is run.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  GG.views = GG.views || {};

  var RISKY = GG.workflowSamples.risky, NIGHTLY = GG.workflowSamples.nightly;

  var EVENT_TEXT = {
    push: 'someone pushes commits',
    pull_request: 'a pull request is opened or updated',
    pull_request_target: 'a pull request is opened or updated, run with the base repository’s own access',
    workflow_dispatch: 'someone starts it by hand',
    schedule: 'on a schedule',
    release: 'a release is published',
    issues: 'an issue is opened or changed',
    issue_comment: 'someone comments on an issue or pull request',
    workflow_call: 'another workflow calls it',
    workflow_run: 'another workflow finishes',
    merge_group: 'a pull request enters the merge queue'
  };

  var LEVEL = { error: ['danger', 'Error'], warn: ['caution', 'Warning'], note: ['', 'Note'] };
  var STATUS = { runs: ['safe', 'Runs'], skipped: ['', 'Skipped'], unknown: ['caution', 'Cannot tell'] };

  function listText(items) {
    return items.map(function (x) { return '`' + x + '`'; }).join(', ');
  }

  function describeTrigger(t) {
    var text = 'When ' + (EVENT_TEXT[t.event] || 'the `' + t.event + '` event happens'), extra = [];
    if (t.branches) extra.push((t.event.indexOf('pull_request') === 0 ? 'into ' : 'to ') + 'branches matching ' + listText(t.branches));
    if (t.branchesIgnore) extra.push('except branches matching ' + listText(t.branchesIgnore));
    if (t.tags) extra.push('for tags matching ' + listText(t.tags));
    if (t.tagsIgnore) extra.push('except tags matching ' + listText(t.tagsIgnore));
    if (t.paths) extra.push('only if a changed file matches ' + listText(t.paths));
    if (t.pathsIgnore) extra.push('unless every changed file matches ' + listText(t.pathsIgnore));
    if (t.types) extra.push('for activity types ' + listText(t.types));
    if (t.cron && t.cron.length) extra.push('at ' + listText(t.cron) + ' (cron syntax, in UTC)');
    if (t.inputs && t.inputs.length) extra.push('asking for ' + listText(t.inputs));
    return text + (extra.length ? ', ' + extra.join(', ') : '') + '.';
  }

  function describePermissions(p) {
    if (!p) return null;
    if (typeof p === 'string') return p === 'read-all' ? 'read access to everything' : p === 'write-all' ? 'write access to everything' : p;
    var keys = Object.keys(p);
    if (!keys.length) return 'no access at all';
    return keys.map(function (k) { return k + ': ' + p[k]; }).join(', ');
  }

  function stepText(step) {
    if (step.uses) return ['uses', step.uses];
    var first = String(step.run || '').split('\n').filter(function (l) { return l.trim(); })[0] || '';
    var more = String(step.run || '').split('\n').filter(function (l) { return l.trim(); }).length - 1;
    return ['run', first + (more > 0 ? '  (+' + more + ' more line' + (more > 1 ? 's' : '') + ')' : '')];
  }

  GG.views.workflow = function () {
    document.title = 'Workflow reader · ' + GG.data.site.title;
    var samples = [
      { id: 'guide', label: 'This guide’s own workflow', text: (GG.data.workflow && GG.data.workflow.guide) || NIGHTLY },
      { id: 'risky', label: 'A workflow with problems to find', text: RISKY },
      { id: 'nightly', label: 'A nightly matrix build', text: NIGHTLY }
    ];
    var output = h('div.stack', { 'aria-live': 'polite' });
    var area = h('textarea', { id: 'wf-text', rows: '14', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', 'aria-describedby': 'wf-help' });
    area.value = samples[0].text;
    var scenario = { event: null, ref: 'refs/heads/main', fork: false };

    function problemList(problems) {
      if (!problems.length) {
        return h('div.callout.kind-tip', { role: 'note' }, GG.icon('check'), h('span.kind', null, 'Nothing flagged'),
          h('div.body', null, 'This reader found none of the problems it knows how to look for. That is a narrower statement than “this workflow is safe”.'));
      }
      var order = { error: 0, warn: 1, note: 2 };
      return h('ul.wf-problems', null, problems.slice().sort(function (a, b) { return order[a.level] - order[b.level]; }).map(function (p) {
        var lesson = p.lesson && GG.app.lesson(p.lesson), level = LEVEL[p.level] || LEVEL.note;
        return h('li', { class: 'wf-' + p.level },
          h('div.row', null,
            h('span.badge' + (level[0] ? '.' + level[0] : ''), null, level[1]),
            p.line ? h('span.mono.xs.muted', null, 'line ' + p.line) : null,
            p.where ? h('code.xs', null, p.where) : null),
          h('p', null, GG.inline(p.message)),
          lesson ? h('p.xs', null, 'Covered in ', h('a', { href: '#' + lesson.id }, lesson.title)) : null);
      }));
    }

    function jobCard(job) {
      var facts = [];
      if (job.uses) facts.push(['Calls', job.uses]);
      if (job.runsOn) facts.push(['Runs on', Array.isArray(job.runsOn) ? job.runsOn.join(', ') : String(job.runsOn)]);
      if (job.needs && job.needs.length) facts.push(['Waits for', job.needs.join(', ')]);
      if (job.if) facts.push(['Only if', job.if]);
      if (job.environment) facts.push(['Environment', job.environment]);
      if (job.permissions) facts.push(['Token', describePermissions(job.permissions)]);
      if (job.timeoutMinutes) facts.push(['Time limit', job.timeoutMinutes + ' minutes']);
      if (job.matrix) facts.push(['Matrix', Object.keys(job.matrix).filter(function (k) { return k !== 'include' && k !== 'exclude'; }).map(function (k) {
        return k + ' × ' + (Array.isArray(job.matrix[k]) ? job.matrix[k].length : 1);
      }).join(', ')]);
      return h('div.card.stack.wf-job', null,
        h('h3', null, job.name && job.name !== job.id ? [job.name, ' ', h('code.xs', null, job.id)] : h('code', null, job.id)),
        h('dl.wf-facts', null, facts.map(function (f) { return [h('dt', null, f[0]), h('dd', null, h('code', null, f[1]))]; })),
        job.steps && job.steps.length ? h('ol.wf-steps', null, job.steps.map(function (step) {
          var t = stepText(step);
          return h('li', null,
            step.name ? h('span.wf-step-name', null, step.name) : null,
            h('span.badge', null, t[0]), ' ', h('code', null, t[1]),
            step.if ? h('span.xs.muted', null, ' only if ', h('code', null, step.if)) : null);
        })) : null);
    }

    function simulatorCard(analysis) {
      var events = analysis.triggers.map(function (t) { return t.event; });
      ['push', 'pull_request', 'workflow_dispatch'].forEach(function (e) { if (events.indexOf(e) === -1) events.push(e); });
      if (!scenario.event || events.indexOf(scenario.event) === -1) scenario.event = events[0];
      var result = h('div.stack');
      function paint() {
        var isPr = scenario.event.indexOf('pull_request') === 0;
        var sim = GG.workflow.simulate(analysis, {
          event: scenario.event, ref: scenario.ref, baseRef: 'main', headRef: 'feature/example',
          fork: isPr && scenario.fork, repository: 'you/project', changedPaths: null
        });
        forkBox.disabled = !isPr;
        refPick.disabled = isPr;
        GG.clear(result);
        result.appendChild(h('p', null, h('span.badge.' + (sim.triggered ? 'safe' : 'caution'), null, sim.triggered ? 'Starts' : 'Does not start'), ' ', GG.inline(sim.why)));
        if (sim.triggered) {
          result.appendChild(h('ul.wf-sim', null, sim.jobs.map(function (j) {
            var st = STATUS[j.status] || STATUS.unknown;
            return h('li', null, h('span.badge' + (st[0] ? '.' + st[0] : ''), null, st[1]), ' ', h('code', null, j.id), ' ', h('span.wf-why', null, GG.inline(j.why)));
          })));
        }
        (sim.notes || []).forEach(function (n) { result.appendChild(h('p.small.muted', null, GG.inline(n))); });
      }
      var eventPick = h('select', { id: 'wf-event', onchange: function (e) { scenario.event = e.target.value; paint(); } },
        events.map(function (e) { return h('option', { value: e, selected: e === scenario.event || null }, e); }));
      var refs = [['refs/heads/main', 'the main branch'], ['refs/heads/feature/example', 'a feature branch'], ['refs/tags/v1.0.0', 'a version tag']];
      var refPick = h('select', { id: 'wf-ref', onchange: function (e) { scenario.ref = e.target.value; paint(); } },
        refs.map(function (r) { return h('option', { value: r[0], selected: r[0] === scenario.ref || null }, r[1]); }));
      var forkBox = h('input', { id: 'wf-fork', type: 'checkbox', checked: scenario.fork || null, onchange: function (e) { scenario.fork = e.target.checked; paint(); } });
      paint();
      return h('section.card.stack', { 'aria-labelledby': 'wf-sim-h' },
        h('h2', { id: 'wf-sim-h', style: 'font-size:var(--t-m)' }, 'What runs when'),
        h('div.wf-controls', null,
          h('div.field', null, h('label', { for: 'wf-event' }, 'Event'), eventPick),
          h('div.field', null, h('label', { for: 'wf-ref' }, 'On'), refPick),
          h('label.check', { for: 'wf-fork' }, forkBox, h('span', { style: 'text-decoration:none;color:inherit' }, 'The pull request comes from a fork'))),
        result);
    }

    function read() {
      var doc, analysis;
      GG.clear(output);
      try {
        doc = GG.yaml.parseDocument(area.value);
      } catch (err) {
        var lines = area.value.split('\n'), n = err && err.line;
        output.appendChild(h('div.callout.kind-danger', { role: 'alert' }, GG.icon('danger'), h('span.kind', null, 'Not valid YAML yet'),
          h('div.body.stack', null,
            h('span', null, String((err && err.message) || err)),
            n ? h('span.mono.small', null, 'line ' + n + ':  ' + (lines[n - 1] || '')) : null)));
        return;
      }
      analysis = GG.workflow.analyze(doc.value, doc.lineOf);
      var errors = analysis.problems.filter(function (p) { return p.level === 'error'; }).length;
      var warns = analysis.problems.filter(function (p) { return p.level === 'warn'; }).length;

      output.appendChild(h('section.card.stack', { 'aria-labelledby': 'wf-sum-h' },
        h('h2', { id: 'wf-sum-h', style: 'font-size:var(--t-m)' }, analysis.name ? 'What “' + analysis.name + '” does' : 'What this workflow does'),
        analysis.triggers.length ? h('ul', null, analysis.triggers.map(function (t) { return h('li', null, GG.inline(describeTrigger(t))); })) : null,
        h('p', null, h('strong', null, 'The token it gets: '), analysis.permissions
          ? describePermissions(analysis.permissions) + ', unless a job says otherwise.'
          : 'not declared at the top, so each job gets the repository’s default unless it declares its own.'),
        h('p.small.muted', null, GG.plural(analysis.jobs.length, 'job') + ', ' + GG.plural(errors, 'error') + ', ' + GG.plural(warns, 'warning') + '.')));

      output.appendChild(h('section.stack', { 'aria-labelledby': 'wf-prob-h' },
        h('h2', { id: 'wf-prob-h', style: 'font-size:var(--t-m)' }, 'What to look at'),
        problemList(analysis.problems)));

      if (analysis.jobs.length) {
        output.appendChild(h('section.stack', { 'aria-labelledby': 'wf-jobs-h' },
          h('h2', { id: 'wf-jobs-h', style: 'font-size:var(--t-m)' }, 'Jobs'),
          h('div.wf-jobs', null, analysis.jobs.map(jobCard))));
        output.appendChild(simulatorCard(analysis));
      }
    }

    var readSoon = GG.debounce(read, 500);
    area.addEventListener('input', readSoon);
    var pick = h('select', { id: 'wf-sample', onchange: function (e) {
      var chosen = samples.filter(function (s) { return s.id === e.target.value; })[0];
      if (!chosen) return;
      area.value = chosen.text;
      scenario.event = null;
      read();
    } }, samples.map(function (s) { return h('option', { value: s.id }, s.label); }));

    var root = h('div.page.wf', null,
      h('header.stack', null,
        h('p.eyebrow', null, 'Workflow reader'),
        h('h1', null, 'Read a workflow before you trust it'),
        h('p.lede', null, 'Paste a GitHub Actions workflow file. The reader says what it does in plain words, flags the risks the lessons teach, and shows which jobs would run for a push, a pull request or a fork.')),
      h('div.wf-layout', null,
        h('section.card.stack.wf-input', { 'aria-labelledby': 'wf-in-h' },
          h('h2', { id: 'wf-in-h', style: 'font-size:var(--t-m)' }, 'The workflow file'),
          h('div.field', null, h('label', { for: 'wf-sample' }, 'Start from an example'), pick),
          h('div.field', null, h('label', { for: 'wf-text' }, 'Or paste your own'), area),
          h('p.xs.muted', { id: 'wf-help' }, 'It is read as you type. Nothing is run, and nothing leaves this page.'),
          h('div', null, h('button.btn.primary', { type: 'button', onclick: read }, GG.icon('eye'), 'Read it'))),
        output),
      h('p.small.muted', { style: 'max-width:var(--measure)' }, 'This reader understands the common shape of a workflow file. It does not know your repository’s settings, it cannot see inside the actions a workflow uses, and a clean result is not a security review. It also declines a few YAML features that real files use, such as anchors, and says so when it meets one. Where it and the official documentation disagree, the documentation is right.'));
    read();
    return root;
  };
})();
