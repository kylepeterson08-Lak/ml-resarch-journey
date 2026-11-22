/*
 * views-home.js: the front page and the track pages.
 *
 * The front page draws the curriculum as a transit map: four lines, one
 * station per lesson, filled in as you finish them. It is also real
 * navigation: every station is a link.
 */
(function () {
  'use strict';
  var GG = window.GG, h = GG.h, s = GG.s;
  GG.views = GG.views || {};

  // ---------------------------------------------------------------- transit map

  function buildMap(vertical) {
    var tracks = GG.data.tracks, progress = GG.store.progress();
    var maxLen = Math.max.apply(null, tracks.map(function (t) { return t.lessons.length; }));
    var W, H, pos;
    if (vertical) {
      W = 328; H = 132 + (maxLen - 1) * 40 + 34;
      pos = function (i, j) { return { x: 50 + i * 76, y: 132 + j * 40 }; };
    } else {
      W = 836; H = 68 + 3 * 66 + 40;
      pos = function (i, j) { return { x: 168 + j * 78, y: 68 + i * 66 }; };
    }
    var svg = s('svg.map', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Curriculum map: four tracks, one station per lesson' });

    // The interchange every line starts from: you can board any of them.
    if (vertical) {
      svg.appendChild(s('rect.m-hub', { x: 30, y: 16, width: 268, height: 26, rx: 13 }));
      svg.appendChild(s('text.m-hubtext', { x: 164, y: 33, 'text-anchor': 'middle' }, 'START ON ANY LINE'));
    } else {
      svg.appendChild(s('rect.m-hub', { x: 30, y: 44, width: 28, height: 246, rx: 14 }));
      svg.appendChild(s('text.m-hubtext', { x: 44, y: 167, 'text-anchor': 'middle', transform: 'rotate(-90 44 167)' }, 'START ON ANY LINE'));
    }

    tracks.forEach(function (track, i) {
      var g = s('g', { class: 't-' + track.id });
      var first = pos(i, 0), last = pos(i, track.lessons.length - 1);
      var d = vertical ? 'M' + first.x + ',42 L' + last.x + ',' + last.y : 'M58,' + first.y + ' L' + last.x + ',' + last.y;
      g.appendChild(s('path.m-line', { d: d, pathLength: '1' }));

      // line head: roundel and name
      var hx = vertical ? first.x : 100, hy = vertical ? 74 : first.y;
      var head = s('a', { href: '#track-' + track.id, 'aria-label': track.title + ' track: ' + track.subtitle });
      head.appendChild(s('circle.m-roundel', { cx: hx, cy: hy, r: 15 }));
      head.appendChild(s('text.m-letter', { x: hx, y: hy + 5, 'text-anchor': 'middle' }, track.letter));
      g.appendChild(head);
      if (vertical) g.appendChild(s('text.m-name', { x: hx, y: 106, 'text-anchor': 'middle' }, track.title));
      else g.appendChild(s('text.m-name', { x: 124, y: hy - 25 }, track.title + ' · ' + track.subtitle));

      var nextFound = false;
      track.lessons.forEach(function (id, j) {
        var lesson = GG.app.lesson(id), p = pos(i, j);
        var done = !!(progress.lessons[id] || {}).done;
        var isNext = !done && !nextFound && !lesson.stub;
        if (isNext) nextFound = true;
        var a = s('a', {
          href: '#' + id, class: 'm-station' + (done ? ' m-done' : '') + (isNext ? ' m-next' : ''),
          'aria-label': track.title + ' ' + (j + 1) + ': ' + lesson.title + (done ? ' (complete)' : isNext ? ' (next up)' : '')
        });
        a.appendChild(s('title', null, lesson.title));
        a.appendChild(s('circle.m-hit', { cx: p.x, cy: p.y, r: 18 }));
        if (isNext) a.appendChild(s('circle.m-ring', { cx: p.x, cy: p.y, r: 17 }));
        a.appendChild(s('circle.m-st', { cx: p.x, cy: p.y, r: 11.5 }));
        a.appendChild(s('text.m-num', { x: p.x, y: p.y + 4, 'text-anchor': 'middle' }, String(j + 1)));
        g.appendChild(a);
      });
      svg.appendChild(g);
    });
    return svg;
  }

  function mapFigure() {
    var holder = h('div.map-holder');
    var narrow = window.matchMedia('(max-width: 46rem)');
    function paint() { GG.clear(holder).appendChild(buildMap(narrow.matches)); }
    paint();
    var onChange = function () { paint(); };
    if (narrow.addEventListener) narrow.addEventListener('change', onChange);
    GG.app.cleanups.push(function () { if (narrow.removeEventListener) narrow.removeEventListener('change', onChange); });
    var c = GG.data.build.counts;
    return h('figure.map-wrap', null, holder,
      h('figcaption.row', null,
        h('span.key', null, h('span.dot.is-done', { 'aria-hidden': 'true' }), 'finished'),
        h('span.key', null, h('span.dot.is-next', { 'aria-hidden': 'true' }), 'next up'),
        h('span.key', null, h('span.dot', { 'aria-hidden': 'true' }), 'not started'),
        h('span', null, c.lessons + ' lessons, about ' + Math.round(c.minutes / 60) + ' hours. Every station is a link.')));
  }

  // ---------------------------------------------------------------- pieces

  function resume() {
    var progress = GG.store.progress(), best = null;
    Object.keys(progress.lessons).forEach(function (id) {
      var rec = progress.lessons[id], lesson = GG.app.lesson(id);
      if (!lesson || lesson.stub || rec.done || !rec.seen) return;
      if (!best || rec.seen > progress.lessons[best].seen) best = id;
    });
    if (best) return GG.app.lesson(best);
    // nothing half-read: offer the next unfinished lesson of the most recent track
    var recent = null;
    Object.keys(progress.lessons).forEach(function (id) {
      var rec = progress.lessons[id];
      if (GG.app.lesson(id) && (!recent || (rec.seen || 0) > (progress.lessons[recent].seen || 0))) recent = id;
    });
    if (!recent) return null;
    var stats = GG.progress.trackStats(GG.app.trackOf(recent), GG.data.lessons, progress);
    return stats.next ? GG.app.lesson(stats.next) : null;
  }

  function trackCard(track) {
    var st = GG.progress.trackStats(track, GG.data.lessons, GG.store.progress());
    var next = st.next ? GG.app.lesson(st.next) : null;
    return h('div.card.lined.track-card.stack.t-' + track.id, null,
      h('div.row', null,
        h('span.roundel', { 'aria-hidden': 'true' }, track.letter),
        h('div', null, h('h3', null, h('a', { href: '#track-' + track.id }, track.title)), h('p.small.muted', null, track.subtitle))),
      h('p.small', null, track.promise),
      h('div.stack', { style: 'gap:.35rem' },
        h('div.bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.total), 'aria-valuenow': String(st.done), 'aria-label': track.title + ' progress' },
          h('span', { style: 'width:' + st.percent + '%' })),
        h('p.xs.muted.mono', null, st.done + ' of ' + st.total + ' lessons')),
      h('div', null, next
        ? h('a.btn.sm', { href: '#' + next.id }, (st.done ? 'Continue: ' : 'Start: ') + next.title)
        : h('a.btn.sm', { href: '#track-' + track.id }, 'Track complete. Review it')));
  }

  function waysPanel() {
    var prefs = GG.store.prefs();
    var lenses = [{ id: 'rotate', label: 'Rotate' }].concat(GG.data.lenses);
    var tools = [{ id: 'auto', label: 'Auto' }].concat(GG.data.tools);
    var modes = [{ id: 'auto', label: 'Auto' }, { id: 'skim', label: 'Skim' }, { id: 'learn', label: 'Learn' }, { id: 'do', label: 'Do' }, { id: 'test', label: 'Test' }];
    function row(title, hint, control) {
      return h('div.way.stack', null, h('div', null, h('h3', null, title), h('p.small.muted', null, hint)), control);
    }
    return h('section.ways.card.stack', { 'aria-labelledby': 'ways-h' },
      h('div', null,
        h('h2', { id: 'ways-h' }, 'Change how you take it in'),
        h('p.small.muted', null, 'Three dials. Each starts on a setting that adapts to you. Change one here to fix it everywhere, or switch inside any lesson when a topic is not landing.')),
      h('div.way-grid', null,
        row('Explain ideas as', 'Rotate gives each lesson a different one of the four, so the same kind of idea reaches you several ways. Pick one to pin it.',
          GG.segmented('Explain ideas as', lenses, prefs.lens, function (id) { GG.store.setPref('lens', id); })),
        row('Show steps for', 'Auto shows phone steps on a small screen and browser steps on a large one.',
          GG.segmented('Show steps for', tools, prefs.tool, function (id) { GG.store.setPref('tool', id); })),
        row('Open lessons in', 'Auto opens a lesson in Learn, and in Skim once you have finished it or tested past its track.',
          GG.segmented('Open lessons in', modes, prefs.mode, function (id) { GG.store.setPref('mode', id); }))));
  }

  function toolCard(route, icon, title, text, badge) {
    return h('a.card.link', { href: '#' + route },
      h('div.spread', null, h('span.row', null, GG.icon(icon), h('h3', null, title)), badge ? h('span.badge', null, badge) : null),
      h('p.small.muted', null, text));
  }

  // ---------------------------------------------------------------- home

  GG.views.home = function () {
    document.title = GG.data.site.title;
    var site = GG.data.site, counts = GG.data.build.counts, progress = GG.store.progress();
    var next = resume(), placed = progress.placement && GG.app.track(progress.placement.track);
    var due = GG.app.cardsDue();

    var actions = h('div.row');
    if (next) actions.appendChild(h('a.btn.primary', { href: '#' + next.id }, GG.icon('right'), 'Continue: ' + next.title));
    else if (placed) actions.appendChild(h('a.btn.primary', { href: '#track-' + placed.id }, GG.icon('right'), 'Start the ' + placed.title + ' track'));
    else actions.appendChild(h('a.btn.primary', { href: '#placement' }, GG.icon('compass'), 'Find your starting point'));
    actions.appendChild(h('a.btn', { href: '#lab' }, GG.icon('terminal'), 'Open the practice lab'));

    return h('div.page.home', null,
      h('header.hero.stack', null,
        h('p.eyebrow', null, h('span', null, site.tagline), h('span', null, 'reviewed ' + site.reviewed)),
        h('h1', null, 'GitHub, inside out'),
        h('p.lede', null, 'Four tracks, from your first commit to running an organization. Every idea is explained four ways, every task is shown for four tools, and there is a practice terminal where nothing can break.'),
        actions,
        placed && !next ? h('p.small.muted', null, 'Your placement check suggested ', h('a', { href: '#track-' + placed.id }, placed.title), '. ', h('a', { href: '#placement' }, 'Retake it'), '.') : null),
      mapFigure(),
      waysPanel(),
      h('section.stack', { 'aria-labelledby': 'tracks-h' },
        h('h2', { id: 'tracks-h' }, 'The four tracks'),
        h('div.track-grid', null, GG.data.tracks.map(trackCard))),
      h('section.stack', { 'aria-labelledby': 'tools-h' },
        h('h2', { id: 'tools-h' }, 'Practice and review'),
        h('div.grid', null,
          toolCard('lab', 'terminal', 'Practice lab', 'Real Git commands, a simulated repository, a live commit graph.', counts.labs + ' labs'),
          toolCard('workflow', 'file', 'Workflow reader', 'Paste a GitHub Actions file. See what it does, what is risky, and what runs when.'),
          toolCard('drills', 'target', 'Drills', 'Something has gone wrong. Choose what to do next.', counts.drills + ' drills'),
          toolCard('cards', 'cards', 'Flashcards', 'Terms and commands on a spaced schedule.', due ? due + ' due' : null),
          toolCard('cheatsheet', 'list', 'Cheat sheet', 'Every command in the guide, searchable, with a risk rating.', counts.commands + ' entries'),
          toolCard('glossary', 'az', 'Glossary', 'Every term, defined once, linked to its lesson.', counts.terms + ' terms'),
          toolCard('progress', 'chart', 'Progress', 'What you have finished, and a way to carry it between devices.'))),
      h('footer.stack.small.muted.home-foot', null,
        h('p', null, site.disclaimer),
        h('p', null, h('a', { href: '#about' }, 'How this guide is built'), ' · version ' + GG.data.build.version +
          (GG.data.build.commit ? ' · commit ' + GG.data.build.commit : '') + ' · built ' + GG.data.build.date)));
  };

  // ---------------------------------------------------------------- track

  GG.views.track = function (id) {
    var track = GG.app.track(id), progress = GG.store.progress();
    var st = GG.progress.trackStats(track, GG.data.lessons, progress);
    document.title = track.title + ' track · ' + GG.data.site.title;
    var labs = GG.data.labs.filter(function (l) { return l.track === id && !l.free; });
    var drills = GG.data.drills.filter(function (d) { return d.track === id; });
    var at = GG.data.tracks.indexOf(track), nextTrack = GG.data.tracks[at + 1], prevTrack = GG.data.tracks[at - 1];

    return h('div.page.t-' + id, null,
      h('header.stack', null,
        h('p.eyebrow', null, h('span', null, 'Track ' + (at + 1) + ' of ' + GG.data.tracks.length), h('span', null, track.subtitle)),
        h('div.row', null, h('span.roundel.lg', { 'aria-hidden': 'true' }, track.letter), h('h1', null, track.title)),
        h('p.lede', null, track.promise),
        h('p.muted', null, h('strong', null, 'This is for you if: '), track.audience),
        h('div.stack', { style: 'gap:.35rem;max-width:26rem' },
          h('div.bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.total), 'aria-valuenow': String(st.done), 'aria-label': 'Track progress' },
            h('span', { style: 'width:' + st.percent + '%' })),
          h('p.xs.muted.mono', null, st.done + ' of ' + st.total + ' lessons complete' + (st.quizTotal ? ' · ' + st.quizRight + ' of ' + st.quizTotal + ' quiz questions right' : '')))),
      h('ol.stations', null, track.lessons.map(function (lid, n) {
        var lesson = GG.app.lesson(lid), rec = progress.lessons[lid] || {};
        return h('li', { class: rec.done ? 'is-done' : '' },
          h('span.st-mark', { 'aria-hidden': 'true' }, rec.done ? GG.icon('check') : String(n + 1)),
          h('a.card.link', { href: '#' + lid },
            h('div.spread', null,
              h('h2', { style: 'font-size:var(--t-m)' }, lesson.title),
              h('span.row', null,
                rec.done ? h('span.badge.done', null, 'Complete') : null,
                lesson.lab ? h('span.badge', null, 'lab') : null,
                lesson.stub ? h('span.badge', null, 'planned') : h('span.badge', null, lesson.minutes + ' min'))),
            lesson.summary ? h('p.small.muted', null, GG.inline(lesson.summary)) : null));
      })),
      labs.length ? h('section.stack', null, h('h2', null, 'Labs for this track'),
        h('div.grid', null, labs.map(function (l) {
          return h('a.card.link', { href: '#' + l.id }, h('div.spread', null, h('h3', null, l.title),
            progress.labs[l.id] ? h('span.badge.done', null, 'Done') : h('span.badge', null, l.minutes + ' min')));
        }))) : null,
      drills.length ? h('section.stack', null, h('h2', null, 'Drills for this track'),
        h('div.grid', null, drills.map(function (d) {
          var best = progress.drills[d.id];
          return h('a.card.link', { href: '#' + d.id }, h('div.spread', null, h('h3', null, d.title),
            best ? h('span.badge.done', null, best.best + ' of ' + best.of) : h('span.badge', null, d.minutes + ' min')));
        }))) : null,
      h('div.spread', null,
        prevTrack ? h('a.btn', { href: '#track-' + prevTrack.id }, GG.icon('left'), prevTrack.title) : h('span'),
        nextTrack ? h('a.btn', { href: '#track-' + nextTrack.id }, nextTrack.title, GG.icon('right')) : h('span')));
  };
})();
