// The Workflow reader's built-in examples must behave the way the page says they do.
// Run with:  node --test github-guide/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const yaml = require('../src/js/yaml.js');
const workflow = require('../src/js/workflow.js');
const samples = require('../src/js/workflow-samples.js');

function read(text) {
  const doc = yaml.parseDocument(text);
  return workflow.analyze(doc.value, doc.lineOf);
}
const codes = (analysis, level) => analysis.problems.filter(p => !level || p.level === level).map(p => p.code);

test('the example with problems contains every problem it was written to show', () => {
  const analysis = read(samples.risky);
  const planted = ['no-permissions', 'pull-request-target', 'pull-request-target-checkout', 'version-as-number',
    'unpinned-third-party', 'script-injection', 'secret-in-run-echo', 'no-timeout'];
  for (const code of planted) {
    assert.ok(codes(analysis).includes(code), `expected the reader to flag ${code}; it flagged ${codes(analysis).join(', ')}`);
  }
  // The sample file promises eight problems. One finding per problem: no more, no fewer.
  assert.equal(analysis.problems.length, planted.length, codes(analysis).join(', '));
  assert.deepEqual(codes(analysis, 'error'), ['pull-request-target-checkout']);
  assert.deepEqual(codes(analysis, 'note'), ['no-timeout']);
});

test('every problem the reader reports names a line and a lesson that exists', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'tracks.json'), 'utf8'));
  const lessons = new Set(manifest.tracks.flatMap(t => t.lessons));
  for (const text of [samples.risky, samples.nightly]) {
    for (const problem of read(text).problems) {
      assert.ok(lessons.has(problem.lesson), `${problem.code} points at an unknown lesson: ${problem.lesson}`);
      assert.ok(problem.message.length > 20 && !/[!]$/.test(problem.message), `${problem.code} needs a calm, full-sentence message`);
      assert.ok(problem.line === null || problem.line >= 1);
    }
  }
});

test('the nightly example is clean, and its report job waits for a failure', () => {
  const analysis = read(samples.nightly);
  assert.deepEqual(codes(analysis, 'error'), []);
  assert.deepEqual(codes(analysis, 'warn'), []);
  assert.deepEqual(analysis.triggers.map(t => t.event), ['schedule', 'workflow_dispatch']);
  const sim = workflow.simulate(analysis, { event: 'schedule', ref: 'refs/heads/main', fork: false });
  assert.equal(sim.triggered, true);
  const status = Object.fromEntries(sim.jobs.map(j => [j.id, j.status]));
  assert.equal(status.test, 'runs');
  assert.equal(status.report, 'skipped', 'report has if: failure(), so it is skipped when nothing failed');
  const push = workflow.simulate(analysis, { event: 'push', ref: 'refs/heads/main', fork: false });
  assert.equal(push.triggered, false, 'nothing in this workflow listens for a push');
});

test("this guide's own workflow is the reader's first example and reads clean", () => {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'guide.yml'), 'utf8');
  const analysis = read(text);
  assert.deepEqual(codes(analysis, 'error'), []);
  assert.deepEqual(codes(analysis, 'warn'), []);
  assert.deepEqual(analysis.jobs.map(j => j.id), ['build', 'deploy']);
});
