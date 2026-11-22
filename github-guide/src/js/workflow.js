/*
 * workflow.js: understands a GitHub Actions workflow file.
 *
 * yaml.js turns the text into plain values. This file answers the three
 * questions a reviewer asks of a workflow:
 *
 *   analyze(doc, lineOf)             what starts it, what may it touch, what
 *                                    does it run, and what deserves a second look
 *   simulate(analysis, scenario)     for this event, which jobs run
 *   evaluate(expression, context)    the value of an "if:" condition, or an
 *                                    honest "cannot tell"
 *
 * It models the common shape of a workflow, not all of GitHub Actions. Where
 * it cannot know something (a secret, a matrix value, another job's output)
 * it says so instead of guessing.
 *
 * No DOM and no dependencies, so the same file runs in the browser and under
 * Node (see tests/workflow.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.GG = root.GG || {}).workflow = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ helpers

  function isMap(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function has(map, key) { return isMap(map) && Object.prototype.hasOwnProperty.call(map, key); }
  function get(map, key) { return has(map, key) ? map[key] : undefined; }
  function list(v) { return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]; }
  function text(v) { return v === undefined || v === null ? '' : String(v); }
  function strings(v) { return v === undefined ? null : list(v).map(text); }
  function join(path, key) { return path === '' ? key : path + '.' + key; }
  function item(path, i) { return path + '[' + i + ']'; }
  /** Wrap text so the page shows it as code. A code span cannot hold a backtick or a line break. */
  function code(s) {
    var clean = text(s).replace(/`/g, "'").replace(/\s+/g, ' ').trim();
    return clean ? '`' + clean + '`' : '(empty)';
  }

  /** "`a`", "`a` and `b`", "`a`, `b` and `c`". */
  function names(items) {
    var c = items.map(code);
    return c.length < 2 ? c.join('') : c.slice(0, -1).join(', ') + ' and ' + c[c.length - 1];
  }

  /** How many slips turn one word into the other: a letter added, dropped or changed, or two neighbours swapped. */
  function distance(a, b) {
    var before = null, prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (before && i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          cur[j] = Math.min(cur[j], before[j - 2] + 1);
        }
      }
      before = prev; prev = cur;
    }
    return prev[b.length];
  }

  /** The known word a mistyped one most likely stands for, or null. */
  function nearest(word, known) {
    var lower = word.toLowerCase(), plain = lower.replace(/[_\s]/g, '-'), best = null, bestD = 3, i, d;
    if (lower.length < 3) return null;   // two letters are within an edit or two of almost anything
    for (i = 0; i < known.length; i++) {
      if (known[i].replace(/_/g, '-') === plain) return known[i];
      d = distance(lower, known[i]);
      if (d < bestD) { bestD = d; best = known[i]; }
    }
    return best && bestD <= (lower.length <= 4 ? 1 : 2) ? best : null;
  }

  // ------------------------------------------------------------ what GitHub knows

  var TOP_KEYS = ['name', 'run-name', 'on', 'permissions', 'env', 'defaults', 'concurrency', 'jobs'];
  var JOB_KEYS = ['name', 'permissions', 'needs', 'if', 'runs-on', 'environment', 'concurrency', 'outputs', 'env',
    'defaults', 'steps', 'timeout-minutes', 'strategy', 'continue-on-error', 'container', 'services', 'uses', 'with', 'secrets'];
  var STEP_KEYS = ['id', 'if', 'name', 'uses', 'run', 'working-directory', 'shell', 'with', 'env', 'continue-on-error', 'timeout-minutes'];
  var EVENTS = ['branch_protection_rule', 'check_run', 'check_suite', 'create', 'delete', 'deployment', 'deployment_status',
    'discussion', 'discussion_comment', 'fork', 'gollum', 'issue_comment', 'issues', 'label', 'merge_group', 'milestone',
    'page_build', 'public', 'pull_request', 'pull_request_review', 'pull_request_review_comment', 'pull_request_target',
    'push', 'registry_package', 'release', 'repository_dispatch', 'schedule', 'status', 'watch', 'workflow_call',
    'workflow_dispatch', 'workflow_run'];

  // Organizations whose actions are GitHub's own.
  var FIRST_PARTY = { actions: true, github: true };
  var BRANCH_NAMES = /^(main|master|develop|development|dev|trunk|head|next|nightly|canary|edge|latest)$/i;

  // Parts of an event that an outsider types: titles, bodies, branch names, commit messages.
  var UNTRUSTED = /github\.head_ref\b|github\.event\.[\w.*\-\[\]']*\.(title|body|message|name|email|label|ref|default_branch|page_name|head_branch)\b/;
  var PR_HEAD = /github\.event\.pull_request\.head\.(sha|ref)\b|github\.head_ref\b|refs\/pull\//;
  var PRINTS = /(^|[\s;&|(])(echo|printf|print|cat|tee|Write-Host|Write-Output)\b/;

  // The lesson that teaches each thing this reader flags.
  var FUNDAMENTALS = 'advanced-actions-fundamentals', PIPELINES = 'advanced-ci-pipelines', SECRETS = 'advanced-secrets-environments';
  var ARCHITECTURE = 'expert-actions-architecture', SUPPLY = 'expert-supply-chain';
  var LESSON = {
    'not-a-workflow': FUNDAMENTALS, 'no-triggers': FUNDAMENTALS, 'unknown-event': FUNDAMENTALS, 'filter-conflict': FUNDAMENTALS,
    'bad-cron': FUNDAMENTALS, 'unknown-top-level-key': FUNDAMENTALS, 'unknown-key': FUNDAMENTALS, 'no-jobs': FUNDAMENTALS,
    'job-no-runner': FUNDAMENTALS, 'job-no-steps': FUNDAMENTALS, 'needs-unknown': FUNDAMENTALS, 'needs-cycle': FUNDAMENTALS,
    'step-uses-and-run': FUNDAMENTALS, 'step-empty': FUNDAMENTALS, 'action-no-version': FUNDAMENTALS,
    'bad-condition': FUNDAMENTALS, 'condition-mixed': FUNDAMENTALS,
    'version-as-number': PIPELINES, 'no-timeout': PIPELINES, 'no-concurrency': PIPELINES,
    'no-permissions': SECRETS, 'write-all': SECRETS, 'secret-in-run-echo': SECRETS,
    'pull-request-target': ARCHITECTURE, 'pull-request-target-checkout': ARCHITECTURE, 'script-injection': ARCHITECTURE,
    'self-hosted-on-pr': ARCHITECTURE,
    'unpinned-third-party': SUPPLY, 'branch-ref': SUPPLY
  };

  // ------------------------------------------------------------ filter patterns

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

  /**
   * GitHub's filter patterns as a regular expression. "*" stops at a slash and
   * "**" does not; "?" and "+" repeat the character before them; "[a-z]" is one
   * character from a set. Returns null for a pattern that cannot be read.
   */
  function globToRegExp(pattern) {
    var out = '', i = 0, n = pattern.length, c, end;
    while (i < n) {
      c = pattern.charAt(i);
      if (c === '*') {
        if (pattern.charAt(i + 1) !== '*') { out += '[^/]*'; i += 1; }
        else if (pattern.charAt(i + 2) === '/') { out += '(?:.*/)?'; i += 3; }   // "docs/**/*.md" also matches docs/a.md
        else { out += '.*'; i += 2; }
      } else if (c === '?' || c === '+') {
        out += out ? c : '\\' + c; i += 1;
      } else if (c === '[' && (end = pattern.indexOf(']', i + 1)) !== -1) {
        out += '[' + pattern.slice(i + 1, end).replace(/[\\\]^]/g, '\\$&') + ']'; i = end + 1;
      } else if (c === '\\' && i + 1 < n) {
        out += escapeRe(pattern.charAt(i + 1)); i += 2;
      } else {
        out += escapeRe(c); i += 1;
      }
    }
    try { return new RegExp('^' + out + '$'); } catch (err) { return null; }
  }

  function globMatch(pattern, value) {
    var re = globToRegExp(pattern);
    return re ? re.test(value) : pattern === value;
  }

  /** Patterns are read top to bottom: a later "!pattern" takes a match away, a later plain one gives it back. */
  function matchOrdered(value, patterns) {
    var hit = false;
    patterns.forEach(function (p) {
      var negative = p.charAt(0) === '!';
      if (globMatch(negative ? p.slice(1) : p, value)) hit = !negative;
    });
    return hit;
  }

  function refAllowed(name, include, ignore) {
    if (include && !matchOrdered(name, include)) return false;
    if (ignore && ignore.some(function (p) { return globMatch(p, name); })) return false;
    return true;
  }

  // ---------------------------------------------------------------- conditions
  //
  // The small language inside "if:" and ${{ }}: values, comparisons, && || !,
  // dotted names such as github.ref, and a handful of functions.

  function SyntaxProblem(message) { this.message = message; this.syntax = true; }

  function show(token) { return token.t === 'str' ? "'" + token.v + "'" : String(token.v); }

  function tokenize(src) {
    var tokens = [], i = 0, n = src.length, c, m, rest, out, j, closed;
    while (i < n) {
      c = src.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      rest = src.slice(i);
      if (c === "'") {
        out = ''; j = i + 1; closed = false;
        while (j < n) {
          if (src.charAt(j) !== "'") { out += src.charAt(j++); continue; }
          if (src.charAt(j + 1) === "'") { out += "'"; j += 2; continue; }   // '' is a quote inside the text
          closed = true; j++; break;
        }
        if (!closed) throw new SyntaxProblem('A text value opens with a single quote that is never closed.');
        tokens.push({ t: 'str', v: out }); i = j; continue;
      }
      if (c === '"') throw new SyntaxProblem('Text inside a condition goes in single quotes, not double quotes.');
      if ((m = /^(0x[0-9a-fA-F]+|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(rest))) {
        tokens.push({ t: 'num', v: Number(m[1]) }); i += m[1].length; continue;
      }
      if ((m = /^(\|\||&&|==|!=|<=|>=|[()\[\].,!<>*])/.exec(rest))) {
        tokens.push({ t: 'op', v: m[1] }); i += m[1].length; continue;
      }
      if ((m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest))) {
        tokens.push({ t: 'name', v: m[0] }); i += m[0].length; continue;
      }
      if (c === '=') throw new SyntaxProblem('A single `=` is not a comparison. Write `==` to compare two values.');
      if (c === '&' || c === '|') throw new SyntaxProblem('Write `&&` for "and" and `||` for "or".');
      throw new SyntaxProblem('The character `' + c + '` does not belong in a condition.');
    }
    return tokens;
  }

  /** Turn the text of a condition into a tree. Throws SyntaxProblem with a sentence a learner can act on. */
  function parseExpression(src) {
    var tokens = tokenize(src), pos = 0;
    function isOp(v) { var t = tokens[pos]; return !!t && t.t === 'op' && t.v === v; }
    function take(v) { if (isOp(v)) { pos++; return true; } return false; }
    function expect(v) {
      if (take(v)) return;
      throw new SyntaxProblem(tokens[pos] ? 'A `' + v + '` is missing before `' + show(tokens[pos]) + '`.' : 'The condition ends where a `' + v + '` is still needed.');
    }
    function level(next, ops) {
      return function () {
        var left = next(), t;
        while ((t = tokens[pos]) && t.t === 'op' && ops.indexOf(t.v) !== -1) { pos++; left = { k: 'bin', op: t.v, a: left, b: next() }; }
        return left;
      };
    }
    function unary() { return take('!') ? { k: 'not', a: unary() } : primary(); }
    function primary() {
      var t = tokens[pos], node, lower, args, p;
      if (!t) throw new SyntaxProblem('The condition ends where a value is still needed.');
      pos++;
      if (t.t === 'str' || t.t === 'num') return { k: 'lit', v: t.v };
      if (t.t === 'op' && t.v === '(') { node = or(); expect(')'); return node; }
      if (t.t !== 'name') throw new SyntaxProblem('`' + show(t) + '` is not expected at this point in the condition.');
      lower = t.v.toLowerCase();
      if (take('(')) {
        args = [];
        if (!take(')')) { do { args.push(or()); } while (take(',')); expect(')'); }
        node = { k: 'call', name: lower, shown: t.v, args: args };
      } else if (lower === 'true' || lower === 'false') {
        return { k: 'lit', v: lower === 'true' };
      } else if (lower === 'null') {
        return { k: 'lit', v: null };
      } else {
        node = { k: 'ref', root: t.v, path: [] };
      }
      for (;;) {
        if (take('.')) {
          p = tokens[pos];
          if (p && (p.t === 'name' || p.t === 'num' || (p.t === 'op' && p.v === '*'))) { pos++; node = access(node, String(p.v)); }
          else throw new SyntaxProblem('A name is needed after the dot.');
        } else if (take('[')) {
          node = access(node, or()); expect(']');
        } else {
          return node;
        }
      }
    }
    function access(node, key) {
      if (node.k !== 'ref') node = { k: 'ref', base: node, path: [] };
      node.path.push(key);
      return node;
    }
    var relational = level(unary, ['<', '<=', '>', '>=']);
    var equality = level(relational, ['==', '!=']);
    var and = level(equality, ['&&']);
    var or = level(and, ['||']);
    var tree = or();
    if (pos < tokens.length) throw new SyntaxProblem('`' + show(tokens[pos]) + '` is not expected at this point in the condition. An operator such as `&&` or `==` may be missing.');
    return tree;
  }

  var STATUS_FUNCTIONS = { always: true, success: true, failure: true, cancelled: true };

  function callsStatus(node) {
    if (!node || typeof node !== 'object') return false;
    if (node.k === 'call') return STATUS_FUNCTIONS[node.name] === true || node.args.some(callsStatus);
    if (node.k === 'bin') return callsStatus(node.a) || callsStatus(node.b);
    if (node.k === 'not') return callsStatus(node.a);
    if (node.k === 'ref') return callsStatus(node.base) || node.path.some(callsStatus);
    return false;
  }

  function known(v) { return { known: true, value: v }; }
  function unknown(reason) { return { known: false, reason: reason }; }
  function truthy(v) { return !(v === false || v === null || v === undefined || v === '' || v === 0 || (typeof v === 'number' && isNaN(v))); }
  function toNumber(v) {
    if (v === null || v === undefined || v === false || v === '') return 0;
    if (v === true) return 1;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v.trim());
    return NaN;
  }
  /** GitHub compares text without regard to case, and turns unlike types into numbers first. */
  function looseEqual(a, b) {
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
    if (a === null && b === null) return true;
    if ((typeof a === 'object' && a !== null) || (typeof b === 'object' && b !== null)) return a === b;
    if (typeof a === typeof b) return a === b;
    return toNumber(a) === toNumber(b);
  }
  function compare(op, a, b) {
    var x, y;
    if (typeof a === 'string' && typeof b === 'string') { x = a.toLowerCase(); y = b.toLowerCase(); }
    else { x = toNumber(a); y = toNumber(b); }
    return op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y;
  }

  function ownKey(map, key) {
    var lower, keys, i;
    if (has(map, key)) return key;
    lower = key.toLowerCase(); keys = Object.keys(map);
    for (i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === lower) return keys[i];
    return null;
  }

  function evalNode(node, ctx, status) {
    var a, b, i, cur, key, shown, args, fn;
    switch (node.k) {
      case 'lit': return known(node.v);
      case 'not':
        a = evalNode(node.a, ctx, status);
        return a.known ? known(!truthy(a.value)) : a;
      case 'bin':
        a = evalNode(node.a, ctx, status);
        if (node.op === '&&') {
          if (a.known && !truthy(a.value)) return a;           // false && anything is false
          b = evalNode(node.b, ctx, status);
          if (a.known) return b;
          return b.known && !truthy(b.value) ? known(false) : a;
        }
        if (node.op === '||') {
          if (a.known && truthy(a.value)) return a;            // true || anything is true
          b = evalNode(node.b, ctx, status);
          if (a.known) return b;
          return b.known && truthy(b.value) ? known(true) : a;
        }
        b = evalNode(node.b, ctx, status);
        if (!a.known) return a;
        if (!b.known) return b;
        if (node.op === '==') return known(looseEqual(a.value, b.value));
        if (node.op === '!=') return known(!looseEqual(a.value, b.value));
        return known(compare(node.op, a.value, b.value));
      case 'call':
        fn = node.name;
        if (fn === 'always') return known(true);
        if (fn === 'success' || fn === 'failure' || fn === 'cancelled') {
          return status[fn] === undefined ? unknown('whether the jobs it waits for succeed') : known(!!status[fn]);
        }
        args = node.args.map(function (arg) { return evalNode(arg, ctx, status); });
        for (i = 0; i < args.length; i++) if (!args[i].known) return args[i];
        args = args.map(function (arg) { return arg.value; });
        if (fn === 'contains' && args.length === 2) {
          if (Array.isArray(args[0])) return known(args[0].some(function (el) { return looseEqual(el, args[1]); }));
          return known(text(args[0]).toLowerCase().indexOf(text(args[1]).toLowerCase()) !== -1);
        }
        if (fn === 'startswith' && args.length === 2) return known(text(args[0]).toLowerCase().indexOf(text(args[1]).toLowerCase()) === 0);
        if (fn === 'endswith' && args.length === 2) {
          a = text(args[0]).toLowerCase(); b = text(args[1]).toLowerCase();
          return known(a.length >= b.length && a.slice(a.length - b.length) === b);
        }
        if (fn === 'format' && args.length >= 1) {
          return known(text(args[0]).replace(/\{(\d+)\}/g, function (whole, n) { return +n + 1 < args.length ? text(args[+n + 1]) : whole; }));
        }
        return unknown('the result of ' + code(node.shown + '()'));
      default:   // 'ref': a dotted name such as github.event.pull_request.head.ref
        if (node.base) return unknown('part of a computed value');
        shown = code(node.root + node.path.map(function (part) { return typeof part === 'string' ? '.' + part : '[...]'; }).join(''));
        key = ownKey(ctx, node.root);
        if (key === null) return unknown(shown);
        cur = ctx[key];
        for (i = 0; i < node.path.length; i++) {
          key = node.path[i];
          if (typeof key !== 'string') {
            a = evalNode(key, ctx, status);
            if (!a.known) return a;
            key = text(a.value);
          }
          if (cur === null || cur === undefined || typeof cur !== 'object') return known(null);   // a part of nothing is nothing
          if (key === '*') return unknown(shown);
          if (Array.isArray(cur)) { cur = /^\d+$/.test(key) && +key < cur.length ? cur[+key] : null; continue; }
          key = ownKey(cur, key);
          if (key === null) return unknown(shown);
          cur = cur[key];
        }
        return cur === undefined ? unknown(shown) : known(cur);
    }
  }

  /**
   * How a condition is written: plain, wrapped in one ${{ }}, or a mixture.
   * Returns the text to evaluate, or null for a mixture.
   */
  function unwrap(src) {
    var m;
    if (src.indexOf('${{') === -1) return src;
    m = /^\$\{\{([\s\S]*)\}\}$/.exec(src);
    return m && m[1].indexOf('${{') === -1 && m[1].indexOf('}}') === -1 ? m[1] : null;
  }

  /**
   * Work out a condition.
   *   context: nested values such as { github: { ref: 'refs/heads/main' } }.
   *            A name the context leaves out is unknown; null means "known to be empty".
   *   status:  { success, failure, cancelled } for the jobs it waits for.
   *            Left out, the walk-through assumes everything so far succeeded.
   * Returns { value, usesStatus } or { unknown: true, reason, usesStatus }, plus
   * `error` when the text cannot be read and `mixed` when ${{ }} is mixed with plain text.
   */
  function evaluate(expression, context, status) {
    var src = text(expression).trim(), inner = unwrap(src), tree, result;
    status = status || { success: true, failure: false, cancelled: false };
    if (inner === null) {
      return { unknown: true, mixed: true, usesStatus: /\b(always|success|failure|cancelled)\s*\(/i.test(src),
        reason: 'the condition mixes `${{ }}` with text outside it' };
    }
    try {
      tree = parseExpression(inner);
    } catch (err) {
      if (!err || !err.syntax) throw err;
      return { unknown: true, error: err.message, usesStatus: false, reason: 'the condition cannot be read' };
    }
    result = evalNode(tree, isMap(context) ? context : {}, status);
    return result.known
      ? { value: result.value, usesStatus: callsStatus(tree) }
      : { unknown: true, reason: 'the condition depends on ' + result.reason + ', which this reader cannot know', usesStatus: callsStatus(tree) };
  }

  // ------------------------------------------------------------------ schedules

  var CRON_FIELDS = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day of month', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12, words: 'jan feb mar apr may jun jul aug sep oct nov dec' },
    { name: 'day of week', min: 0, max: 7, words: 'sun mon tue wed thu fri sat' }
  ];

  function cronValue(word, field) {
    if (/^\d+$/.test(word)) return +word >= field.min && +word <= field.max;
    return !!field.words && field.words.split(' ').indexOf(word.toLowerCase()) !== -1;
  }
  function cronFieldOk(value, field) {
    return value.split(',').every(function (part) {
      var m = /^([^/]+)(?:\/(\d+))?$/.exec(part), range;
      if (!m || (m[2] !== undefined && +m[2] < 1)) return false;
      if (m[1] === '*') return true;
      range = m[1].split('-');
      return range.length <= 2 && range.every(function (w) { return cronValue(w, field); });
    });
  }
  /** Null for a schedule GitHub accepts, otherwise a sentence about what is wrong with it. */
  function cronProblem(expr) {
    var fields = expr.trim().split(/\s+/), i;
    if (expr.trim().charAt(0) === '@') {
      return 'The schedule ' + code(expr) + ' uses a shorthand that GitHub does not support. Write the five fields out, as in `17 3 * * *`.';
    }
    if (fields.length !== 5) {
      return 'The schedule ' + code(expr) + ' has ' + fields.length + (fields.length === 1 ? ' field' : ' fields') +
        ', and GitHub expects exactly five: minute, hour, day of month, month and day of week.';
    }
    for (i = 0; i < 5; i++) {
      if (!cronFieldOk(fields[i], CRON_FIELDS[i])) {
        return 'In the schedule ' + code(expr) + ', the ' + CRON_FIELDS[i].name + ' field ' + code(fields[i]) + ' is not a value GitHub accepts.';
      }
    }
    return null;
  }

  // -------------------------------------------------------------------- analyze

  function blankTrigger(event) {
    return { event: event, branches: null, branchesIgnore: null, tags: null, tagsIgnore: null, paths: null, pathsIgnore: null, types: null, cron: null, inputs: null };
  }

  function readPermissions(v) {
    var out;
    if (v === undefined) return null;
    if (typeof v === 'string') return v;
    if (!isMap(v)) return {};
    out = {};
    Object.keys(v).forEach(function (scope) { out[scope] = text(v[scope]); });
    return out;
  }

  /** Split "owner/repo/path@ref" into its parts. Local paths and Docker images have no owner. */
  function readUses(uses) {
    var at = uses.lastIndexOf('@'), ref = at === -1 ? '' : uses.slice(at + 1), target = at === -1 ? uses : uses.slice(0, at);
    if (/^\.\.?\//.test(uses)) return { local: true };
    if (/^docker:\/\//.test(uses)) return { docker: true };
    return {
      owner: target.split('/')[0].toLowerCase(), target: target, ref: ref,
      pinned: /^[0-9a-f]{40}$/i.test(ref),
      branch: BRANCH_NAMES.test(ref)
    };
  }

  /**
   * Read a parsed workflow.
   *   doc:     the value yaml.js returned
   *   lineOf:  optional, yaml.js's lineOf, so each problem can name its line
   * Returns { name, triggers, permissions, concurrency, jobs, problems }.
   */
  function analyze(doc, lineOf) {
    var problems = [];
    var out = { name: null, triggers: [], permissions: null, concurrency: false, jobs: [], problems: problems };

    /** The line a path starts on, falling back to the nearest enclosing key the parser recorded. */
    function line(path) {
      var found;
      if (typeof lineOf !== 'function' || path === undefined || path === null) return null;
      while (path !== '') {
        found = lineOf(path);
        if (typeof found === 'number') return found;
        path = path.replace(/(\.[^.\[\]]*|\[\d+\]|^[^.\[\]]+)$/, '');
      }
      return null;
    }
    function flag(level, problemCode, message, where, path) {
      problems.push({ level: level, code: problemCode, message: message, where: where || null, line: line(path), lesson: LESSON[problemCode] || FUNDAMENTALS });
    }

    if (!isMap(doc) || (!has(doc, 'on') && !has(doc, 'true') && !has(doc, 'jobs'))) {
      flag('error', 'not-a-workflow', 'This does not look like a workflow file. A workflow is a set of `key: value` lines with at least `on:`, which says what starts it, and `jobs:`, which says what it runs.', null, undefined);
      return out;
    }

    out.name = has(doc, 'name') ? text(doc.name) : null;
    out.permissions = readPermissions(get(doc, 'permissions'));
    out.concurrency = has(doc, 'concurrency');

    Object.keys(doc).forEach(function (key) {
      var guess;
      if (TOP_KEYS.indexOf(key) !== -1 || key === 'true') return;
      guess = nearest(key, TOP_KEYS);
      flag('warn', 'unknown-top-level-key', code(key) + ' is not a key GitHub knows at the top of a workflow' +
        (guess ? '. Did you mean ' + code(guess) + '? A key it does not know makes GitHub reject the file.'
          : ', and a key it does not know makes GitHub reject the file. The top-level keys are ' + names(TOP_KEYS) + '.'), key, key);
    });

    // ---- what starts it
    var on = has(doc, 'on') ? doc.on : get(doc, 'true');
    if (typeof on === 'string') out.triggers.push(blankTrigger(on));
    else if (Array.isArray(on)) on.forEach(function (event) { if (typeof event === 'string') out.triggers.push(blankTrigger(event)); });
    else if (isMap(on)) {
      Object.keys(on).forEach(function (event) {
        var t = blankTrigger(event), cfg = on[event];
        if (event === 'schedule') {
          t.cron = list(cfg).map(function (entry) { return isMap(entry) ? text(get(entry, 'cron')) : text(entry); }).filter(Boolean);
        } else if (isMap(cfg)) {
          t.branches = strings(get(cfg, 'branches'));
          t.branchesIgnore = strings(get(cfg, 'branches-ignore'));
          t.tags = strings(get(cfg, 'tags'));
          t.tagsIgnore = strings(get(cfg, 'tags-ignore'));
          t.paths = strings(get(cfg, 'paths'));
          t.pathsIgnore = strings(get(cfg, 'paths-ignore'));
          t.types = strings(get(cfg, 'types'));
          if (isMap(get(cfg, 'inputs'))) t.inputs = Object.keys(cfg.inputs);
        }
        out.triggers.push(t);
      });
    }
    var onPath = function (event) { return isMap(on) ? join('on', event) : 'on'; };
    if (!out.triggers.length) {
      flag('error', 'no-triggers', on === undefined
        ? 'There is no `on:` key, so nothing can ever start this workflow. Add the events it should react to, such as `on: push`.'
        : 'The `on:` key names no events, so nothing can ever start this workflow. Add the events it should react to, such as `on: push`.', 'on', on === undefined ? undefined : 'on');
    }
    out.triggers.forEach(function (t) {
      var guess, path = onPath(t.event);
      if (EVENTS.indexOf(t.event) === -1 && (guess = nearest(t.event, EVENTS))) {
        flag('error', 'unknown-event', 'GitHub has no event named ' + code(t.event) + '. The closest real one is ' + code(guess) + '.', 'on.' + t.event, path);
      }
      [['branches', t.branches, t.branchesIgnore], ['tags', t.tags, t.tagsIgnore], ['paths', t.paths, t.pathsIgnore]].forEach(function (pair) {
        if (pair[1] && pair[2]) {
          flag('error', 'filter-conflict', code(t.event) + ' uses both ' + code(pair[0]) + ' and ' + code(pair[0] + '-ignore') +
            '. GitHub accepts only one of the two for an event. To leave something out, keep ' + code(pair[0]) + ' and add a pattern that starts with `!`.',
            'on.' + t.event, join(path, pair[0] + '-ignore'));
        }
      });
      (t.cron || []).forEach(function (expr, i) {
        var wrong = cronProblem(expr);
        if (wrong) flag('error', 'bad-cron', wrong, 'on.schedule', item(path, i));
      });
      if (t.event === 'pull_request_target') {
        flag('warn', 'pull-request-target', '`pull_request_target` runs with the repository’s own token and secrets, even when the pull request comes from a fork. It exists for labelling and commenting. It stays safe only while the workflow never checks out or runs the pull request’s code.',
          'on.pull_request_target', path);
      }
    });
    var events = out.triggers.map(function (t) { return t.event; });
    var onPrTarget = events.indexOf('pull_request_target') !== -1;
    var onAnyPr = onPrTarget || events.indexOf('pull_request') !== -1;

    if (out.permissions === 'write-all') {
      flag('warn', 'write-all', '`permissions: write-all` gives the token write access to everything in the repository. List only the scopes this workflow needs, starting from `contents: read`.', 'permissions', 'permissions');
    }

    // ---- what it runs
    var jobsRaw = get(doc, 'jobs');
    if (!isMap(jobsRaw) || !Object.keys(jobsRaw).length) {
      flag('error', 'no-jobs', has(doc, 'jobs')
        ? 'The `jobs:` key is empty, so the workflow has nothing to run. Add at least one job with `runs-on:` and `steps:`.'
        : 'There is no `jobs:` key, so the workflow has nothing to run. Add at least one job with `runs-on:` and `steps:`.', 'jobs', has(doc, 'jobs') ? 'jobs' : undefined);
      return out;
    }
    var ids = Object.keys(jobsRaw);

    function checkCondition(value, where, path) {
      var result = evaluate(value, {});
      if (result.error) {
        flag('error', 'bad-condition', 'GitHub cannot read the condition ' + code(text(value).trim()) + '. ' + result.error, where, path);
      } else if (result.mixed) {
        flag('warn', 'condition-mixed', 'The condition ' + code(text(value).trim()) + ' mixes `${{ }}` with text outside it. GitHub fills in each `${{ }}` and then treats the whole result as text, and any text that is not empty counts as true, so this is likely to pass every time. Wrap the whole condition in one `${{ }}`, or leave the braces out.', where, path);
      }
    }

    function nearMisses(raw, knownKeys, kind, where, path, skip) {
      Object.keys(raw).forEach(function (key) {
        var guess;
        if (knownKeys.indexOf(key) !== -1 || key === skip) return;
        guess = nearest(key, knownKeys);
        if (guess) {
          flag('warn', 'unknown-key', code(key) + ' is not a key GitHub knows in a ' + kind + '. Did you mean ' + code(guess) + '? A key it does not know makes GitHub reject the file.', where, join(path, key));
        }
      });
    }

    function readStep(raw, index, job, jobPath) {
      var path = item(join(jobPath, 'steps'), index), where = 'job ' + job.id + ', step ' + (index + 1);
      var step = { index: index, id: null, name: null, uses: null, run: null, if: null, with: null, env: null };
      if (!isMap(raw)) {
        flag('error', 'step-empty', 'This list item is not a step. A step is a set of keys such as `name:`, `uses:` or `run:`.', where, path);
        return step;
      }
      step.id = has(raw, 'id') ? text(raw.id) : null;
      step.name = has(raw, 'name') ? text(raw.name) : null;
      step.uses = has(raw, 'uses') ? text(raw.uses) : null;
      step.run = has(raw, 'run') ? text(raw.run) : null;
      step.if = has(raw, 'if') && text(raw.if).trim() !== '' ? text(raw.if).trim() : null;
      step.with = isMap(get(raw, 'with')) ? raw.with : null;
      step.env = isMap(get(raw, 'env')) ? raw.env : null;

      if (step.uses !== null && step.run !== null) {
        flag('error', 'step-uses-and-run', 'This step has both `uses` and `run`. A step does one or the other, so split it into two steps.', where, path);
      } else if (step.uses === null && step.run === null) {
        flag('error', 'step-empty', 'This step has neither `uses` nor `run`, so it does nothing. Give it one of the two.', where, path);
      }
      nearMisses(raw, STEP_KEYS, 'step', where, path);
      if (step.if) checkCondition(step.if, where, join(path, 'if'));

      if (step.uses) checkUses(step, where, path);
      if (step.with) {
        Object.keys(step.with).forEach(function (key) {
          var value = step.with[key];
          if (/(^|-)version$/.test(key) && typeof value === 'number' && value % 1 !== 0) {
            flag('warn', 'version-as-number', code(key) + ' is written without quotes, so YAML reads it as the number ' + code(String(value)) +
              '. A version typed as `3.10` loses its final zero this way and asks for a different release. Put versions in quotes, as in `"3.10"`.', where, join(join(path, 'with'), key));
          }
        });
      }
      var script = step.run !== null ? step.run : (step.uses && /^actions\/github-script@/i.test(step.uses) && step.with ? text(get(step.with, 'script')) : '');
      if (script) checkScript(script, step.run !== null ? 'run' : 'with.script', where, path);
      return step;
    }

    function checkUses(step, where, path) {
      var u = readUses(step.uses), usesPath = join(path, 'uses'), withRef;
      if (u.local || u.docker) return;
      if (!u.ref) {
        flag('error', 'action-no-version', code(step.uses) + ' does not say which version to use. GitHub requires one after an `@`: a release tag or a commit id.', where, usesPath);
        return;
      }
      if (!FIRST_PARTY[u.owner] && !u.pinned) {
        flag('warn', 'unpinned-third-party', code(step.uses) + ' is code from outside GitHub’s own `actions` organization, chosen by ' +
          (u.branch ? 'a branch name. Whoever controls that repository changes what runs here with their next push.'
            : 'a tag. A tag can be moved to different code later, and this workflow would run it without anyone here noticing.') +
          ' Pin it to a full commit id, and let Dependabot propose the updates.', where, usesPath);
      } else if (FIRST_PARTY[u.owner] && u.branch) {
        flag('warn', 'branch-ref', code(step.uses) + ' follows a branch, so the code it runs changes whenever that branch does, and a breaking change arrives without warning. Use a release tag or a full commit id.', where, usesPath);
      }
      if (onPrTarget && /^actions\/checkout$/i.test(u.target) && step.with) {
        withRef = text(get(step.with, 'ref')) + ' ' + text(get(step.with, 'repository'));
        if (PR_HEAD.test(withRef) || /github\.event\.pull_request\.head\.repo/.test(withRef)) {
          flag('error', 'pull-request-target-checkout', 'This step checks out the pull request’s own code inside a `pull_request_target` run, which holds the repository’s token and secrets. Anything later that builds, installs or tests that code hands them to whoever opened the pull request. Use the `pull_request` event for work that runs a contributor’s code.',
            where, has(step.with, 'ref') ? join(join(path, 'with'), 'ref') : usesPath);
        }
      }
    }

    function checkScript(script, key, where, path) {
      var seen = {}, m, re = /\$\{\{([\s\S]*?)\}\}/g, untrusted = [];
      while ((m = re.exec(script))) {
        if (UNTRUSTED.test(m[1]) && !seen[m[0]]) { seen[m[0]] = true; untrusted.push(m[0].replace(/\s+/g, ' ')); }
      }
      if (untrusted.length) {
        flag('warn', 'script-injection', 'This step puts ' + names(untrusted) + ' straight into a script. That is text someone else typed, so text that contains shell commands would run them. This is called script injection. Pass the value in through `env:` and use the variable in quotes.', where, join(path, key));
      }
      if (script.split('\n').some(function (l) { return PRINTS.test(l) && /\$\{\{\s*secrets\./.test(l); })) {
        flag('warn', 'secret-in-run-echo', 'This step prints a secret to the log. GitHub masks the secrets it recognizes, but masking is a safety net with holes: a secret that is split, encoded or changed gets through. Remove the line.', where, join(path, key));
      }
    }

    ids.forEach(function (id) {
      var raw = isMap(jobsRaw[id]) ? jobsRaw[id] : {}, path = join('jobs', id), where = 'job ' + id;
      var runsOn = get(raw, 'runs-on'), env = get(raw, 'environment'), matrix = get(get(raw, 'strategy'), 'matrix'), typo;
      var job = {
        id: id,
        name: has(raw, 'name') ? text(raw.name) : id,
        runsOn: runsOn === undefined || runsOn === null ? null
          : Array.isArray(runsOn) ? runsOn.map(text)
            : isMap(runsOn) ? (has(runsOn, 'labels') ? list(runsOn.labels).map(text) : 'group: ' + text(get(runsOn, 'group')))
              : text(runsOn),
        needs: list(get(raw, 'needs')).map(text),
        if: has(raw, 'if') && text(raw.if).trim() !== '' ? text(raw.if).trim() : null,
        permissions: readPermissions(get(raw, 'permissions')),
        environment: isMap(env) ? text(get(env, 'name')) || null : env === undefined || env === null ? null : text(env),
        timeoutMinutes: has(raw, 'timeout-minutes') ? raw['timeout-minutes'] : null,
        concurrency: has(raw, 'concurrency'),
        uses: has(raw, 'uses') ? text(raw.uses) : null,
        matrix: isMap(matrix) ? matrix : null,
        steps: []
      };
      out.jobs.push(job);

      if (job.runsOn === null && job.uses === null) {
        typo = Object.keys(raw).filter(function (key) { return JOB_KEYS.indexOf(key) === -1 && nearest(key, JOB_KEYS) === 'runs-on'; })[0];
        flag('error', 'job-no-runner', 'Job ' + code(id) + ' has no `runs-on`, so GitHub does not know what machine to run it on. Add a line such as `runs-on: ubuntu-latest`.' +
          (typo ? ' It has ' + code(typo) + ', which looks like a misspelling of `runs-on`.' : ''), where, typo ? join(path, typo) : path);
      }
      nearMisses(raw, JOB_KEYS, 'job', where, path, typo);
      if (job.if) checkCondition(job.if, where, join(path, 'if'));
      if (job.permissions === 'write-all') {
        flag('warn', 'write-all', 'Job ' + code(id) + ' asks for `permissions: write-all`, which is write access to everything in the repository. List only the scopes this job needs.', where, join(path, 'permissions'));
      }
      if (job.uses === null) {
        if (!Array.isArray(get(raw, 'steps')) || !raw.steps.length) {
          if (job.runsOn !== null) flag('error', 'job-no-steps', 'Job ' + code(id) + ' has no `steps`, so it has nothing to do. Add at least one step with `run:` or `uses:`.', where, has(raw, 'steps') ? join(path, 'steps') : path);
        } else {
          job.steps = raw.steps.map(function (step, i) { return readStep(step, i, job, path); });
        }
      }
      if (job.matrix) {
        Object.keys(job.matrix).forEach(function (key) {
          var bare = list(job.matrix[key]).filter(function (v) { return typeof v === 'number' && v % 1 !== 0; });
          if (bare.length && /version|^(python|node|go|ruby|java|php|dotnet)$/i.test(key)) {
            flag('warn', 'version-as-number', 'The matrix value ' + code(key) + ' holds versions written without quotes, so YAML reads them as numbers such as ' + code(String(bare[0])) +
              '. A version typed as `3.10` loses its final zero this way and asks for a different release. Put versions in quotes, as in `"3.10"`.', where, join(join(join(path, 'strategy'), 'matrix'), key));
          }
        });
      }
      if (onAnyPr && /(^|,)self-hosted(,|$)/i.test(list(job.runsOn).join(','))) {
        flag('warn', 'self-hosted-on-pr', 'Job ' + code(id) + ' runs on a self-hosted runner in a workflow that pull requests can start. On a public repository, a pull request from a fork could then run its code on your own machine. Use GitHub-hosted runners for pull requests, or require approval for outside contributors.', where, join(path, 'runs-on'));
      }
    });

    // ---- how the jobs depend on each other
    out.jobs.forEach(function (job) {
      job.needs.forEach(function (need) {
        if (ids.indexOf(need) === -1) {
          flag('error', 'needs-unknown', 'Job ' + code(job.id) + ' waits for ' + code(need) + ', but no job has that id. The ids in this file are ' + names(ids) + '.', 'job ' + job.id, join(join('jobs', job.id), 'needs'));
        }
      });
    });
    var loop = findLoop(out.jobs);
    if (loop) {
      flag('error', 'needs-cycle', 'The jobs ' + names(loop) + ' wait for each other in a loop, so none of them could ever start. Remove one of the `needs` links.', 'job ' + loop[0], join(join('jobs', loop[0]), 'needs'));
    }

    // ---- the token, the clock and the queue
    var open = out.jobs.filter(function (job) { return job.permissions === null; });
    if (out.permissions === null && open.length) {
      flag('warn', 'no-permissions', (open.length === out.jobs.length
        ? 'Nothing here says what the workflow’s token may do, so it gets the repository’s default, which on many repositories includes write access.'
        : (open.length === 1 ? 'Job ' : 'The jobs ') + names(open.map(function (j) { return j.id; })) + (open.length === 1 ? ' does' : ' do') +
          ' not say what the token may do, so it gets the repository’s default, which on many repositories includes write access.') +
        ' Add `permissions:` at the top with `contents: read`, then give each job only what it needs.', 'permissions', undefined);
    }
    var untimed = out.jobs.filter(function (job) { return job.uses === null && job.runsOn !== null && job.timeoutMinutes === null; });
    if (untimed.length) {
      flag('note', 'no-timeout', (untimed.length === 1 ? 'Job ' : 'The jobs ') + names(untimed.map(function (j) { return j.id; })) + (untimed.length === 1 ? ' sets' : ' set') +
        ' no `timeout-minutes`. A job that hangs keeps running until GitHub’s limit of six hours, using minutes the whole time. Ten to thirty minutes suits most jobs.',
        'job ' + untimed[0].id, join('jobs', untimed[0].id));
    }
    if (!out.concurrency) {
      out.jobs.filter(function (job) {
        return !job.concurrency && (job.environment || job.steps.some(function (s) { return s.uses && /^actions\/deploy-pages@/i.test(s.uses); }));
      }).forEach(function (job) {
        flag('note', 'no-concurrency', 'Job ' + code(job.id) + ' deploys' + (job.environment ? ' to the ' + code(job.environment) + ' environment' : '') +
          ', and nothing stops two runs from doing that at the same moment. Add a `concurrency:` group so one deployment finishes before the next begins.', 'job ' + job.id, join('jobs', job.id));
      });
    }
    return out;
  }

  /** The ids of jobs that wait for each other in a circle, or null. */
  function findLoop(jobs) {
    var byId = Object.create(null), state = Object.create(null), found = null;
    jobs.forEach(function (job) { byId[job.id] = job; });
    function visit(id, trail) {
      if (found || !byId[id] || state[id] === 'done') return;
      if (state[id] === 'open') { found = trail.slice(trail.indexOf(id)); return; }
      state[id] = 'open';
      byId[id].needs.forEach(function (need) { visit(need, trail.concat(id)); });
      state[id] = 'done';
    }
    jobs.forEach(function (job) { visit(job.id, []); });
    return found;
  }

  // ------------------------------------------------------------------- simulate

  /**
   * Which jobs would run.
   *   scenario: { event, ref, fork, baseRef, headRef, repository, defaultBranch, changedPaths }
   *             ref is a full name such as refs/heads/main or refs/tags/v1.0.0;
   *             changedPaths is a list of file paths, or null when unknown.
   * Returns { triggered, why, jobs: [{ id, status: 'runs' | 'skipped' | 'unknown', why }], notes }.
   * It assumes every job that runs succeeds.
   */
  function simulate(analysis, scenario) {
    scenario = scenario || {};
    var event = text(scenario.event) || 'push';
    var repository = text(scenario.repository) || 'owner/project';
    var main = text(scenario.defaultBranch) || 'main';
    var base = text(scenario.baseRef) || main, head = text(scenario.headRef) || 'feature';
    var ref = text(scenario.ref) || 'refs/heads/' + main;
    var isPr = event === 'pull_request' || event === 'pull_request_target';
    var fork = isPr && !!scenario.fork;
    var notes = [], trigger = null, why, i;

    function stopped(reason) {
      return { triggered: false, why: reason, notes: notes,
        jobs: analysis.jobs.map(function (job) { return { id: job.id, status: 'skipped', why: 'The workflow does not start.' }; }) };
    }
    for (i = 0; i < analysis.triggers.length; i++) if (analysis.triggers[i].event === event) trigger = analysis.triggers[i];
    if (!trigger) return stopped('Nothing in this workflow listens for ' + code(event) + '.');

    if (event === 'schedule' && ref !== 'refs/heads/' + main) {
      ref = 'refs/heads/' + main;
      notes.push('A scheduled run always uses the workflow file on the default branch, so the choice of branch makes no difference.');
    }
    var isTag = /^refs\/tags\//.test(ref), short = ref.replace(/^refs\/(heads|tags)\//, '');
    var hasBranch = !!(trigger.branches || trigger.branchesIgnore), hasTag = !!(trigger.tags || trigger.tagsIgnore);

    if (isPr) {
      if (trigger.types && trigger.types.indexOf('opened') === -1 && trigger.types.indexOf('synchronize') === -1) {
        return stopped('This trigger reacts only to the activity ' + names(trigger.types) + '. Opening or updating a pull request is not one of them.');
      }
      if (hasBranch && !refAllowed(base, trigger.branches, trigger.branchesIgnore)) {
        return stopped('The pull request targets ' + code(base) + ', which the trigger’s branch filter leaves out.');
      }
      why = 'A pull request into ' + code(base) + ' starts it.';
    } else if (event === 'push') {
      if (isTag) {
        if (!hasTag && hasBranch) return stopped('The `push` trigger filters by branch only, so pushing a tag does not start it.');
        if (hasTag && !refAllowed(short, trigger.tags, trigger.tagsIgnore)) return stopped('The tag ' + code(short) + ' is left out by the trigger’s tag filter.');
        why = 'Pushing the tag ' + code(short) + ' starts it.';
      } else {
        if (!hasBranch && hasTag) return stopped('The `push` trigger filters by tag only, so pushing to a branch does not start it.');
        if (hasBranch && !refAllowed(short, trigger.branches, trigger.branchesIgnore)) return stopped('The branch ' + code(short) + ' is left out by the trigger’s branch filter.');
        why = 'A push to the branch ' + code(short) + ' starts it.';
      }
    } else if (event === 'workflow_dispatch') {
      why = 'Someone with write access starts it by hand, on ' + code(short) + '.';
    } else if (event === 'schedule') {
      why = 'The schedule starts it, on the default branch.';
    } else {
      why = 'The ' + code(event) + ' event starts it.';
    }

    // Path filters apply to pushes of branches and to pull requests, never to tags.
    if ((trigger.paths || trigger.pathsIgnore) && !isTag) {
      if (!Array.isArray(scenario.changedPaths)) {
        notes.push('This trigger also looks at which files changed. The reader cannot see a real change, so it assumes a file that matches.');
      } else if (trigger.paths && !scenario.changedPaths.some(function (p) { return matchOrdered(p, trigger.paths); })) {
        return stopped('None of the changed files match the trigger’s `paths` filter.');
      } else if (trigger.pathsIgnore && scenario.changedPaths.every(function (p) { return trigger.pathsIgnore.some(function (g) { return globMatch(g, p); }); })) {
        return stopped('Every changed file is covered by the trigger’s `paths-ignore` filter.');
      }
    }

    if (event === 'pull_request' && fork) {
      notes.push('By default, a pull request from a fork gets a read-only token and no secrets, whatever `permissions` asks for. On a public repository it may also wait for a maintainer to approve the run.');
    }
    if (event === 'pull_request_target') {
      notes.push('A `pull_request_target` run uses the workflow file from the base branch and gets the repository’s own token and secrets, even when the pull request comes from a fork.');
    }

    var contextRef = event === 'pull_request' ? 'refs/pull/1/merge' : event === 'pull_request_target' ? 'refs/heads/' + base : ref;
    var owner = repository.split('/')[0], project = repository.split('/').slice(1).join('/');
    var context = {
      github: {
        event_name: event,
        ref: contextRef,
        ref_name: contextRef.replace(/^refs\/(heads|tags|pull)\//, ''),
        ref_type: !isPr && isTag ? 'tag' : 'branch',
        head_ref: isPr ? head : '',
        base_ref: isPr ? base : '',
        repository: repository,
        repository_owner: owner,
        event: {
          pull_request: !isPr ? null : {
            number: 1,
            draft: false,
            head: { ref: head, repo: { full_name: fork ? 'someone-else/' + project : repository, fork: fork } },
            base: { ref: base, repo: { full_name: repository, fork: false } }
          }
        }
      }
    };

    var byId = Object.create(null), results = Object.create(null);
    analysis.jobs.forEach(function (job) { byId[job.id] = job; });

    function settle(job, trail) {
      var deps, skipped, unsure, missing, cond, status, waits;
      if (results[job.id]) return results[job.id];
      if (trail.indexOf(job.id) !== -1) return { id: job.id, status: 'unknown', why: 'It is part of a `needs` loop.' };
      deps = job.needs.map(function (need) { return byId[need] ? settle(byId[need], trail.concat(job.id)) : { id: need, status: 'missing' }; });
      missing = deps.filter(function (d) { return d.status === 'missing'; });
      skipped = deps.filter(function (d) { return d.status === 'skipped'; });
      unsure = deps.filter(function (d) { return d.status === 'unknown'; });
      waits = function (group, tail) { return 'It waits for ' + names(group.map(function (d) { return d.id; })) + ', ' + tail; };
      function done(state, reason) { return (results[job.id] = { id: job.id, status: state, why: reason }); }

      if (missing.length) return done('unknown', waits(missing, 'which no job in this file is called.'));
      status = { success: skipped.length ? false : unsure.length ? undefined : true, failure: false, cancelled: false };
      cond = job.if ? evaluate(job.if, context, status) : null;

      // Without always(), failure() or the like, a job quietly requires everything it waits for to have succeeded.
      if (!cond || !cond.usesStatus) {
        if (skipped.length) return done('skipped', waits(skipped, 'which is skipped, and a job is skipped along with the job it waits for.'));
        if (!cond) return unsure.length ? done('unknown', waits(unsure, 'and the reader cannot tell whether that runs.')) : done('runs', deps.length ? waits(deps, 'which runs.') : 'It has no condition.');
      }
      if (cond.unknown) return done('unknown', 'The reader cannot tell: ' + cond.reason + '.');
      if (!truthy(cond.value)) {
        return done('skipped', /\bfailure\s*\(/i.test(job.if) ? 'Its condition asks for an earlier failure, and this walk-through assumes every job that runs succeeds.' : 'Its condition is false for this event.');
      }
      if (unsure.length && !cond.usesStatus) return done('unknown', waits(unsure, 'and the reader cannot tell whether that runs.'));
      return done('runs', 'Its condition is true for this event.');
    }

    return { triggered: true, why: why, notes: notes, jobs: analysis.jobs.map(function (job) { return settle(job, []); }) };
  }

  return { analyze: analyze, simulate: simulate, evaluate: evaluate, globMatch: globMatch, cronProblem: cronProblem };
});
