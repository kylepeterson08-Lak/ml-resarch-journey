// Tests for the YAML reader behind the Workflow reader page.
// Run with:  node --test github-guide/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Y = require('../src/js/yaml.js');

const BS = '\\';   // one backslash, for writing YAML escapes without JavaScript reading them first

/** The text must be refused with a YamlError whose message matches, on the given 1-based line. */
function rejects(text, pattern, line) {
  assert.throws(() => Y.parse(text), (err) => {
    assert.ok(err instanceof Y.YamlError, `expected a YamlError, got ${err}`);
    assert.ok(err instanceof Error);
    assert.match(err.message, pattern);
    assert.doesNotMatch(err.message, /\w!(\s|$)/, 'no exclamation marks: a message may only name the ! character');
    if (line !== undefined) assert.equal(err.line, line, `wrong line for: ${err.message}`);
    return true;
  });
}

// ---------------------------------------------------------------- what it reads

test('comments start at the line start or after a space, and nowhere else', () => {
  assert.deepEqual(Y.parse('# top\na: 1 # trailing\nb: x#y\n  # indented\nc: "q # q"\nd: \'s # s\' # real\ne: # only a comment\n'),
    { a: 1, b: 'x#y', c: 'q # q', d: 's # s', e: null });
  assert.deepEqual(Y.parse('- a # c\n- b#c\n'), ['a', 'b#c']);
});

test('block mappings nest and keep their key order', () => {
  const doc = Y.parse('zeta: 1\nalpha:\n  mid: 2\n  deep:\n    leaf: 3\nlast: 4\n');
  assert.deepEqual(doc, { zeta: 1, alpha: { mid: 2, deep: { leaf: 3 } }, last: 4 });
  assert.deepEqual(Object.keys(doc), ['zeta', 'alpha', 'last']);
  assert.deepEqual(Y.parse('key with spaces: v\nspaced : w\n'), { 'key with spaces': 'v', spaced: 'w' });
});

test('block sequences, including a list of mappings with continuation keys', () => {
  assert.deepEqual(Y.parse('- a\n- b\n'), ['a', 'b']);
  assert.deepEqual(Y.parse('steps:\n  - name: one\n    run: x\n  - uses: y\n    with:\n      k: v\n'),
    { steps: [{ name: 'one', run: 'x' }, { uses: 'y', with: { k: 'v' } }] });
  assert.deepEqual(Y.parse('- - a\n  - b\n- - c\n'), [['a', 'b'], ['c']]);
  assert.deepEqual(Y.parse('-\n  a: 1\n-\n- b\n'), [{ a: 1 }, null, 'b']);
});

test('a list may sit in the same column as the key that owns it', () => {
  assert.deepEqual(Y.parse('steps:\n- uses: a\n- run: b\nenv:\n  X: 1\n'), { steps: [{ uses: 'a' }, { run: 'b' }], env: { X: 1 } });
  assert.deepEqual(Y.parse('- name: x\n  items:\n  - a\n  - b\n- name: y\n'), [{ name: 'x', items: ['a', 'b'] }, { name: 'y' }]);
  assert.deepEqual(Y.parse('- a:\n- b\n'), [{ a: null }, 'b']);
});

test('any consistent indentation by spaces works', () => {
  assert.deepEqual(Y.parse('a:\n   b:\n       c: 1\n   d: 2\ne:\n -   f: 3\n     g: 4\n'), { a: { b: { c: 1 }, d: 2 }, e: [{ f: 3, g: 4 }] });
  assert.deepEqual(Y.parse('  a: 1\n  b: 2\n'), { a: 1, b: 2 });
});

test('plain, single-quoted and double-quoted scalars', () => {
  assert.deepEqual(Y.parse('a: ubuntu-latest\nb: a b  c  \nc: https://example.org/x?y=1\nd: blob:none\ne: ~/.cache/pip\nf: dist/*\ng: a && b | c\n'),
    { a: 'ubuntu-latest', b: 'a b  c', c: 'https://example.org/x?y=1', d: 'blob:none', e: '~/.cache/pip', f: 'dist/*', g: 'a && b | c' });
  assert.deepEqual(Y.parse('a: \'it\'\'s\'\nb: \'say "hi"\'\nc: \'\'\nd: \'x' + BS + 'ny\'\n'), { a: "it's", b: 'say "hi"', c: '', d: 'x' + BS + 'ny' });
  const escapes = 'a: "x' + BS + 'ny' + BS + 'tz"\nb: "q' + BS + '"q"\nc: "b' + BS + BS + 's"\nd: "s' + BS + '/s"\ne: "caf' + BS + 'u00e9"\n';
  assert.deepEqual(Y.parse(escapes), { a: 'x\ny\tz', b: 'q"q', c: 'b' + BS + 's', d: 's/s', e: 'caf' + String.fromCharCode(0xe9) });
});

test('plain scalars get YAML 1.2 core types, so 3.10 becomes the number 3.1', () => {
  assert.deepEqual(Y.parse('a: true\nb: True\nc: TRUE\nd: false\ne: False\nf: FALSE\n'), { a: true, b: true, c: true, d: false, e: false, f: false });
  assert.deepEqual(Y.parse('a: null\nb: ~\nc:\nd: Null\ne: NULL\n'), { a: null, b: null, c: null, d: null, e: null });
  assert.deepEqual(Y.parse('a: 1\nb: -2\nc: +3\nd: 0\ne: 0x1F\nf: 0o17\n'), { a: 1, b: -2, c: 3, d: 0, e: 31, f: 15 });
  assert.deepEqual(Y.parse('a: 3.10\nb: .5\nc: 1.\nd: -0.5\ne: 1e3\nf: 1.5E-2\n'), { a: 3.1, b: 0.5, c: 1, d: -0.5, e: 1000, f: 0.015 });
  assert.equal(Y.parse('.inf'), Infinity);
  assert.ok(Number.isNaN(Y.parse('.nan')));
  assert.deepEqual(Y.parse('a: 1.2.0\nb: 12:30\nc: 2026-11-21\nd: tRue\ne: 1_000\nf: 0b11\n'),
    { a: '1.2.0', b: '12:30', c: '2026-11-21', d: 'tRue', e: '1_000', f: '0b11' });
});

test('on, off, yes, no, y and n stay text, so the key "on" is the string "on"', () => {
  const doc = Y.parse('on: push\na: on\nb: off\nc: yes\nd: no\ne: y\nf: n\ng: Yes\nh: ON\n');
  assert.deepEqual(doc, { on: 'push', a: 'on', b: 'off', c: 'yes', d: 'no', e: 'y', f: 'n', g: 'Yes', h: 'ON' });
  assert.deepEqual(Object.keys(Y.parse('on:\n  push:\n')), ['on']);
});

test('quoted scalars are always strings', () => {
  assert.deepEqual(Y.parse('a: "3.10"\nb: \'true\'\nc: "null"\nd: "~"\ne: \'1\'\n'), { a: '3.10', b: 'true', c: 'null', d: '~', e: '1' });
});

test('literal blocks keep line breaks, with - and + chomping', () => {
  assert.deepEqual(Y.parse('a: |\n  x\n  y\nb: 1\n'), { a: 'x\ny\n', b: 1 });
  assert.equal(Y.parse('a: |-\n  x\n  y\n').a, 'x\ny');
  assert.deepEqual(Y.parse('a: |+\n  x\n\n\nb: 1\n'), { a: 'x\n\n\n', b: 1 });
  assert.equal(Y.parse('a: |\n  x\n\n  y\n\n\n').a, 'x\n\ny\n', 'blank lines inside are kept, trailing ones are clipped');
  assert.equal(Y.parse('a: |\n  x\n    more\n  y\n').a, 'x\n  more\ny\n', 'deeper lines keep their extra indentation');
  assert.equal(Y.parse('a: |\n\n  x\n').a, '\nx\n');
  assert.equal(Y.parse('run: |\n  echo "a: b" # kept\n  key: value\n  - item\n').run, 'echo "a: b" # kept\nkey: value\n- item\n');
  assert.equal(Y.parse('a: |2\n    x\n   y\n').a, '  x\n y\n', 'an indentation indicator is honoured');
  assert.deepEqual(Y.parse('- |\n  x\n- >-\n  y\n  z\n'), ['x\n', 'y z']);
  assert.equal(Y.parse('a: |\n').a, '');
});

test('a block that ends the file without a final line break keeps none', () => {
  assert.equal(Y.parse('a: |\n  x\n  y').a, 'x\ny');
  assert.equal(Y.parse('a: |+\n  x\n').a, 'x\n');
});

test('folded blocks join lines, but keep blank lines and deeper lines', () => {
  assert.equal(Y.parse('a: >\n  x\n  y\n\n  z\n').a, 'x y\nz\n');
  assert.equal(Y.parse('a: >-\n  x\n  y\n').a, 'x y');
  assert.equal(Y.parse('a: >+\n  x\n\n').a, 'x\n\n');
  const spec = 'a: >\n\n  folded\n  line\n\n  next\n  line\n    * bullet\n\n    * list\n    * lines\n\n  last\n  line\n\n# Comment\n';
  assert.equal(Y.parse(spec).a, '\nfolded line\nnext line\n  * bullet\n\n  * list\n  * lines\n\nlast line\n');
});

test('flow sequences and mappings, nested, quoted and over several lines', () => {
  assert.deepEqual(Y.parse('a: [x, y, "c d"]\nb: { x: y, c: [1, 2] }\nc: []\nd: {}\n'), { a: ['x', 'y', 'c d'], b: { x: 'y', c: [1, 2] }, c: [], d: {} });
  assert.deepEqual(Y.parse('a: [true, 1, 3.10, null, ~, "3.10", on]\n'), { a: [true, 1, 3.1, null, null, '3.10', 'on'] });
  assert.deepEqual(Y.parse('matrix: { os: [ubuntu-latest, macos-latest], py: ["3.11", \'3.12\'] }\n'),
    { matrix: { os: ['ubuntu-latest', 'macos-latest'], py: ['3.11', '3.12'] } });
  assert.deepEqual(Y.parse('a: [x, # why\n  y,\n  z]\nb: {\n  x: 1,\n  y: [2,\n    3]\n}\nc: 1\n'), { a: ['x', 'y', 'z'], b: { x: 1, y: [2, 3] }, c: 1 });
  assert.deepEqual(Y.parse('a: [\n  x,\n  y,\n]\n'), { a: ['x', 'y'] }, 'a trailing comma is fine');
  assert.deepEqual(Y.parse('a: [x,\ny]\n'), { a: ['x', 'y'] }, 'as other parsers do, tolerate a continuation line that is not indented');
  assert.deepEqual(Y.parse('{a:[1], "b":{c: 2}, d, e: }'), { a: [1], b: { c: 2 }, d: null, e: null });
  assert.deepEqual(Y.parse('- [a, [b, {c: d}]]\n- {e: f}\n'), [['a', ['b', { c: 'd' }]], { e: 'f' }]);
  assert.deepEqual(Y.parse('a: [https://x.y/z, a:b, it\'\'s]\n'), { a: ['https://x.y/z', 'a:b', "it''s"] });
});

test('quoted keys', () => {
  assert.deepEqual(Y.parse('"on": push\n\'b c\': 2\n"d: e": 3\n- x: 1\n'.replace('- x: 1\n', '')), { on: 'push', 'b c': 2, 'd: e': 3 });
  assert.deepEqual(Y.parse('- "quoted": v\n  \'k\': [1]\n'), [{ quoted: 'v', k: [1] }]);
  assert.deepEqual(Y.parse('-: dash is an ordinary key here\n'), { '-': 'dash is an ordinary key here' });
});

test('an expression is plain text to the end of the line', () => {
  const doc = Y.parse([
    "if: ${{ github.ref == 'refs/heads/main' }}",
    'url: ${{ steps.deployment.outputs.page_url }}',
    "cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}   # a comment",
    'group: ci-${{ github.ref }}',
    "label: ${{ format('{0}: {1}', a, b) }}",
    "when: github.event_name != 'pull_request' || a.b != c",
    'home: $HOME',
    'list:',
    '  - ${{ matrix.os }}',
    "  - ${{ format('a: b') }}"
  ].join('\n'));
  assert.deepEqual(doc, {
    if: "${{ github.ref == 'refs/heads/main' }}",
    url: '${{ steps.deployment.outputs.page_url }}',
    'cancel-in-progress': "${{ github.ref != 'refs/heads/main' }}",
    group: 'ci-${{ github.ref }}',
    label: "${{ format('{0}: {1}', a, b) }}",
    when: "github.event_name != 'pull_request' || a.b != c",
    home: '$HOME',
    list: ['${{ matrix.os }}', "${{ format('a: b') }}"]
  });
});

test('a leading ---, an empty document, Windows line endings and a byte order mark', () => {
  assert.deepEqual(Y.parse('---\na: 1\n'), { a: 1 });
  assert.deepEqual(Y.parse('# intro\n--- # start\na: 1\n...\n'), { a: 1 });
  assert.equal(Y.parse(''), null);
  assert.equal(Y.parse('\n   \n# only a comment\n'), null);
  assert.equal(Y.parse('---\n'), null);
  assert.equal(Y.parse(undefined), null);
  assert.deepEqual(Y.parse('a: 1\r\nb:\r\n  - x\r\n  - y\r\nc: |\r\n  one\r\n  two\r\n'), { a: 1, b: ['x', 'y'], c: 'one\ntwo\n' });
  assert.deepEqual(Y.parse(String.fromCharCode(0xfeff) + 'a: 1\n'), { a: 1 });
  assert.equal(Y.parse('just text'), 'just text');
  assert.equal(Y.parse('42'), 42);
});

test('keys such as __proto__ are ordinary keys', () => {
  const doc = Y.parse('__proto__:\n  polluted: yes\nconstructor: 1\ntoString: 2\n');
  assert.deepEqual(Object.keys(doc), ['__proto__', 'constructor', 'toString']);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(doc), Object.prototype);
});

// ---------------------------------------------------------------- what it refuses

test('a tab used for indentation is refused', () => {
  const message = /^YAML does not allow tabs for indentation\. Replace the tab on this line with spaces\.$/;
  rejects('a: 1\n\tb: 2\n', message, 2);
  rejects('a:\n  b:\n\t  c: 1\n', message, 3);
  rejects('a: |\n  x\n\ty\n', message, 3);
  rejects('a: [\n\tx]\n', message, 2);
  assert.deepEqual(Y.parse('a: "tab\there"\nb: |\n  x\ty\n'), { a: 'tab\there', b: 'x\ty\n' }, 'a tab inside a value is not indentation');
});

test('inconsistent indentation is refused', () => {
  rejects('a: 1\n  b: 2\n', /indented differently/, 2);
  rejects('a:\n    b: 1\n  c: 2\n', /indented differently/, 3);
  rejects('  a: 1\nb: 2\n', /indented differently/, 2);
  rejects('steps:\n  - name: a\n     run: b\n', /indented differently/, 3);
  rejects('steps:\n  - name: a\n   run: b\n', /indented differently/, 3);
  rejects('a: |\n    deep\n  x\n', /indented differently/, 3);
});

test('a key that appears twice in one mapping is refused', () => {
  const twice = (key) => new RegExp(`^The key "${key}" appears twice in the same block\\. The second one would silently replace the first\\.$`);
  rejects('a: 1\nb: 2\na: 3\n', twice('a'), 3);
  rejects('jobs:\n  build:\n    runs-on: x\n    runs-on: y\n', twice('runs-on'), 4);
  rejects('a: 1\n"a": 2\n', twice('a'), 2);
  rejects('a: {x: 1, x: 2}\n', twice('x'), 1);
  assert.deepEqual(Y.parse('a:\n  x: 1\nb:\n  x: 2\n'), { a: { x: 1 }, b: { x: 2 } }, 'the same key in two mappings is fine');
});

test('anchors, aliases, tags and merge keys are not supported by this reader', () => {
  rejects('base: &base\n  a: 1\n', /anchor.*not supported by this reader/, 1);
  rejects('a: 1\nb: *base\n', /alias.*not supported by this reader/, 2);
  rejects('paths:\n  - *.md\n', /alias.*not supported by this reader.*quotes/, 2);
  rejects('a: !!str 1\n', /tag.*not supported by this reader/, 1);
  rejects('if: !cancelled()\n', /tag.*not supported by this reader.*quotes/, 1);
  rejects('a:\n  <<: {b: 1}\n', /Merge keys.*not supported by this reader/, 2);
  rejects('a: [&x 1, *x]\n', /not supported by this reader/, 1);
  rejects('? a\n: b\n', /not supported by this reader/, 1);
  rejects('%YAML 1.2\n---\na: 1\n', /directive.*not supported by this reader/, 1);
  assert.deepEqual(Y.parse('a: "*.md"\nb: \'!x\'\nc: x & y\nd: "<<"\n'), { a: '*.md', b: '!x', c: 'x & y', d: '<<' });
});

test('more than one document is refused', () => {
  rejects('a: 1\n---\nb: 2\n', /one YAML document at a time/, 2);
  rejects('---\na: 1\n---\nb: 2\n', /one YAML document at a time/, 3);
  rejects('a: 1\n...\nb: 2\n', /one YAML document at a time/, 3);
});

test('plain text that runs on to a second line is refused, with | and > as the way out', () => {
  rejects('a: x\n  y\n', /Start the value with \| to keep the line breaks or > to join the lines/, 1);
  rejects('run: echo one\n  echo two\n', /\|.*>/, 1);
  rejects('- x\n  y\n', /\|.*>/, 1);
  rejects('a:\n  some text\n  more text\n', /\|.*>/, 2);
  rejects('hello\nworld\n', /\|.*>/, 1);
});

test('unterminated quotes and flow collections are refused', () => {
  rejects('a: "abc\nb: 1\n', /quote that is never closed/, 1);
  rejects("a: 'abc\n", /quote that is never closed/, 1);
  rejects('a: ["x, y]\n', /quote that is never closed/, 1);
  rejects('on:\n  push:\n    branches: [main\njobs:\n  build:\n', /^The \[ on this line is never closed\. Add the matching \]\.$/, 3);
  rejects('a: [x, y\n', /The \[ on this line is never closed/, 1);
  rejects('a: {x: 1\nb: 1\n', /^The \{ on this line is never closed\. Add the matching \}\.$/, 1);
});

test('other mistakes get a message that says what to change', () => {
  rejects('name: Build: test\n', /colon inside this value.*quotes/, 1);
  rejects('run: echo "a: b"\n', /colon inside this value.*quotes/, 1);
  rejects('name Guide\non: push\n', /not a "key: value" pair/, 1);
  rejects('jobs:\n  build\n    runs-on: x\n', /not a "key: value" pair/, 2);
  rejects('a: 1\nb:c\n', /space follows the colon/, 2);
  rejects(': x\n', /key is missing/, 1);
  rejects('branches: - main\n', /cannot share a line with its key/, 1);
  rejects('- a\n-b\n', /needs a space after its dash/, 2);
  rejects('a:\n  - b\n  c: d\n', /never both/, 3);
  rejects('a: 1\n- b\n', /starts a list item/, 2);
  rejects('a: "x" y\n', /after the closing quote/, 1);
  rejects('a: [x, y] z\n', /after the closing bracket/, 1);
  rejects('a: "' + BS + 'q"\n', /backslash/, 1);
  rejects('a: |x\n  y\n', /After \| or >/, 1);
  rejects('a: @x\n', /cannot start with @/, 1);
  rejects('a: [x,, y]\n', /value is missing/, 1);
  rejects('a: [:x]\n', /value is missing/, 1);
  rejects('a: [?x]\n', /not supported by this reader/, 1);
  rejects('a: [x: y]\n', /wrapped in \{ \}/, 1);
  rejects('a: ["x" y]\n', /comma or a closing bracket is missing/, 1);
  rejects('runs-on: [self-hosted, ${{ matrix.os }}]\n', /must be in quotes/, 1);
});

// ---------------------------------------------------------------- lineOf

test('lineOf gives the line where a key or a list item starts', () => {
  const doc = Y.parseDocument([
    'name: CI',                                    // 1
    'on:',                                         // 2
    '  push:',                                     // 3
    '    branches: [main, dev]',                   // 4
    'jobs:',                                       // 5
    '  build:',                                    // 6
    '    runs-on: ubuntu-latest',                  // 7
    '    steps:',                                  // 8
    '      - uses: actions/checkout@v7',           // 9
    '      - name: Test',                          // 10
    '        run: |',                              // 11
    '          echo one',                          // 12
    '          echo two',                          // 13
    '',                                            // 14
    '      # the third step',                      // 15
    '      - name: Upload',                        // 16
    '        uses: actions/upload-artifact@v7',    // 17
    '        with:',                               // 18
    '          path: [',                           // 19
    '            dist,',                           // 20
    '            docs',                            // 21
    '          ]'                                  // 22
  ].join('\n'));
  const expected = {
    '': 1, name: 1, on: 2, 'on.push': 3, 'on.push.branches': 4, 'on.push.branches[0]': 4, 'on.push.branches[1]': 4,
    jobs: 5, 'jobs.build': 6, 'jobs.build.runs-on': 7, 'jobs.build.steps': 8,
    'jobs.build.steps[0]': 9, 'jobs.build.steps[0].uses': 9,
    'jobs.build.steps[1]': 10, 'jobs.build.steps[1].name': 10, 'jobs.build.steps[1].run': 11,
    'jobs.build.steps[2]': 16, 'jobs.build.steps[2].uses': 17, 'jobs.build.steps[2].with': 18,
    'jobs.build.steps[2].with.path': 19, 'jobs.build.steps[2].with.path[0]': 20, 'jobs.build.steps[2].with.path[1]': 21
  };
  for (const [where, line] of Object.entries(expected)) assert.equal(doc.lineOf(where), line, `lineOf('${where}')`);
  assert.equal(doc.lineOf('jobs.deploy'), null);
  assert.equal(doc.lineOf('jobs.build.steps[3]'), null);
  assert.equal(doc.lineOf('constructor'), null);
  assert.equal(doc.value.jobs.build.steps[2].uses, 'actions/upload-artifact@v7');
});

test('lineOf works for a list at the top, a same-column list and an empty document', () => {
  const list = Y.parseDocument('# intro\n- a\n- b: 1\n  c:\n  - x\n  - y\n');
  assert.equal(list.lineOf(''), 1);
  assert.equal(list.lineOf('[0]'), 2);
  assert.equal(list.lineOf('[1]'), 3);
  assert.equal(list.lineOf('[1].c'), 4);
  assert.equal(list.lineOf('[1].c[1]'), 6);
  const empty = Y.parseDocument('');
  assert.equal(empty.value, null);
  assert.equal(empty.lineOf(''), 1);
  assert.equal(empty.lineOf('a'), null);
});

// ---------------------------------------------------------------- real files

test('this repository\'s own workflow file is read correctly', () => {
  const file = path.join(__dirname, '..', '..', '.github', 'workflows', 'guide.yml');
  const text = fs.readFileSync(file, 'utf8');
  const doc = Y.parseDocument(text);
  const wf = doc.value;
  assert.equal(typeof wf.name, 'string');
  assert.deepEqual(Object.keys(wf.on), ['push', 'pull_request', 'workflow_dispatch'], 'the key "on" is text, not true');
  assert.equal(wf.on.workflow_dispatch, null);
  assert.ok(Array.isArray(wf.on.push.paths));
  assert.deepEqual(Object.keys(wf.jobs), ['build', 'deploy']);
  assert.equal(wf.jobs.deploy.needs, 'build');
  assert.match(wf.jobs.build.if, /^github\.event_name != 'pull_request' \|\| /);
  assert.match(wf.concurrency['cancel-in-progress'], /^\$\{\{ .* \}\}$/);
  assert.match(wf.jobs.deploy.environment.url, /^\$\{\{ .* \}\}$/);
  assert.ok(Array.isArray(wf.jobs.build.steps) && wf.jobs.build.steps.length > 0);
  for (const step of wf.jobs.build.steps) {
    for (const [name, value] of Object.entries(step.with || {})) {
      if (/-version$/.test(name)) assert.equal(typeof value, 'string', `${name} is quoted, so it stays text`);
    }
  }
  const lines = text.split('\n');
  assert.match(lines[doc.lineOf('jobs.deploy.needs') - 1], /^\s+needs: build/);
  assert.match(lines[doc.lineOf('jobs.build.steps[0]') - 1], /^\s+- /);
});

test('every YAML example in the lessons parses', () => {
  // Blocks that are deliberately not valid YAML go here as 'lesson-id#section.block', with the reason.
  const SKIP = {};
  const lessonsDir = path.join(__dirname, '..', 'content', 'lessons');
  let count = 0;
  for (const track of fs.readdirSync(lessonsDir)) {
    const trackDir = path.join(lessonsDir, track);
    if (!fs.statSync(trackDir).isDirectory()) continue;
    for (const name of fs.readdirSync(trackDir).filter((f) => f.endsWith('.json'))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(trackDir, name), 'utf8'));
      (lesson.sections || []).forEach((section, s) => {
        (section.blocks || []).forEach((block, b) => {
          if (block.type !== 'code' || block.lang !== 'yaml') return;
          const id = `${lesson.id}#${s}.${b}`;
          if (SKIP[id]) return;
          count++;
          let value;
          assert.doesNotThrow(() => { value = Y.parse(block.code); }, `${id} should parse`);
          assert.equal(typeof value, 'object', `${id} should be a mapping or a list`);
        });
      });
    }
  }
  assert.ok(count > 0, 'the lessons hold YAML examples');
});
