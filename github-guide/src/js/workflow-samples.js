/*
 * workflow-samples.js: the example workflows the Workflow reader offers.
 *
 * They live in their own file so the tests can check them: the example
 * "with problems to find" must really contain each problem, and the clean
 * example must really be clean (see tests/workflow-samples.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.GG = root.GG || {}).workflowSamples = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Eight things are wrong with this one. The reader should find them all.
  var risky = [
    'name: Review helper',
    '',
    'on:',
    '  pull_request_target:',
    '    types: [opened, synchronize]',
    '',
    'jobs:',
    '  greet:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v7',
    '        with:',
    '          ref: ${{ github.event.pull_request.head.sha }}',
    '      - uses: actions/setup-python@v7',
    '        with:',
    '          python-version: 3.10',
    '      - uses: some-org/pr-labeler@main',
    '      - name: Say hello',
    '        run: echo "Thanks for ${{ github.event.pull_request.title }}"',
    '      - name: Debug',
    '        run: echo ${{ secrets.DEPLOY_TOKEN }}'
  ].join('\n');

  var nightly = [
    'name: Nightly tests',
    '',
    'on:',
    '  schedule:',
    '    - cron: "17 3 * * *"',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  test:',
    '    runs-on: ${{ matrix.os }}',
    '    timeout-minutes: 20',
    '    strategy:',
    '      fail-fast: false',
    '      matrix:',
    '        os: [ubuntu-latest, macos-latest]',
    '        python-version: ["3.11", "3.12", "3.13"]',
    '    steps:',
    '      - uses: actions/checkout@v7',
    '      - uses: actions/setup-python@v7',
    '        with:',
    '          python-version: ${{ matrix.python-version }}',
    '          cache: pip',
    '      - run: pip install -r requirements.txt',
    '      - run: pytest -q',
    '',
    '  report:',
    '    needs: test',
    '    if: failure()',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 5',
    '    permissions:',
    '      issues: write',
    '    steps:',
    '      - run: gh issue create --title "Nightly tests failed" --body "See the run log."',
    '        env:',
    '          GH_TOKEN: ${{ github.token }}'
  ].join('\n');

  return { risky: risky, nightly: nightly };
});
