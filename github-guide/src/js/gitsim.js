/*
 * gitsim.js: a small, honest simulation of Git for the practice lab.
 *
 * It models the parts of Git that shape your mental model: commits as
 * snapshots, branches as movable pointers, the staging area, three-way
 * merges with real line-level conflict detection, rebase, reset, revert,
 * stash, the reflog, and a remote you can fetch from and push to.
 *
 * It is not Git. Output is simplified and many flags are missing. Where the
 * simulation differs from real Git in a way that matters, the lab says so.
 *
 * No DOM access here, so the same file runs in the browser and under Node
 * (see tests/gitsim.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.GG = root.GG || {}).gitsim = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  function GitError(message) {
    this.message = message;
  }

  function fnv(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /** A 40-character hex id derived from content, like a commit hash. */
  function sha40(str) {
    var out = '';
    for (var i = 0; i < 5; i++) {
      out += ('00000000' + fnv(str + '#' + i, 2166136261 + i * 2654435761).toString(16)).slice(-8);
    }
    return out;
  }

  function clone(obj) {
    return Object.assign({}, obj);
  }

  function union() {
    var seen = {};
    for (var i = 0; i < arguments.length; i++) {
      for (var k in arguments[i]) seen[k] = true;
    }
    return Object.keys(seen).sort();
  }

  function treesEqual(a, b) {
    var keys = union(a, b);
    for (var i = 0; i < keys.length; i++) if (a[keys[i]] !== b[keys[i]]) return false;
    return true;
  }

  function toLines(text) {
    if (text === undefined || text === '') return [];
    var lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function fromLines(lines) {
    return lines.length ? lines.join('\n') + '\n' : '';
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  // ------------------------------------------------------------------
  // Line diff and three-way merge
  // ------------------------------------------------------------------

  /** Longest common subsequence. Returns match[i] = index in b, or -1. */
  function lcsMatch(a, b) {
    var n = a.length, m = b.length, i, j;
    var table = [];
    for (i = 0; i <= n; i++) {
      table.push(new Array(m + 1).fill(0));
    }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    var match = new Array(n).fill(-1);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { match[i] = j; i++; j++; }
      else if (table[i + 1][j] >= table[i][j + 1]) i++;
      else j++;
    }
    return match;
  }

  /** A line-by-line diff as [{op: ' ' | '+' | '-', text}]. */
  function diffLines(a, b) {
    var match = lcsMatch(a, b), out = [], j = 0;
    for (var i = 0; i < a.length; i++) {
      if (match[i] === -1) { out.push({ op: '-', text: a[i] }); continue; }
      while (j < match[i]) out.push({ op: '+', text: b[j++] });
      out.push({ op: ' ', text: a[i] });
      j++;
    }
    while (j < b.length) out.push({ op: '+', text: b[j++] });
    return out;
  }

  function diffStat(aText, bText) {
    var d = diffLines(toLines(aText), toLines(bText)), plus = 0, minus = 0;
    d.forEach(function (row) { if (row.op === '+') plus++; else if (row.op === '-') minus++; });
    return { plus: plus, minus: minus };
  }

  function sameLines(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /**
   * Three-way merge of line arrays. A base line matched on both sides is a
   * sync point. Between sync points, a region changed on one side only is
   * taken from that side; changed differently on both is a conflict. This is
   * why Git conflicts on overlapping or adjacent lines but not distant ones.
   */
  function diff3(base, ours, theirs, labels) {
    var mo = lcsMatch(base, ours), mt = lcsMatch(base, theirs);
    var out = [], conflict = false;
    var ib = 0, io = 0, it = 0;

    function emitChunk(bEnd, oEnd, tEnd) {
      var b = base.slice(ib, bEnd), o = ours.slice(io, oEnd), t = theirs.slice(it, tEnd);
      if (sameLines(o, t)) out.push.apply(out, o);
      else if (sameLines(b, o)) out.push.apply(out, t);
      else if (sameLines(b, t)) out.push.apply(out, o);
      else {
        conflict = true;
        out.push('<<<<<<< ' + labels.ours);
        out.push.apply(out, o);
        out.push('=======');
        out.push.apply(out, t);
        out.push('>>>>>>> ' + labels.theirs);
      }
    }

    while (ib < base.length) {
      if (mo[ib] === io && mt[ib] === it) {
        out.push(base[ib]);
        ib++; io++; it++;
        continue;
      }
      var j = ib;
      while (j < base.length && !(mo[j] !== -1 && mt[j] !== -1 && mo[j] >= io && mt[j] >= it)) j++;
      if (j >= base.length) break;
      emitChunk(j, mo[j], mt[j]);
      ib = j; io = mo[j]; it = mt[j];
    }
    if (ib < base.length || io < ours.length || it < theirs.length) {
      emitChunk(base.length, ours.length, theirs.length);
    }
    return { lines: out, conflict: conflict };
  }

  // ------------------------------------------------------------------
  // Command-line parsing
  // ------------------------------------------------------------------

  /** Split a line into words and operators, honoring quotes. */
  function tokenize(line) {
    var tokens = [], cur = '', has = false, quote = null, i = 0;
    function push() {
      if (has) tokens.push({ t: 'word', v: cur });
      cur = ''; has = false;
    }
    while (i < line.length) {
      var ch = line[i];
      if (quote) {
        if (ch === '\\' && quote === '"' && i + 1 < line.length && '"\\$`'.indexOf(line[i + 1]) !== -1) {
          cur += line[i + 1]; i += 2; continue;
        }
        if (ch === quote) { quote = null; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; has = true; i++; continue; }
      if (ch === ' ') { push(); i++; continue; }
      if (ch === '#' && !has) break; // comment
      if (ch === '&' && line[i + 1] === '&') { push(); tokens.push({ t: 'op', v: '&&' }); i += 2; continue; }
      if (ch === ';') { push(); tokens.push({ t: 'op', v: '&&' }); i++; continue; }
      if (ch === '>') {
        push();
        if (line[i + 1] === '>') { tokens.push({ t: 'op', v: '>>' }); i += 2; }
        else { tokens.push({ t: 'op', v: '>' }); i++; }
        continue;
      }
      cur += ch; has = true; i++;
    }
    if (quote) throw new GitError('unterminated quote: add a closing ' + quote);
    push();
    return tokens;
  }

  /** Separate flags from positional arguments. */
  function parseArgs(args, valueFlags) {
    var flags = {}, pos = [], takesValue = {};
    (valueFlags || []).forEach(function (f) { takesValue[f] = true; });
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { pos = pos.concat(args.slice(i + 1)); flags['--'] = true; break; }
      if (/^-\d+$/.test(a)) { flags['-n'] = a.slice(1); continue; }
      if (a.indexOf('--') === 0) {
        var eq = a.indexOf('=');
        if (eq !== -1) { flags[a.slice(0, eq)] = a.slice(eq + 1); continue; }
        if (takesValue[a] && i + 1 < args.length) { flags[a] = args[++i]; continue; }
        flags[a] = true; continue;
      }
      if (a[0] === '-' && a.length > 1) {
        if (takesValue[a]) { flags[a] = i + 1 < args.length ? args[++i] : ''; continue; }
        if (a.length > 2) {
          // combined short flags, e.g. -am "message"
          for (var k = 1; k < a.length; k++) {
            var f = '-' + a[k];
            if (takesValue[f]) {
              var rest = a.slice(k + 1);
              flags[f] = rest || (i + 1 < args.length ? args[++i] : '');
              break;
            }
            flags[f] = true;
          }
          continue;
        }
        flags[a] = true; continue;
      }
      pos.push(a);
    }
    return { flags: flags, pos: pos };
  }

  function normPath(p) {
    return p.replace(/^\.\//, '').replace(/\/+$/, '');
  }

  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fakeDate(seq) {
    var d = new Date(Date.UTC(2026, 10, 2, 15, 0, 0) + seq * 7 * 60000);
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return DAY[d.getUTCDay()] + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' +
      two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':00 ' + d.getUTCFullYear() + ' +0000';
  }

  // ------------------------------------------------------------------
  // The simulator
  // ------------------------------------------------------------------

  function Sim() {
    this.initialized = false;
    this.commits = {};      // sha -> {sha, parents, tree, message, author, seq}
    this.seq = 0;
    this.branches = {};     // local branch name -> sha
    this.tags = {};         // tag name -> {sha, annotated, message}
    this.head = { type: 'branch', name: 'main' };
    this.index = {};        // the staging area: path -> content
    this.work = {};         // the working tree: path -> content
    this.conflicted = {};   // path -> true while unmerged
    this.pending = null;    // an operation waiting on you: merge, rebase, cherry-pick, revert
    this.stashes = [];
    this.reflog = [];       // newest first
    this.remote = null;     // the simulated GitHub side: {branches, prs, protected}
    this.tracking = {};     // remote-tracking refs: 'origin/main' -> sha
    this.upstream = {};     // local branch -> 'origin/branch'
    this.config = { 'user.name': 'You', 'user.email': 'you@example.com' };
    this.previousBranch = null;
    this.ran = [];          // every command line run by the learner
  }

  Sim.prototype.author = function () {
    return this.config['user.name'] + ' <' + this.config['user.email'] + '>';
  };

  Sim.prototype.newCommit = function (parents, tree, message, author) {
    var seq = ++this.seq;
    var sha = sha40(parents.join(',') + '|' + message + '|' + JSON.stringify(tree, Object.keys(tree).sort()) + '|' + seq);
    while (this.commits[sha]) sha = sha40(sha);
    this.commits[sha] = {
      sha: sha, parents: parents.slice(), tree: clone(tree), message: message,
      author: author || this.author(), seq: seq
    };
    return sha;
  };

  Sim.prototype.tree = function (sha) { return sha ? this.commits[sha].tree : {}; };
  Sim.prototype.short = function (sha) { return sha.slice(0, 7); };
  Sim.prototype.subject = function (sha) { return this.commits[sha].message.split('\n')[0]; };
  Sim.prototype.currentBranch = function () { return this.head.type === 'branch' ? this.head.name : null; };

  Sim.prototype.headSha = function () {
    if (this.head.type === 'branch') return this.branches[this.head.name] || null;
    return this.head.sha;
  };

  /** Move HEAD (and the branch it is on) to a commit, recording it in the reflog. */
  Sim.prototype.moveHead = function (sha, why) {
    if (this.head.type === 'branch') this.branches[this.head.name] = sha;
    else this.head.sha = sha;
    this.reflog.unshift({ sha: sha, msg: why });
  };

  Sim.prototype.ancestors = function (sha) {
    var seen = {}, stack = sha ? [sha] : [];
    while (stack.length) {
      var s = stack.pop();
      if (seen[s]) continue;
      seen[s] = true;
      var parents = this.commits[s].parents;
      for (var i = 0; i < parents.length; i++) stack.push(parents[i]);
    }
    return seen;
  };

  Sim.prototype.isAncestor = function (a, b) {
    return !!a && !!b && !!this.ancestors(b)[a];
  };

  /** The most recent commit both sides share. */
  Sim.prototype.mergeBase = function (a, b) {
    var inA = this.ancestors(a), best = null, self = this;
    Object.keys(this.ancestors(b)).forEach(function (s) {
      if (inA[s] && (!best || self.commits[s].seq > self.commits[best].seq)) best = s;
    });
    return best;
  };

  Sim.prototype.resolve = function (rev) {
    var m = /^(.*?)((?:[~^]\d*)*)$/.exec(rev);
    var base = m[1], suffix = m[2], sha = null;
    var rl = /^(?:HEAD)?@\{(\d+)\}$/.exec(base);
    if (base === 'HEAD' || base === '@') sha = this.headSha();
    else if (rl) sha = (this.reflog[+rl[1]] || {}).sha;
    else if (this.branches[base]) sha = this.branches[base];
    else if (this.tags[base]) sha = this.tags[base].sha;
    else if (this.tracking[base]) sha = this.tracking[base];
    else if (base.indexOf('server/') === 0 && this.remote) sha = this.remote.branches[base.slice(7)];
    else if (/^[0-9a-f]{4,40}$/.test(base)) {
      var hits = Object.keys(this.commits).filter(function (s) { return s.indexOf(base) === 0; });
      if (hits.length === 1) sha = hits[0];
    }
    if (!sha) throw new GitError("fatal: ambiguous argument '" + rev + "': unknown revision or path not in the working tree.");
    var re = /([~^])(\d*)/g, s;
    while ((s = re.exec(suffix))) {
      var n = s[2] === '' ? 1 : +s[2];
      if (s[1] === '~') {
        for (var i = 0; i < n; i++) {
          sha = this.commits[sha].parents[0];
          if (!sha) throw new GitError("fatal: ambiguous argument '" + rev + "': unknown revision or path not in the working tree.");
        }
      } else if (n > 0) {
        sha = this.commits[sha].parents[n - 1];
        if (!sha) throw new GitError("fatal: ambiguous argument '" + rev + "': unknown revision or path not in the working tree.");
      }
    }
    return sha;
  };

  Sim.prototype.tryResolve = function (rev) {
    try { return this.resolve(rev); } catch (e) { return null; }
  };

  /** Files in the working tree that Git is not tracking. */
  Sim.prototype.untrackedFiles = function () {
    var out = {};
    for (var p in this.work) if (!(p in this.index) && !this.conflicted[p]) out[p] = this.work[p];
    return out;
  };

  /** Structured status, used by `git status`, the lab UI and the checks. */
  Sim.prototype.status = function () {
    var H = this.tree(this.headSha()), I = this.index, W = this.work, self = this;
    var staged = [], unstaged = [], untracked = [];
    union(H, I).forEach(function (p) {
      if (self.conflicted[p]) return;
      if (!(p in H)) staged.push({ path: p, kind: 'new file' });
      else if (!(p in I)) staged.push({ path: p, kind: 'deleted' });
      else if (H[p] !== I[p]) staged.push({ path: p, kind: 'modified' });
    });
    Object.keys(I).sort().forEach(function (p) {
      if (self.conflicted[p]) return;
      if (!(p in W)) unstaged.push({ path: p, kind: 'deleted' });
      else if (W[p] !== I[p]) unstaged.push({ path: p, kind: 'modified' });
    });
    Object.keys(W).sort().forEach(function (p) {
      if (!(p in I) && !self.conflicted[p]) untracked.push(p);
    });
    var branch = this.currentBranch(), ahead = 0, behind = 0, up = branch && this.upstream[branch];
    if (up && this.tracking[up] && this.headSha()) {
      var mine = this.ancestors(this.headSha()), theirs = this.ancestors(this.tracking[up]);
      ahead = Object.keys(mine).filter(function (s) { return !theirs[s]; }).length;
      behind = Object.keys(theirs).filter(function (s) { return !mine[s]; }).length;
    }
    return {
      branch: branch, detached: this.head.type === 'detached', head: this.headSha(),
      staged: staged, unstaged: unstaged, untracked: untracked,
      conflicted: Object.keys(this.conflicted).sort(),
      upstream: up && this.tracking[up] ? up : null, ahead: ahead, behind: behind,
      pending: this.pending ? this.pending.kind : null,
      clean: !staged.length && !unstaged.length && !untracked.length && !Object.keys(this.conflicted).length
    };
  };

  Sim.prototype.hasTrackedChanges = function () {
    var st = this.status();
    return st.staged.length > 0 || st.unstaged.length > 0;
  };

  /** Three-way merge of whole trees. */
  Sim.prototype.mergeTrees = function (base, ours, theirs, labels) {
    var tree = {}, conflicts = [], auto = [];
    union(base, ours, theirs).forEach(function (p) {
      var b = base[p], o = ours[p], t = theirs[p];
      if (o === t) { if (o !== undefined) tree[p] = o; return; }
      if (b === o) { if (t !== undefined) tree[p] = t; return; }
      if (b === t) { if (o !== undefined) tree[p] = o; return; }
      if (o === undefined || t === undefined) {
        tree[p] = o !== undefined ? o : t;
        conflicts.push({ path: p, type: 'modify/delete' });
        return;
      }
      var r = diff3(toLines(b), toLines(o), toLines(t), labels);
      tree[p] = fromLines(r.lines);
      if (r.conflict) conflicts.push({ path: p, type: b === undefined ? 'add/add' : 'content' });
      else auto.push(p);
    });
    return { tree: tree, conflicts: conflicts, auto: auto };
  };

  /** Put a merge result with conflicts into the working tree and index. */
  Sim.prototype.enterConflict = function (result, oursTree) {
    var untracked = this.untrackedFiles(), self = this;
    this.work = Object.assign({}, untracked, result.tree);
    this.index = clone(result.tree);
    this.conflicted = {};
    result.conflicts.forEach(function (c) {
      self.conflicted[c.path] = true;
      if (oursTree[c.path] !== undefined) self.index[c.path] = oursTree[c.path];
      else delete self.index[c.path];
    });
  };

  Sim.prototype.setCleanTree = function (tree) {
    var untracked = this.untrackedFiles();
    this.index = clone(tree);
    this.work = Object.assign({}, untracked, tree);
    this.conflicted = {};
  };

  Sim.prototype.conflictReport = function (result) {
    var lines = [];
    result.auto.concat(result.conflicts.map(function (c) { return c.path; })).sort().forEach(function (p) {
      lines.push('Auto-merging ' + p);
    });
    result.conflicts.forEach(function (c) {
      lines.push('CONFLICT (' + c.type + '): Merge conflict in ' + c.path);
    });
    return lines;
  };

  Sim.prototype.changeSummary = function (oldTree, newTree) {
    var files = 0, plus = 0, minus = 0;
    union(oldTree, newTree).forEach(function (p) {
      if (oldTree[p] === newTree[p]) return;
      files++;
      var st = diffStat(oldTree[p], newTree[p]);
      plus += st.plus; minus += st.minus;
    });
    var parts = [' ' + plural(files, 'file') + ' changed'];
    if (plus) parts.push(plural(plus, 'insertion') + '(+)');
    if (minus) parts.push(plural(minus, 'deletion') + '(-)');
    return parts.join(', ');
  };

  Sim.prototype.decorations = function (sha) {
    var d = [], self = this, branch = this.currentBranch();
    if (this.headSha() === sha) d.push(branch ? 'HEAD -> ' + branch : 'HEAD');
    Object.keys(this.branches).sort().forEach(function (b) {
      if (self.branches[b] === sha && b !== branch) d.push(b);
    });
    Object.keys(this.tracking).sort().forEach(function (r) {
      if (self.tracking[r] === sha) d.push(r);
    });
    Object.keys(this.tags).sort().forEach(function (t) {
      if (self.tags[t].sha === sha) d.push('tag: ' + t);
    });
    return d.length ? ' (' + d.join(', ') + ')' : '';
  };

  /** Every ref that keeps commits alive. */
  Sim.prototype.allRefShas = function () {
    var out = [], self = this;
    Object.keys(this.branches).forEach(function (b) { out.push(self.branches[b]); });
    Object.keys(this.tracking).forEach(function (r) { out.push(self.tracking[r]); });
    Object.keys(this.tags).forEach(function (t) { out.push(self.tags[t].sha); });
    if (this.headSha()) out.push(this.headSha());
    return out;
  };

  Sim.prototype.reachableFromRefs = function () {
    var seen = {}, self = this;
    this.allRefShas().forEach(function (s) { Object.assign(seen, self.ancestors(s)); });
    return seen;
  };

  // ------------------------------------------------------------------
  // Running commands
  // ------------------------------------------------------------------

  /** Run one line. Returns {out: string, err: boolean, clear: boolean}. */
  Sim.prototype.run = function (line, opts) {
    var silent = opts && opts.silent;
    line = String(line).trim();
    if (!line) return { out: '', err: false };
    if (!silent) this.ran.push(line);
    var tokens;
    try { tokens = tokenize(line); } catch (e) { return { out: e.message, err: true }; }

    // split on && into simple commands
    var groups = [[]];
    tokens.forEach(function (tok) {
      if (tok.t === 'op' && tok.v === '&&') groups.push([]);
      else groups[groups.length - 1].push(tok);
    });

    var outputs = [], err = false, clear = false;
    for (var g = 0; g < groups.length; g++) {
      if (!groups[g].length) continue;
      var res;
      try { res = this.runSimple(groups[g]); }
      catch (e) {
        if (e instanceof GitError) res = { out: e.message, err: true };
        else throw e;
      }
      if (res.clear) clear = true;
      if (res.out) outputs.push(res.out);
      if (res.err) { err = true; break; }
    }
    return { out: outputs.join('\n'), err: err, clear: clear };
  };

  Sim.prototype.runSimple = function (tokens) {
    // redirection
    var redirect = null, words = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].t === 'op') {
        if (!tokens[i + 1] || tokens[i + 1].t !== 'word') throw new GitError('syntax error: expected a file name after ' + tokens[i].v);
        redirect = { mode: tokens[i].v, path: normPath(tokens[i + 1].v) };
        i++;
      } else words.push(tokens[i].v);
    }
    var cmd = words[0], args = words.slice(1), out;
    if (cmd === 'git') out = this.git(args);
    else if (cmd === 'gh') out = this.gh(args);
    else if (cmd && cmd[0] === '!') out = this.directive(cmd.slice(1), args);
    else out = this.shell(cmd, args);

    if (redirect) {
      var text = typeof out === 'string' ? out : (out && out.out) || '';
      if (text && text[text.length - 1] !== '\n') text += '\n';
      if (redirect.mode === '>>') this.work[redirect.path] = (this.work[redirect.path] || '') + text;
      else this.work[redirect.path] = text;
      return { out: '', err: false };
    }
    if (typeof out === 'string') return { out: out, err: false };
    return out || { out: '', err: false };
  };

  // ------------------------------------------------------------------
  // Shell built-ins
  // ------------------------------------------------------------------

  Sim.prototype.shell = function (cmd, args) {
    var self = this, p;
    switch (cmd) {
      case 'echo':
        return args.join(' ');
      case 'printf':
        return (args[0] || '').replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\n$/, '');
      case 'cat':
        if (!args.length) throw new GitError('cat: name a file to print');
        return args.map(function (a) {
          p = normPath(a);
          if (!(p in self.work)) throw new GitError('cat: ' + a + ': No such file or directory');
          return self.work[p].replace(/\n$/, '');
        }).join('\n');
      case 'ls': {
        var prefix = args.filter(function (a) { return a[0] !== '-'; })[0];
        prefix = prefix ? normPath(prefix) + '/' : '';
        var names = {};
        Object.keys(this.work).forEach(function (path) {
          if (path.indexOf(prefix) !== 0) return;
          var rest = path.slice(prefix.length), slash = rest.indexOf('/');
          names[slash === -1 ? rest : rest.slice(0, slash + 1)] = true;
        });
        return Object.keys(names).sort().join('  ');
      }
      case 'touch':
        args.forEach(function (a) { p = normPath(a); if (!(p in self.work)) self.work[p] = ''; });
        return '';
      case 'rm':
        args.filter(function (a) { return a[0] !== '-'; }).forEach(function (a) {
          p = normPath(a);
          if (!(p in self.work)) throw new GitError("rm: cannot remove '" + a + "': No such file or directory");
          delete self.work[p];
        });
        return '';
      case 'mv': {
        var from = normPath(args[0] || ''), to = normPath(args[1] || '');
        if (!(from in this.work) || !to) throw new GitError('mv: cannot move: check both file names');
        this.work[to] = this.work[from];
        delete this.work[from];
        return '';
      }
      case 'cp': {
        var src = normPath(args[0] || ''), dst = normPath(args[1] || '');
        if (!(src in this.work) || !dst) throw new GitError('cp: cannot copy: check both file names');
        this.work[dst] = this.work[src];
        return '';
      }
      case 'mkdir':
        return '';
      case 'pwd':
        return '/home/you/project';
      case 'clear':
        return { out: '', err: false, clear: true };
      case 'help':
        return HELP;
      case 'history':
        return this.ran.map(function (l, n) { return '  ' + (n + 1) + '  ' + l; }).join('\n');
      case 'nano': case 'vim': case 'vi': case 'code': case 'open': case 'notepad':
        return 'No editor in this terminal. Use the Files panel to edit a file, or write one with:\n  echo "text" > ' + (args[0] || 'file.txt');
      case 'cd':
        return 'This lab stays in the project folder, so cd is not needed.';
      default:
        throw new GitError(cmd + ': command not found. Type help to see what this lab supports.');
    }
  };

  var HELP = [
    'This is a practice terminal. Nothing here touches a real repository.',
    '',
    'Files      ls   cat FILE   echo "text" > FILE   echo "text" >> FILE   touch   rm   mv   cp',
    'Snapshots  git status   git add   git commit -m   git log --oneline   git diff   git show',
    'Branches   git branch   git switch   git switch -c   git checkout   git merge   git rebase',
    'Undo       git restore   git reset   git revert   git commit --amend   git stash   git reflog',
    'Remote     git fetch   git pull   git push   git remote -v',
    'Other      git tag   git cherry-pick   git clean   git cat-file   git rev-parse   git config',
    'GitHub     gh pr create   gh pr list   gh pr view   gh pr merge',
    '',
    'Chain commands with &&. Use the Files panel to edit a file by hand.'
  ].join('\n');

  // ------------------------------------------------------------------
  // Lab directives (setup only): lines that start with !
  // ------------------------------------------------------------------

  function keyValues(args) {
    var out = {};
    args.forEach(function (a) {
      var eq = a.indexOf('=');
      if (eq === -1) out[a] = true;
      else out[a.slice(0, eq)] = a.slice(eq + 1);
    });
    return out;
  }

  Sim.prototype.directive = function (name, args) {
    var kv = keyValues(args), self = this;
    if (name === 'origin') {
      // Create the remote and publish every local branch to it.
      this.remote = { name: 'origin', url: 'github.com:you/project.git', branches: clone(this.branches), prs: [], protect: {} };
      Object.keys(this.branches).forEach(function (b) {
        self.tracking['origin/' + b] = self.branches[b];
        self.upstream[b] = 'origin/' + b;
      });
      if (kv.protect) kv.protect.split(',').forEach(function (b) { self.remote.protect[b] = true; });
      return '';
    }
    if (name === 'teammate') {
      // A collaborator pushes a commit straight to the remote.
      if (!this.remote) throw new GitError('!teammate needs !origin first');
      var branch = kv.branch || 'main';
      var from = this.remote.branches[branch] || this.remote.branches[kv.from || 'main'];
      var tree = clone(this.tree(from));
      var text = String(kv.text || '').replace(/\\n/g, '\n');
      if (kv.remove) delete tree[kv.file];
      else if (kv.append) tree[kv.file] = (tree[kv.file] || '') + text + '\n';
      else tree[kv.file] = text + '\n';
      this.remote.branches[branch] = this.newCommit([from], tree, kv.msg || 'Update ' + kv.file, 'Sam Rivera <sam@example.com>');
      return '';
    }
    throw new GitError('unknown directive !' + name);
  };

  // ------------------------------------------------------------------
  // git
  // ------------------------------------------------------------------

  Sim.prototype.git = function (args) {
    var sub = args[0], rest = args.slice(1);
    if (!sub || sub === 'help' || sub === '--help') return HELP;
    if (sub === '--version' || sub === 'version') return 'git version 2.47.0 (simulated)';
    if (sub === 'init') {
      if (this.initialized) return 'Reinitialized existing Git repository in /home/you/project/.git/';
      this.initialized = true;
      return 'Initialized empty Git repository in /home/you/project/.git/';
    }
    if (sub === 'config') return this.gitConfig(rest);
    if (sub === 'clone') return 'This lab starts inside a repository that is already cloned.';
    if (!this.initialized) throw new GitError('fatal: not a git repository (or any of the parent directories): .git');
    var fn = this['git_' + sub.replace(/-/g, '_')];
    if (!fn) throw new GitError("git: '" + sub + "' is not supported in this practice terminal. Type help to see what is.");
    return fn.call(this, rest);
  };

  Sim.prototype.gitConfig = function (args) {
    var a = parseArgs(args, ['--get']);
    if (a.flags['--list'] || a.flags['-l']) {
      var cfg = this.config;
      return Object.keys(cfg).sort().map(function (k) { return k + '=' + cfg[k]; }).join('\n');
    }
    if (a.flags['--get']) return this.config[a.flags['--get']] || '';
    if (a.pos.length === 1) return this.config[a.pos[0]] || '';
    if (a.pos.length >= 2) { this.config[a.pos[0]] = a.pos.slice(1).join(' '); return ''; }
    throw new GitError('usage: git config [--global] <key> <value>');
  };

  Sim.prototype.git_status = function (args) {
    var a = parseArgs(args), st = this.status(), L = [], self = this;
    if (a.flags['-s'] || a.flags['--short']) {
      st.conflicted.forEach(function (p) { L.push('UU ' + p); });
      var code = {};
      st.staged.forEach(function (f) { code[f.path] = [f.kind === 'new file' ? 'A' : f.kind === 'deleted' ? 'D' : 'M', ' ']; });
      st.unstaged.forEach(function (f) {
        code[f.path] = code[f.path] || [' ', ' '];
        code[f.path][1] = f.kind === 'deleted' ? 'D' : 'M';
      });
      Object.keys(code).sort().forEach(function (p) { L.push(code[p].join('') + ' ' + p); });
      st.untracked.forEach(function (p) { L.push('?? ' + p); });
      return L.join('\n');
    }
    if (this.pending && this.pending.kind === 'rebase') {
      L.push('rebase in progress; onto ' + this.short(this.pending.onto));
      L.push("You are currently rebasing branch '" + this.pending.branch + "' on '" + this.short(this.pending.onto) + "'.");
      L.push(st.conflicted.length
        ? '  (fix conflicts and then run "git rebase --continue")'
        : '  (all conflicts fixed: run "git rebase --continue")');
      L.push('  (use "git rebase --abort" to check out the original branch)');
    } else if (st.detached) {
      L.push('HEAD detached at ' + this.short(st.head));
    } else {
      L.push('On branch ' + st.branch);
      if (st.upstream) {
        if (st.ahead && st.behind) {
          L.push("Your branch and '" + st.upstream + "' have diverged,");
          L.push('and have ' + st.ahead + ' and ' + st.behind + ' different commits each, respectively.');
          L.push('  (use "git pull" to merge the remote branch into yours)');
        } else if (st.ahead) {
          L.push("Your branch is ahead of '" + st.upstream + "' by " + plural(st.ahead, 'commit') + '.');
          L.push('  (use "git push" to publish your local commits)');
        } else if (st.behind) {
          L.push("Your branch is behind '" + st.upstream + "' by " + plural(st.behind, 'commit') + ', and can be fast-forwarded.');
          L.push('  (use "git pull" to update your local branch)');
        } else L.push("Your branch is up to date with '" + st.upstream + "'.");
      }
    }
    if (!st.head) { L.push(''); L.push('No commits yet'); }
    if (this.pending && this.pending.kind !== 'rebase') {
      var verb = { merge: 'merging', 'cherry-pick': 'cherry-picking', revert: 'reverting' }[this.pending.kind];
      L.push('');
      if (st.conflicted.length) {
        L.push('You have unmerged paths.');
        L.push('  (fix conflicts and run "git commit")');
        L.push('  (use "git ' + this.pending.kind + ' --abort" to abort the ' + this.pending.kind + ')');
      } else {
        L.push('All conflicts fixed but you are still ' + verb + '.');
        L.push('  (use "git commit" to conclude the ' + this.pending.kind + ')');
      }
    }
    if (st.staged.length) {
      L.push(''); L.push('Changes to be committed:');
      L.push('  (use "git restore --staged <file>..." to unstage)');
      st.staged.forEach(function (f) { L.push('\t' + (f.kind + ':          ').slice(0, 12) + f.path); });
    }
    if (st.conflicted.length) {
      L.push(''); L.push('Unmerged paths:');
      L.push('  (use "git add <file>..." to mark resolution)');
      st.conflicted.forEach(function (p) { L.push('\tboth modified:   ' + p); });
    }
    if (st.unstaged.length) {
      L.push(''); L.push('Changes not staged for commit:');
      L.push('  (use "git add <file>..." to update what will be committed)');
      L.push('  (use "git restore <file>..." to discard changes in working directory)');
      st.unstaged.forEach(function (f) { L.push('\t' + (f.kind + ':          ').slice(0, 12) + f.path); });
    }
    if (st.untracked.length) {
      L.push(''); L.push('Untracked files:');
      L.push('  (use "git add <file>..." to include in what will be committed)');
      st.untracked.forEach(function (p) { L.push('\t' + p); });
    }
    L.push('');
    if (st.clean && !self.pending) L.push('nothing to commit, working tree clean');
    else if (!st.staged.length && !st.conflicted.length && (st.unstaged.length || st.untracked.length)) {
      L.push(st.unstaged.length
        ? 'no changes added to commit (use "git add" and/or "git commit -a")'
        : 'nothing added to commit but untracked files present (use "git add" to track)');
    } else L.pop();
    return L.join('\n');
  };

  Sim.prototype.git_add = function (args) {
    var a = parseArgs(args), self = this;
    var all = a.flags['-A'] || a.flags['--all'] || a.pos.indexOf('.') !== -1;
    if (!all && !a.pos.length) throw new GitError("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?");
    var paths = all ? union(this.work, this.index, this.conflicted) : a.pos.map(normPath);
    paths.forEach(function (p) {
      var matches = [p];
      if (!(p in self.work) && !(p in self.index) && !self.conflicted[p]) {
        // treat as a directory prefix
        matches = union(self.work, self.index).filter(function (q) { return q.indexOf(p + '/') === 0; });
        if (!matches.length) throw new GitError("fatal: pathspec '" + p + "' did not match any files");
      }
      matches.forEach(function (q) {
        if (q in self.work) self.index[q] = self.work[q];
        else delete self.index[q];
        delete self.conflicted[q];
      });
    });
    return '';
  };

  Sim.prototype.git_rm = function (args) {
    var a = parseArgs(args), self = this;
    if (!a.pos.length) throw new GitError('usage: git rm [--cached] <file>...');
    return a.pos.map(function (raw) {
      var p = normPath(raw);
      if (!(p in self.index)) throw new GitError("fatal: pathspec '" + raw + "' did not match any files");
      delete self.index[p];
      if (!a.flags['--cached']) delete self.work[p];
      return "rm '" + p + "'";
    }).join('\n');
  };

  Sim.prototype.git_mv = function (args) {
    var from = normPath(args[0] || ''), to = normPath(args[1] || '');
    if (!(from in this.index) || !to) throw new GitError('fatal: bad source or destination');
    this.index[to] = this.index[from]; delete this.index[from];
    if (from in this.work) { this.work[to] = this.work[from]; delete this.work[from]; }
    return '';
  };

  Sim.prototype.git_ls_files = function () {
    return Object.keys(this.index).sort().join('\n');
  };

  Sim.prototype.git_commit = function (args) {
    var a = parseArgs(args, ['-m', '--message']), self = this;
    var message = a.flags['-m'] !== undefined ? a.flags['-m'] : a.flags['--message'];
    if (message === true) message = '';
    if (Object.keys(this.conflicted).length) {
      throw new GitError('error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add <file>\'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.');
    }
    if (this.pending && this.pending.kind === 'rebase') {
      throw new GitError('You are in the middle of a rebase. Stage your resolution, then run:\n  git rebase --continue');
    }
    if (a.flags['-a'] || a.flags['--all']) {
      Object.keys(this.index).forEach(function (p) {
        if (p in self.work) self.index[p] = self.work[p];
        else delete self.index[p];
      });
    }
    var head = this.headSha(), branch = this.currentBranch();
    var label = branch || 'detached HEAD';

    if (a.flags['--amend']) {
      if (!head) throw new GitError('fatal: You have nothing to amend.');
      if (this.pending) throw new GitError('fatal: You are in the middle of a ' + this.pending.kind + ' -- cannot amend.');
      var old = this.commits[head];
      var amended = this.newCommit(old.parents, this.index, message || old.message, old.author);
      this.moveHead(amended, 'commit (amend): ' + (message || old.message).split('\n')[0]);
      return '[' + label + ' ' + this.short(amended) + '] ' + this.subject(amended) + '\n' +
        this.changeSummary(this.tree(old.parents[0]), this.index);
    }

    var parents = head ? [head] : [], author, kind = 'commit';
    if (this.pending) {
      if (!message) message = this.pending.message;
      if (this.pending.kind === 'merge' && !this.pending.squash) parents.push(this.pending.theirs);
      author = this.pending.author;
      kind = this.pending.kind === 'merge' ? 'commit (merge)' : this.pending.kind;
    } else {
      if (treesEqual(this.tree(head), this.index) && !a.flags['--allow-empty']) {
        var st = this.status();
        var note = st.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")'
          : st.untracked.length ? 'nothing added to commit but untracked files present (use "git add" to track)'
            : 'nothing to commit, working tree clean';
        return { out: (branch ? 'On branch ' + branch : 'HEAD detached at ' + this.short(head)) + '\n' + note, err: true };
      }
      if (!message) {
        throw new GitError('Aborting commit due to empty commit message.\n(Real Git would open an editor here. In this lab, pass the message with -m "your message".)');
      }
    }
    var sha = this.newCommit(parents, this.index, message, author);
    var wasPending = this.pending;
    this.pending = null;
    this.moveHead(sha, (head ? kind : 'commit (initial)') + ': ' + message.split('\n')[0]);
    var prefix = '[' + label + (head ? '' : ' (root-commit)') + ' ' + this.short(sha) + '] ' + this.subject(sha);
    if (wasPending && wasPending.kind === 'merge' && !wasPending.squash) return prefix;
    return prefix + '\n' + this.changeSummary(this.tree(head), this.index);
  };

  Sim.prototype.logList = function (revs, all) {
    var seen = {}, self = this;
    var include = [], exclude = [];
    revs.forEach(function (r) {
      var dots = r.indexOf('..');
      if (dots !== -1) {
        exclude.push(self.resolve(r.slice(0, dots) || 'HEAD'));
        include.push(self.resolve(r.slice(dots + 2) || 'HEAD'));
      } else include.push(self.resolve(r));
    });
    if (all) include = include.concat(this.allRefShas());
    if (!include.length && this.headSha()) include.push(this.headSha());
    include.forEach(function (s) { Object.assign(seen, self.ancestors(s)); });
    exclude.forEach(function (s) { Object.keys(self.ancestors(s)).forEach(function (x) { delete seen[x]; }); });
    return Object.keys(seen).sort(function (x, y) { return self.commits[y].seq - self.commits[x].seq; });
  };

  Sim.prototype.git_log = function (args) {
    var a = parseArgs(args, ['-n', '--max-count']), self = this;
    if (!this.headSha() && !a.pos.length) {
      throw new GitError("fatal: your current branch '" + (this.currentBranch() || 'HEAD') + "' does not have any commits yet");
    }
    var list = this.logList(a.pos, a.flags['--all']);
    var n = a.flags['-n'] || a.flags['--max-count'];
    if (n) list = list.slice(0, +n);
    var graph = a.flags['--graph'] ? '* ' : '';
    if (a.flags['--oneline']) {
      return list.map(function (s) {
        return graph + self.short(s) + self.decorations(s) + ' ' + self.subject(s);
      }).join('\n');
    }
    return list.map(function (s) {
      var c = self.commits[s], L = [graph + 'commit ' + s + self.decorations(s)];
      if (c.parents.length > 1) L.push('Merge: ' + c.parents.map(function (p) { return self.short(p); }).join(' '));
      L.push('Author: ' + c.author);
      L.push('Date:   ' + fakeDate(c.seq));
      L.push('');
      c.message.split('\n').forEach(function (m) { L.push('    ' + m); });
      return L.join('\n');
    }).join('\n\n');
  };

  Sim.prototype.diffTrees = function (a, b, only) {
    var L = [];
    union(a, b).forEach(function (p) {
      if (a[p] === b[p]) return;
      if (only && only.indexOf(p) === -1) return;
      L.push('diff --git a/' + p + ' b/' + p);
      if (a[p] === undefined) L.push('new file');
      if (b[p] === undefined) L.push('deleted file');
      L.push('--- ' + (a[p] === undefined ? '/dev/null' : 'a/' + p));
      L.push('+++ ' + (b[p] === undefined ? '/dev/null' : 'b/' + p));
      L.push('@@ @@');
      diffLines(toLines(a[p]), toLines(b[p])).forEach(function (row) { L.push(row.op + row.text); });
    });
    return L.join('\n');
  };

  Sim.prototype.git_diff = function (args) {
    var a = parseArgs(args), self = this;
    if (a.flags['--check']) {
      var found = [];
      Object.keys(this.work).sort().forEach(function (p) {
        toLines(self.work[p]).forEach(function (line, n) {
          if (/^(<<<<<<<|=======$|>>>>>>>)/.test(line)) found.push(p + ':' + (n + 1) + ': leftover conflict marker');
        });
      });
      return found.length ? { out: found.join('\n'), err: true } : '';
    }
    var staged = a.flags['--staged'] || a.flags['--cached'];
    var revs = [], files = [];
    a.pos.forEach(function (p) {
      if (p.indexOf('..') !== -1) p.split(/\.\.\.?/).forEach(function (r) { revs.push(r || 'HEAD'); });
      else if (!a.flags['--'] && self.tryResolve(p) && !(normPath(p) in self.work)) revs.push(p);
      else files.push(normPath(p));
    });
    var from, to;
    if (revs.length >= 2) { from = this.tree(this.resolve(revs[0])); to = this.tree(this.resolve(revs[1])); }
    else if (revs.length === 1) { from = this.tree(this.resolve(revs[0])); to = staged ? this.index : this.work; }
    else if (staged) { from = this.tree(this.headSha()); to = this.index; }
    else {
      from = this.index;
      to = {};
      // unstaged view ignores untracked files, like real git diff
      Object.keys(this.work).forEach(function (p) { if (p in self.index) to[p] = self.work[p]; });
      Object.keys(this.index).forEach(function (p) { if (!(p in self.work)) to[p] = undefined; });
      to = JSON.parse(JSON.stringify(to));
    }
    if (a.flags['--name-only'] || a.flags['--name-status']) {
      if (a.flags['--diff-filter'] === 'U') return Object.keys(this.conflicted).sort().join('\n');
      return union(from, to).filter(function (p) { return from[p] !== to[p]; }).join('\n');
    }
    if (a.flags['--stat']) return this.changeSummary(from, to);
    return this.diffTrees(from, to, files.length ? files : null);
  };

  Sim.prototype.git_show = function (args) {
    var a = parseArgs(args), target = a.pos[0] || 'HEAD';
    var colon = target.indexOf(':');
    if (colon !== -1) {
      var tree = this.tree(this.resolve(target.slice(0, colon) || 'HEAD')), path = normPath(target.slice(colon + 1));
      if (!(path in tree)) throw new GitError("fatal: path '" + path + "' does not exist in '" + target.slice(0, colon) + "'");
      return tree[path].replace(/\n$/, '');
    }
    var sha = this.resolve(target), c = this.commits[sha];
    var L = ['commit ' + sha + this.decorations(sha)];
    if (c.parents.length > 1) L.push('Merge: ' + c.parents.map(this.short).join(' '));
    L.push('Author: ' + c.author, 'Date:   ' + fakeDate(c.seq), '');
    c.message.split('\n').forEach(function (m) { L.push('    ' + m); });
    var d = this.diffTrees(this.tree(c.parents[0]), c.tree);
    if (d) L.push('', d);
    return L.join('\n');
  };

  Sim.prototype.git_branch = function (args) {
    var a = parseArgs(args, ['-u', '--set-upstream-to']), self = this, cur = this.currentBranch();
    if (a.flags['--show-current']) return cur || '';
    var up = a.flags['-u'] || a.flags['--set-upstream-to'];
    if (up) {
      var target = a.pos[0] || cur;
      if (!this.tracking[up]) throw new GitError("fatal: the requested upstream branch '" + up + "' does not exist");
      this.upstream[target] = up;
      return "branch '" + target + "' set up to track '" + up + "'.";
    }
    if (a.flags['-d'] || a.flags['-D'] || a.flags['--delete']) {
      if (!a.pos.length) throw new GitError('fatal: branch name required');
      return a.pos.map(function (name) {
        if (!self.branches[name]) throw new GitError("error: branch '" + name + "' not found");
        if (name === cur) throw new GitError("error: cannot delete branch '" + name + "' used by worktree at '/home/you/project'");
        var sha = self.branches[name];
        var upstreamSha = self.tracking[self.upstream[name]];
        var merged = self.isAncestor(sha, self.headSha()) || (upstreamSha && self.isAncestor(sha, upstreamSha));
        if (!a.flags['-D'] && !merged) {
          throw new GitError("error: the branch '" + name + "' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D " + name + "'");
        }
        delete self.branches[name];
        delete self.upstream[name];
        return 'Deleted branch ' + name + ' (was ' + self.short(sha) + ').';
      }).join('\n');
    }
    if (a.flags['-m'] || a.flags['-M'] || a.flags['--move']) {
      var from = a.pos.length > 1 ? a.pos[0] : cur, to = a.pos[a.pos.length - 1];
      if (!from || !this.branches[from] || !to) throw new GitError('fatal: branch rename needs an existing branch and a new name');
      if (this.branches[to]) throw new GitError("fatal: a branch named '" + to + "' already exists");
      this.branches[to] = this.branches[from]; delete this.branches[from];
      if (this.upstream[from]) { this.upstream[to] = this.upstream[from]; delete this.upstream[from]; }
      if (cur === from) this.head.name = to;
      return '';
    }
    if (a.pos.length) {
      var name = a.pos[0];
      if (this.branches[name]) throw new GitError("fatal: a branch named '" + name + "' already exists");
      var start = a.pos[1] ? this.resolve(a.pos[1]) : this.headSha();
      if (!start) throw new GitError("fatal: not a valid object name: '" + (cur || 'HEAD') + "'");
      this.branches[name] = start;
      return '';
    }
    var names = Object.keys(this.branches).sort();
    if (a.flags['--merged']) names = names.filter(function (b) { return self.isAncestor(self.branches[b], self.headSha()); });
    if (a.flags['--no-merged']) names = names.filter(function (b) { return !self.isAncestor(self.branches[b], self.headSha()); });
    var L = [];
    if (this.head.type === 'detached') L.push('* (HEAD detached at ' + this.short(this.head.sha) + ')');
    names.forEach(function (b) {
      var line = (b === cur ? '* ' : '  ') + b;
      if (a.flags['-v'] || a.flags['-vv']) line += ' ' + self.short(self.branches[b]) + ' ' + self.subject(self.branches[b]);
      L.push(line);
    });
    if (a.flags['-a'] || a.flags['--all'] || a.flags['-r']) {
      Object.keys(this.tracking).sort().forEach(function (r) { L.push('  remotes/' + r); });
    }
    return L.join('\n');
  };

  /** Change which commit the working tree shows, keeping safe local edits. */
  Sim.prototype.checkoutTree = function (targetSha) {
    var H = this.tree(this.headSha()), T = this.tree(targetSha), self = this;
    var newI = clone(T), newW = clone(T), blockers = [];
    union(H, this.index, this.work).forEach(function (p) {
      var h = H[p], i = self.index[p], w = self.work[p], t = T[p];
      if (i === h && w === i) return; // untouched: take the target's version
      if (h !== t) { blockers.push(p); return; }
      if (i === undefined) delete newI[p]; else newI[p] = i;
      if (w === undefined) delete newW[p]; else newW[p] = w;
    });
    if (blockers.length) {
      throw new GitError('error: Your local changes to the following files would be overwritten by checkout:\n' +
        blockers.map(function (p) { return '\t' + p; }).join('\n') +
        '\nPlease commit your changes or stash them before you switch branches.\nAborting');
    }
    this.index = newI; this.work = newW;
  };

  Sim.prototype.orphanWarning = function (oldSha) {
    if (!oldSha) return '';
    var kept = this.reachableFromRefs(), self = this;
    var lost = Object.keys(this.ancestors(oldSha)).filter(function (s) { return !kept[s]; })
      .sort(function (x, y) { return self.commits[y].seq - self.commits[x].seq; });
    if (!lost.length) return '';
    return 'Warning: you are leaving ' + plural(lost.length, 'commit') + ' behind, not connected to\nany of your branches:\n\n' +
      lost.map(function (s) { return '  ' + self.short(s) + ' ' + self.subject(s); }).join('\n') +
      '\n\nIf you want to keep ' + (lost.length === 1 ? 'it' : 'them') + ' by creating a new branch, this may be a good time\nto do so with:\n\n git branch <new-branch-name> ' +
      this.short(lost[0]) + '\n\n';
  };

  Sim.prototype.switchBranch = function (name) {
    if (this.pending) throw new GitError('error: you need to resolve your current index first (a ' + this.pending.kind + ' is in progress)');
    if (!this.branches[name]) {
      if (this.tracking['origin/' + name]) {
        // like real Git: create a local branch that tracks the remote one
        this.checkoutTree(this.tracking['origin/' + name]);
        this.branches[name] = this.tracking['origin/' + name];
        this.upstream[name] = 'origin/' + name;
        this.previousBranch = this.currentBranch();
        this.head = { type: 'branch', name: name };
        this.reflog.unshift({ sha: this.branches[name], msg: 'checkout: moving to ' + name });
        return "branch '" + name + "' set up to track 'origin/" + name + "'.\nSwitched to a new branch '" + name + "'";
      }
      throw new GitError("fatal: invalid reference: " + name);
    }
    if (name === this.currentBranch()) return "Already on '" + name + "'";
    var wasDetached = this.head.type === 'detached' ? this.head.sha : null;
    this.checkoutTree(this.branches[name]);
    this.previousBranch = this.currentBranch();
    this.head = { type: 'branch', name: name };
    this.reflog.unshift({ sha: this.branches[name], msg: 'checkout: moving to ' + name });
    return this.orphanWarning(wasDetached) + "Switched to branch '" + name + "'";
  };

  Sim.prototype.createAndSwitch = function (name, startRev) {
    if (this.pending) throw new GitError('error: you need to resolve your current index first');
    if (this.branches[name]) throw new GitError("fatal: a branch named '" + name + "' already exists");
    var start = startRev ? this.resolve(startRev) : this.headSha();
    if (startRev) this.checkoutTree(start);
    if (start) this.branches[name] = start;
    this.previousBranch = this.currentBranch();
    this.head = { type: 'branch', name: name };
    if (start) this.reflog.unshift({ sha: start, msg: 'checkout: moving to ' + name });
    return "Switched to a new branch '" + name + "'";
  };

  Sim.prototype.detachAt = function (rev) {
    if (this.pending) throw new GitError('error: you need to resolve your current index first');
    var sha = this.resolve(rev), wasDetached = this.head.type === 'detached' ? this.head.sha : null;
    this.checkoutTree(sha);
    this.previousBranch = this.currentBranch() || this.previousBranch;
    this.head = { type: 'detached', sha: sha };
    this.reflog.unshift({ sha: sha, msg: 'checkout: moving to ' + rev });
    return this.orphanWarning(wasDetached) + "Note: switching to '" + rev + "'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nHEAD is now at " + this.short(sha) + ' ' + this.subject(sha);
  };

  Sim.prototype.git_switch = function (args) {
    var a = parseArgs(args, ['-c', '-C', '--create']);
    var create = a.flags['-c'] || a.flags['-C'] || a.flags['--create'];
    if (create) return this.createAndSwitch(create, a.pos[0]);
    if (a.flags['--detach'] || a.flags['-d']) return this.detachAt(a.pos[0] || 'HEAD');
    if (!a.pos.length) throw new GitError('fatal: missing branch or commit argument');
    var name = a.pos[0];
    if (name === '-') {
      if (!this.previousBranch) throw new GitError('fatal: no previous branch');
      name = this.previousBranch;
    }
    if (!this.branches[name] && !this.tracking['origin/' + name] && this.tryResolve(name)) {
      throw new GitError("fatal: a branch is expected, got commit '" + name + "'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.");
    }
    return this.switchBranch(name);
  };

  Sim.prototype.git_checkout = function (args) {
    var a = parseArgs(args, ['-b', '-B']), self = this;
    if (a.flags['-b'] || a.flags['-B']) return this.createAndSwitch(a.flags['-b'] || a.flags['-B'], a.pos[0]);
    var side = a.flags['--ours'] ? 'ours' : a.flags['--theirs'] ? 'theirs' : null;
    if (side) {
      if (!this.pending) throw new GitError('fatal: --ours and --theirs only make sense while resolving a conflict');
      var src = side === 'ours' ? this.tree(this.headSha()) : this.pending.theirsTree;
      a.pos.forEach(function (raw) {
        var p = normPath(raw);
        if (src[p] === undefined) delete self.work[p]; else self.work[p] = src[p];
      });
      return 'Updated ' + plural(a.pos.length, 'path') + ' from the index';
    }
    if (a.flags['--']) return this.restorePaths(a.pos, {});
    if (!a.pos.length) throw new GitError('fatal: missing branch, commit or file argument');
    var name = a.pos[0];
    if (name === '-') {
      if (!this.previousBranch) throw new GitError('fatal: no previous branch');
      return this.switchBranch(this.previousBranch);
    }
    if (this.branches[name] || this.tracking['origin/' + name]) return this.switchBranch(name);
    if (this.tryResolve(name)) return this.detachAt(name);
    if (normPath(name) in this.index) return this.restorePaths(a.pos, {});
    throw new GitError("error: pathspec '" + name + "' did not match any file(s) known to git");
  };

  Sim.prototype.restorePaths = function (paths, opts) {
    var self = this, src = opts.source ? this.tree(this.resolve(opts.source)) : null;
    if (!paths.length) throw new GitError('fatal: you must specify path(s) to restore');
    var list = paths.indexOf('.') !== -1 ? union(this.index, this.work, this.tree(this.headSha())) : paths.map(normPath);
    list.forEach(function (p) {
      if (opts.staged) {
        var from = src || self.tree(self.headSha());
        if (!(p in from) && !(p in self.index)) {
          if (paths.indexOf('.') !== -1) return;
          throw new GitError("error: pathspec '" + p + "' did not match any file(s) known to git");
        }
        if (p in from) self.index[p] = from[p]; else delete self.index[p];
        return;
      }
      var base = src || self.index;
      if (!(p in base)) {
        if (paths.indexOf('.') !== -1) return;
        throw new GitError("error: pathspec '" + p + "' did not match any file(s) known to git");
      }
      self.work[p] = base[p];
      if (src) self.index[p] = self.index[p]; // --source without --staged leaves the index alone
    });
    return '';
  };

  Sim.prototype.git_restore = function (args) {
    var a = parseArgs(args, ['--source', '-s']);
    return this.restorePaths(a.pos, { staged: a.flags['--staged'] || a.flags['-S'], source: a.flags['--source'] || a.flags['-s'] });
  };

  Sim.prototype.requireCleanTracked = function (verb) {
    var st = this.status();
    var dirty = st.staged.concat(st.unstaged).map(function (f) { return f.path; });
    if (dirty.length) {
      throw new GitError('error: Your local changes to the following files would be overwritten by ' + verb + ':\n' +
        dirty.filter(function (p, i) { return dirty.indexOf(p) === i; }).map(function (p) { return '\t' + p; }).join('\n') +
        '\nPlease commit your changes or stash them before you ' + verb + '.\nAborting');
    }
  };

  Sim.prototype.abortPending = function (kind) {
    if (!this.pending || this.pending.kind !== kind) {
      throw new GitError('fatal: There is no ' + kind + ' to abort' + (kind === 'merge' ? ' (MERGE_HEAD missing).' : '.'));
    }
    var untracked = this.pending.untracked || {};
    if (kind === 'rebase') {
      this.head = { type: 'branch', name: this.pending.branch };
      this.branches[this.pending.branch] = this.pending.orig;
      this.reflog.unshift({ sha: this.pending.orig, msg: 'rebase (abort): returning to refs/heads/' + this.pending.branch });
    }
    var tree = this.tree(this.headSha());
    this.index = clone(tree);
    this.work = Object.assign({}, untracked, tree);
    this.conflicted = {};
    this.pending = null;
    return '';
  };

  Sim.prototype.git_merge = function (args) {
    var a = parseArgs(args, ['-m']), self = this;
    if (a.flags['--abort']) return this.abortPending('merge');
    if (a.flags['--continue']) {
      if (!this.pending || this.pending.kind !== 'merge') throw new GitError('fatal: There is no merge in progress (MERGE_HEAD missing).');
      return this.git_commit([]);
    }
    if (this.pending) throw new GitError('error: Merging is not possible because you have unmerged files or an operation in progress.');
    if (!a.pos.length) throw new GitError('fatal: No commit specified. Example: git merge feature');
    var name = a.pos[0], theirs = this.resolve(name), ours = this.headSha(), branch = this.currentBranch();
    if (!ours) throw new GitError('fatal: no commits yet on this branch');
    if (this.isAncestor(theirs, ours)) return 'Already up to date.';
    this.requireCleanTracked('merge');

    var canFF = this.isAncestor(ours, theirs);
    if (canFF && !a.flags['--no-ff'] && !a.flags['--squash']) {
      var summary = this.changeSummary(this.tree(ours), this.tree(theirs));
      this.setCleanTree(this.tree(theirs));
      this.moveHead(theirs, 'merge ' + name + ': Fast-forward');
      return 'Updating ' + this.short(ours) + '..' + this.short(theirs) + '\nFast-forward\n' + summary;
    }
    if (a.flags['--ff-only']) throw new GitError('fatal: Not possible to fast-forward, aborting.');

    var base = this.mergeBase(ours, theirs);
    var result = this.mergeTrees(this.tree(base), this.tree(ours), this.tree(theirs), { ours: 'HEAD', theirs: name });
    var message = a.flags['-m'] || ("Merge branch '" + name + "'" + (branch && branch !== 'main' && branch !== 'master' ? ' into ' + branch : ''));
    if (this.tracking[name]) message = a.flags['-m'] || ("Merge remote-tracking branch '" + name + "'" + (branch && branch !== 'main' ? ' into ' + branch : ''));
    var pending = {
      kind: 'merge', theirs: theirs, theirsTree: this.tree(theirs), message: message,
      squash: !!a.flags['--squash'], untracked: this.untrackedFiles()
    };

    if (result.conflicts.length) {
      this.enterConflict(result, this.tree(ours));
      if (pending.squash) pending.message = a.flags['-m'] || 'Squashed commit of the following changes from ' + name;
      this.pending = pending;
      return { out: this.conflictReport(result).concat(['Automatic merge failed; fix conflicts and then commit the result.']).join('\n'), err: true };
    }
    if (a.flags['--squash']) {
      this.setCleanTree(result.tree);
      // staged but not committed; HEAD does not move and no merge is recorded
      this.index = clone(result.tree);
      this.work = Object.assign({}, this.untrackedFiles(), result.tree);
      return 'Squash commit -- not updating HEAD\nAutomatic merge went well; stopped before committing as requested';
    }
    var sha = this.newCommit([ours, theirs], result.tree, message);
    var stat = this.changeSummary(this.tree(ours), result.tree);
    this.setCleanTree(result.tree);
    this.moveHead(sha, 'merge ' + name + ": Merge made by the 'ort' strategy.");
    return (result.auto.length ? result.auto.map(function (p) { return 'Auto-merging ' + p; }).join('\n') + '\n' : '') +
      "Merge made by the 'ort' strategy.\n" + stat;
  };

  /** Apply one commit's change on top of HEAD (used by cherry-pick and revert). */
  Sim.prototype.applyChange = function (kind, baseTree, theirsTree, labels, message, author) {
    var ours = this.headSha();
    var result = this.mergeTrees(baseTree, this.tree(ours), theirsTree, labels);
    if (result.conflicts.length) {
      var untracked = this.untrackedFiles();
      this.enterConflict(result, this.tree(ours));
      this.pending = { kind: kind, message: message, author: author, theirsTree: theirsTree, untracked: untracked };
      return {
        out: this.conflictReport(result).concat([
          'error: could not apply the change',
          'hint: After resolving the conflicts, mark them with "git add <file>"',
          'hint: and run "git commit". To cancel, run "git ' + kind + ' --abort".'
        ]).join('\n'), err: true
      };
    }
    if (treesEqual(result.tree, this.tree(ours))) {
      return { out: 'The change is already present; nothing to commit.', err: true };
    }
    var sha = this.newCommit([ours], result.tree, message, author);
    var stat = this.changeSummary(this.tree(ours), result.tree);
    this.setCleanTree(result.tree);
    this.moveHead(sha, kind + ': ' + message.split('\n')[0]);
    return '[' + (this.currentBranch() || 'detached HEAD') + ' ' + this.short(sha) + '] ' + this.subject(sha) + '\n' + stat;
  };

  Sim.prototype.git_cherry_pick = function (args) {
    var a = parseArgs(args);
    if (a.flags['--abort']) return this.abortPending('cherry-pick');
    if (a.flags['--continue']) return this.git_commit([]);
    if (this.pending) throw new GitError('error: a ' + this.pending.kind + ' is already in progress');
    if (!a.pos.length) throw new GitError('usage: git cherry-pick <commit>');
    this.requireCleanTracked('cherry-pick');
    var sha = this.resolve(a.pos[0]), c = this.commits[sha];
    if (c.parents.length > 1) throw new GitError('error: commit ' + this.short(sha) + ' is a merge but no -m option was given.');
    var message = c.message + (a.flags['-x'] ? '\n\n(cherry picked from commit ' + sha + ')' : '');
    return this.applyChange('cherry-pick', this.tree(c.parents[0]), c.tree,
      { ours: 'HEAD', theirs: this.short(sha) + ' (' + this.subject(sha) + ')' }, message, c.author);
  };

  Sim.prototype.git_revert = function (args) {
    var a = parseArgs(args, ['-m', '--mainline']);
    if (a.flags['--abort']) return this.abortPending('revert');
    if (a.flags['--continue']) return this.git_commit([]);
    if (this.pending) throw new GitError('error: a ' + this.pending.kind + ' is already in progress');
    if (!a.pos.length) throw new GitError('usage: git revert <commit>');
    this.requireCleanTracked('revert');
    var sha = this.resolve(a.pos[0]), c = this.commits[sha], mainline = a.flags['-m'] || a.flags['--mainline'];
    if (c.parents.length > 1 && !mainline) {
      throw new GitError('error: commit ' + this.short(sha) + ' is a merge but no -m option was given.\nfatal: revert failed\n(A merge has two parents. -m 1 says: keep the first parent\'s side and undo what the merge brought in.)');
    }
    var parent = c.parents[mainline ? +mainline - 1 : 0];
    if (c.parents.length && !parent) throw new GitError('error: commit ' + this.short(sha) + ' does not have parent ' + mainline);
    var message = 'Revert "' + this.subject(sha) + '"\n\nThis reverts commit ' + sha + '.';
    return this.applyChange('revert', c.tree, this.tree(parent),
      { ours: 'HEAD', theirs: 'parent of ' + this.short(sha) + ' (' + this.subject(sha) + ')' }, message);
  };

  Sim.prototype.rebaseLoop = function () {
    var P = this.pending;
    while (P.todo.length) {
      var c = this.commits[P.todo[0]], cur = this.headSha();
      var result = this.mergeTrees(this.tree(c.parents[0]), this.tree(cur), c.tree,
        { ours: 'HEAD', theirs: this.short(c.sha) + ' (' + this.subject(c.sha) + ')' });
      if (result.conflicts.length) {
        this.enterConflict(result, this.tree(cur));
        P.theirsTree = c.tree;
        return {
          out: this.conflictReport(result).concat([
            'error: could not apply ' + this.short(c.sha) + '... ' + this.subject(c.sha),
            'hint: Resolve all conflicts manually, mark them as resolved with',
            'hint: "git add <file>", then run "git rebase --continue".',
            'hint: To abort and get back to the state before "git rebase", run "git rebase --abort".',
            'Could not apply ' + this.short(c.sha) + '... ' + this.subject(c.sha)
          ]).join('\n'), err: true
        };
      }
      P.todo.shift();
      if (treesEqual(result.tree, this.tree(cur))) continue; // already applied upstream
      var sha = this.newCommit([cur], result.tree, c.message, c.author);
      this.setCleanTree(result.tree);
      this.head.sha = sha;
      this.reflog.unshift({ sha: sha, msg: 'rebase (pick): ' + this.subject(sha) });
    }
    var tip = this.headSha();
    this.branches[P.branch] = tip;
    this.head = { type: 'branch', name: P.branch };
    this.reflog.unshift({ sha: tip, msg: 'rebase (finish): returning to refs/heads/' + P.branch });
    this.pending = null;
    return 'Successfully rebased and updated refs/heads/' + P.branch + '.';
  };

  Sim.prototype.git_rebase = function (args) {
    var a = parseArgs(args), self = this;
    if (a.flags['--abort']) return this.abortPending('rebase');
    if (a.flags['--continue'] || a.flags['--skip']) {
      if (!this.pending || this.pending.kind !== 'rebase') throw new GitError('fatal: No rebase in progress?');
      if (a.flags['--skip']) {
        this.setCleanTree(this.tree(this.headSha()));
        this.pending.todo.shift();
        return this.rebaseLoop();
      }
      if (Object.keys(this.conflicted).length) {
        throw new GitError('error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, then "git add <file>" and run "git rebase --continue".');
      }
      var c = this.commits[this.pending.todo.shift()], cur = this.headSha();
      if (!treesEqual(this.index, this.tree(cur))) {
        var sha = this.newCommit([cur], this.index, c.message, c.author);
        this.head.sha = sha;
        this.reflog.unshift({ sha: sha, msg: 'rebase (continue): ' + this.subject(sha) });
      }
      this.setCleanTree(this.tree(this.headSha()));
      return this.rebaseLoop();
    }
    if (a.flags['-i'] || a.flags['--interactive']) {
      return { out: 'Interactive rebase opens a text editor with a to-do list, which this practice terminal does not have.\nTo practice squashing here, try:\n  git reset --soft HEAD~2 && git commit -m "One tidy commit"', err: true };
    }
    if (this.pending) throw new GitError('error: a ' + this.pending.kind + ' is already in progress');
    if (!a.pos.length) throw new GitError('usage: git rebase <upstream>   (for example: git rebase main)');
    var branch = this.currentBranch();
    if (!branch) throw new GitError('fatal: this lab only rebases a checked-out branch, not a detached HEAD');
    this.requireCleanTracked('rebase');
    var onto = this.resolve(a.pos[0]), head = this.headSha();
    if (this.isAncestor(onto, head)) return 'Current branch ' + branch + ' is up to date.';
    if (this.isAncestor(head, onto)) {
      this.setCleanTree(this.tree(onto));
      this.moveHead(onto, 'rebase (finish): refs/heads/' + branch + ' onto ' + this.short(onto));
      return 'Successfully rebased and updated refs/heads/' + branch + '.';
    }
    // commits on this branch that the upstream does not have, oldest first
    var upstreamSet = this.ancestors(onto), todo = [], walk = head;
    while (walk && !upstreamSet[walk]) { todo.unshift(walk); walk = this.commits[walk].parents[0]; }
    todo = todo.filter(function (s) { return self.commits[s].parents.length < 2; }); // merges are flattened
    this.pending = { kind: 'rebase', branch: branch, orig: head, onto: onto, todo: todo, untracked: this.untrackedFiles() };
    this.reflog.unshift({ sha: onto, msg: 'rebase (start): checkout ' + a.pos[0] });
    this.setCleanTree(this.tree(onto));
    this.head = { type: 'detached', sha: onto };
    return this.rebaseLoop();
  };

  Sim.prototype.git_reset = function (args) {
    var a = parseArgs(args), self = this;
    var mode = a.flags['--hard'] ? 'hard' : a.flags['--soft'] ? 'soft' : 'mixed';
    var pos = a.pos.slice(), target = 'HEAD';
    // "git reset <file>" or "git reset HEAD <file>" unstages
    if (pos.length && this.tryResolve(pos[0]) && !(normPath(pos[0]) in this.index && !this.branches[pos[0]])) target = pos.shift();
    if (pos.length) {
      var from = this.tree(this.resolve(target));
      pos.forEach(function (raw) {
        var p = normPath(raw);
        if (p in from) self.index[p] = from[p]; else delete self.index[p];
      });
      var st0 = this.status();
      return st0.unstaged.length ? 'Unstaged changes after reset:\n' + st0.unstaged.map(function (f) { return (f.kind === 'deleted' ? 'D' : 'M') + '\t' + f.path; }).join('\n') : '';
    }
    var sha = this.resolve(target), tree = this.tree(sha);
    if (this.pending && this.pending.kind === 'rebase') throw new GitError('error: finish or abort the rebase first (git rebase --abort)');
    if (mode !== 'soft') { this.pending = null; this.conflicted = {}; }
    if (mode === 'hard') {
      var untracked = this.untrackedFiles();
      this.index = clone(tree);
      this.work = Object.assign({}, untracked, tree);
    } else if (mode === 'mixed') {
      this.index = clone(tree);
    }
    this.moveHead(sha, 'reset: moving to ' + target);
    if (mode === 'hard') return 'HEAD is now at ' + this.short(sha) + ' ' + this.subject(sha);
    if (mode === 'mixed') {
      var st = this.status();
      return st.unstaged.length ? 'Unstaged changes after reset:\n' + st.unstaged.map(function (f) { return (f.kind === 'deleted' ? 'D' : 'M') + '\t' + f.path; }).join('\n') : '';
    }
    return '';
  };

  Sim.prototype.git_stash = function (args) {
    var sub = args[0] && args[0][0] !== '-' ? args[0] : 'push';
    var a = parseArgs(sub === args[0] ? args.slice(1) : args, ['-m', '--message']), self = this;
    var head = this.headSha();
    if (sub === 'push' || sub === 'save') {
      if (!head) throw new GitError('You do not have the initial commit yet');
      if (this.pending) throw new GitError('error: finish or abort the ' + this.pending.kind + ' first');
      var st = this.status(), withUntracked = a.flags['-u'] || a.flags['--include-untracked'];
      if (!st.staged.length && !st.unstaged.length && !(withUntracked && st.untracked.length)) return 'No local changes to save';
      var label = (a.flags['-m'] || a.flags['--message'])
        ? 'On ' + (this.currentBranch() || '(no branch)') + ': ' + (a.flags['-m'] || a.flags['--message'])
        : 'WIP on ' + (this.currentBranch() || '(no branch)') + ': ' + this.short(head) + ' ' + this.subject(head);
      var untracked = this.untrackedFiles(), saved = {};
      Object.keys(this.work).forEach(function (p) { if (withUntracked || !(p in untracked)) saved[p] = self.work[p]; });
      this.stashes.unshift({ base: head, index: clone(this.index), work: saved, label: label, added: withUntracked ? Object.keys(untracked) : [] });
      this.index = clone(this.tree(head));
      this.work = Object.assign({}, withUntracked ? {} : untracked, this.tree(head));
      return 'Saved working directory and index state ' + label;
    }
    if (sub === 'list') {
      return this.stashes.map(function (s, n) { return 'stash@{' + n + '}: ' + s.label; }).join('\n');
    }
    var nMatch = /(\d+)/.exec(a.pos[0] || ''), n = nMatch ? +nMatch[1] : 0, entry = this.stashes[n];
    if (sub === 'clear') { this.stashes = []; return ''; }
    if (!entry) throw new GitError(this.stashes.length ? 'error: stash@{' + n + '} is not a valid reference' : 'No stash entries found.');
    if (sub === 'drop') { this.stashes.splice(n, 1); return 'Dropped stash@{' + n + '}'; }
    if (sub === 'show') return this.changeSummary(this.tree(entry.base), entry.work);
    if (sub === 'pop' || sub === 'apply') {
      if (this.hasTrackedChanges() && Object.keys(this.conflicted).length) throw new GitError('error: resolve the current conflicts first');
      var tracked = {};
      Object.keys(this.work).forEach(function (p) { if (p in self.index) tracked[p] = self.work[p]; });
      var theirs = {};
      Object.keys(entry.work).forEach(function (p) { if (entry.added.indexOf(p) === -1) theirs[p] = entry.work[p]; });
      var result = this.mergeTrees(this.tree(entry.base), tracked, theirs, { ours: 'Updated upstream', theirs: 'Stashed changes' });
      var untracked2 = this.untrackedFiles();
      this.work = Object.assign({}, untracked2, result.tree);
      entry.added.forEach(function (p) { self.work[p] = entry.work[p]; });
      // files that were newly staged when stashed come back staged
      Object.keys(entry.index).forEach(function (p) {
        if (!(p in self.tree(entry.base)) && p in self.work) self.index[p] = self.work[p];
      });
      if (result.conflicts.length) {
        result.conflicts.forEach(function (c) { self.conflicted[c.path] = true; });
        return { out: this.conflictReport(result).concat(['The stash entry is kept in case you need it again.']).join('\n'), err: true };
      }
      var out = this.git_status([]);
      if (sub === 'pop') { this.stashes.splice(n, 1); out += '\nDropped stash@{' + n + '}'; }
      return out;
    }
    throw new GitError("fatal: unknown stash subcommand '" + sub + "'");
  };

  Sim.prototype.git_tag = function (args) {
    var a = parseArgs(args, ['-m', '-d']), self = this;
    if (a.flags['-d']) {
      var gone = a.flags['-d'] === true ? a.pos[0] : a.flags['-d'];
      if (!this.tags[gone]) throw new GitError("error: tag '" + gone + "' not found.");
      var was = this.tags[gone].sha; delete this.tags[gone];
      return "Deleted tag '" + gone + "' (was " + this.short(was) + ')';
    }
    if (!a.pos.length) return Object.keys(this.tags).sort().join('\n');
    var name = a.pos[0];
    if (this.tags[name]) throw new GitError("fatal: tag '" + name + "' already exists");
    var sha = a.pos[1] ? this.resolve(a.pos[1]) : this.headSha();
    if (!sha) throw new GitError('fatal: Failed to resolve HEAD as a valid ref.');
    var annotated = !!(a.flags['-a'] || a.flags['-m']);
    if (a.flags['-a'] && !a.flags['-m']) throw new GitError('An annotated tag needs a message. In this lab, pass it with -m "message".');
    this.tags[name] = { sha: sha, annotated: annotated, message: a.flags['-m'] || '' };
    return '';
  };

  Sim.prototype.git_reflog = function (args) {
    var a = parseArgs(args, ['-n']), self = this;
    var list = this.reflog.slice(0, a.flags['-n'] ? +a.flags['-n'] : 30);
    return list.map(function (e, n) { return self.short(e.sha) + ' HEAD@{' + n + '}: ' + e.msg; }).join('\n');
  };

  Sim.prototype.git_clean = function (args) {
    var a = parseArgs(args), self = this, untracked = Object.keys(this.untrackedFiles()).sort();
    if (a.flags['-n'] || a.flags['--dry-run']) return untracked.map(function (p) { return 'Would remove ' + p; }).join('\n');
    if (!a.flags['-f'] && !a.flags['--force']) throw new GitError('fatal: clean.requireForce is true and -f not given: refusing to clean');
    untracked.forEach(function (p) { delete self.work[p]; });
    return untracked.map(function (p) { return 'Removing ' + p; }).join('\n');
  };

  Sim.prototype.git_rev_parse = function (args) {
    var a = parseArgs(args), self = this;
    if (a.flags['--abbrev-ref']) return this.currentBranch() || 'HEAD';
    if (a.flags['--short']) return a.pos.map(function (r) { return self.short(self.resolve(r)); }).join('\n');
    return a.pos.map(function (r) { return self.resolve(r); }).join('\n');
  };

  Sim.prototype.git_merge_base = function (args) {
    var a = parseArgs(args);
    if (a.flags['--is-ancestor']) {
      return this.isAncestor(this.resolve(a.pos[0]), this.resolve(a.pos[1])) ? '' : { out: '', err: true };
    }
    if (a.pos.length < 2) throw new GitError('usage: git merge-base <commit> <commit>');
    return this.mergeBase(this.resolve(a.pos[0]), this.resolve(a.pos[1])) || '';
  };

  Sim.prototype.git_cat_file = function (args) {
    var a = parseArgs(args), sha = this.resolve(a.pos[0] || 'HEAD'), c = this.commits[sha];
    if (a.flags['-t']) return 'commit';
    var L = ['tree ' + sha40(JSON.stringify(c.tree, Object.keys(c.tree).sort()))];
    c.parents.forEach(function (p) { L.push('parent ' + p); });
    L.push('author ' + c.author, 'committer ' + c.author, '', c.message);
    return L.join('\n');
  };

  // ------------------------------------------------------------------
  // Remote operations
  // ------------------------------------------------------------------

  Sim.prototype.requireRemote = function () {
    if (!this.remote) throw new GitError("fatal: 'origin' does not appear to be a git repository\nfatal: Could not read from remote repository.");
  };

  Sim.prototype.git_remote = function (args) {
    var a = parseArgs(args);
    if (a.pos[0] === 'add') {
      if (this.remote) throw new GitError('error: remote ' + a.pos[1] + ' already exists.');
      this.remote = { name: 'origin', url: (a.pos[2] || 'github.com:you/project.git').replace(/^https:\/\//, ''), branches: {}, prs: [], protect: {} };
      return '';
    }
    if (!this.remote) return '';
    if (a.flags['-v']) {
      return 'origin\tgit@' + this.remote.url + ' (fetch)\norigin\tgit@' + this.remote.url + ' (push)';
    }
    return 'origin';
  };

  Sim.prototype.doFetch = function (prune) {
    var L = [], self = this, server = this.remote.branches;
    Object.keys(server).sort().forEach(function (b) {
      var ref = 'origin/' + b, old = self.tracking[ref];
      if (old === server[b]) return;
      if (!old) L.push(' * [new branch]      ' + b + ' -> ' + ref);
      else L.push('   ' + self.short(old) + '..' + self.short(server[b]) + '  ' + b + ' -> ' + ref);
      self.tracking[ref] = server[b];
    });
    Object.keys(this.tracking).forEach(function (ref) {
      var b = ref.slice(7);
      if (!server[b] && prune) { L.push(' - [deleted]         (none) -> ' + ref); delete self.tracking[ref]; }
    });
    return L.length ? 'From ' + this.remote.url.replace(/\.git$/, '') + '\n' + L.join('\n') : '';
  };

  Sim.prototype.git_fetch = function (args) {
    var a = parseArgs(args);
    this.requireRemote();
    return this.doFetch(a.flags['--prune'] || a.flags['-p']);
  };

  Sim.prototype.git_pull = function (args) {
    var a = parseArgs(args);
    this.requireRemote();
    var branch = this.currentBranch();
    if (!branch) throw new GitError('You are not currently on a branch.');
    var up = a.pos[1] ? 'origin/' + a.pos[1] : this.upstream[branch];
    var fetched = this.doFetch(false);
    if (!up || !this.tracking[up]) {
      throw new GitError((fetched ? fetched + '\n' : '') + 'There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\n\n    git pull origin <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/<branch> ' + branch);
    }
    var res;
    if (a.flags['--rebase'] || a.flags['-r']) res = this.git_rebase([up]);
    else res = this.git_merge(a.flags['--ff-only'] ? ['--ff-only', up] : [up]);
    var text = typeof res === 'string' ? res : res.out;
    return { out: (fetched ? fetched + '\n' : '') + text, err: typeof res !== 'string' && res.err };
  };

  Sim.prototype.git_push = function (args) {
    var a = parseArgs(args, ['--delete', '-d']), self = this;
    this.requireRemote();
    var server = this.remote.branches, url = this.remote.url;
    var pos = a.pos.filter(function (p) { return p !== 'origin'; });
    var del = a.flags['--delete'] || a.flags['-d'];
    if (del === true) del = pos[0];
    if (!del && pos[0] && pos[0][0] === ':') del = pos[0].slice(1);
    if (del) {
      if (!server[del]) throw new GitError("error: unable to delete '" + del + "': remote ref does not exist");
      delete server[del]; delete this.tracking['origin/' + del];
      return 'To ' + url + '\n - [deleted]         ' + del;
    }
    if (a.flags['--tags']) return 'To ' + url + '\n' + Object.keys(this.tags).sort().map(function (t) { return ' * [new tag]         ' + t + ' -> ' + t; }).join('\n');
    var branch = pos[0] || this.currentBranch();
    if (!branch) throw new GitError('fatal: You are not currently on a branch.');
    if (this.tags[branch] && !this.branches[branch]) return 'To ' + url + '\n * [new tag]         ' + branch + ' -> ' + branch;
    if (!this.branches[branch]) throw new GitError("error: src refspec " + branch + " does not match any");
    var setUp = a.flags['-u'] || a.flags['--set-upstream'];
    if (!pos.length && !this.upstream[branch] && !setUp) {
      throw new GitError('fatal: The current branch ' + branch + ' has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ' + branch + '\n');
    }
    var local = this.branches[branch], remoteSha = server[branch], known = this.tracking['origin/' + branch];
    var force = a.flags['--force'] || a.flags['-f'], lease = a.flags['--force-with-lease'];
    var L = ['To ' + url];
    if (this.remote.protect[branch]) {
      return {
        out: 'remote: error: GH006: Protected branch update failed for refs/heads/' + branch + '.\nremote: error: Changes must be made through a pull request.\n' + L[0] + '\n ! [remote rejected] ' + branch + ' -> ' + branch + ' (protected branch hook declined)\nerror: failed to push some refs to \'' + url + "'", err: true
      };
    }
    if (remoteSha === local) {
      if (setUp) { this.upstream[branch] = 'origin/' + branch; this.tracking['origin/' + branch] = local; }
      return 'Everything up-to-date' + (setUp ? "\nbranch '" + branch + "' set up to track 'origin/" + branch + "'." : '');
    }
    if (!remoteSha) L.push(' * [new branch]      ' + branch + ' -> ' + branch);
    else if (this.isAncestor(remoteSha, local)) L.push('   ' + this.short(remoteSha) + '..' + this.short(local) + '  ' + branch + ' -> ' + branch);
    else if (force) L.push(' + ' + this.short(remoteSha) + '...' + this.short(local) + ' ' + branch + ' -> ' + branch + ' (forced update)');
    else if (lease) {
      if (known !== remoteSha) {
        return { out: L[0] + '\n ! [rejected]        ' + branch + ' -> ' + branch + ' (stale info)\nerror: failed to push some refs to \'' + url + "'\n(The remote moved since your last fetch, so the lease refused to overwrite it. Fetch and look before forcing.)", err: true };
      }
      L.push(' + ' + this.short(remoteSha) + '...' + this.short(local) + ' ' + branch + ' -> ' + branch + ' (forced update)');
    } else {
      var reason = known === remoteSha ? 'non-fast-forward' : 'fetch first';
      return {
        out: L[0] + '\n ! [rejected]        ' + branch + ' -> ' + branch + ' (' + reason + ')\nerror: failed to push some refs to \'' + url + "'\n" +
          (reason === 'fetch first'
            ? 'hint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: \'git pull\' before pushing again.'
            : 'hint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. If you want to integrate the remote changes,\nhint: use \'git pull\' before pushing again.'),
        err: true
      };
    }
    server[branch] = local;
    this.tracking['origin/' + branch] = local;
    if (setUp) { this.upstream[branch] = 'origin/' + branch; L.push("branch '" + branch + "' set up to track 'origin/" + branch + "'."); }
    return L.join('\n');
  };

  // ------------------------------------------------------------------
  // gh: a small slice of the GitHub CLI, for the pull request loop
  // ------------------------------------------------------------------

  Sim.prototype.findPr = function (ref) {
    var prs = this.remote.prs, branch = this.currentBranch();
    if (ref) {
      var n = +String(ref).replace('#', '');
      return prs.filter(function (p) { return p.number === n || p.head === ref; })[0];
    }
    return prs.filter(function (p) { return p.head === branch && p.state === 'OPEN'; })[0] ||
      prs.filter(function (p) { return p.head === branch; })[0];
  };

  Sim.prototype.gh = function (args) {
    var self = this;
    if (args[0] === 'auth') return 'github.com\n  Logged in to github.com account you (simulated)';
    if (args[0] === 'repo') return 'you/project\nA practice repository\n';
    if (args[0] !== 'pr') {
      return { out: 'This lab simulates a small part of gh:\n  gh pr create --title "..." [--body "..."] [--draft]\n  gh pr list\n  gh pr view [number]\n  gh pr merge [number] --merge | --squash | --rebase [--delete-branch]', err: !!args[0] };
    }
    this.requireRemote();
    var sub = args[1], a = parseArgs(args.slice(2), ['--title', '-t', '--body', '-b', '--base', '-B', '--head', '-H']);
    var server = this.remote.branches, prs = this.remote.prs;

    if (sub === 'create') {
      var head = a.flags['--head'] || a.flags['-H'] || this.currentBranch();
      var base = a.flags['--base'] || a.flags['-B'] || 'main';
      if (!head) throw new GitError('could not determine the current branch');
      if (head === base) throw new GitError('pull request create failed: head and base are the same branch (' + base + '). Switch to your feature branch first.');
      if (!server[head]) throw new GitError('aborted: you must first push the current branch to a remote, or use the --head flag');
      if (server[head] !== this.branches[head]) throw new GitError('aborted: ' + head + ' has commits that are not pushed yet. Run git push first.');
      if (prs.some(function (p) { return p.head === head && p.state === 'OPEN'; })) throw new GitError('a pull request for branch "' + head + '" into branch "' + base + '" already exists');
      if (this.isAncestor(server[head], server[base])) throw new GitError('pull request create failed: No commits between ' + base + ' and ' + head);
      var title = a.flags['--title'] || a.flags['-t'] || (a.flags['--fill'] || a.flags['-f'] ? this.subject(server[head]) : null);
      if (!title) throw new GitError('In this lab, give the pull request a title:\n  gh pr create --title "Your title"');
      var pr = { number: prs.length + 1, title: title, body: a.flags['--body'] || a.flags['-b'] || '', head: head, base: base, state: 'OPEN', draft: !!a.flags['--draft'] };
      prs.push(pr);
      return '\nCreating ' + (pr.draft ? 'draft ' : '') + 'pull request for ' + head + ' into ' + base + ' in you/project\n\nhttps://github.com/you/project/pull/' + pr.number;
    }
    if (sub === 'list') {
      var open = prs.filter(function (p) { return a.flags['--state'] === 'all' || p.state === 'OPEN'; });
      if (!open.length) return 'no open pull requests in you/project';
      return open.map(function (p) { return '#' + p.number + '  ' + p.title + '  ' + p.head + '  ' + (p.draft ? 'DRAFT' : p.state); }).join('\n');
    }
    if (sub === 'view' || sub === 'status') {
      var v = this.findPr(a.pos[0]);
      if (!v) throw new GitError('no pull requests found for branch "' + (this.currentBranch() || '') + '"');
      var mergeable = v.state === 'OPEN' ? (this.prMergeResult(v).conflicts.length ? 'CONFLICTING' : 'MERGEABLE') : '-';
      return v.title + ' #' + v.number + '\n' + (v.draft ? 'Draft' : v.state === 'OPEN' ? 'Open' : v.state === 'MERGED' ? 'Merged' : 'Closed') +
        ' - you wants to merge ' + v.head + ' into ' + v.base + '\nmergeable: ' + mergeable + (v.body ? '\n\n  ' + v.body : '') +
        '\n\nView this pull request on GitHub: https://github.com/you/project/pull/' + v.number;
    }
    if (sub === 'ready') {
      var r = this.findPr(a.pos[0]);
      if (!r) throw new GitError('no pull request found');
      r.draft = false;
      return 'Pull request #' + r.number + ' is marked as "ready for review"';
    }
    if (sub === 'merge') {
      var m = this.findPr(a.pos[0]);
      if (!m) throw new GitError('no pull requests found for branch "' + (this.currentBranch() || '') + '"');
      if (m.state !== 'OPEN') throw new GitError('Pull request #' + m.number + ' was already ' + m.state.toLowerCase());
      if (m.draft) throw new GitError('Pull request #' + m.number + ' is still a draft. Run: gh pr ready');
      var method = a.flags['--squash'] || a.flags['-s'] ? 'squash' : a.flags['--rebase'] || a.flags['-r'] ? 'rebase' : a.flags['--merge'] || a.flags['-m'] ? 'merge' : null;
      if (!method) throw new GitError('Choose how to merge:\n  gh pr merge --merge     keep every commit and add a merge commit\n  gh pr merge --squash    combine the branch into one commit\n  gh pr merge --rebase    replay the commits for a straight line');
      var baseTip = server[m.base], headTip = server[m.head];
      var result = this.prMergeResult(m);
      if (result.conflicts.length) throw new GitError('X Pull request #' + m.number + ' is not mergeable: the merge commit cannot be cleanly created.\nTo have the pull request merged after all the requirements have been met, resolve the conflicts first.');
      var verbPast;
      if (method === 'merge') {
        server[m.base] = this.newCommit([baseTip, headTip], result.tree, 'Merge pull request #' + m.number + ' from you/' + m.head + '\n\n' + m.title);
        verbPast = 'Merged';
      } else if (method === 'squash') {
        server[m.base] = this.newCommit([baseTip], result.tree, m.title + ' (#' + m.number + ')');
        verbPast = 'Squashed and merged';
      } else {
        var baseSet = this.ancestors(baseTip), chain = [], w = headTip, tip = baseTip;
        while (w && !baseSet[w]) { chain.unshift(w); w = this.commits[w].parents[0]; }
        chain.forEach(function (s) {
          var c = self.commits[s];
          var step = self.mergeTrees(self.tree(c.parents[0]), self.tree(tip), c.tree, { ours: 'base', theirs: 'head' });
          tip = self.newCommit([tip], step.tree, c.message, c.author);
        });
        server[m.base] = tip;
        verbPast = 'Rebased and merged';
      }
      m.state = 'MERGED';
      var L = ['✓ ' + verbPast + ' pull request #' + m.number + ' (' + m.title + ')'];
      if (a.flags['--delete-branch'] || a.flags['-d']) {
        delete server[m.head];
        delete this.tracking['origin/' + m.head];
        if (this.branches[m.head]) {
          if (this.currentBranch() === m.head && !this.hasTrackedChanges()) {
            this.tracking['origin/' + m.base] = server[m.base];
            if (this.branches[m.base] && this.isAncestor(this.branches[m.base], server[m.base])) this.branches[m.base] = server[m.base];
            this.setCleanTree(this.tree(this.branches[m.base]));
            this.head = { type: 'branch', name: m.base };
            this.reflog.unshift({ sha: this.branches[m.base], msg: 'checkout: moving to ' + m.base });
            delete this.branches[m.head]; delete this.upstream[m.head];
            L.push('✓ Deleted local branch ' + m.head + ' and switched to branch ' + m.base);
          } else if (this.currentBranch() !== m.head) {
            delete this.branches[m.head]; delete this.upstream[m.head];
            L.push('✓ Deleted local branch ' + m.head);
          }
        }
        L.push('✓ Deleted remote branch ' + m.head);
      }
      return L.join('\n');
    }
    throw new GitError('unknown command "gh pr ' + (sub || '') + '". Try: gh pr create, list, view, merge');
  };

  Sim.prototype.prMergeResult = function (pr) {
    var server = this.remote.branches, b = server[pr.base], h = server[pr.head];
    if (!b || !h) return { tree: {}, conflicts: [{ path: '(branch missing)' }], auto: [] };
    return this.mergeTrees(this.tree(this.mergeBase(b, h)), this.tree(b), this.tree(h), { ours: pr.base, theirs: pr.head });
  };

  // ------------------------------------------------------------------
  // Views for the UI
  // ------------------------------------------------------------------

  Sim.prototype.readFile = function (path) { return this.work[path]; };

  Sim.prototype.writeFile = function (path, content) {
    if (content && content[content.length - 1] !== '\n') content += '\n';
    this.work[normPath(path)] = content;
  };

  /** Working-tree files with a one-word state, for the Files panel. */
  Sim.prototype.files = function () {
    var st = this.status(), state = {}, self = this;
    Object.keys(this.work).forEach(function (p) { state[p] = 'clean'; });
    st.staged.forEach(function (f) { if (f.path in self.work) state[f.path] = 'staged'; });
    st.unstaged.forEach(function (f) { if (f.path in self.work) state[f.path] = 'modified'; });
    st.untracked.forEach(function (p) { state[p] = 'untracked'; });
    st.conflicted.forEach(function (p) { if (p in self.work) state[p] = 'conflict'; });
    return Object.keys(state).sort().map(function (p) { return { path: p, state: state[p] }; });
  };

  /**
   * A picture-ready description of the commit graph.
   * side: 'local' (your clone) or 'server' (what GitHub has).
   */
  Sim.prototype.graph = function (side) {
    var self = this, branches = {}, remotes = {}, tags = {}, keep = {}, head = null;
    if (side === 'server') {
      if (!this.remote) return null;
      branches = clone(this.remote.branches);
      Object.keys(branches).forEach(function (b) { Object.assign(keep, self.ancestors(branches[b])); });
    } else {
      branches = clone(this.branches);
      remotes = clone(this.tracking);
      Object.keys(this.tags).forEach(function (t) { tags[t] = self.tags[t].sha; });
      keep = this.reachableFromRefs();
      head = this.currentBranch() || this.headSha();
    }
    var commits = [];
    Object.keys(this.commits).forEach(function (sha) {
      var c = self.commits[sha], reachable = !!keep[sha];
      if (side === 'server' && !reachable) return;
      if (side !== 'server' && !reachable) {
        // only show unreachable commits the learner has actually had locally
        var known = self.reflog.some(function (e) { return e.sha === sha; });
        if (!known) return;
      }
      commits.push({ id: self.short(sha), sha: sha, parents: c.parents.map(function (p) { return self.short(p); }), msg: self.subject(sha), seq: c.seq, ghost: !reachable });
    });
    commits.sort(function (x, y) { return x.seq - y.seq; });
    var ids = {};
    commits.forEach(function (c) { ids[c.id] = true; });
    commits.forEach(function (c) { c.parents = c.parents.filter(function (p) { return ids[p]; }); });
    function shortAll(map) {
      var out = {};
      Object.keys(map).forEach(function (k) { if (map[k]) out[k] = self.short(map[k]); });
      return out;
    }
    return {
      commits: commits, branches: shortAll(branches), remotes: shortAll(remotes), tags: shortAll(tags),
      head: head && this.commits[head] ? this.short(head) : head
    };
  };

  // ------------------------------------------------------------------
  // Lab checks
  // ------------------------------------------------------------------

  function asList(v) { return Array.isArray(v) ? v : [v]; }

  /** Evaluate a lab step's check against the simulator. ran = commands since the step began. */
  function evaluate(check, sim, ran) {
    var st = sim.status();
    return Object.keys(check).every(function (key) {
      var v = check[key];
      switch (key) {
        case 'not': return !evaluate(v, sim, ran);
        case 'ran': { var re = new RegExp(v); return (ran || []).some(function (l) { return re.test(l); }); }
        case 'branch': return sim.currentBranch() === v;
        case 'branchExists': return asList(v).every(function (b) { return !!sim.branches[b]; });
        case 'branchMissing': return asList(v).every(function (b) { return !sim.branches[b]; });
        case 'headDetached': return st.detached === v;
        case 'clean': return st.clean === v;
        case 'staged': return asList(v).every(function (p) { return st.staged.some(function (f) { return f.path === p; }); });
        case 'unstaged': return asList(v).every(function (p) { return st.unstaged.some(function (f) { return f.path === p; }); });
        case 'untracked': return asList(v).every(function (p) { return st.untracked.indexOf(p) !== -1; });
        case 'minCommits': return Object.keys(v).every(function (ref) {
          var sha = sim.tryResolve(ref);
          return !!sha && Object.keys(sim.ancestors(sha)).length >= v[ref];
        });
        case 'merging': return (!!sim.pending && sim.pending.kind === 'merge') === v;
        case 'rebasing': return (!!sim.pending && sim.pending.kind === 'rebase') === v;
        case 'conflicts': return st.conflicted.length === v;
        case 'isAncestor': { var a = sim.tryResolve(v[0]), b = sim.tryResolve(v[1]); return !!a && !!b && sim.isAncestor(a, b); }
        case 'sameCommit': { var x = sim.tryResolve(v[0]), y = sim.tryResolve(v[1]); return !!x && x === y; }
        case 'differentCommit': { var p = sim.tryResolve(v[0]), q = sim.tryResolve(v[1]); return !!p && !!q && p !== q; }
        case 'fileContains': return asList(v.text).every(function (t) { return (sim.work[v.path] || '').indexOf(t) !== -1; });
        case 'fileLacks': return v.path in sim.work && asList(v.text).every(function (t) { return sim.work[v.path].indexOf(t) === -1; });
        case 'fileExists': return asList(v).every(function (f) { return f in sim.work; });
        case 'fileMissing': return asList(v).every(function (f) { return !(f in sim.work); });
        case 'headMessage': return !!st.head && new RegExp(v).test(sim.commits[st.head].message);
        case 'parents': { var s = sim.tryResolve(v.ref || 'HEAD'); return !!s && sim.commits[s].parents.length === v.count; }
        case 'stash': return sim.stashes.length === v;
        case 'tagExists': return asList(v).every(function (t) { return !!sim.tags[t]; });
        case 'linear': { var tip = sim.tryResolve(v); return !!tip && Object.keys(sim.ancestors(tip)).every(function (c) { return sim.commits[c].parents.length < 2; }); }
        case 'reachable': {
          var from = sim.tryResolve(v.ref || 'HEAD'), rx = new RegExp(v.message);
          return !!from && Object.keys(sim.ancestors(from)).some(function (c) { return rx.test(sim.commits[c].message); });
        }
        case 'prOpen': return !!sim.remote && sim.remote.prs.filter(function (pr) { return pr.state === 'OPEN'; }).length === v;
        case 'prMerged': return !!sim.remote && sim.remote.prs.some(function (pr) { return pr.state === 'MERGED'; }) === v;
        default: throw new Error('unknown lab check: ' + key);
      }
    });
  }

  /** Build a simulator from a lab's setup commands. Throws if setup itself fails. */
  function fromSetup(setup) {
    var sim = new Sim();
    (setup || []).forEach(function (line) {
      var res = sim.run(line, { silent: true });
      if (res.err) throw new Error('lab setup failed at "' + line + '": ' + res.out);
    });
    sim.reflogStart = sim.reflog.length;
    return sim;
  }

  return {
    Sim: Sim, fromSetup: fromSetup, evaluate: evaluate,
    diff3: diff3, diffLines: diffLines, toLines: toLines, fromLines: fromLines, tokenize: tokenize
  };
});
