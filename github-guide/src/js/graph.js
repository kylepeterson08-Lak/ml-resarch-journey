/*
 * graph.js: draws a commit graph as SVG.
 *
 * One renderer serves the diagrams in lessons and the live picture in the
 * practice lab. Time runs left to right. Each line of work gets its own
 * lane, labels are stacked so they never overlap, and every figure carries
 * a text description for readers who cannot see it.
 *
 * Input:
 *   { commits: [{id, parents, msg, ghost}],   oldest first
 *     branches: {name: commitId}, remotes: {...}, tags: {...},
 *     head: branchName | commitId, highlight: [commitId] }
 */
(function () {
  'use strict';
  var GG = window.GG;

  var DX = 64, R = 9, PILL_H = 18, PILL_GAP = 3, ID_H = 18, BAND_PAD = 12, EDGE = 8;
  var LANE_COLORS = ['var(--ink-2)', 'var(--line-b)', 'var(--line-a)', 'var(--line-e)', 'var(--line-i)'];

  function layout(spec) {
    var commits = spec.commits || [], byId = {}, laneLast = [];
    commits.forEach(function (c, i) { byId[c.id] = { c: c, i: i, lane: -1, labels: [] }; });

    // A chain of unclaimed commits, walked from a tip along first parents,
    // continues an existing lane only if it grows from that lane's newest
    // commit. Otherwise it is a fork and gets a lane of its own.
    function claim(tip) {
      var chain = [], id = tip;
      while (id && byId[id] && byId[id].lane === -1) {
        chain.push(byId[id]);
        id = (byId[id].c.parents || [])[0];
      }
      if (!chain.length) return;
      var base = id && byId[id], lane;
      if (base && laneLast[base.lane] === base.i) lane = base.lane;
      else { lane = laneLast.length; laneLast.push(-1); }
      chain.forEach(function (n) { n.lane = lane; laneLast[lane] = Math.max(laneLast[lane], n.i); });
    }

    var branches = spec.branches || {}, remotes = spec.remotes || {}, tags = spec.tags || {};
    var names = Object.keys(branches);
    ['master', 'main'].forEach(function (primary) {
      var at = names.indexOf(primary);
      if (at > 0) { names.splice(at, 1); names.unshift(primary); }
    });
    names.forEach(function (b) { claim(branches[b]); });
    if (spec.head && !branches[spec.head]) claim(spec.head);
    Object.keys(tags).forEach(function (t) { claim(tags[t]); });
    Object.keys(remotes).forEach(function (r) { claim(remotes[r]); });
    for (var k = commits.length - 1; k >= 0; k--) claim(commits[k].id);

    // Labels
    names.forEach(function (b) {
      var n = byId[branches[b]];
      if (!n) return;
      if (spec.head === b) n.labels.unshift({ text: 'HEAD → ' + b, cls: 'is-head' });
      else n.labels.push({ text: b, cls: '' });
    });
    if (spec.head && !branches[spec.head] && byId[spec.head]) byId[spec.head].labels.unshift({ text: 'HEAD', cls: 'is-head' });
    Object.keys(remotes).forEach(function (r) { if (byId[remotes[r]]) byId[remotes[r]].labels.push({ text: r, cls: 'is-remote' }); });
    Object.keys(tags).forEach(function (t) { if (byId[tags[t]]) byId[tags[t]].labels.push({ text: 'tag: ' + t, cls: 'is-tag' }); });

    // Stack labels above each node without horizontal overlap inside a lane.
    var levels = laneLast.map(function () { return []; });
    commits.forEach(function (c) {
      var n = byId[c.id];
      n.labels.forEach(function (label) {
        label.w = Math.round(label.text.length * 6.7 + 14);
        var x0 = n.i * DX - label.w / 2 - 3, x1 = n.i * DX + label.w / 2 + 3, lv = 0;
        for (;; lv++) {
          var row = levels[n.lane][lv] || (levels[n.lane][lv] = []);
          var clash = row.some(function (iv) { return x0 < iv[1] && x1 > iv[0]; });
          if (!clash) { row.push([x0, x1]); break; }
        }
        label.level = lv;
      });
    });

    // Vertical bands: each lane is as tall as its label stack needs.
    var laneY = [], y = EDGE;
    levels.forEach(function (rows, lane) {
      y += rows.length * (PILL_H + PILL_GAP) + R + 4;
      laneY[lane] = y;
      y += R + ID_H + BAND_PAD;
    });
    var height = Math.max(y - BAND_PAD + EDGE, 60);

    var minX = -R - 4, maxX = (commits.length - 1) * DX + R + 4;
    commits.forEach(function (c) {
      var n = byId[c.id];
      n.labels.forEach(function (label) {
        minX = Math.min(minX, n.i * DX - label.w / 2);
        maxX = Math.max(maxX, n.i * DX + label.w / 2);
      });
      var idW = String(c.id).length * 6.7 / 2;
      minX = Math.min(minX, n.i * DX - idW);
      maxX = Math.max(maxX, n.i * DX + idW);
    });
    var shift = EDGE - minX;

    var nodes = commits.map(function (c) {
      var n = byId[c.id];
      n.x = n.i * DX + shift;
      n.y = laneY[n.lane];
      return n;
    });

    var edges = [];
    nodes.forEach(function (n) {
      (n.c.parents || []).forEach(function (pid, k) {
        var p = byId[pid];
        if (!p) return;
        var d;
        if (p.lane === n.lane) d = 'M' + p.x + ',' + p.y + ' L' + n.x + ',' + n.y;
        else if (k === 0) {
          // branching off: drop to the new lane right away, then run along it
          d = 'M' + p.x + ',' + p.y + ' C' + (p.x + DX / 2) + ',' + p.y + ' ' + (p.x + DX / 2) + ',' + n.y + ' ' + (p.x + DX) + ',' + n.y + ' L' + n.x + ',' + n.y;
        } else {
          // merging in: run along the source lane, then curve into the merge
          d = 'M' + p.x + ',' + p.y + ' L' + (n.x - DX) + ',' + p.y + ' C' + (n.x - DX / 2) + ',' + p.y + ' ' + (n.x - DX / 2) + ',' + n.y + ' ' + n.x + ',' + n.y;
        }
        edges.push({ d: d, lane: k === 0 ? n.lane : p.lane, ghost: !!(n.c.ghost || p.c.ghost) });
      });
    });

    return { nodes: nodes, edges: edges, width: Math.ceil(maxX - minX + EDGE * 2), height: Math.ceil(height), byId: byId };
  }

  function laneColor(lane) {
    return LANE_COLORS[lane % LANE_COLORS.length];
  }

  /** A sentence that says what the picture shows. */
  function describe(spec) {
    var parts = ['Commit graph with ' + GG.plural((spec.commits || []).length, 'commit') + '.'];
    Object.keys(spec.branches || {}).forEach(function (b) { parts.push('Branch ' + b + ' points at ' + spec.branches[b] + '.'); });
    Object.keys(spec.remotes || {}).forEach(function (r) { parts.push(r + ' points at ' + spec.remotes[r] + '.'); });
    if (spec.head) parts.push((spec.branches || {})[spec.head] ? 'HEAD is on ' + spec.head + '.' : 'HEAD is detached at ' + spec.head + '.');
    return parts.join(' ');
  }

  function textList(spec, L) {
    return GG.h('ul', null, L.nodes.map(function (n) {
      var c = n.c, bits = [c.id];
      if (c.msg) bits.push('“' + c.msg + '”');
      bits.push((c.parents || []).length ? 'parent ' + c.parents.join(' and ') : 'first commit');
      if (n.labels.length) bits.push('labels: ' + n.labels.map(function (l) { return l.text; }).join(', '));
      if (c.ghost) bits.push('not reachable from any branch');
      return GG.h('li', null, bits.join(', '));
    }));
  }

  /**
   * Draw a graph. Returns a <figure>.
   * opts: {caption, title, scrollEnd}
   */
  function render(spec, opts) {
    opts = opts || {};
    var L = layout(spec), s = GG.s;
    var highlight = spec.highlight || [];
    var svg = s('svg', {
      viewBox: '0 0 ' + L.width + ' ' + L.height, width: L.width, height: L.height,
      role: 'img', 'aria-label': (opts.title ? opts.title + '. ' : '') + describe(spec), style: 'max-width:none'
    });

    L.edges.forEach(function (e) {
      svg.appendChild(s('path.g-edge', { d: e.d, style: 'stroke:' + laneColor(e.lane), 'stroke-dasharray': e.ghost ? '4 4' : null, opacity: e.ghost ? '0.6' : null }));
    });

    L.nodes.forEach(function (n) {
      var g = s('g', { class: n.c.ghost ? 'g-ghost' : '' });
      g.appendChild(s('title', null, n.c.id + (n.c.msg ? ': ' + n.c.msg : '')));
      if (highlight.indexOf(n.c.id) !== -1) g.appendChild(s('circle.g-hi', { cx: n.x, cy: n.y, r: R + 7 }));
      var isHead = n.labels.some(function (l) { return l.cls === 'is-head'; });
      if (isHead) g.appendChild(s('circle.g-ring', { cx: n.x, cy: n.y, r: R + 4 }));
      g.appendChild(s('circle.g-node', {
        cx: n.x, cy: n.y, r: R,
        style: n.c.ghost ? 'stroke:' + laneColor(n.lane) : 'fill:' + laneColor(n.lane)
      }));
      g.appendChild(s('text.g-id', { x: n.x, y: n.y + R + 13 }, String(n.c.id)));
      n.labels.forEach(function (label) {
        var py = n.y - R - 6 - (label.level + 1) * (PILL_H + PILL_GAP) + PILL_GAP;
        var pill = s('g', { class: 'g-pill ' + label.cls });
        pill.appendChild(s('rect', { x: n.x - label.w / 2, y: py, width: label.w, height: PILL_H, rx: label.cls === 'is-tag' ? 2 : 9 }));
        pill.appendChild(s('text', { x: n.x, y: py + 13, 'text-anchor': 'middle' }, label.text));
        g.appendChild(pill);
      });
      svg.appendChild(g);
    });

    var scroller = GG.h('div.graph-scroll', { tabindex: '0', role: 'group', 'aria-label': 'Commit graph, scrolls sideways' }, svg);
    var fig = GG.h('figure.graph', null,
      opts.title ? GG.h('div.xs.muted.mono', { style: 'margin-bottom:.35rem' }, opts.title) : null,
      scroller,
      opts.caption ? GG.h('figcaption', null, GG.inline(opts.caption)) : null,
      GG.h('details', null, GG.h('summary', null, 'Read this graph as text'), textList(spec, L))
    );
    if (opts.scrollEnd) {
      // show the newest commit, which is at the right-hand end
      setTimeout(function () { scroller.scrollLeft = scroller.scrollWidth; }, 0);
    }
    return fig;
  }

  GG.graph = { layout: layout, render: render, describe: describe };
})();
