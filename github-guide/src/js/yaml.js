/*
 * yaml.js: reads the YAML that GitHub Actions workflow files are written in.
 *
 * It covers the subset real workflow files use: block mappings and lists,
 * quoted and plain values, "|" and ">" text blocks, and [flow] and {flow}
 * collections. Plain values get YAML 1.2 types, so "on" and "yes" stay text
 * and 3.10 becomes the number 3.1. Every mistake is reported in plain words
 * with the line it is on, and parseDocument() remembers where each key and
 * list item starts, so a page can point at it.
 *
 * Deliberately not supported, and refused with a message instead of being
 * read wrongly: anchors and aliases (&a, *a), tags (!!str), merge keys (<<),
 * "? " keys, directives, several documents in one file, and plain or quoted
 * text that runs on to a second line.
 *
 * No DOM and no dependencies, so the same file runs in the browser and under
 * Node (see tests/yaml.test.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.GG = root.GG || {}).yaml = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Shown to learners as plain text, so every message says what to change.
  var MSG = {
    tab: 'YAML does not allow tabs for indentation. Replace the tab on this line with spaces.',
    indent: 'This line is indented differently from the lines around it. Lines that belong to the same block must start in the same column.',
    documents: 'This reader takes one YAML document at a time. Remove this line and everything after it, or paste the documents one by one.',
    multiline: 'This value carries on to the next line, which plain text cannot do. Start the value with | to keep the line breaks or > to join the lines, and indent the text below it.',
    keyExpected: 'This line is not a "key: value" pair, but one is needed here. Check that the key ends with a colon and that a space follows the colon.',
    itemInMapping: 'This line starts a list item, but the lines above it are "key: value" pairs. Indent the list under the key it belongs to.',
    mixed: 'This line does not fit with the lines above it. A block holds either "key: value" lines or "- item" lines, never both.',
    dashSpace: 'A list item needs a space after its dash. Write "- item".',
    colonInValue: 'YAML reads the colon inside this value as the start of another key. Put the whole value in quotes.',
    itemAfterKey: 'A list item cannot share a line with its key. Put each "- item" on its own line below the key.',
    emptyKey: 'This line starts with a colon, so its key is missing. Write the key before the colon.',
    merge: 'Merge keys (<<) are not supported by this reader. Copy the keys you want into this block.',
    complexKey: 'Keys written with "? " are not supported by this reader. Write the key and its value as "key: value".',
    unclosedQuote: 'This text opens with a quote that is never closed. Add the closing quote before the end of the line.',
    afterQuote: 'There is text after the closing quote. Remove it, or move the closing quote to the end of the value.',
    escape: 'Inside double quotes a backslash must start a known escape such as \\n, \\t, \\" or \\\\. To write a backslash itself, type two.',
    blockHeader: 'After | or > only + or -, then an optional comment, may follow on the same line. Put the text itself on the lines below, indented.',
    flowSeparator: 'A comma or a closing bracket is missing here. Separate the items with commas, and close each [ with ] and each { with }.',
    flowPair: 'A "key: value" pair inside [ ] has to be wrapped in { }.',
    flowValue: 'A value is missing here. Remove the extra comma or colon, or add the value.',
    flowExpression: 'Inside [ ] or { }, an expression that starts with ${{ must be in quotes.',
    afterFlow: 'There is text after the closing bracket. Remove it, or move it inside the brackets.'
  };

  // Features this reader leaves out, by the character that introduces them.
  var UNSUPPORTED = {
    '&': 'A value that starts with & is a YAML anchor, and anchors are not supported by this reader. Write the value out in each place it is used.',
    '*': 'A value that starts with * is a YAML alias, and aliases are not supported by this reader. If you mean the text itself, such as a file pattern, put it in quotes.',
    '!': 'A value that starts with ! is a YAML tag, and tags are not supported by this reader. For a condition such as !cancelled(), put the whole value in quotes.',
    '%': 'A line that starts with % is a YAML directive, and directives are not supported by this reader. Remove this line.'
  };

  var ESCAPES = { '0': '\0', a: '\x07', b: '\b', t: '\t', n: '\n', v: '\x0B', f: '\f', r: '\r', e: '\x1B', ' ': ' ', '"': '"', '/': '/', '\\': '\\' };
  var HEX_DIGITS = { x: 2, u: 4 };
  var TRAILING = /^(?:[ \t]+#.*|[ \t]*)$/;   // what may follow a finished value: nothing, or a comment

  function YamlError(message, line) {
    this.name = 'YamlError';
    this.message = message;
    this.line = line;
    if (Error.captureStackTrace) Error.captureStackTrace(this, YamlError);
  }
  YamlError.prototype = Object.create(Error.prototype);
  YamlError.prototype.constructor = YamlError;

  /** Stop with a message for the learner. `no` counts lines from 0, as the parser does. */
  function fail(message, no) {
    throw new YamlError(message, no + 1);
  }

  function isBlank(c) { return c === ' ' || c === '\t'; }
  function isItem(text) { return /^-([ \t]|$)/.test(text); }

  /** The message for a line that fits nowhere. A dash with no space after it is the likeliest slip, so say that first. */
  function misfit(line, message) {
    return /^-[^ \t-]/.test(line.text) ? MSG.dashSpace : message;
  }
  function hasOwn(map, key) { return Object.prototype.hasOwnProperty.call(map, key); }

  /** Set an own property even for a key such as "__proto__", which a plain assignment treats specially. */
  function setOwn(map, key, value) {
    Object.defineProperty(map, key, { value: value, enumerable: true, writable: true, configurable: true });
  }

  function parse(text) {
    return parseDocument(text).value;
  }

  /** Parse one document. Returns its value and lineOf(path), the 1-based line where that key or item starts. */
  function parseDocument(text) {
    var source = String(text === undefined || text === null ? '' : text);
    var s = { lines: splitLines(source), pos: 0, ended: false, where: Object.create(null) };
    // A text block that runs to the end of a file with no final line break has no line break to keep.
    s.noFinalBreak = !/[\r\n]$/.test(source);
    var first = peek(s);
    var value = first ? parseNode(s, first, -1, '') : null;
    var extra = peek(s);
    if (extra) fail(misfit(extra, extra.indent === first.indent ? MSG.mixed : MSG.indent), extra.no);
    s.where[''] = 1;
    return {
      value: value,
      lineOf: function (path) {
        var line = s.where[path === undefined || path === null ? '' : path];
        return line === undefined ? null : line;
      }
    };
  }

  /** Split the text into lines and blank out a leading "---", which only announces the document. */
  function splitLines(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/), i = 0;
    if (lines[lines.length - 1] === '') lines.pop();   // a final line break does not start another line
    while (i < lines.length && /^[ \t]*(#.*)?$/.test(lines[i])) i++;
    if (i < lines.length && /^---([ \t]|$)/.test(lines[i])) lines[i] = '   ' + lines[i].slice(3);
    return lines;
  }

  /** The next line that carries content, without consuming it. Null at the end of the document. */
  function peek(s) {
    for (; s.pos < s.lines.length; s.pos++) {
      var raw = s.lines[s.pos], lead = /^[ \t]*/.exec(raw)[0], text = raw.slice(lead.length);
      if (text === '' || text.charAt(0) === '#') continue;
      if (lead.indexOf('\t') !== -1) fail(MSG.tab, s.pos);
      if (/^\.\.\.([ \t]|$)/.test(raw)) { s.ended = true; continue; }   // "..." closes the document
      if (s.ended || /^---([ \t]|$)/.test(raw)) fail(MSG.documents, s.pos);
      return { no: s.pos, indent: lead.length, text: text };
    }
    return null;
  }

  /**
   * Read the node that starts on `line`: a list, a mapping, or a single value.
   * `parent` is the indentation of the block the node sits in. A value that
   * spans lines must stay indented deeper than that.
   */
  function parseNode(s, line, parent, path) {
    if (isItem(line.text)) return parseSequence(s, line.indent, path, false);
    if (splitKey(line)) return parseMapping(s, line.indent, path);
    s.pos = line.no + 1;
    var value = parseInline(s, line.no, line.indent, parent, path);
    // Text on a line of its own cannot have more lines beside or under it.
    // When it does, the usual cause is a key that lost its colon.
    var next = peek(s);
    if (next && next.indent >= line.indent && !/^[|>[{]/.test(line.text)) fail(MSG.keyExpected, line.no);
    return value;
  }

  function parseMapping(s, indent, path) {
    var map = {};
    for (var line = peek(s); line && line.indent >= indent; line = peek(s)) {
      if (line.indent > indent) fail(misfit(line, MSG.indent), line.no);
      var entry = splitKey(line);
      if (!entry) fail(isItem(line.text) ? MSG.itemInMapping : MSG.keyExpected, line.no);
      checkKey(entry.key, entry.quoted, map, line.no);
      var childPath = join(path, entry.key);
      s.where[childPath] = line.no + 1;
      s.pos = line.no + 1;
      setOwn(map, entry.key, parseValue(s, line.no, entry.col, indent, childPath));
    }
    return map;
  }

  /** `level` is true for a list that sits in the same column as the key that owns it. Keys may then follow it. */
  function parseSequence(s, indent, path, level) {
    var list = [];
    for (var line = peek(s); line && line.indent >= indent; line = peek(s)) {
      if (line.indent > indent) fail(misfit(line, MSG.indent), line.no);
      if (!isItem(line.text) && !level) fail(misfit(line, MSG.mixed), line.no);
      if (!isItem(line.text)) break;
      var raw = s.lines[line.no], itemPath = path + '[' + list.length + ']';
      s.where[itemPath] = line.no + 1;
      // Blank out the dash. What is left reads as a node of its own that starts
      // where the item's content starts, so "- name: x" and the keys under it
      // line up as one mapping.
      s.lines[line.no] = raw.slice(0, indent) + ' ' + raw.slice(indent + 1);
      var item = peek(s);
      list.push(item && item.no === line.no ? parseNode(s, item, indent, itemPath) : parseBelow(s, indent, false, itemPath));
    }
    return list;
  }

  /** The value of a key: on the same line when there is one, otherwise the block on the lines below. */
  function parseValue(s, no, col, indent, path) {
    var raw = s.lines[no];
    while (isBlank(raw.charAt(col))) col++;
    if (col >= raw.length || raw.charAt(col) === '#') return parseBelow(s, indent, true, path);
    return parseInline(s, no, col, indent, path);
  }

  /** A value written on the lines below its key or its dash. Nothing there means null. */
  function parseBelow(s, indent, listMaySitLevel, path) {
    var next = peek(s);
    if (next && next.indent > indent) return parseNode(s, next, indent, path);
    // YAML lets a list start in the same column as the key that owns it.
    if (next && listMaySitLevel && next.indent === indent && isItem(next.text)) return parseSequence(s, indent, path, true);
    return null;
  }

  /** A value that starts at column `col` of line `no`: a text block, a flow collection, or one scalar. */
  function parseInline(s, no, col, parent, path) {
    var text = s.lines[no].slice(col), first = text.charAt(0);
    if (first === '|' || first === '>') return blockScalar(s, text, parent, no);
    if (first === '[' || first === '{') return flowCollection(s, no, col, parent, path);
    if (first !== '"' && first !== "'") return plainScalar(s, text, parent, no);
    var quoted = readQuoted(text, 0, no);
    if (!TRAILING.test(text.slice(quoted.end))) fail(MSG.afterQuote, no);
    return quoted.value;
  }

  // ---------------------------------------------------------------- keys

  /** Split "key: value" into the key and the column where the value starts. Null when the line holds no key. */
  function splitKey(line) {
    var text = line.text, first = text.charAt(0);
    if (first === '"' || first === "'") {
      var quoted = readQuoted(text, 0, line.no);
      var colon = quoted.end + /^[ \t]*/.exec(text.slice(quoted.end))[0].length;
      if (!/^:([ \t]|$)/.test(text.slice(colon))) return null;
      return { key: quoted.value, quoted: true, col: line.indent + colon + 1 };
    }
    // A flow collection or an expression is a value, even when it holds a colon.
    if (first === '[' || first === '{' || text.slice(0, 3) === '${{') return null;
    // The key ends at the first colon that a space or the line end follows, unless a comment starts first.
    var m = /[ \t]#|:(?=[ \t]|$)/.exec(text);
    if (!m || m[0] !== ':') return null;
    if (m.index === 0) fail(MSG.emptyKey, line.no);
    return { key: text.slice(0, m.index).replace(/[ \t]+$/, ''), quoted: false, col: line.indent + m.index + 1 };
  }

  /** Refuse a key this reader cannot honour, or one the mapping already has. */
  function checkKey(key, quoted, map, no) {
    if (!quoted && key === '<<') fail(MSG.merge, no);
    if (!quoted) rejectUnsupported(key, no);
    if (hasOwn(map, key)) fail('The key "' + key + '" appears twice in the same block. The second one would silently replace the first.', no);
  }

  /** Refuse the YAML features this reader leaves out, and characters that cannot start plain text. */
  function rejectUnsupported(text, no) {
    var first = text.charAt(0);
    if (hasOwn(UNSUPPORTED, first)) fail(UNSUPPORTED[first], no);
    if (/^\?([ \t]|$)/.test(text)) fail(MSG.complexKey, no);
    if (/^([@`,\]}]|-[ \t])/.test(text)) fail('Plain text cannot start with ' + first + ' here. Put the whole value in quotes.', no);
  }

  function join(path, key) {
    return path === '' ? key : path + '.' + key;
  }

  // ---------------------------------------------------------------- scalars

  /** Plain text up to the end of the line or a comment, given its YAML 1.2 type. */
  function plainScalar(s, text, parent, no) {
    if (isItem(text)) fail(MSG.itemAfterKey, no);
    rejectUnsupported(text, no);
    var value = text.replace(/[ \t]+#.*$/, '').replace(/[ \t]+$/, '');
    // An expression is taken whole. Anywhere else a colon and a space would start a nested key.
    if (text.charAt(0) !== '$' && /:([ \t]|$)/.test(value)) fail(MSG.colonInValue, no);
    var next = peek(s);
    if (next && next.indent > parent && !/^(-|[\w.$-]+[ \t]*:)([ \t]|$)/.test(next.text)) fail(MSG.multiline, no);
    return typed(value);
  }

  /** The YAML 1.2 core schema: only these spellings are not text. So "on", "yes" and "1.2.0" stay strings. */
  function typed(text) {
    if (text === '' || text === '~' || /^(null|Null|NULL)$/.test(text)) return null;
    if (/^(true|True|TRUE)$/.test(text)) return true;
    if (/^(false|False|FALSE)$/.test(text)) return false;
    if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(text)) return Number(text);
    if (/^0o[0-7]+$/.test(text)) return parseInt(text.slice(2), 8);
    if (/^0x[0-9a-fA-F]+$/.test(text)) return parseInt(text.slice(2), 16);
    if (/^[-+]?\.(inf|Inf|INF)$/.test(text)) return text.charAt(0) === '-' ? -Infinity : Infinity;
    if (/^\.(nan|NaN|NAN)$/.test(text)) return NaN;
    return text;
  }

  /** Read the quoted scalar that opens at text[start]. Returns its value and the index just past the closing quote. */
  function readQuoted(text, start, no) {
    var quote = text.charAt(start), out = '';
    for (var i = start + 1; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === quote && quote === "'" && text.charAt(i + 1) === "'") {
        out += "'";   // two single quotes stand for one
        i++;
      } else if (c === quote) {
        return { value: out, end: i + 1 };
      } else if (c === '\\' && quote === '"') {
        var escape = readEscape(text, i + 1, no);
        out += escape.value;
        i += escape.length;
      } else {
        out += c;
      }
    }
    fail(MSG.unclosedQuote, no);
  }

  function readEscape(text, at, no) {
    var c = text.charAt(at), digits = HEX_DIGITS[c];
    if (hasOwn(ESCAPES, c)) return { value: ESCAPES[c], length: 1 };
    var hex = digits ? text.substr(at + 1, digits) : '';
    if (!digits || hex.length !== digits || /[^0-9a-fA-F]/.test(hex)) fail(MSG.escape, no);
    return { value: String.fromCharCode(parseInt(hex, 16)), length: 1 + digits };
  }

  /** Read a text block: "|" keeps its line breaks, ">" folds them into spaces. */
  function blockScalar(s, header, parent, no) {
    var m = /^([|>])([-+]?)([1-9]?)([-+]?)(?:[ \t]+#.*|[ \t]*)$/.exec(header);
    if (!m || (m[2] && m[4])) fail(MSG.blockHeader, no);
    var chomp = m[2] || m[4], rows = [], floor = Math.max(parent, 0);
    var indent = m[3] ? floor + Number(m[3]) : -1;   // -1: set by the first line of text
    for (; s.pos < s.lines.length; s.pos++) {
      var raw = s.lines[s.pos], lead = /^ */.exec(raw)[0].length, blank = /^[ \t]*$/.test(raw);
      if (!blank && indent < 0) {
        if (lead <= floor) break;
        indent = lead;
      }
      if (!blank && lead < indent) break;   // back out to the surrounding block
      rows.push(indent >= 0 && lead >= indent ? raw.slice(indent) : '');
    }
    var open = s.noFinalBreak && s.pos === s.lines.length;   // the last row has no line break after it
    if (open && rows[rows.length - 1] === '') {
      rows.pop();   // spaces alone on that row are not a blank line
      open = false;
    }
    var last = rows.length - 1;
    while (last >= 0 && rows[last] === '') last--;
    var body = m[1] === '|' ? rows.slice(0, last + 1).join('\n') : fold(rows.slice(0, last + 1));
    // Chomping: "-" drops the final line break, "+" keeps every trailing one, the default keeps exactly one.
    if (chomp === '-' || open) return body;
    if (chomp === '+') return body + new Array(rows.length - last + (last < 0 ? 0 : 1)).join('\n');
    return last < 0 ? '' : body + '\n';
  }

  /**
   * Join the lines of a ">" block. A single line break becomes a space. Blank
   * lines, and lines indented further than the rest, keep their line breaks.
   */
  function fold(rows) {
    var out = '';
    rows.forEach(function (row, i) {
      if (row === '') { out += '\n'; return; }
      out += row;
      var next = i + 1;
      while (next < rows.length && rows[next] === '') next++;
      if (next === rows.length) return;
      if (isBlank(row.charAt(0)) || isBlank(rows[next].charAt(0))) out += '\n';
      else if (next === i + 1) out += ' ';
    });
    return out;
  }

  // ---------------------------------------------------------------- flow collections

  /** Read "[...]" or "{...}". It may run over several lines, so it is read character by character. */
  function flowCollection(s, no, col, parent, path) {
    var cur = { no: no, col: col, parent: parent, strayed: false }, open = s.lines[no].charAt(col), value;
    try {
      value = flowNode(s, cur, path);
    } catch (error) {
      // Once the text has stepped back out to the surrounding block, or run off the end,
      // the mistake to report is the bracket that was never closed.
      if (!cur.strayed) throw error;
      fail('The ' + open + ' on this line is never closed. Add the matching ' + (open === '[' ? ']' : '}') + '.', no);
    }
    if (!TRAILING.test(s.lines[cur.no].slice(cur.col))) fail(MSG.afterFlow, cur.no);
    s.pos = cur.no + 1;
    return value;
  }

  function flowNode(s, cur, path) {
    var c = flowPeek(s, cur);
    if (c === '[') return flowSequence(s, cur, path);
    if (c === '{') return flowMapping(s, cur, path);
    var scalar = flowScalar(s, cur);
    return scalar.quoted ? scalar.text : typed(scalar.text);
  }

  function flowSequence(s, cur, path) {
    var list = [];
    cur.col++;   // step over "["
    for (var c = flowPeek(s, cur); c !== ']'; c = flowPeek(s, cur)) {
      var itemPath = path + '[' + list.length + ']';
      s.where[itemPath] = cur.no + 1;
      list.push(flowNode(s, cur, itemPath));
      flowSeparator(s, cur, ']');
    }
    cur.col++;
    return list;
  }

  function flowMapping(s, cur, path) {
    var map = {};
    cur.col++;   // step over "{"
    for (var c = flowPeek(s, cur); c !== '}'; c = flowPeek(s, cur)) {
      var no = cur.no, key = flowScalar(s, cur), value = null;
      checkKey(key.text, key.quoted, map, no);
      var childPath = join(path, key.text);
      s.where[childPath] = no + 1;
      if (flowPeek(s, cur) === ':') {
        cur.col++;
        c = flowPeek(s, cur);
        if (c !== ',' && c !== '}') value = flowNode(s, cur, childPath);
      }
      setOwn(map, key.text, value);
      flowSeparator(s, cur, '}');
    }
    cur.col++;
    return map;
  }

  /** After an item comes a comma or the closing bracket. */
  function flowSeparator(s, cur, close) {
    var c = flowPeek(s, cur);
    if (c === ',') cur.col++;
    else if (c !== close) fail(c === ':' && close === ']' ? MSG.flowPair : MSG.flowSeparator, cur.no);
  }

  /** One scalar inside a flow collection. Plain text ends at a comma, a bracket, a colon and space, or the line end. */
  function flowScalar(s, cur) {
    var raw = s.lines[cur.no], first = raw.charAt(cur.col), end = cur.col;
    if (first === '"' || first === "'") {
      var quoted = readQuoted(raw, cur.col, cur.no);
      cur.col = quoted.end;
      return { text: quoted.value, quoted: true };
    }
    for (; end < raw.length; end++) {
      var c = raw.charAt(end), after = raw.charAt(end + 1);
      if (/[,[\]{}]/.test(c)) break;
      if (c === ':' && (after === '' || /[ \t,[\]{}]/.test(after))) break;
      if (c === '#' && isBlank(raw.charAt(end - 1))) break;
    }
    var text = raw.slice(cur.col, end).replace(/[ \t]+$/, '');
    if (text === '$' && raw.charAt(end) === '{') fail(MSG.flowExpression, cur.no);
    if (text === '' || text.charAt(0) === ':') fail(MSG.flowValue, cur.no);
    if (text.charAt(0) === '?') fail(MSG.complexKey, cur.no);
    rejectUnsupported(text, cur.no);
    cur.col = end;
    return { text: text, quoted: false };
  }

  /** Move to the next character that matters inside a flow collection, crossing spaces, comments and line ends. */
  function flowPeek(s, cur) {
    for (;;) {
      var raw = s.lines[cur.no], c = raw.charAt(cur.col);
      if (isBlank(c)) { cur.col++; continue; }
      var comment = c === '#' && (cur.col === 0 || isBlank(raw.charAt(cur.col - 1)));
      if (c !== '' && !comment) return c;
      flowNextLine(s, cur);
    }
  }

  function flowNextLine(s, cur) {
    cur.no++;
    cur.col = 0;
    cur.strayed = cur.strayed || cur.no === s.lines.length;
    if (cur.strayed && cur.no === s.lines.length) fail(MSG.flowSeparator, cur.no - 1);
    var raw = s.lines[cur.no], lead = /^[ \t]*/.exec(raw)[0], first = raw.charAt(lead.length);
    if (first === '' || first === '#') return;
    if (lead.indexOf('\t') !== -1) fail(MSG.tab, cur.no);
    // Real parsers tolerate a line that steps back out to the surrounding block, so read on.
    // If the brackets then fail to close, flowCollection reports the opening one.
    if (lead.length <= cur.parent && first !== ']' && first !== '}') cur.strayed = true;
  }

  return { parse: parse, parseDocument: parseDocument, YamlError: YamlError };
});
