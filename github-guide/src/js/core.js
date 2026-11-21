/*
 * core.js: small helpers every other file uses.
 *
 * No framework. `h()` builds DOM nodes, `inline()` turns the content files'
 * tiny markup subset into nodes, and nothing here ever assigns innerHTML,
 * so content can never inject markup.
 */
(function () {
  'use strict';
  var GG = (window.GG = window.GG || {});

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** True when the page is embedded in another page (for example a viewer frame). */
  GG.framed = (function () {
    try { return window.self !== window.top; } catch (e) { return true; }
  })();

  function append(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  function build(el, attrs, children) {
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') el.setAttribute('class', ((el.getAttribute('class') || '') + ' ' + value).trim());
        else if (key.slice(0, 2) === 'on' && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (key === 'dataset') Object.keys(value).forEach(function (d) { el.dataset[d] = value[d]; });
        else if (key === 'style') el.setAttribute('style', value);
        else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, String(value));
      });
    }
    append(el, children);
    return el;
  }

  function parseSpec(spec) {
    var parts = spec.split('.'), first = parts[0].split('#');
    return { tag: first[0] || 'div', id: first[1], classes: parts.slice(1) };
  }

  /** h('button.btn.primary', {onclick: fn}, 'Save') */
  GG.h = function (spec, attrs) {
    var s = parseSpec(spec), el = document.createElement(s.tag);
    if (s.id) el.id = s.id;
    if (s.classes.length) el.className = s.classes.join(' ');
    return build(el, attrs, Array.prototype.slice.call(arguments, 2));
  };

  /** Same, for SVG elements. */
  GG.s = function (spec, attrs) {
    var s = parseSpec(spec), el = document.createElementNS(SVG_NS, s.tag);
    if (s.classes.length) el.setAttribute('class', s.classes.join(' '));
    return build(el, attrs, Array.prototype.slice.call(arguments, 2));
  };

  GG.clear = function (el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  // ---------------------------------------------------------------- inline markup

  var INLINE = /(`[^`\n]+`)|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\{\{[^}]+\}\})/g;

  /** Render **bold**, *italic*, `code`, [links](https://...) and {{keys}} into a fragment. */
  GG.inline = function (text) {
    var frag = document.createDocumentFragment(), last = 0, m;
    text = String(text === undefined || text === null ? '' : text);
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var tok = m[0];
      if (m[1]) frag.appendChild(GG.h('code', null, tok.slice(1, -1)));
      else if (m[2]) frag.appendChild(GG.h('strong', null, inner(tok.slice(2, -2))));
      else if (m[3]) frag.appendChild(GG.h('em', null, inner(tok.slice(1, -1))));
      else if (m[4]) {
        var split = tok.lastIndexOf('](');
        frag.appendChild(GG.link(tok.slice(split + 2, -1), inner(tok.slice(1, split))));
      } else frag.appendChild(GG.h('kbd', null, tok.slice(2, -2)));
      last = m.index + tok.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  };

  function inner(text) {
    // one level of nesting is enough for the content we write
    var saved = INLINE.lastIndex, out = GG.inline(text);
    INLINE.lastIndex = saved;
    return out;
  }

  /** A link that is safe for both a normal tab and an embedded frame. */
  GG.link = function (url, label, attrs) {
    var a = GG.h('a', Object.assign({ href: url }, attrs || {}), label);
    if (url.charAt(0) !== '#') {
      a.setAttribute('rel', 'noopener noreferrer');
      // In a frame the host opens outside links itself; target=_blank can be blocked there.
      if (!GG.framed) a.setAttribute('target', '_blank');
      a.appendChild(GG.h('span.vh', null, ' (external site)'));
    }
    return a;
  };

  /** Plain text of a marked-up string, for search and read-aloud. */
  GG.plain = function (text) {
    // Code spans are kept verbatim: `${{ secrets.NAME }}` must survive.
    return String(text || '').split(/(`[^`\n]+`)/).map(function (part) {
      if (part.charAt(0) === '`' && part.length > 1) return part.slice(1, -1);
      return part
        .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
        .replace(/\*\*|\{\{|\}\}/g, '')
        .replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2');
    }).join('');
  };

  // ---------------------------------------------------------------- icons

  var ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10',
    route: 'M6 7m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M18 17m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M8.5 7H14a3.5 3.5 0 0 1 0 7h-4a3 3 0 0 0 0 6h5.5',
    terminal: 'M4 5h16v14H4zM7.5 10l3 2-3 2M12.5 15h4',
    cards: 'M4 8h12v12H4zM8 4h12v12',
    menu: 'M4 7h16M4 12h16M4 17h16',
    search: 'M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M20 20l-4.7-4.7',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6 6l12 12M18 6L6 18',
    right: 'M9 5l7 7-7 7',
    left: 'M15 5l-7 7 7 7',
    note: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v6M12 7.5v.2',
    warn: 'M12 4l9 16H3zM12 10v4M12 17v.2',
    danger: 'M12 4l9 16H3zM12 10v4M12 17v.2',
    tip: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
    law: 'M12 4v16M7 20h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
    a11y: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7.4v.2M7.5 10.5h9M12 10.5v4M12 14.5l-2.5 4M12 14.5l2.5 4',
    copy: 'M9 9h10v11H9zM5 15V4h10',
    play: 'M8 5l11 7-11 7z',
    stop: 'M7 7h10v10H7z',
    book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h9',
    target: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    list: 'M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01',
    az: 'M3 18l4-12 4 12M4.5 14h5M14 7h6l-6 11h6',
    chart: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    refresh: 'M20 5v5h-5M4 19v-5h5M19.5 10A8 8 0 0 0 5 8.5M4.5 14A8 8 0 0 0 19 15.5',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    speaker: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
    chat: 'M4 5h16v11H9l-5 4z',
    compass: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M15.5 8.5l-2 5-5 2 2-5z'
  };

  GG.icon = function (name) {
    return GG.s('svg.icon', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
      GG.s('path', { d: ICONS[name] || ICONS.note }));
  };

  // ---------------------------------------------------------------- misc

  GG.debounce = function (fn, ms) {
    var timer;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  var uidCounter = 0;
  GG.uid = function (prefix) { return (prefix || 'u') + '-' + (++uidCounter); };

  var toastTimer;
  /** Show a short message and announce it to screen readers. */
  GG.toast = function (message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.textContent = ''; }, 3200);
  };

  /** Copy text. Must be called from a click. Resolves true or false. */
  GG.copy = function (text) {
    function fallback() {
      try {
        var ta = GG.h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-99rem;top:0' });
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  };

  GG.copyButton = function (getText, label) {
    return GG.h('button.icon-btn.copy', {
      type: 'button', 'aria-label': label || 'Copy',
      onclick: function () {
        GG.copy(getText()).then(function (ok) {
          GG.toast(ok ? 'Copied' : 'Copy was blocked here. Select the text and copy it by hand.');
        });
      }
    }, GG.icon('copy'));
  };

  GG.plural = function (n, word, many) {
    return n + ' ' + (n === 1 ? word : many || word + 's');
  };

  /** Days since 1970 in local time, for "is this card due today". */
  GG.today = function () {
    var d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  };
})();
