/*
 * app.js: boots the guide.
 *
 * Loads the content, applies display settings, builds the navigation, and
 * routes on the URL hash. Routes are plain names with no slashes, because
 * some hosts only pass a simple #name through to an embedded page:
 *
 *   #home  #track-basics  #basics-commits  #lab  #lab-merge-conflict
 *   #drills  #drill-leaked-secret  #cards  #cheatsheet  #glossary
 *   #progress  #placement  #about
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h;
  var root = document.documentElement;
  var hostTheme = root.getAttribute('data-theme');
  var themeOverridden = false;
  var main, tracksById = {}, labsById = {}, drillsById = {}, currentRoute = null, firstRender = true;
  var SIMPLE = ['cards', 'cheatsheet', 'glossary', 'progress', 'placement', 'about'];

  GG.app = {
    order: [],
    cleanups: [],
    lesson: function (id) { return GG.data.lessons[id]; },
    track: function (id) { return tracksById[id]; },
    trackOf: function (lessonId) { return tracksById[GG.data.lessons[lessonId].track]; },
    lab: function (id) { return labsById[id]; },
    drill: function (id) { return drillsById[id]; },
    lessonForLab: function (labId) {
      for (var i = 0; i < GG.app.order.length; i++) {
        var l = GG.data.lessons[GG.app.order[i]];
        if (l.lab === labId) return l;
      }
      return null;
    },
    go: function (route) { window.location.hash = route; },
    rerender: function () { render(false); },
    applyPrefs: applyPrefs,
    cardsDue: function () {
      var cards = GG.store.progress().cards, today = GG.today(), n = 0;
      Object.keys(cards).forEach(function (k) { if (cards[k].due <= today) n++; });
      return n;
    }
  };

  // ---------------------------------------------------------------- display settings

  function attr(name, value) {
    if (value) root.setAttribute(name, value); else root.removeAttribute(name);
  }

  function applyPrefs() {
    var p = GG.store.prefs();
    if (p.theme === 'auto') {
      if (themeOverridden) { attr('data-theme', hostTheme); themeOverridden = false; }
    } else {
      root.setAttribute('data-theme', p.theme);
      themeOverridden = true;
    }
    attr('data-contrast', p.contrast === 'more' ? 'more' : null);
    attr('data-size', p.size !== 'm' ? p.size : null);
    attr('data-spacing', p.spacing === 'relaxed' ? 'relaxed' : null);
    attr('data-font', p.font === 'system' ? 'system' : null);
    attr('data-motion', p.motion === 'reduce' ? 'reduce' : null);
    // Focus mode hides the navigation, so it only applies while reading a lesson.
    attr('data-focus', p.focus === 'on' && currentRoute && currentRoute.view === 'lesson' ? 'on' : null);
    Array.prototype.forEach.call(document.querySelectorAll('link[data-webfont]'), function (link) {
      link.disabled = p.font === 'system';
    });
  }

  // ---------------------------------------------------------------- navigation

  function navItem(route, icon, label, extra) {
    return h('li', null, h('a', { href: '#' + route, 'data-nav': route }, typeof icon === 'string' ? GG.icon(icon) : icon, h('span', null, label), extra || null));
  }

  function buildNav() {
    var rail = document.getElementById('rail'), progress = GG.store.progress();
    GG.clear(rail);
    var items = [navItem('home', 'home', 'Home'), h('li.nav-group', { 'aria-hidden': 'true' }, 'Tracks')];
    GG.data.tracks.forEach(function (t) {
      var st = GG.progress.trackStats(t, GG.data.lessons, progress);
      items.push(h('li.t-' + t.id, null, h('a', { href: '#track-' + t.id, 'data-nav': 'track-' + t.id },
        h('span.roundel.sm', { 'aria-hidden': 'true' }, t.letter), h('span', null, t.title),
        h('span.count', { 'aria-label': st.done + ' of ' + st.total + ' lessons complete' }, st.done + '/' + st.total))));
    });
    items.push(h('li.nav-group', { 'aria-hidden': 'true' }, 'Practice'), navItem('lab', 'terminal', 'Practice lab'), navItem('drills', 'target', 'Drills'));
    items.push(h('li.nav-group', { 'aria-hidden': 'true' }, 'Review'), navItem('cards', 'cards', 'Flashcards'), navItem('cheatsheet', 'list', 'Cheat sheet'), navItem('glossary', 'az', 'Glossary'));
    items.push(h('li.nav-group', { 'aria-hidden': 'true' }, 'You'), navItem('progress', 'chart', 'Progress'), navItem('placement', 'compass', 'Find your start'), navItem('about', 'layers', 'How it is built'));
    rail.appendChild(h('ul.nav', null, items));
    markNav();
  }

  function homeTrack() {
    var progress = GG.store.progress(), recent = null;
    Object.keys(progress.lessons).forEach(function (id) {
      if (GG.data.lessons[id] && (!recent || (progress.lessons[id].seen || 0) > (progress.lessons[recent].seen || 0))) recent = id;
    });
    if (recent) return GG.data.lessons[recent].track;
    return progress.placement && tracksById[progress.placement.track] ? progress.placement.track : GG.data.tracks[0].id;
  }

  function buildTabbar() {
    var bar = document.getElementById('tabbar');
    GG.clear(bar);
    function tab(route, key, icon, label) {
      return h('a', { href: '#' + route, 'data-tab': key }, GG.icon(icon), h('span', null, label));
    }
    bar.appendChild(tab('home', 'home', 'home', 'Home'));
    bar.appendChild(tab('track-' + homeTrack(), 'tracks', 'route', 'Tracks'));
    bar.appendChild(tab('lab', 'lab', 'terminal', 'Lab'));
    bar.appendChild(tab('cards', 'cards', 'cards', 'Cards'));
    bar.appendChild(h('button', { type: 'button', 'data-tab': 'more', onclick: function () { GG.ui.openMore(); } }, GG.icon('menu'), h('span', null, 'More')));
  }

  function markNav() {
    if (!currentRoute) return;
    var r = currentRoute, key = r.view, tab = 'more';
    if (r.view === 'home') { key = 'home'; tab = 'home'; }
    else if (r.view === 'track') { key = 'track-' + r.id; tab = 'tracks'; }
    else if (r.view === 'lesson') { key = 'track-' + GG.data.lessons[r.id].track; tab = 'tracks'; }
    else if (r.view === 'labs' || r.view === 'lab') { key = 'lab'; tab = 'lab'; }
    else if (r.view === 'drills' || r.view === 'drill') key = 'drills';
    else if (r.view === 'cards') tab = 'cards';
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------------------------------------------------------------- routing

  function parse(hash) {
    try { hash = decodeURIComponent(hash.replace(/^#/, '')); } catch (e) { hash = ''; }
    if (!hash || hash === 'home') return { view: 'home' };
    if (hash.indexOf('track-') === 0 && tracksById[hash.slice(6)]) return { view: 'track', id: hash.slice(6) };
    if (GG.data.lessons[hash]) return { view: 'lesson', id: hash };
    if (hash === 'lab') return { view: 'labs' };
    if (labsById[hash]) return { view: 'lab', id: hash };
    if (hash === 'drills') return { view: 'drills' };
    if (drillsById[hash]) return { view: 'drill', id: hash };
    if (SIMPLE.indexOf(hash) !== -1) return { view: hash };
    return null;
  }

  function render(navigated) {
    var r = currentRoute;
    GG.app.cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } });
    GG.speech.stop();
    var view;
    try {
      view = GG.views[r.view](r.id);
    } catch (err) {
      view = h('div.page', null, h('h1', null, 'This page hit a problem'),
        h('p', null, 'Something in the guide broke while drawing this page. Going back home usually clears it.'),
        h('p.mono.small.muted', null, String(err && err.message || err)),
        h('p', null, h('a.btn', { href: '#home' }, 'Back to the start')));
      if (window.console) console.error(err);
    }
    GG.clear(main).appendChild(view);
    applyPrefs();
    markNav();
    if (navigated) {
      window.scrollTo(0, 0);
      // Move keyboard and screen-reader focus to the new page's heading.
      var heading = main.querySelector('h1');
      if (heading && !firstRender) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
    firstRender = false;
  }

  function onHash() {
    var raw = window.location.hash.replace(/^#/, ''), next = parse(window.location.hash);
    if (!next) {
      // not a route: maybe an anchor inside the current page
      var target = currentRoute && raw && document.getElementById(raw);
      if (target) {
        target.scrollIntoView();
        if (target === main) main.focus();
        return;
      }
      next = { view: 'home' };
    }
    currentRoute = next;
    GG.store.setLast(raw);
    render(true);
    buildTabbar();
    markNav();
  }

  // ---------------------------------------------------------------- boot

  function loadContent() {
    var inline = document.getElementById('gg-content');
    if (inline) return Promise.resolve(JSON.parse(inline.textContent));
    return fetch('data/content.json').then(function (res) {
      if (!res.ok) throw new Error('The content file answered with status ' + res.status + '.');
      return res.json();
    });
  }

  function boot(data) {
    GG.data = data;
    data.tracks.forEach(function (t) {
      tracksById[t.id] = t;
      t.lessons.forEach(function (id) { GG.app.order.push(id); });
    });
    data.labs.forEach(function (l) { labsById[l.id] = l; });
    data.drills.forEach(function (d) { drillsById[d.id] = d; });

    buildNav();
    buildTabbar();
    window.addEventListener('hashchange', onHash);
    onHash();

    GG.store.onChange(function (what) {
      if (what === 'lesson' || what === 'merge' || what === 'reset') buildNav();
      if (what === 'merge' && currentRoute && ['home', 'track', 'progress'].indexOf(currentRoute.view) !== -1) render(false);
    });

    GG.platform.onReady.push(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-needs="tts"]'), function (el) { el.hidden = !GG.speech.available(); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-needs="ask"]'), function (el) { el.hidden = !GG.platform.ask; });
      if (currentRoute && currentRoute.view === 'progress') render(false);
    });
  }

  function start() {
    main = document.getElementById('main');
    applyPrefs();
    document.getElementById('btn-search').addEventListener('click', function () { GG.ui.openSearch(); });
    document.getElementById('btn-display').addEventListener('click', function () { GG.ui.openPrefs(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (GG.data) GG.ui.openSearch();
    });

    loadContent().then(boot).catch(function (err) {
      GG.clear(main).appendChild(h('div.page', null,
        h('h1', null, 'The guide could not load its content'),
        h('p', null, 'The page is here, but the lessons did not arrive.'),
        h('ul', null,
          h('li', null, 'If you opened ', h('code', null, 'index.html'), ' straight from a folder, browsers block it from reading its data file. Open ', h('code', null, 'offline.html'), ' instead, or run ', h('code', null, 'python3 tools/serve.py'), '.'),
          h('li', null, 'If this is the published site, reload the page. A deploy may have been in progress.')),
        h('p.mono.small.muted', null, String(err && err.message || err))));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
