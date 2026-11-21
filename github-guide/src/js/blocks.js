/*
 * blocks.js: turns the content blocks in a lesson's JSON into DOM.
 *
 * Block types: p, list, code, callout, table, compare, flow, graph, reveal.
 * docs/AUTHORING.md describes each one.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;

  // ---------------------------------------------------------------- code coloring

  var HASH_LANGS = { bash: 1, yaml: 1, python: 1, gitignore: 1, toml: 1, ini: 1, dockerfile: 1, graphql: 1 };
  var PY_WORDS = /\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|with|as|try|except|finally|raise|lambda|yield|None|True|False|pass|break|continue)\b/g;
  var SH_WORDS = /^(\s*)(git|gh|python3?|pip|uv|conda|pytest|ruff|npm|node|cd|echo|printf|curl|docker|make|export|ssh-keygen|ssh|gpg|dvc|jupytext|nbstripout|pre-commit|scalar)(?=\s|$)/;

  /** Split a line into plain text, quoted strings and a trailing comment. */
  function segments(line, hashComments) {
    var out = [], cur = '', i = 0, quote = null;
    function flush(type) { if (cur) out.push({ t: type, v: cur }); cur = ''; }
    while (i < line.length) {
      var ch = line[i];
      if (quote) {
        cur += ch;
        if (ch === '\\' && i + 1 < line.length) { cur += line[i + 1]; i += 2; continue; }
        if (ch === quote) { flush('st'); quote = null; }
        i++; continue;
      }
      if (ch === '"' || (ch === "'" && (i === 0 || !/[A-Za-z0-9]/.test(line[i - 1])))) { flush('txt'); quote = ch; cur = ch; i++; continue; }
      if (hashComments && ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) { flush('txt'); out.push({ t: 'cm', v: line.slice(i) }); return out; }
      cur += ch; i++;
    }
    flush(quote ? 'st' : 'txt');
    return out;
  }

  function span(cls, text) { return h('span.' + cls, null, text); }

  /** Wrap regex matches in a class, leaving the rest as text. */
  function mark(text, regex, cls) {
    var frag = document.createDocumentFragment(), last = 0, m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(span(cls, m[0]));
      last = m.index + m[0].length;
      if (!regex.global) break;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function colorLine(line, lang) {
    var frag = document.createDocumentFragment();
    var segs = segments(line, !!HASH_LANGS[lang]);
    segs.forEach(function (seg, n) {
      if (seg.t === 'cm') { frag.appendChild(span('tok-cm', seg.v)); return; }
      if (seg.t === 'st') {
        var next = segs[n + 1];
        var isKey = lang === 'json' && next && next.t === 'txt' && /^\s*:/.test(next.v);
        frag.appendChild(span(isKey ? 'tok-key' : 'tok-st', seg.v));
        return;
      }
      var text = seg.v, m;
      if (n === 0 && lang === 'bash' && (m = SH_WORDS.exec(text))) {
        frag.appendChild(document.createTextNode(m[1]));
        frag.appendChild(span('tok-kw', m[2]));
        frag.appendChild(document.createTextNode(text.slice(m[0].length)));
      } else if (n === 0 && (lang === 'yaml' || lang === 'toml' || lang === 'ini') && (m = /^(\s*(?:-\s+)?)([A-Za-z0-9_.\-/]+)(\s*[:=])/.exec(text))) {
        frag.appendChild(document.createTextNode(m[1]));
        frag.appendChild(span('tok-key', m[2]));
        frag.appendChild(document.createTextNode(text.slice(m[1].length + m[2].length)));
      } else if (n === 0 && lang === 'dockerfile' && (m = /^(\s*)([A-Z]+)(?=\s)/.exec(text))) {
        frag.appendChild(document.createTextNode(m[1]));
        frag.appendChild(span('tok-kw', m[2]));
        frag.appendChild(document.createTextNode(text.slice(m[0].length)));
      } else if (lang === 'python') frag.appendChild(mark(text, PY_WORDS, 'tok-kw'));
      else if (lang === 'json') frag.appendChild(mark(text, /\b(true|false|null)\b|-?\b\d+(\.\d+)?\b/g, 'tok-kw'));
      else frag.appendChild(document.createTextNode(text));
    });
    return frag;
  }

  function highlight(code, lang) {
    var frag = document.createDocumentFragment(), side = null;
    code.split('\n').forEach(function (line, i, all) {
      var node;
      if (lang === 'diff') {
        if (/^\+(?!\+\+)/.test(line)) node = span('tok-add', line);
        else if (/^-(?!--)/.test(line)) node = span('tok-del', line);
        else if (/^(@@|diff |index |---|\+\+\+)/.test(line)) node = span('tok-cm', line);
        else node = document.createTextNode(line);
      } else if (lang === 'conflict') {
        if (/^<<<<<<< /.test(line)) { node = span('tok-mark', line); side = 'ours'; }
        else if (/^\|\|\|\|\|\|\|/.test(line)) { node = span('tok-mark', line); side = 'base'; }
        else if (/^=======$/.test(line)) { node = span('tok-mark', line); side = 'theirs'; }
        else if (/^>>>>>>> /.test(line)) { node = span('tok-mark', line); side = null; }
        else if (side === 'ours') node = span('tok-ours', line);
        else if (side === 'theirs') node = span('tok-theirs', line);
        else node = document.createTextNode(line);
      } else if (lang === 'text' || lang === 'markdown') node = document.createTextNode(line);
      else node = colorLine(line, lang);
      frag.appendChild(node);
      if (i < all.length - 1) frag.appendChild(document.createTextNode('\n'));
    });
    return frag;
  }

  var LANG_NAMES = {
    bash: 'Terminal', yaml: 'YAML', json: 'JSON', python: 'Python', diff: 'Diff', text: 'Text',
    gitignore: '.gitignore', markdown: 'Markdown', toml: 'TOML', ini: 'Config', conflict: 'Conflict',
    graphql: 'GraphQL', dockerfile: 'Dockerfile'
  };

  function codeFigure(block) {
    var label = block.file || LANG_NAMES[block.lang] || block.lang;
    return h('figure.code', null,
      h('div.code-head', null,
        h('span', null, label),
        GG.copyButton(function () { return block.code; }, 'Copy this ' + (block.file ? 'file' : 'code'))),
      h('pre', { tabindex: '0', 'aria-label': label + ' example' }, h('code', null, highlight(block.code, block.lang))),
      block.caption ? h('figcaption', null, GG.inline(block.caption)) : null);
  }

  // ---------------------------------------------------------------- blocks

  var CALLOUT_LABEL = { tip: 'Tip', note: 'Note', warn: 'Watch out', danger: 'Danger', law: 'Law and compliance', a11y: 'Accessibility' };

  var RENDER = {
    p: function (b) { return h('p', { 'data-speak': true }, GG.inline(b.text)); },

    list: function (b) {
      return h(b.ordered ? 'ol' : 'ul', null, b.items.map(function (item) {
        return h('li', { 'data-speak': true }, GG.inline(item));
      }));
    },

    code: codeFigure,

    callout: function (b) {
      return h('div.callout.kind-' + b.kind, { role: 'note' },
        GG.icon(b.kind),
        h('span.kind', null, CALLOUT_LABEL[b.kind] || 'Note'),
        h('div.body', { 'data-speak': true },
          b.title ? h('strong.t', null, GG.inline(b.title)) : null,
          h('span', null, GG.inline(b.text))));
    },

    table: function (b) {
      return h('div.table-wrap', { tabindex: '0', role: 'region', 'aria-label': b.caption || 'Table' },
        h('table', null,
          b.caption ? h('caption', null, GG.inline(b.caption)) : null,
          h('thead', null, h('tr', null, b.head.map(function (cell) { return h('th', { scope: 'col' }, GG.inline(cell)); }))),
          h('tbody', null, b.rows.map(function (row) {
            return h('tr', null, row.map(function (cell) { return h('td', null, GG.inline(cell)); }));
          }))));
    },

    compare: function (b) {
      return h('div.stack', null,
        h('div.compare', null, b.items.map(function (item) {
          return h('div.card', null,
            h('h3', null, GG.inline(item.title)),
            h('ul', null, item.points.map(function (p) { return h('li', { 'data-speak': true }, GG.inline(p)); })));
        })),
        b.caption ? h('p.xs.muted', null, GG.inline(b.caption)) : null);
    },

    flow: function (b) {
      return h('figure', null,
        h('ol.flow', null, b.steps.map(function (step) {
          return h('li', null,
            step.via ? h('span.f-via', null, h('span.vh', null, 'by '), step.via) : null,
            h('span.f-label', null, GG.inline(step.label)),
            step.note ? h('span.f-note', null, GG.inline(step.note)) : null);
        })),
        b.caption ? h('figcaption', null, GG.inline(b.caption)) : null);
    },

    graph: function (b) { return GG.graph.render(b, { caption: b.caption }); },

    reveal: function (b) {
      var id = GG.uid('reveal');
      var answer = h('div.answer', { id: id, hidden: true, 'data-speak': true }, GG.inline(b.answer));
      var btn = h('button.btn.sm', {
        type: 'button', 'aria-expanded': 'false', 'aria-controls': id,
        onclick: function () {
          var open = answer.hidden;
          answer.hidden = !open;
          btn.setAttribute('aria-expanded', String(open));
          btn.textContent = open ? 'Hide answer' : 'Show answer';
        }
      }, 'Show answer');
      return h('div.reveal', null,
        h('span.tag', null, 'Predict first'),
        h('p', { 'data-speak': true }, GG.inline(b.prompt)),
        btn, answer);
    }
  };

  GG.blocks = {
    render: function (block) {
      var fn = RENDER[block.type];
      return fn ? fn(block) : h('p.muted', null, 'Unsupported block: ' + block.type);
    },
    highlight: highlight,
    codeFigure: codeFigure,

    /** Plain text of a block, for search and for the lesson tutor's context. */
    text: function (b) {
      switch (b.type) {
        case 'p': case 'callout': return GG.plain((b.title ? b.title + '. ' : '') + b.text);
        case 'list': return b.items.map(GG.plain).join(' ');
        case 'code': return b.code;
        case 'table': return b.rows.map(function (r) { return r.map(GG.plain).join(': '); }).join('. ');
        case 'compare': return b.items.map(function (i) { return GG.plain(i.title) + ': ' + i.points.map(GG.plain).join(' '); }).join(' ');
        case 'flow': return b.steps.map(function (s) { return GG.plain(s.label); }).join(' then ');
        case 'reveal': return GG.plain(b.prompt + ' ' + b.answer);
        case 'graph': return GG.plain(b.caption || '');
        default: return '';
      }
    }
  };
})();
