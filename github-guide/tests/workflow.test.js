// The Workflow reader's judgement: what it reads, what it flags, and which jobs it says would run.
// Run with:  node --test github-guide/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const yaml = require('../src/js/yaml.js');
const workflow = require('../src/js/workflow.js');

function read(text) {
  const doc = yaml.parseDocument(text);
  return workflow.analyze(doc.value, doc.lineOf);
}
const codes = (analysis, level) => analysis.problems.filter(p => !level || p.level === level).map(p => p.code);
const problem = (analysis, code) => analysis.problems.find(p => p.code === code);

const CLEAN = `name: Tiny
on: push
permissions:
  contents: read
jobs:
  hello:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: echo hello
`;

/** A one-job workflow around the given steps, clean apart from what the steps bring. */
function withSteps(steps, on = 'push') {
  return `on: ${on}
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
${steps.replace(/^/gm, '      ')}
`;
}

// ---------------------------------------------------------------- reading

test('a small, careful workflow raises nothing', () => {
  assert.deepEqual(read(CLEAN).problems, []);
});

test('it reads the name, triggers, token, jobs and steps', () => {
  const a = read(`name: CI
on:
  push:
    branches: [main, 'release/**']
    paths-ignore: ['docs/**']
  pull_request:
    types: [opened, synchronize]
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:
    inputs:
      target:
        type: string
permissions: read-all
concurrency: ci
jobs:
  test:
    name: Unit tests
    runs-on: [self-hosted, linux]
    timeout-minutes: 15
    strategy:
      matrix:
        os: [a, b]
    steps:
      - name: Get the code
        id: code
        uses: actions/checkout@v7
      - run: |
          make test
          make lint
        if: success()
  ship:
    needs: [test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
    permissions: {}
    timeout-minutes: 5
    steps:
      - run: ./deploy.sh
  shared:
    uses: octo-org/workflows/.github/workflows/build.yml@v1
`);
  assert.equal(a.name, 'CI');
  assert.deepEqual(a.triggers.map(t => t.event), ['push', 'pull_request', 'schedule', 'workflow_dispatch']);
  assert.deepEqual(a.triggers[0].branches, ['main', 'release/**']);
  assert.deepEqual(a.triggers[0].pathsIgnore, ['docs/**']);
  assert.equal(a.triggers[0].tags, null);
  assert.deepEqual(a.triggers[1].types, ['opened', 'synchronize']);
  assert.deepEqual(a.triggers[2].cron, ['17 3 * * 1']);
  assert.deepEqual(a.triggers[3].inputs, ['target']);
  assert.equal(a.permissions, 'read-all');
  assert.equal(a.concurrency, true);
  assert.deepEqual(a.jobs.map(j => j.id), ['test', 'ship', 'shared']);
  const [t, ship, shared] = a.jobs;
  assert.equal(t.name, 'Unit tests');
  assert.deepEqual(t.runsOn, ['self-hosted', 'linux']);
  assert.equal(t.timeoutMinutes, 15);
  assert.deepEqual(Object.keys(t.matrix), ['os']);
  assert.deepEqual(t.steps.map(s => [s.id, s.name, s.uses, s.if]), [['code', 'Get the code', 'actions/checkout@v7', null], [null, null, null, 'success()']]);
  assert.equal(t.steps[1].run, 'make test\nmake lint\n');
  assert.deepEqual(ship.needs, ['test']);
  assert.equal(ship.if, "github.ref == 'refs/heads/main'");
  assert.equal(ship.environment, 'production');
  assert.deepEqual(ship.permissions, {});
  assert.equal(shared.uses, 'octo-org/workflows/.github/workflows/build.yml@v1');
  assert.equal(shared.runsOn, null);
});

test('"on" can be one event, a list of events, or a set of events with filters', () => {
  const body = '\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n';
  assert.deepEqual(read('on: push' + body).triggers.map(t => t.event), ['push']);
  assert.deepEqual(read('on: [push, pull_request]' + body).triggers.map(t => t.event), ['push', 'pull_request']);
  assert.deepEqual(read('on:\n  release:\n    types: [published]' + body).triggers[0].types, ['published']);
});

// ---------------------------------------------------------------- structure

test('text that is not a workflow is called that, once', () => {
  for (const text of ['just some words', '- a\n- b', 'version: "3"\nservices:\n  web:\n    image: nginx\n', '']) {
    assert.deepEqual(codes(read(text)), ['not-a-workflow'], JSON.stringify(text));
  }
});

test('missing pieces are errors, each named for what is missing', () => {
  const fragment = read('jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.ok(codes(fragment, 'error').includes('no-triggers'));
  assert.match(problem(fragment, 'no-triggers').message, /part of a larger workflow/);
  assert.ok(!codes(fragment).includes('no-permissions'), 'a fragment without its top cannot be judged on the token');
  assert.ok(codes(read('on: push\n'), 'error').includes('no-jobs'));
  assert.ok(codes(read('on: push\njobs:\n  a:\n    steps:\n      - run: ls\n'), 'error').includes('job-no-runner'));
  assert.ok(codes(read('on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n'), 'error').includes('job-no-steps'));
  assert.ok(codes(read(withSteps('- uses: actions/checkout@v7\n  run: ls')), 'error').includes('step-uses-and-run'));
  assert.ok(codes(read(withSteps('- name: Nothing to do')), 'error').includes('step-empty'));
  assert.ok(codes(read(withSteps('- just text')), 'error').includes('step-empty'));
  assert.ok(codes(read(withSteps('- uses: actions/checkout')), 'error').includes('action-no-version'));
});

test('a job that waits for a job that does not exist, or for itself in a circle, is an error', () => {
  const lost = read('on: push\njobs:\n  a:\n    needs: b\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.ok(codes(lost, 'error').includes('needs-unknown'));
  assert.match(problem(lost, 'needs-unknown').message, /`b`/);
  const two = read('on: push\njobs:\n  gate:\n    needs: [lint, test]\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.deepEqual(codes(two, 'error'), ['needs-unknown'], 'one finding for the job, however many jobs it waits for are missing');
  assert.match(problem(two, 'needs-unknown').message, /`lint` and `test`/);
  const loop = read('on: push\njobs:\n  a:\n    needs: c\n    runs-on: x\n    steps:\n      - run: ls\n  b:\n    needs: a\n    runs-on: x\n    steps:\n      - run: ls\n  c:\n    needs: [b]\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.deepEqual(codes(loop, 'error'), ['needs-cycle']);
  for (const id of ['a', 'b', 'c']) assert.match(problem(loop, 'needs-cycle').message, new RegExp('`' + id + '`'));
});

test('near-miss spellings get a "did you mean", and unfamiliar keys are otherwise left alone', () => {
  const top = read('on: push\njob:\n  a:\n    runs-on: x\n');
  assert.match(problem(top, 'unknown-top-level-key').message, /Did you mean `jobs`/);
  assert.match(problem(read('on:\n  pull-request:\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: ls\n'), 'unknown-event').message, /`pull_request`/);
  const runner = read('on: push\njobs:\n  a:\n    run-on: ubuntu-latest\n    steps:\n      - run: ls\n');
  assert.match(problem(runner, 'job-no-runner').message, /`run-on`, which looks like a misspelling of `runs-on`/);
  assert.ok(!codes(runner).includes('unknown-key'), 'the misspelling is reported once, with the missing runner');
  assert.match(problem(read(withSteps('- nmae: Build\n  run: make')), 'unknown-key').message, /Did you mean `name`/);
  assert.match(problem(read('on: push\njobs:\n  a:\n    runs-on: x\n    timeout_minutes: 5\n    steps:\n      - run: ls\n'), 'unknown-key').message, /`timeout-minutes`/);
  // A key this reader has never heard of may be newer than the reader: no guess, no flag.
  const novel = read('on: push\npermissions: {}\njobs:\n  a:\n    runs-on: x\n    timeout-minutes: 5\n    snapshot: nightly\n    steps:\n      - run: ls\n        zzz-experimental: 1\n');
  assert.deepEqual(codes(novel), []);
});

test('filters that contradict each other and schedules GitHub would refuse are errors', () => {
  const both = read('on:\n  push:\n    branches: [main]\n    branches-ignore: [dev]\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.ok(codes(both, 'error').includes('filter-conflict'));
  for (const good of ['17 3 * * *', '*/15 * * * *', '0 0 * * MON-FRI', '0 9 1 JAN,JUL *', '5,35 8-18/2 * * 1-5']) {
    assert.equal(workflow.cronProblem(good), null, good);
  }
  for (const bad of ['@daily', '* * * *', '0 0 * * * *', '61 * * * *', '0 25 * * *', '0 0 32 * *', '0 0 * 13 *', '*/0 * * * *', 'a b c d e']) {
    assert.equal(typeof workflow.cronProblem(bad), 'string', bad);
  }
  const cron = read('on:\n  schedule:\n    - cron: "@daily"\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: ls\n');
  assert.equal(problem(cron, 'bad-cron').line, 3);
});

// ---------------------------------------------------------------- the token

test('a workflow that never says what its token may do is flagged, unless every job says so itself', () => {
  const job = (perms) => `    runs-on: x\n    timeout-minutes: 5\n${perms}    steps:\n      - run: ls\n`;
  const none = read('on: push\njobs:\n  a:\n' + job('') + '  b:\n' + job(''));
  assert.match(problem(none, 'no-permissions').message, /^Nothing here says/);
  const some = read('on: push\njobs:\n  a:\n' + job('    permissions:\n      contents: read\n') + '  b:\n' + job(''));
  assert.match(problem(some, 'no-permissions').message, /^Job `b` does not say/);
  const each = read('on: push\njobs:\n  a:\n' + job('    permissions:\n      contents: read\n') + '  b:\n' + job('    permissions: {}\n'));
  assert.deepEqual(codes(each), []);
});

test('write-all is flagged at the top and on a job', () => {
  assert.ok(codes(read(CLEAN.replace('permissions:\n  contents: read', 'permissions: write-all')), 'warn').includes('write-all'));
  const onJob = read(CLEAN.replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    permissions: write-all'));
  assert.match(problem(onJob, 'write-all').message, /Job `hello`/);
});

// ---------------------------------------------------------------- actions

test('code from outside GitHub must be pinned to a commit; GitHub’s own may use a release tag', () => {
  const flagged = (uses) => codes(read(withSteps('- uses: ' + uses)));
  assert.deepEqual(flagged('actions/checkout@v7'), []);
  assert.deepEqual(flagged('github/codeql-action/init@v4'), []);
  assert.deepEqual(flagged('some-org/tool@0123456789abcdef0123456789abcdef01234567'), []);
  assert.deepEqual(flagged('some-org/tool@<full-40-character-commit-sha>'), [], 'a blank to fill in, as the lessons write it');
  assert.deepEqual(flagged('./.github/actions/setup'), []);
  assert.deepEqual(flagged('docker://alpine:3.20'), []);
  assert.deepEqual(flagged('some-org/tool@v2'), ['unpinned-third-party']);
  assert.deepEqual(flagged('some-org/tool/sub/dir@v2.1.0'), ['unpinned-third-party']);
  assert.deepEqual(flagged('some-org/tool@main'), ['unpinned-third-party'], 'one finding for one line, not two');
  assert.deepEqual(flagged('actions/checkout@main'), ['branch-ref']);
  assert.match(problem(read(withSteps('- uses: some-org/tool@main')), 'unpinned-third-party').message, /a branch name/);
  assert.match(problem(read(withSteps('- uses: some-org/tool@v2')), 'unpinned-third-party').message, /a tag/);
});

test('pull_request_target is flagged, and checking out the pull request under it is an error', () => {
  const plain = read(withSteps('- uses: actions/checkout@v7', 'pull_request_target'));
  assert.deepEqual(codes(plain), ['pull-request-target']);
  for (const ref of ['${{ github.event.pull_request.head.sha }}', '${{ github.head_ref }}', 'refs/pull/${{ github.event.number }}/merge']) {
    const a = read(withSteps('- uses: actions/checkout@v7\n  with:\n    ref: ' + ref, 'pull_request_target'));
    assert.deepEqual(codes(a, 'error'), ['pull-request-target-checkout'], ref);
  }
  // The same checkout under plain pull_request is the normal, safe way to test a contribution.
  assert.deepEqual(codes(read(withSteps('- uses: actions/checkout@v7\n  with:\n    ref: ${{ github.event.pull_request.head.sha }}', 'pull_request'))), []);
});

test('text an outsider typed must not be pasted into a script', () => {
  const inject = (step) => codes(read(withSteps(step, 'pull_request')));
  assert.deepEqual(inject('- run: echo "${{ github.event.pull_request.title }}"'), ['script-injection']);
  assert.deepEqual(inject('- run: git checkout ${{ github.head_ref }}'), ['script-injection']);
  assert.deepEqual(inject('- run: |\n    echo one\n    echo "${{ github.event.comment.body }}"'), ['script-injection']);
  assert.deepEqual(inject('- uses: actions/github-script@v8\n  with:\n    script: console.log("${{ github.event.issue.title }}")'), ['script-injection']);
  // Safe: through an environment variable, or values an outsider cannot shape.
  assert.deepEqual(inject('- run: echo "$TITLE"\n  env:\n    TITLE: ${{ github.event.pull_request.title }}'), []);
  assert.deepEqual(inject('- run: echo ${{ github.event.pull_request.number }} ${{ github.event.pull_request.head.sha }} ${{ github.sha }}'), []);
  assert.deepEqual(inject('- run: echo ${{ github.event.pull_request.head.repo.full_name }}'), []);
  assert.deepEqual(inject('- run: echo ${{ github.event.pull_request.base.ref }} ${{ github.event.repository.name }} ${{ github.event.release.name }}'), [], 'set by the repository, not by an outsider');
  assert.deepEqual(inject('- run: echo "${{ github.event.head_commit.author.name }}"'), ['script-injection']);
  assert.deepEqual(inject('- run: git switch ${{ github.event.workflow_run.head_branch }}'), ['script-injection']);
  assert.deepEqual(inject('- run: echo "${{ github.event.pull_request.head.ref }}" "${{ github.event.commits.*.message }}"'), ['script-injection']);
  assert.match(problem(read(withSteps('- run: echo "${{ github.event.pull_request.title }}"')), 'script-injection').message, /`\$\{\{ github\.event\.pull_request\.title \}\}`/);
});

test('printing a secret is flagged; handing one to a program is not', () => {
  assert.deepEqual(codes(read(withSteps('- run: echo ${{ secrets.TOKEN }}'))), ['secret-in-run-echo']);
  assert.deepEqual(codes(read(withSteps('- run: |\n    set -e\n    printf "%s" "${{ secrets.TOKEN }}" > key.txt'))), ['secret-in-run-echo']);
  assert.deepEqual(codes(read(withSteps('- run: ./deploy.sh\n  env:\n    TOKEN: ${{ secrets.TOKEN }}'))), []);
  assert.deepEqual(codes(read(withSteps('- run: echo "deploying"\n- run: |\n    curl -H "Authorization: Bearer ${{ secrets.TOKEN }}" https://example.com'))), []);
});

test('a version without quotes is flagged where YAML would turn it into a number', () => {
  const bare = read(withSteps('- uses: actions/setup-python@v7\n  with:\n    python-version: 3.10'));
  assert.deepEqual(codes(bare), ['version-as-number']);
  assert.match(problem(bare, 'version-as-number').message, /the number `3\.1`/);
  assert.equal(problem(bare, 'version-as-number').line, 11);
  assert.deepEqual(codes(read(withSteps('- uses: actions/setup-python@v7\n  with:\n    python-version: "3.10"'))), []);
  assert.deepEqual(codes(read(withSteps('- uses: actions/setup-node@v7\n  with:\n    node-version: 22'))), [], 'a whole number survives the trip');
  const matrix = read(CLEAN.replace('    timeout-minutes: 5', '    timeout-minutes: 5\n    strategy:\n      matrix:\n        python-version: [3.9, 3.10, 3.11]'));
  assert.deepEqual(codes(matrix), ['version-as-number']);
  const quoted = read(CLEAN.replace('    timeout-minutes: 5', '    timeout-minutes: 5\n    strategy:\n      matrix:\n        python-version: ["3.9", "3.10"]\n        shard: [1, 2]\n        ratio: [0.5]'));
  assert.deepEqual(codes(quoted), []);
});

test('your own machines should not run a stranger’s pull request', () => {
  const selfHosted = (on) => codes(read(CLEAN.replace('on: push', 'on: ' + on).replace('runs-on: ubuntu-latest', 'runs-on: [self-hosted, linux]')));
  assert.deepEqual(selfHosted('pull_request'), ['self-hosted-on-pr']);
  assert.deepEqual(selfHosted('push'), []);
});

test('the clock and the queue: no time limit is a note, and so is a deployment nothing queues', () => {
  const untimed = read(CLEAN.replace('    timeout-minutes: 5\n', ''));
  assert.deepEqual(codes(untimed), ['no-timeout']);
  assert.equal(problem(untimed, 'no-timeout').level, 'note');
  assert.match(problem(untimed, 'no-timeout').message, /^Job `hello` sets no/);
  const deploy = CLEAN.replace('    timeout-minutes: 5', '    timeout-minutes: 5\n    environment: production');
  assert.deepEqual(codes(read(deploy)), ['no-concurrency']);
  assert.match(problem(read(deploy), 'no-concurrency').message, /`production`/);
  assert.deepEqual(codes(read(deploy.replace('jobs:', 'concurrency: deploy\njobs:'))), []);
  assert.deepEqual(codes(read(deploy.replace('    environment: production', '    environment: production\n    concurrency: deploy'))), []);
});

test('every problem names a level, a lesson and, where the text has one, a line', () => {
  const a = read('on: pull_request_target\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout\n      - run: echo ${{ secrets.X }}\n');
  assert.ok(a.problems.length >= 4);
  for (const p of a.problems) {
    assert.ok(['error', 'warn', 'note'].includes(p.level), p.code);
    assert.match(p.lesson, /^(advanced|expert)-/, p.code);
    assert.ok(p.message.length > 20 && /[.]$/.test(p.message), p.code + ' should be a full sentence');
    assert.ok(p.line === null || (Number.isInteger(p.line) && p.line >= 1), p.code);
  }
  assert.equal(problem(a, 'action-no-version').line, 6);
  assert.equal(problem(a, 'secret-in-run-echo').line, 7);
  assert.equal(problem(a, 'pull-request-target').line, 1);
  assert.equal(problem(a, 'no-permissions').line, null, 'nothing in the text to point at');
  // It also works without line numbers.
  assert.equal(workflow.analyze(yaml.parse('on: push\njobs:\n  a:\n    steps: []\n')).problems[0].line, null);
});

// ---------------------------------------------------------------- conditions

test('conditions GitHub cannot read are errors that say what to type instead', () => {
  const cond = (text) => read(CLEAN.replace('    timeout-minutes: 5', '    timeout-minutes: 5\n    if: ' + text));
  assert.match(problem(cond("github.ref = 'refs/heads/main'"), 'bad-condition').message, /Write `==`/);
  assert.match(problem(cond('github.ref == "refs/heads/main"'), 'bad-condition').message, /single quotes/);
  assert.match(problem(cond("github.ref == 'refs/heads/main"), 'bad-condition').message, /never closed/);
  assert.match(problem(cond('github.ref =='), 'bad-condition').message, /a value is still needed/);
  assert.match(problem(cond("(github.ref == 'a'"), 'bad-condition').message, /`\)`/);
  assert.match(problem(cond("github.ref == 'a' github.actor"), 'bad-condition').message, /operator/);
  assert.ok(codes(cond("${{ github.ref == 'a' }} && ${{ github.actor == 'b' }}"), 'warn').includes('condition-mixed'));
  const step = read(withSteps("- run: ls\n  if: github.ref = 'x'"));
  assert.equal(problem(step, 'bad-condition').where, 'job build, step 1');
});

test('conditions people really write are read without complaint', () => {
  const real = [
    "github.ref == 'refs/heads/main'",
    "${{ github.ref == 'refs/heads/main' }}",
    "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name != github.repository",
    'always()', 'failure()', 'success() || failure()', '${{ !cancelled() }}', "always() && needs.build.result == 'success'",
    "startsWith(github.ref, 'refs/tags/v')", "contains(github.event.pull_request.labels.*.name, 'deploy')",
    "contains(fromJSON('[\"push\", \"workflow_dispatch\"]'), github.event_name)",
    "github.event.pull_request.draft == false", "matrix.os == 'ubuntu-latest' && matrix.python-version == '3.13'",
    "steps.changes.outputs.docs == 'true'", "inputs.deploy", "github.actor != 'dependabot[bot]'",
    "github.event.commits[0].message != ''", "hashFiles('**/package-lock.json') != ''", "env.DEPLOY == 'yes' && (github.run_attempt > 1 || vars.FORCE)",
    "github.repository == 'octo-org/octo-repo' && github.event_name == 'schedule'", "format('{0}-{1}', 'a', 'b') == 'a-b'", "!contains(github.event.head_commit.message, '[skip ci]')",
    "needs.*.result", "github.event.pull_request.user.login == 'it''s-me'", 'true', "0xff == 255 && -1 < 2.5e3"
  ];
  for (const text of real) {
    const result = workflow.evaluate(text, {});
    assert.equal(result.error, undefined, text + ' -> ' + result.error);
    assert.equal(result.mixed, undefined, text);
  }
});

test('conditions are worked out the way GitHub does: text without regard to case, unlike types as numbers', () => {
  const ctx = { github: { ref: 'refs/heads/main', event_name: 'push', repository: 'you/project', head_ref: '', event: { pull_request: null, commits: [{ message: 'fix: typo' }] } } };
  const value = (text, status) => {
    const r = workflow.evaluate(text, ctx, status);
    return r.unknown ? 'unknown' : r.value;
  };
  const table = [
    ["github.ref == 'refs/heads/main'", true],
    ["github.ref == 'REFS/HEADS/MAIN'", true],
    ["${{ github.ref == 'refs/heads/main' }}", true],
    ["github.event_name != 'pull_request'", true],
    ["startsWith(github.ref, 'refs/tags/')", false],
    ["endsWith(github.ref, '/MAIN')", true],
    ["contains(github.ref, 'heads')", true],
    ["contains(github.repository, 'nobody')", false],
    ["github.event.pull_request.head.repo.full_name != github.repository", true],   // nothing is not the repository name
    ['github.event.pull_request.draft == false', true],                             // nothing and false are both zero
    ['!github.event.pull_request', true],
    ["github.event.commits[0].message == 'fix: typo'", true],
    ['github.event.commits[5].message', null],
    ["github.head_ref == ''", true],
    ["'10' == 10", true], ["'abc' == 0", false], ['null == 0', true], ['true == 1', true],
    ['1 < 2', true], ["'apple' < 'Banana'", true], ['2 >= 3', false],
    ["format('{0}/{1}', 'a', github.event_name)", 'a/push'],
    ["github.event_name == 'push' && github.ref == 'refs/heads/main'", true],
    ["github.event_name == 'release' || github.ref == 'refs/heads/dev'", false],
    ['always()', true], ['success()', true], ['failure()', false], ['!cancelled()', true],
    // What the reader cannot know stays unknown, unless the other side settles it.
    ["secrets.TOKEN != ''", 'unknown'], ["matrix.os == 'ubuntu-latest'", 'unknown'], ['github.actor', 'unknown'],
    ["needs.build.result == 'success'", 'unknown'], ["contains(fromJSON('[1]'), 1)", 'unknown'],
    ['false && secrets.X', false], ['secrets.X && false', false], ['true || secrets.X', true], ['secrets.X || true', true],
    ['secrets.X && true', 'unknown'], ['secrets.X || false', 'unknown'],
    ["github.ref = 'x'", 'unknown'], ["${{ github.ref }} == 'refs/heads/main'", 'unknown']
  ];
  for (const [text, expected] of table) assert.deepEqual(value(text), expected, text);
  assert.equal(value('success()', { success: false, failure: true, cancelled: false }), false);
  assert.equal(value('failure()', { success: false, failure: true, cancelled: false }), true);
  assert.equal(value('success()', { failure: false, cancelled: false }), 'unknown');
  assert.equal(workflow.evaluate("always() && github.ref == 'x'", ctx).usesStatus, true);
  assert.equal(workflow.evaluate("github.ref == 'x'", ctx).usesStatus, false);
  assert.match(workflow.evaluate('secrets.TOKEN', ctx).reason, /`secrets\.TOKEN`/);
});

// ---------------------------------------------------------------- filter patterns

test('filter patterns match the way GitHub documents them', () => {
  const table = [
    ['main', 'main', true], ['main', 'mainline', false],
    ['feature/*', 'feature/my-branch', true], ['feature/*', 'feature/a/b', false],
    ['feature/**', 'feature/beta-a/my-branch', true], ['feature/**', 'feature/mona/the/octocat', true],
    ['*', 'main', true], ['*', 'releases/v1', false], ['**', 'all/the/branches', true],
    ['*feature', 'mona-feature', true], ['*feature', 'feature', true], ['v2*', 'v2.9', true], ['v2*', 'v3', false],
    ['v[12].[0-9]+.[0-9]+', 'v1.10.1', true], ['v[12].[0-9]+.[0-9]+', 'v3.0.0', false], ['v[12].[0-9]+.[0-9]+', 'v1.x.1', false],
    ['*.jsx?', 'page.js', true], ['*.jsx?', 'page.jsx', true], ['*.jsx?', 'page.jsxx', false],
    ['*.js', 'app.js', true], ['*.js', 'src/app.js', false], ['**.js', 'src/js/app.js', true],
    ['docs/*', 'docs/README.md', true], ['docs/*', 'docs/mona/octocat.txt', false], ['docs/**', 'docs/mona/octocat.txt', true],
    ['docs/**/*.md', 'docs/README.md', true], ['docs/**/*.md', 'docs/a/markdown/file.md', true], ['docs/**/*.md', 'docs/a/file.txt', false],
    ['**/docs/**', 'docs/hello.md', true], ['**/docs/**', 'dir/docs/my-file.txt', true],
    ['**/README.md', 'README.md', true], ['**/README.md', 'js/README.md', true],
    ['**/*src/**', 'a/src/app.js', true], ['**/*src/**', 'my-src/code/js/app.js', true],
    ['**/migrate-*.sql', 'db/sept/migrate-v1.sql', true], ['**/migrate-*.sql', 'migrate-10909.sql', true],
    ['github-guide/**', 'github-guide/src/js/app.js', true], ['github-guide/**', 'README.md', false],
    ['a.b', 'axb', false], ['a.b', 'a.b', true]
  ];
  for (const [pattern, value, expected] of table) assert.equal(workflow.globMatch(pattern, value), expected, `${pattern}  vs  ${value}`);
});

// ---------------------------------------------------------------- what runs when

function sim(text, scenario) {
  const result = workflow.simulate(read(text), Object.assign({ repository: 'you/project', baseRef: 'main', headRef: 'feature/x', changedPaths: null }, scenario));
  result.status = Object.fromEntries(result.jobs.map(j => [j.id, j.status]));
  return result;
}
const ONE_JOB = '\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ls\n';

test('a push is matched against branch and tag filters, read top to bottom', () => {
  const branches = "on:\n  push:\n    branches: [main, 'release/**', '!release/old/**']" + ONE_JOB;
  const starts = (ref) => sim(branches, { event: 'push', ref }).triggered;
  assert.equal(starts('refs/heads/main'), true);
  assert.equal(starts('refs/heads/dev'), false);
  assert.equal(starts('refs/heads/release/1.0'), true);
  assert.equal(starts('refs/heads/release/old/0.9'), false);
  assert.equal(starts('refs/tags/v1.0.0'), false, 'a branch filter alone leaves tags out');
  const tags = "on:\n  push:\n    tags: ['v*']" + ONE_JOB;
  assert.equal(sim(tags, { event: 'push', ref: 'refs/tags/v1.0.0' }).triggered, true);
  assert.equal(sim(tags, { event: 'push', ref: 'refs/tags/nightly' }).triggered, false);
  assert.equal(sim(tags, { event: 'push', ref: 'refs/heads/main' }).triggered, false, 'a tag filter alone leaves branches out');
  const ignore = "on:\n  push:\n    branches-ignore: ['dependabot/**']" + ONE_JOB;
  assert.equal(sim(ignore, { event: 'push', ref: 'refs/heads/main' }).triggered, true);
  assert.equal(sim(ignore, { event: 'push', ref: 'refs/heads/dependabot/npm/left-pad' }).triggered, false);
  const any = 'on: push' + ONE_JOB;
  assert.equal(sim(any, { event: 'push', ref: 'refs/heads/anything' }).triggered, true);
  assert.equal(sim(any, { event: 'push', ref: 'refs/tags/v9' }).triggered, true);
  assert.equal(sim(any, { event: 'pull_request' }).triggered, false);
  assert.match(sim(any, { event: 'pull_request' }).why, /listens for `pull_request`/);
});

test('path filters decide from the changed files, and say so when the files are unknown', () => {
  const paths = "on:\n  push:\n    paths: ['src/**', '!src/docs/**']" + ONE_JOB;
  const starts = (text, changedPaths) => sim(text, { event: 'push', ref: 'refs/heads/main', changedPaths }).triggered;
  assert.equal(starts(paths, ['README.md']), false);
  assert.equal(starts(paths, ['README.md', 'src/app.js']), true);
  assert.equal(starts(paths, ['src/docs/intro.md']), false);
  const unknown = sim(paths, { event: 'push', ref: 'refs/heads/main', changedPaths: null });
  assert.equal(unknown.triggered, true);
  assert.match(unknown.notes.join(' '), /which files changed/);
  assert.equal(sim(paths, { event: 'push', ref: 'refs/tags/v1', changedPaths: ['README.md'] }).triggered, true, 'path filters are not applied to tags');
  const ignore = "on:\n  push:\n    paths-ignore: ['docs/**', '*.md']" + ONE_JOB;
  assert.equal(starts(ignore, ['docs/a.md', 'README.md']), false);
  assert.equal(starts(ignore, ['docs/a.md', 'src/app.js']), true);
});

test('a pull request is matched against the branch it targets and the activity it reacts to', () => {
  const base = 'on:\n  pull_request:\n    branches: [main]' + ONE_JOB;
  assert.equal(sim(base, { event: 'pull_request', baseRef: 'main' }).triggered, true);
  assert.equal(sim(base, { event: 'pull_request', baseRef: 'develop' }).triggered, false);
  const labeled = 'on:\n  pull_request:\n    types: [labeled]' + ONE_JOB;
  assert.equal(sim(labeled, { event: 'pull_request' }).triggered, false);
  assert.match(sim(labeled, { event: 'pull_request' }).why, /`labeled`/);
  const fork = sim('on: pull_request' + ONE_JOB, { event: 'pull_request', fork: true });
  assert.match(fork.notes.join(' '), /read-only token and no secrets/);
  assert.deepEqual(sim('on: pull_request' + ONE_JOB, { event: 'pull_request', fork: false }).notes, []);
  assert.match(sim('on: pull_request_target' + ONE_JOB, { event: 'pull_request_target', fork: true }).notes.join(' '), /own token and secrets/);
});

test('a scheduled run uses the default branch whatever branch is chosen', () => {
  const text = "on:\n  schedule:\n    - cron: '17 3 * * *'\njobs:\n  a:\n    if: github.ref == 'refs/heads/main'\n    runs-on: x\n    steps:\n      - run: ls\n";
  const result = sim(text, { event: 'schedule', ref: 'refs/heads/feature/x' });
  assert.equal(result.status.a, 'runs');
  assert.match(result.notes.join(' '), /default branch/);
});

test('a skipped job takes the jobs that wait for it along, unless they ask to run anyway', () => {
  const job = (extra) => `${extra}    runs-on: x\n    steps:\n      - run: ls\n`;
  const text = 'on: push\njobs:\n' +
    '  a:\n' + job("    if: github.ref == 'refs/heads/main'\n") +
    '  b:\n' + job('    needs: a\n') +
    '  c:\n' + job('    needs: a\n    if: always()\n') +
    '  d:\n' + job('    needs: b\n    if: ${{ !cancelled() }}\n') +
    '  e:\n' + job('    needs: a\n    if: failure()\n') +
    '  f:\n' + job("    needs: [a]\n    if: github.event_name == 'push'\n") +
    '  g:\n' + job("    if: secrets.DEPLOY_KEY != ''\n") +
    '  h:\n' + job('    needs: g\n') +
    '  i:\n' + job('    needs: g\n    if: always()\n') +
    '  j:\n' + job('    needs: a\n    if: success()\n') +
    '  k:\n' + job("    needs: [a, g]\n    if: github.event_name == 'push'\n");
  const feature = sim(text, { event: 'push', ref: 'refs/heads/feature/x' });
  assert.deepEqual(feature.status, { a: 'skipped', b: 'skipped', c: 'runs', d: 'runs', e: 'skipped', f: 'skipped', g: 'unknown', h: 'unknown', i: 'runs', j: 'skipped', k: 'skipped' });
  const main = sim(text, { event: 'push', ref: 'refs/heads/main' });
  assert.deepEqual(main.status, { a: 'runs', b: 'runs', c: 'runs', d: 'runs', e: 'skipped', f: 'runs', g: 'unknown', h: 'unknown', i: 'runs', j: 'runs', k: 'unknown' });
  const why = Object.fromEntries(feature.jobs.map(j => [j.id, j.why]));
  assert.match(why.b, /waits for `a`, which is skipped/);
  assert.match(why.e, /assumes every job that runs succeeds/);
  assert.match(why.g, /`secrets\.DEPLOY_KEY`/);
  for (const j of feature.jobs) assert.match(j.why, /^[A-Z].*\.$/, j.id + ' needs a full sentence');
});

test('the facts a condition can ask about a pull request are filled in', () => {
  const job = (id, cond) => `  ${id}:\n    if: ${cond}\n    runs-on: x\n    steps:\n      - run: ls\n`;
  const text = 'on: [push, pull_request, pull_request_target]\njobs:\n' +
    job('fork', 'github.event.pull_request.head.repo.full_name != github.repository') +
    job('flag', 'github.event.pull_request.head.repo.fork') +
    job('head', "github.head_ref == 'feature/x'") +
    job('base', "github.base_ref == 'main'") +
    job('merge', "github.ref == 'refs/pull/1/merge'") +
    job('main', "github.ref == 'refs/heads/main'") +
    job('tag', "github.ref_type == 'tag' && startsWith(github.ref_name, 'v')");
  assert.deepEqual(sim(text, { event: 'pull_request', fork: false }).status, { fork: 'skipped', flag: 'skipped', head: 'runs', base: 'runs', merge: 'runs', main: 'skipped', tag: 'skipped' });
  assert.deepEqual(sim(text, { event: 'pull_request', fork: true }).status, { fork: 'runs', flag: 'runs', head: 'runs', base: 'runs', merge: 'runs', main: 'skipped', tag: 'skipped' });
  assert.deepEqual(sim(text, { event: 'pull_request_target', fork: true }).status, { fork: 'runs', flag: 'runs', head: 'runs', base: 'runs', merge: 'skipped', main: 'runs', tag: 'skipped' });
  assert.deepEqual(sim(text, { event: 'push', ref: 'refs/tags/v2.0.0' }).status, { fork: 'runs', flag: 'skipped', head: 'skipped', base: 'skipped', merge: 'skipped', main: 'skipped', tag: 'runs' });
});

test('a workflow with broken wiring is walked through without crashing', () => {
  const lost = sim('on: push\njobs:\n  a:\n    needs: ghost\n    runs-on: x\n    steps:\n      - run: ls\n', { event: 'push', ref: 'refs/heads/main' });
  assert.equal(lost.status.a, 'unknown');
  const loop = sim('on: push\njobs:\n  a:\n    needs: b\n    runs-on: x\n    steps:\n      - run: ls\n  b:\n    needs: a\n    runs-on: x\n    steps:\n      - run: ls\n', { event: 'push', ref: 'refs/heads/main' });
  assert.deepEqual(Object.keys(loop.status), ['a', 'b']);
  const bad = sim('on: push\njobs:\n  a:\n    if: github.ref = 1\n    runs-on: x\n    steps:\n      - run: ls\n', { event: 'push', ref: 'refs/heads/main' });
  assert.equal(bad.status.a, 'unknown');
  assert.equal(workflow.simulate(read(CLEAN)).triggered, true, 'with no scenario it assumes a push to main');
});

// ---------------------------------------------------------------- the lessons' own examples

/** Every YAML code block in the lessons, as [id, text]. */
function lessonYaml() {
  const dir = path.join(__dirname, '..', 'content', 'lessons'), found = [];
  for (const track of fs.readdirSync(dir)) {
    if (!fs.statSync(path.join(dir, track)).isDirectory()) continue;
    for (const name of fs.readdirSync(path.join(dir, track)).filter(f => f.endsWith('.json'))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, track, name), 'utf8'));
      (lesson.sections || []).forEach((section, s) => (section.blocks || []).forEach((block, b) => {
        if (block.type === 'code' && block.lang === 'yaml') found.push([`${lesson.id}#${s}.${b}`, block.code]);
      }));
    }
  }
  return found;
}

test('the reader agrees with the lessons: a complete workflow example in a lesson raises no error and no warning', () => {
  // An example that shows a mistake on purpose goes here as 'lesson-id#section.block', with the reason.
  const ON_PURPOSE = {};
  let complete = 0;
  for (const [id, text] of lessonYaml()) {
    const doc = yaml.parseDocument(text);
    const analysis = workflow.analyze(doc.value, doc.lineOf);          // a fragment must not crash it either
    for (const trigger of analysis.triggers) {
      for (const fork of [false, true]) workflow.simulate(analysis, { event: trigger.event, ref: 'refs/heads/main', fork });
    }
    if (!doc.value || Array.isArray(doc.value) || !('on' in doc.value) || !('jobs' in doc.value) || ON_PURPOSE[id]) continue;
    complete++;
    assert.deepEqual(codes(analysis, 'error'), [], `${id}: ${analysis.problems.filter(p => p.level === 'error').map(p => p.message).join(' | ')}`);
    assert.deepEqual(codes(analysis, 'warn'), [], `${id}: ${analysis.problems.filter(p => p.level === 'warn').map(p => p.message).join(' | ')}`);
  }
  assert.ok(complete >= 8, `expected the lessons to hold complete workflow examples, found ${complete}`);
});
