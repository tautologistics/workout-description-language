/**
 * The builder: parse, modify, generate — over one document.
 *
 * The design decision worth stating is what *not* to build. A GUI with a field
 * per property — reps here, load there, a dropdown for laterality — would always
 * lag the grammar, and the grammar is the interesting part. `21-15-9`, `each
 * arm`, `@ 85% 1RM`, `reversed`: every one of those would need a widget, and the
 * day the spec grows another the builder silently cannot express it.
 *
 * So the outline gives you *shape* — order, nesting, duplication, deletion — with
 * buttons, because those are the operations that are genuinely fiddly to do by
 * hand in text. Everything a line says stays a line you type, with the movement
 * registry as autocomplete and the parser reporting what it understood. The GUI
 * covers what text is bad at and gets out of the way of what it is good at.
 *
 * The text is the document. Structural operations splice the lines array in
 * place rather than regenerating from the AST, so comments, blank lines and your
 * own spacing survive being dragged around. Canonicalising is a button, not a
 * side effect of clicking something else.
 */

import { readLines } from '../../build/web/core/lines.js';
import {
  spans, move as moveLines, moveTo as moveToLine, shift as shiftLines, remove as removeLines,
  duplicate as duplicateLines, insertAfter, logicalText, replaceLogical, logicalEnd,
} from '../../build/web/core/edit.js';
import { parse } from '../../build/web/core/parse.js';
import { wdl } from '../../build/web/core/grammar/parser.js';
import { blockModifierOptions, blockKindCompletions } from '../../build/web/core/block-affordances.js';
import { format } from '../../build/web/core/format.js';
import { compile } from '../../build/web/core/timeline.js';
import { formatQuantity } from '../../build/web/core/units.js';
import { validate } from '../../build/web/core/validate.js';
import { run, roundLabel } from '../../build/web/core/run.js';
import { provide, has } from '../../build/web/core/env.js';
import { defaultRegistry } from '../../build/web/core/registry.js';
import { parseGoals, check } from '../../build/web/core/goals.js';
import { exposures, muscleLoad, musclesFor, muscles } from '../../build/web/core/muscles.js';
import { mountBody, paintBody, aggregateStates, highlightStates, heatStates, heatColor, attachZoom } from '../shared/body-map.js';
import {
  currentUser, beginGoogleSignIn, refreshAuth, signOut,
  listMine, getById as pbGetById, create as pbCreate, update as pbUpdate,
  remove as pbRemove, shareUrl,
} from '../shared/pocketbase.js';

const GRAMMAR = '../../spec/grammar-0.1.ohm';
const REGISTRY = '../../registry/movements.json';
const CANONICAL = '../../registry/movements.canonical.json';
const MUSCLES = '../../registry/muscles.json';
const GOALS = ['rotate-muscles.wdlg', 'ramp-the-pull.wdlg'];
const el = (id) => document.getElementById(id);

// The grammar, before anything else and with a top-level `await`, because
// `parse` *is* the grammar and this module's first render calls it. The registry
// fetches below are allowed to fail and take a feature with them; this one is
// not, so it is awaited here rather than raced with the first draw. A failure
// leaves a page that says so instead of a page whose buttons quietly do nothing.
try {
  const source = await fetch(new URL(GRAMMAR, location.href))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${r.statusText}`))));
  provide({ grammar: () => source });
} catch (e) {
  document.body.textContent = `Cannot read ${GRAMMAR} — the parser is that file. ${e.message}`;
  throw e;
}

const START = `# New workout
5 rounds for time:
  - 10 Push-Up
  - 15 Air Squat
`;

/** The document, as lines. Everything else is derived. */
let lines = START.replace(/\n$/, '').split('\n');

// A buffer stashed just before a sign-in redirect (see `startSignIn`) — the
// page navigates to Google and back, so the in-memory document would otherwise
// be lost. Restored once, here, before the first render; the key is written
// nowhere else, so a normal reload never triggers this.
try {
  const draft = localStorage.getItem('wdl.pb-draft');
  if (draft != null) {
    localStorage.removeItem('wdl.pb-draft');
    lines = draft.replace(/\n$/, '').split('\n');
    if (!lines.length) lines = [''];
  }
} catch { /* private mode */ }
/** Which line the caret was on, so a redraw does not steal focus back to the top. */
let focused = null;
/** The curated registry, for per-row movement suggestions. Empty until it loads. */
let curatedMovements = [];

/**
 * What a block header can take next — the comma modifiers and the kind
 * completions, both read straight off `spec/grammar-0.1.ohm` by
 * `block-affordances.ts` so they cannot lag it. Computed once, lazily, because
 * the grammar is provided just after this module's imports and `wdl()` throws
 * before then.
 */
let blockAffordances = null;
const headerAffordances = () => (blockAffordances ??= {
  modifiers: blockModifierOptions(wdl().grammar),
  completions: blockKindCompletions(wdl().grammar),
});

const text = () => `${lines.join('\n')}\n`;

// --- structure ---------------------------------------------------------------

// Every structural operation lives in @wdl/core: they are document edits any
// editor over this format would want, they are the ones with the subtle rules
// about what a thing owns, and they are testable there against the whole corpus
// rather than by clicking around in here.

const indentOf = (i) => lines[i - 1].length - lines[i - 1].trimStart().length;

/** Which of the two drags this is, if either. A file drop is neither. */
const dragKind = (e) => {
  const t = e.dataTransfer?.types ?? [];
  if ([...t].includes('text/wdl-line')) return 'move';
  if ([...t].includes('text/wdl-movement')) return 'add';
  return null;
};

/**
 * The thing before this one at the same level, so dropping *before* something
 * can be expressed as inserting after its predecessor — which is the only
 * insertion point `insertAfter` has.
 */
const previousSibling = (line) => {
  const self = spans(lines).get(line);
  const prev = self?.siblings[self.index - 1];
  return prev?.line;
};

const apply = (next, focus) => { lines = next; render(focus); };

const move = (line, dir) => apply(moveLines(lines, line, dir), line);
const moveTo = (line, target, where) => apply(moveToLine(lines, line, target, where), target);
const shift = (line, by) => apply(shiftLines(lines, line, by), line);
const remove = (line) => apply(removeLines(lines, line), Math.min(line, lines.length));
const duplicate = (line) => apply(duplicateLines(lines, line), line);
const insert = (after, content) => apply(insertAfter(lines, after ?? undefined, content), (after ?? lines.length) + 1);

// --- rendering ---------------------------------------------------------------

const TOOLS = [
  ['↑', 'Move up', (l) => move(l, -1)],
  ['↓', 'Move down', (l) => move(l, 1)],
  ['⇥', 'Indent', (l) => shift(l, 2)],
  ['⇤', 'Outdent', (l) => shift(l, -2)],
  ['⧉', 'Duplicate', duplicate],
  ['✕', 'Delete', remove],
];

function render(focusLine) {
  if (focusLine !== undefined) focused = focusLine;
  el('text').value = text();
  renderOutline();
  renderReading();
  renderReadsAs();
  renderFindings();
  renderBody();
  const link = el('board');
  link.href = `../display/#${encodeURIComponent(text())}`;
}

/**
 * The part of a row's value that names a movement — not a parse, because a
 * row can be mid-edit and still deserves suggestions. Strips the leading
 * `- ` a step carries and the quantity in front of the movement (`10 `,
 * `21 `, `400m `, `20cal `), leaving whatever the mover is typing, trailing
 * modifiers and all.
 */
const movementFragment = (value) => value
  .replace(/^-\s+/, '')
  .replace(/^[\d:./x%]+\s*/i, '');

/** Curated movements whose name plausibly matches what is being typed, either way. */
const movementSuggestions = (fragment) => {
  const q = fragment.trim().toLowerCase();
  if (!q) return [];
  return curatedMovements
    .filter((m) => {
      const t = m.title.toLowerCase();
      return t.startsWith(q) || q.startsWith(t) || t.includes(q);
    })
    .slice(0, 20);
};

/**
 * The curated entry a movement name actually resolves to — what a row's
 * modifier affordance reads, as opposed to `movementSuggestions`' fuzzy match
 * while typing a name. Goes through `Registry.resolve()`, the same
 * alias/plural/abbreviation/token-set pipeline the parser and `validate` use
 * (movement_registry_design.md §3), so an alias (`DB Curl`) or a plural
 * (`Dumbbell Curls`) finds the same entry the exact title does — an earlier
 * version of this function did a bare exact-title match and missed both.
 * `has('movements')` guards the window before the registry fetch resolves,
 * when `defaultRegistry()` would otherwise throw.
 */
const movementEntry = (title) => {
  if (!title || !has('movements')) return undefined;
  const resolution = defaultRegistry().resolve(title);
  return resolution.status === 'ok' ? resolution.entry : undefined;
};

/**
 * What one curated movement supports, as insertable defaults — derived from
 * the registry so this can never lag the grammar the way a hand-maintained
 * field per property would (see the file header). Canonical text per
 * movement_registry_design.md §6 (laterality) and spec §4 (measured output).
 * `equipment` is returned for context only; nothing inserts it.
 */
const movementModifiers = (entry) => {
  // Shown even when only one mode is listed: without a `defaultLaterality`,
  // the parser has nothing to assume (movement_registry_design.md §6) — a
  // single-mode entry still needs the mode written, it just has no choice
  // among alternatives.
  const laterality = (entry.laterality ?? []).map((mode) => ({
    text: mode === 'split' ? '(split)' : mode === 'per-side' ? 'each side' : '(both)',
    label: mode === 'split' ? 'count divided across sides'
      : mode === 'per-side' ? 'full count per side'
      : 'both sides together',
    isDefault: mode === entry.defaultLaterality,
  }));
  const measures = (entry.measures ?? []).map((mode) => ({
    text: `, count ${mode === 'calories' ? 'cal' : mode}`,
    label: mode === 'calories' ? 'measured in calories' : 'measured in distance',
  }));
  const load = entry.load
    ? {
        text: entry.load === 'per-implement' && entry.implements ? `@ ${entry.implements}x` : '@ ',
        label: entry.load === 'per-implement'
          ? `takes a load, per implement (holds ${entry.implements ?? 2})`
          : 'takes a load',
      }
    : null;
  // Array.isArray, not just `?? []`: registry/movements.json carried
  // `equipment` as a bare string on 669 entries until 2026-08-25 (a curated
  // seed-file inconsistency `scripts/build-movements.mjs` only normalizes on
  // the canonical merge, not here) — `?? []` lets a truthy string straight
  // through, and `.join` below then throws. See lessons-learned.md.
  const equipment = Array.isArray(entry.equipment) ? entry.equipment : [];
  return { laterality, measures, load, equipment };
};

/**
 * The move/reorder drag wiring shared by every outline row — a real node or a
 * synthesised comment row. `followLine`, set only for a comment row, is the real
 * line the comment attaches forward to: a palette drop "before" the comment
 * lands before *that* line, since the comment has no span of its own to sit
 * beside.
 */
function attachRowDrag(node, lineNo, followLine) {
  node.draggable = true;
  node.dataset.line = String(lineNo);
  node.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'INPUT') return e.preventDefault();   // let text select
    e.dataTransfer.setData('text/wdl-line', String(lineNo));
    e.dataTransfer.effectAllowed = 'move';
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
  node.addEventListener('dragover', (e) => {
    if (!dragKind(e)) return;
    e.preventDefault();
    node.dataset.drop = e.offsetY < node.offsetHeight / 2 ? 'before' : 'after';
  });
  node.addEventListener('dragleave', () => delete node.dataset.drop);
  node.addEventListener('drop', (e) => {
    const where = node.dataset.drop === 'before' ? 'before' : 'after';
    delete node.dataset.drop;
    const kind = dragKind(e);
    if (!kind) return;
    e.preventDefault();
    e.stopPropagation();
    if (kind === 'move') {
      moveTo(Number(e.dataTransfer.getData('text/wdl-line')), lineNo, where);
    } else {
      // A palette drop lands beside what it was dropped on, not inside it.
      const anchor = where === 'before'
        ? previousSibling(followLine ?? lineNo)
        : lineNo;
      insert(anchor, e.dataTransfer.getData('text/wdl-movement'));
    }
  });
}

function renderOutline() {
  const outline = el('outline');
  outline.innerHTML = '';
  const parsed = parse(text());
  const badLines = new Set(parsed.errors.map((e) => e.line));

  // Which movement a line prescribes, if any, for the body map's outline
  // hover — the AST's own line numbers, not the outline's, because a rep
  // scheme step and its outline row do not always number the same way an
  // inline block does.
  const movementOf = new Map();
  // The parsed block a header row stands for, keyed the same way — what the
  // block-header affordance reads to know the kind and what it still needs.
  const blockOf = new Map();
  // The row kind, driven off the parse wherever the parse distinguishes it: a
  // step, a rest, a `section` (the inert labelled container `conditioning:`
  // produces) or a repeating/structured `header` (every other block kind). The
  // preamble kinds the parser folds away — title (`#`), directive (`@`) — and
  // the synthesised comment row are classed from raw text in `walk` instead.
  // Drives the `.node[data-kind]` marker; R9's Text-tab highlighter shares the
  // `--kind-*` tokens it maps to.
  const kindOf = new Map();
  const collect = (nodes) => {
    for (const n of nodes) {
      if (n.node === 'step') { movementOf.set(n.line, n.movement); kindOf.set(n.line, 'step'); }
      else if (n.node === 'rest') kindOf.set(n.line, 'rest');
      else if (n.node === 'block') {
        blockOf.set(n.line, n);
        kindOf.set(n.line, n.type === 'section' ? 'section' : 'header');
        collect(n.children);
      } else if (n.node === 'interrupt') { kindOf.set(n.line, 'header'); collect(n.body); }
    }
  };
  collect(parsed.workout.body);

  // `readLines` folds an own-line comment into the `comments[]` of the next real
  // line and never emits a node for it, so the outline would otherwise show no
  // row for a `//` line. Synthesise one: a `.node.comment` row for each own-line
  // comment, at the depth of the line it attaches forward to, written back
  // through the comment-aware splice in @wdl/core's edit.ts. A *trailing*
  // comment on a content line stays in that line's own input (it is already in
  // the row text), so only lines that are entirely `//` get a row here.
  const isCommentLine = (i) => /^\s*\/\//.test(lines[i - 1] ?? '');
  const emitted = new Set();

  const emitCommentRow = (k, depth, followLine) => {
    emitted.add(k);
    const node = document.createElement('div');
    node.className = 'node comment';
    node.dataset.kind = 'comment';
    if (badLines.has(k)) node.classList.add('bad');

    const rails = document.createElement('span');
    rails.className = 'rails';
    for (let d = 0; d <= depth; d++) {
      const rail = document.createElement('span');
      rail.className = 'rail';
      rails.append(rail);
    }

    const wrap = document.createElement('span');
    wrap.className = 'line-wrap';
    const input = document.createElement('input');
    input.className = 'line';
    input.value = lines[k - 1].trim();
    input.dataset.line = String(k);
    input.addEventListener('input', () => {
      lines = replaceLogical(lines, k, input.value);
      el('text').value = text();
      renderReading();
      renderReadsAs();
      renderFindings();
      renderBody();
    });
    input.addEventListener('change', () => render(k));
    input.addEventListener('focus', () => { focused = k; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); insert(k, '// '); }
      if (e.key === 'Tab' && !e.shiftKey && input.selectionStart === input.value.length) {
        e.preventDefault(); shift(k, 2);
      }
    });
    wrap.append(input);

    const tools = document.createElement('span');
    tools.className = 'tools';
    for (const [glyph, title, fn] of TOOLS) {
      const b = document.createElement('button');
      b.textContent = glyph;
      b.title = title;
      b.onclick = () => fn(k);
      tools.append(b);
    }

    attachRowDrag(node, k, followLine);
    node.append(rails, wrap, tools);
    outline.append(node);
  };

  const walk = (nodes, depth) => {
    for (const n of nodes) {
      if (!n.line) continue;   // the synthetic node trailing comments produce

      // Own-line comments written above this row — physical `//` lines between
      // the previous real content and here, blanks skipped. They attach forward
      // (per `lines.ts`), so the row sits at this node's depth, above it.
      const leading = [];
      for (let k = n.line - 1; k >= 1; k--) {
        if (!lines[k - 1].trim()) continue;
        if (isCommentLine(k)) { if (!emitted.has(k)) leading.unshift(k); continue; }
        break;
      }
      for (const k of leading) emitCommentRow(k, depth, n.line);

      const node = document.createElement('div');
      node.className = 'node';
      // The row kind: raw text for the preamble kinds the parser folds away
      // (title, directive) and the own-line comment, the parsed node (`kindOf`)
      // for step / rest / section / header, and failing both a colon-terminated
      // line reads as a header while anything else reads as a step — so a broken
      // step (`- 10 Nonsense @@@`, which does not parse) still reads as a step,
      // and then `.bad` adds the error treatment on top.
      const kind = (depth === 0 && n.text.startsWith('#')) ? 'title'
        : (depth === 0 && n.text.startsWith('@')) ? 'directive'
        : n.text.startsWith('//') ? 'comment'
        : kindOf.get(n.line) ?? (/:$/.test(n.text) ? 'header' : 'step');
      node.dataset.kind = kind;
      if (/:$/.test(n.text) || n.children.length) node.classList.add('block');
      if (n.text.startsWith('//')) node.classList.add('comment');
      if (badLines.has(n.line)) node.classList.add('bad');

      const rails = document.createElement('span');
      rails.className = 'rails';
      for (let d = 0; d <= depth; d++) {
        const rail = document.createElement('span');
        rail.className = 'rail';
        rails.append(rail);
      }

      // A wrapped inline block is one row standing for several lines; show the
      // whole of it, and write it back over all of them.
      const wrap = document.createElement('span');
      wrap.className = 'line-wrap';

      const input = document.createElement('input');
      input.className = 'line';
      input.value = logicalText(lines, n.line);
      input.dataset.line = String(n.line);

      // The movement caret: a live-filtered list of curated movements matching
      // whatever is being typed, replacing just the movement-name part of the
      // line so quantity and modifiers already on it survive the pick.
      const suggestions = document.createElement('div');
      suggestions.className = 'suggestions';
      suggestions.hidden = true;
      let highlighted = -1;

      const closeSuggestions = () => {
        suggestions.hidden = true;
        suggestions.innerHTML = '';
        highlighted = -1;
      };

      const pick = (m) => {
        const value = input.value;
        const fragment = movementFragment(value);
        const prefixLen = value.length - fragment.length;
        const rest = fragment.toLowerCase().startsWith(m.title.toLowerCase())
          ? fragment.slice(m.title.length)
          : '';
        input.value = value.slice(0, prefixLen) + m.title + rest;
        closeSuggestions();
        lines = replaceLogical(lines, n.line, input.value);
        el('text').value = text();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        const at = prefixLen + m.title.length;
        input.focus();
        input.setSelectionRange(at, at);
      };

      const openSuggestions = () => {
        const matches = movementSuggestions(movementFragment(input.value));
        if (!matches.length) return closeSuggestions();
        suggestions.innerHTML = '';
        for (const m of matches) {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'suggestion';
          item.textContent = m.title;
          item.onmousedown = (e) => e.preventDefault();   // keep focus in the input
          item.onclick = () => pick(m);
          suggestions.append(item);
        }
        highlighted = -1;
        suggestions.hidden = false;
      };

      const highlight = (i) => {
        for (const it of suggestions.children) it.classList.remove('active');
        const item = suggestions.children[i];
        if (item) { item.classList.add('active'); item.scrollIntoView({ block: 'nearest' }); }
        highlighted = i;
      };

      input.addEventListener('input', () => {
        // The indent is structure, and the outline is not where you change it —
        // that is what indent and outdent are for. `replaceLogical` keeps it.
        lines = replaceLogical(lines, n.line, input.value);
        el('text').value = text();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        openSuggestions();
      });
      input.addEventListener('change', () => render(n.line));
      input.addEventListener('focus', () => { focused = n.line; });
      input.addEventListener('blur', closeSuggestions);
      input.addEventListener('keydown', (e) => {
        if (!suggestions.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          const count = suggestions.children.length;
          highlight(e.key === 'ArrowDown' ? (highlighted + 1) % count : (highlighted - 1 + count) % count);
          return;
        }
        if (!suggestions.hidden && e.key === 'Enter' && highlighted >= 0) {
          e.preventDefault(); suggestions.children[highlighted].click(); return;
        }
        if (!suggestions.hidden && e.key === 'Escape') { closeSuggestions(); return; }
        if (e.key === 'Enter') { e.preventDefault(); insert(n.line, ''); }
        if (e.key === 'Tab' && !e.shiftKey && input.selectionStart === input.value.length) {
          e.preventDefault(); shift(n.line, 2);
        }
      });

      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = 'caret';
      caret.title = 'Movement suggestions';
      caret.tabIndex = -1;
      caret.textContent = '▾';
      caret.onmousedown = (e) => e.preventDefault();   // keep focus in the input
      caret.onclick = () => (suggestions.hidden ? (input.focus(), openSuggestions()) : closeSuggestions());

      // The modifier caret: what *this* movement supports, read off the
      // registry entry the row currently names — laterality, measured
      // output, load — each with the default text a pick splices in right
      // after the movement name, the same seam `pick()` replaces it at.
      // Hidden entirely when the row names no curated movement, or the
      // entry has nothing to offer, rather than opening to say so.
      const modifiers = document.createElement('div');
      modifiers.className = 'suggestions modifiers';
      modifiers.hidden = true;

      const closeModifiers = () => { modifiers.hidden = true; modifiers.innerHTML = ''; };

      // Where a modifier lands: laterality is the first inline word after the
      // movement name (spec §4 — "attach to the movement and precede the
      // target"), load follows it and precedes any comma modifiers (`10
      // Dumbbell Curl each arm @ 2x35lb`), and measured output is itself a
      // comma modifier, so it goes at the very end.
      const applyModifier = (entryTitle, addition, position) => {
        const value = input.value;
        let next; let caretAt;
        if (position === 'end') {
          next = value + addition;
          caretAt = next.length;
        } else {
          const fragment = movementFragment(value);
          const prefixLen = value.length - fragment.length;
          const matchLen = fragment.toLowerCase().startsWith(entryTitle.toLowerCase())
            ? entryTitle.length : fragment.length;
          const titleEnd = prefixLen + matchLen;
          let insertAt = titleEnd;
          if (position === 'load') {
            const commaIdx = value.slice(titleEnd).indexOf(',');
            insertAt = commaIdx === -1 ? value.length : titleEnd + commaIdx;
          }
          const head = value.slice(0, insertAt);
          const rest = value.slice(insertAt);
          const lead = head && !head.endsWith(' ') ? ' ' : '';
          const trail = rest && !rest.startsWith(' ') && !rest.startsWith(',') ? ' ' : '';
          next = `${head}${lead}${addition}${trail}${rest}`;
          caretAt = head.length + lead.length + addition.length;
        }
        input.value = next;
        closeModifiers();
        lines = replaceLogical(lines, n.line, next);
        el('text').value = text();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        input.focus();
        input.setSelectionRange(caretAt, caretAt);
      };

      const openModifiers = () => {
        const title = movementOf.get(n.line);
        const entry = title && movementEntry(title);
        if (!entry) return;
        const mods = movementModifiers(entry);
        const items = [
          ...mods.laterality.map((m) => ({ ...m, addition: m.text, position: 'title' })),
          ...mods.measures.map((m) => ({ ...m, addition: m.text, position: 'end' })),
          ...(mods.load ? [{ ...mods.load, addition: mods.load.text, position: 'load' }] : []),
        ];
        if (!items.length) return;
        modifiers.innerHTML = '';
        for (const it of items) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'suggestion';
          b.textContent = `${it.text}${it.isDefault ? ' (default)' : ''} — ${it.label}`;
          b.onmousedown = (e) => e.preventDefault();
          b.onclick = () => applyModifier(entry.title, it.addition, it.position);
          modifiers.append(b);
        }
        if (mods.equipment.length) {
          const info = document.createElement('div');
          info.className = 'modifier-info';
          info.textContent = `Equipment: ${mods.equipment.join(', ')}`;
          modifiers.append(info);
        }
        modifiers.hidden = false;
      };

      const modCaret = document.createElement('button');
      modCaret.type = 'button';
      modCaret.className = 'caret modcaret';
      modCaret.title = 'What this movement takes';
      modCaret.tabIndex = -1;
      modCaret.textContent = '»';
      modCaret.hidden = true;
      modCaret.onmousedown = (e) => e.preventDefault();   // keep focus in the input
      modCaret.onclick = () => (modifiers.hidden ? (input.focus(), openModifiers()) : closeModifiers());
      input.addEventListener('blur', closeModifiers);

      {
        const title = movementOf.get(n.line);
        const entry = title && movementEntry(title);
        const mods = entry && movementModifiers(entry);
        const hasAny = mods && (mods.laterality.length || mods.measures.length || mods.load);
        modCaret.hidden = !hasAny;
      }

      // The block-header caret: the block-level counterpart of `modCaret`. On a
      // row that parses to a block it opens a panel of what that header can take
      // next — a duration to finish a bare `AMRAP:` or `EMOM:`, and the comma
      // modifiers the grammar's `blockModifier` rule allows (`cap`, `for time`,
      // `as …`, `wearing …`, overrun behaviour, an inherited `@` target) — each
      // with an editable default spliced in at the grammatically valid spot.
      // The list comes from `block-affordances.ts`, which reads the grammar, so
      // it cannot drift from what the parser accepts. Sits where `modCaret`
      // sits; the two never show on the same row (one needs a movement, the
      // other a block).
      const blockPanel = document.createElement('div');
      blockPanel.className = 'suggestions modifiers';
      blockPanel.hidden = true;
      const closeBlockPanel = () => { blockPanel.hidden = true; blockPanel.innerHTML = ''; };

      // Splice into the header — the text before the first `:`. A comma modifier
      // goes after the existing header content; a kind completion goes right
      // after the leading kind word (`AMRAP` -> `AMRAP 12min`). Everything after
      // the colon (an inline block's body) is left untouched.
      const applyHeaderMod = (addition, mode) => {
        const value = input.value;
        const colon = value.indexOf(':');
        const head = colon === -1 ? value : value.slice(0, colon);
        const tail = colon === -1 ? '' : value.slice(colon);
        let newHead; let caretAt;
        if (mode === 'kind') {
          // After the kind word, before any comma modifiers already on the line.
          const m = head.match(/^(\s*-?\s*[^\s,]+)(.*)$/);
          if (m) { newHead = `${m[1]} ${addition}${m[2]}`; caretAt = m[1].length + 1 + addition.length; }
          else { newHead = `${head.trim()} ${addition}`; caretAt = newHead.length; }
        } else {
          const base = head.replace(/\s+$/, '');
          newHead = base.trim() ? `${base}, ${addition}` : addition;
          caretAt = newHead.length;
        }
        const next = newHead + tail;
        input.value = next;
        closeBlockPanel();
        lines = replaceLogical(lines, n.line, next);
        el('text').value = text();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        input.focus();
        input.setSelectionRange(caretAt, caretAt);
      };

      const openBlockPanel = () => {
        const block = blockOf.get(n.line);
        if (!block) return;
        const { modifiers: mods, completions } = headerAffordances();
        const header = input.value.split(':')[0];
        const bareHead = header.replace(/^\s*-?\s*/, '').trim();
        // The kind occupies the first comma segment; a completion applies only
        // while that segment is just the kind word, with nothing after it —
        // which is also what keeps `for time:` from being offered `for`'s
        // duration, since its first segment is two words.
        const firstSeg = bareHead.split(',')[0].trim();
        const kindWord = firstSeg.split(/\s+/)[0];
        const kindWordStandsAlone = firstSeg === kindWord;
        const items = [];
        for (const c of completions) {
          if (kindWordStandsAlone && c.head.test(kindWord) && !block[c.filled]) {
            items.push({ text: `${c.insert} — ${c.label}`, addition: c.insert, mode: 'kind' });
          }
        }
        for (const o of mods) {
          if (o.present && o.present(header)) continue;   // header already carries it
          items.push({ text: `${o.insert} — ${o.label}`, addition: o.insert, mode: 'comma' });
        }
        if (!items.length) return;
        blockPanel.innerHTML = '';
        for (const it of items) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'suggestion';
          b.textContent = it.text;
          b.onmousedown = (e) => e.preventDefault();
          b.onclick = () => applyHeaderMod(it.addition, it.mode);
          blockPanel.append(b);
        }
        blockPanel.hidden = false;
      };

      const blockCaret = document.createElement('button');
      blockCaret.type = 'button';
      blockCaret.className = 'caret modcaret';
      blockCaret.title = 'What this block can take next';
      blockCaret.tabIndex = -1;
      blockCaret.textContent = '»';
      blockCaret.hidden = !blockOf.has(n.line);
      blockCaret.onmousedown = (e) => e.preventDefault();
      blockCaret.onclick = () => (blockPanel.hidden ? (input.focus(), openBlockPanel()) : closeBlockPanel());
      input.addEventListener('blur', closeBlockPanel);

      // On a block row the movement-name caret has nothing to complete; hide it
      // so only the one meaningful affordance shows.
      if (blockOf.has(n.line)) caret.hidden = true;

      wrap.append(input, modCaret, blockCaret, caret, suggestions, modifiers, blockPanel);

      const tools = document.createElement('span');
      tools.className = 'tools';
      for (const [glyph, title, fn] of TOOLS) {
        const b = document.createElement('button');
        b.textContent = glyph;
        b.title = title;
        b.onclick = () => fn(n.line);
        tools.append(b);
      }

      // Dragging is for where things go; the buttons stay for one step at a
      // time, which is easier to aim than a drag when that is all you want.
      attachRowDrag(node, n.line);

      const movement = movementOf.get(n.line);
      if (movement) {
        node.addEventListener('mouseenter', () => hoverBody(musclesFor(movement) ?? { primary: [], secondary: [] }));
        node.addEventListener('mouseleave', unhoverBody);
      }

      node.append(rails, wrap, tools);
      outline.append(node);
      walk(n.children, depth + 1);
    }
  };

  walk(readLines(text()), 0);

  // Comments with no following real line — a trailing block at end of file, or
  // after the last child of a block — have no row to hang under. Emit them at
  // the margin, in source order, after everything else.
  for (let k = 1; k <= lines.length; k++) {
    if (isCommentLine(k) && !emitted.has(k)) emitCommentRow(k, 0);
  }

  const restore = outline.querySelector(`input[data-line="${focused}"]`);
  if (restore && document.activeElement?.tagName !== 'TEXTAREA') {
    restore.focus();
    restore.setSelectionRange(restore.value.length, restore.value.length);
  }
}

/**
 * One cue as a row in a `.steps` list — shared by the Analysis tab's capped
 * `#steps` list and the Reads-as tab's uncapped "show every cue" expansion.
 * The cycle-rail classes match the CSS in `.steps .cue.looping`; the palette
 * cycles through four hues so two repeating blocks back to back do not read
 * as one continuous cycle.
 */
function cueRow(cue, laid) {
  const end = (c) => c.to ?? laid.cues.length;
  const cycle = laid.cycles.find((c) => cue.index >= c.from && cue.index < end(c));
  const row = document.createElement('div');
  row.className = `cue ${cue.kind}${cycle ? ' looping' : ''}`;
  if (cycle) {
    const hue = laid.cycles.indexOf(cycle) % 4;
    if (hue > 0) row.classList.add(`cycle-hue-${hue}`);
    if (cue.index === cycle.from) row.classList.add('cycle-start');
    if (cue.index === end(cycle) - 1) row.classList.add('cycle-end');
  }
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = String(cue.index + 1);
  const label = document.createElement('span');
  const round = roundLabel(cue.rounds);
  label.textContent = round ? `${cue.label}  ·  ${round}` : cue.label;
  row.append(n, label);
  return row;
}

/**
 * What the parser understood — the honest half of the round trip.
 *
 * A builder that only shows you what you typed is a text editor. The value is in
 * showing what it *means*: how many reps that adds up to, how long it will take,
 * what order the steps come in once a rep scheme is expanded.
 */
function renderReading() {
  const { workout, errors } = parse(text());
  // The document title lives in the header now; `render()` repaints this pane
  // on every edit, so this is where it stays current.
  el('doc-title').textContent = workout.title ?? '';
  const summary = el('summary');
  const list = el('diagnostics');
  const stepsBox = el('steps');
  summary.innerHTML = '';
  list.innerHTML = '';
  stepsBox.innerHTML = '';

  let laid;
  try {
    laid = run(compile(workout));
  } catch (e) {
    summary.textContent = `cannot compile: ${e.message}`;
    return;
  }

  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  // Mirrors `declaredScore` in packages/core/src/result.ts (the same question
  // the board asks after a run, to know what it is allowed to claim it
  // measured) rather than reading `workout.score` alone: most real workouts
  // — a bare `for time:` or `AMRAP`, no separate `score:` line — carry their
  // only score on the one top-level block, implied by the header, and
  // `workout.score` is undefined for them. Falling back to that single
  // block's score is what makes the row appear for the common case, not just
  // the case where a score line was written out at the top.
  //
  // Blocks-carry-their-own-score is only resolved here in the one-block,
  // one-score case. More than one top-level block (so more than one
  // candidate score) is the "workout can have more than one scoring rule"
  // case the builder-ux.md item flags as a separate, undecided display
  // question — left out of scope for this pass, so the row is simply absent
  // rather than guessing which block's score to show.
  const declaredScoreNode = (w) => {
    if (w.score) return w.score;
    const blocks = w.body.filter((n) => n.node === 'block');
    return blocks.length === 1 ? blocks[0].score : undefined;
  };
  // `raw` already carries the primary phrase as written (or as implied by the
  // header, e.g. `for time` implies `time`) — an implied score reads the same
  // as a written one here, on the call that this pane is a different surface
  // from the canonical formatter, which deliberately omits them because the
  // header already states them. The summary's job is "how is this scored?",
  // and an implied score still answers that.
  const describeScore = (s) => {
    const parts = [s.raw || s.primary];
    if (s.onCap) parts.push(`on cap: ${s.onCap}`);
    if (s.tiebreak) parts.push(`tiebreak: ${s.tiebreak}`);
    return parts.join(', ');
  };
  const score = declaredScoreNode(workout);
  const dl = document.createElement('dl');
  const rows = [
    ['title', workout.title ?? '—'],
    ['cues', `${laid.cues.length}${laid.loops ? ' per pass' : ''}`],
    // A window is a clock you are racing; a duration is how long the work will
    // take. Reusing one label for both, and then printing the window beside it
    // in a different format, made an AMRAP look like it still had the for-time
    // reading stuck to it — the same number twice, under a word that had
    // quietly changed meaning.
    ...(laid.window
      ? [['clock', clock(laid.window)]]
      : [['duration', laid.totalSeconds !== undefined ? clock(laid.totalSeconds) : 'athlete-paced']]),
    // And a cap is neither. It says how long you are *given*, so a capped
    // for-time workout read `duration: 12:00` — "this takes twelve minutes"
    // where the file says "you have at most twelve". Its own row, its own word,
    // and the duration beside it now says `athlete-paced`, which is the true
    // answer to the question the other row asks.
    ...(laid.cap !== undefined ? [['cap', `${clock(laid.cap)} at most`]] : []),
    // The scoring rule, including what happens at the cap — `on cap:` is the
    // whole reason a cap row above can say "at most" instead of "this takes".
    ...(score ? [['score', describeScore(score)]] : []),
    // A cycle that covers the whole workout is the workout repeating; one that
    // covers part of it is a section that does, and saying "repeats until the
    // clock stops" of the whole thing puts the buy-in and the buy-out on a
    // clock they are not on.
    ...laid.cycles.map((c) => {
      const to = c.to ?? laid.cues.length;
      const whole = c.from === 0 && to === laid.cues.length;
      const span = to - c.from === 1 ? `cue ${to}` : `cues ${c.from + 1}–${to}`;
      return [whole ? 'repeats' : `${span} repeat`,
        c.window ? `until ${clock(c.window)} is up` : 'until you stop'];
    }),
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  summary.append(dl);

  // The <dl> above is the summary band; the cue list below is a detail view and
  // lives in the (bounded, scrolling) Analysis panel — see `#steps` / `#view-analysis`.
  // `cueRow` (shared with the Reads-as tab's "show every cue" list) carries the
  // cycle-rail marking: a cue inside a cycle comes round again, and this list is
  // the only place that is visible at a glance.
  for (const cue of laid.cues.slice(0, 24)) stepsBox.append(cueRow(cue, laid));
  if (laid.cues.length > 24) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `…and ${laid.cues.length - 24} more`;
    stepsBox.append(more);
  }

  // Registry-backed checks need the registry. Without it the parse errors still
  // show; say what is missing rather than looking clean because half the checks
  // never ran.
  const diagnostics = [
    ...errors.map((e) => ({ severity: 'error', line: e.line, message: e.message })),
    ...(has('movements') ? validate(workout) : []),
  ];
  if (!has('movements')) {
    diagnostics.push({ severity: 'warning', message: 'no movement registry loaded — name checks are off' });
  }
  for (const d of diagnostics) {
    const li = document.createElement('li');
    const where = document.createElement('span');
    where.className = 'where';
    where.textContent = d.line ? `${d.line}  ` : '';
    const body = document.createElement('span');
    body.className = d.severity;
    body.textContent = d.message;
    li.append(where, body);
    for (const c of d.candidates ?? []) {
      const alt = document.createElement('div');
      alt.className = 'candidates';
      alt.textContent = `· ${c}`;
      li.append(alt);
    }
    list.append(li);
  }
  el('dirty').hidden = text() === format(workout);
}

// --- the Reads-as tab: the run, compressed --------------------------------
// A block-grouped reading of the run, read straight off the parsed workout
// tree — the headers carry their own rounds / scheme / window, so nothing is
// enumerated round-by-round the way `#steps` is — plus an opt-in "show every
// cue" expansion to the same per-cue list, uncapped. `renderReading` still
// owns the summary band, the diagnostics and the capped `#steps` list; this
// is a separate function over `#view-reads` and touches none of them.

/** A step as `Movement ×10`, `200m Run`, `20cal Row`, or a bare `Thruster`
 *  when the count is carried by an enclosing scheme. */
function stepRead(s) {
  const q = formatQuantity(s.quantity);
  const k = s.quantity.kind;
  if (k === 'reps' || k === 'range' || k === 'floor') return `${s.movement} ×${q}`;
  if (!q) return s.movement;                        // open / scheme-driven / max
  return `${q} ${s.movement}`;                      // distance, calories, duration
}

/** A rest as `rest 1:00` / `rest as needed` / `rest = work` / `rest 200m Jog`. */
function restRead(r) {
  if (r.active) return `rest ${formatQuantity(r.active.quantity)} ${r.active.movement}`;
  if (r.dynamic === 'as-needed') return 'rest as needed';
  if (r.dynamic === 'equal-to-work') return 'rest = work';
  return r.duration ? `rest ${formatQuantity(r.duration)}` : 'rest';
}

/** A block / interrupt header as its group label: the raw source line as
 *  written (the whiteboard reading), trailing `:` and any inline body dropped.
 *  Falls back to the kind + count / scheme / window when the node has no
 *  physical line of its own (an adopted or synthesised header). */
function headerRead(b) {
  const raw = (lines[b.line - 1] ?? '').trim().replace(/:.*/s, '');
  if (raw) return raw;
  if (b.node === 'interrupt') return `every ${formatQuantity(b.every)}`;
  if (b.scheme) return b.scheme.join('-');
  if (b.count) return `${b.count} rounds`;
  if (b.type === 'amrap' && b.duration) return `AMRAP ${formatQuantity(b.duration)}`;
  return b.name || b.type;
}

/** One node of the grouped reading: a line for a step / rest, or a titled
 *  group for a block / interrupt whose direct steps and rests collapse onto
 *  one inline row and whose nested blocks recurse. */
function readsNode(node) {
  if (node.node === 'step') {
    const d = document.createElement('div');
    d.className = 'reads-line';
    d.textContent = stepRead(node);
    return d;
  }
  if (node.node === 'rest') {
    const d = document.createElement('div');
    d.className = 'reads-line rest';
    d.textContent = restRead(node);
    return d;
  }
  const group = document.createElement('div');
  group.className = 'reads-group';
  const head = document.createElement('div');
  head.className = 'reads-head';
  head.textContent = headerRead(node);
  group.append(head);

  const kids = node.node === 'interrupt' ? node.body : node.children;
  let inline = [];
  const flush = () => {
    if (!inline.length) return;
    const row = document.createElement('div');
    row.className = 'reads-body';
    row.textContent = inline.join('  ·  ');
    group.append(row);
    inline = [];
  };
  for (const c of kids) {
    if (c.node === 'step') inline.push(stepRead(c));
    else if (c.node === 'rest') inline.push(restRead(c));
    else { flush(); group.append(readsNode(c)); }
  }
  flush();
  return group;
}

function renderReadsAs() {
  const box = el('view-reads');
  box.innerHTML = '';
  const { workout } = parse(text());

  let laid;
  try {
    laid = run(compile(workout));
  } catch (e) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = `cannot compile: ${e.message}`;
    box.append(p);
    return;
  }

  if (!workout.body.length) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = 'Nothing to read yet.';
    box.append(p);
    return;
  }

  const groups = document.createElement('div');
  groups.className = 'reads';
  for (const n of workout.body) groups.append(readsNode(n));
  box.append(groups);

  // The opt-in escape hatch: the full, uncapped per-cue list — the same rows
  // `#steps` builds. State survives a re-render and a reload, so it is read
  // fresh from `localStorage` on every paint.
  const expanded = localStorage.getItem('wdl.reads-expanded') === '1';
  const toggle = document.createElement('button');
  toggle.className = 'link reads-toggle';
  toggle.textContent = expanded ? 'hide the cue-by-cue list' : `show every cue (${laid.cues.length})`;
  toggle.onclick = () => {
    try { localStorage.setItem('wdl.reads-expanded', expanded ? '0' : '1'); } catch { /* private mode */ }
    renderReadsAs();
  };
  box.append(toggle);

  if (expanded) {
    const full = document.createElement('div');
    full.className = 'steps reads-cues';
    for (const cue of laid.cues) full.append(cueRow(cue, laid));
    box.append(full);
  }
}

// --- the body map --------------------------------------------------------------

const AGG_COLOR = 'var(--accent)';
const HI_COLOR = 'var(--ask)';

attachZoom(mountBody(el('bodymap')));

/**
 * Which movement, if any, to show against the aggregate — set by hovering a
 * palette entry or an outline row, cleared on mouseleave. `null` means "just
 * the aggregate", which is also what a compile error or a missing muscle
 * registry falls back to.
 */
let hoverMovement = null;

const HINTS = {
  aggregate: 'Opacity: solid is a primary mover, faint is a muscle a step only assists. '
    + 'Hover a movement in the palette or the outline to see what it would add.',
  'heat-frequency': 'How many steps touch each muscle, primary or secondary — always defined.',
  'heat-volume': 'Reps attributed to each muscle. Hatched means the muscle was worked but by a '
    + 'carry, a hold or a max effort — none of which have a rep count to show.',
};

function renderBody() {
  renderBlockAdds();
  const mode = el('body-mode').value;
  el('body-hint').textContent = HINTS[mode];
  const box = el('bodymap');
  if (!has('muscles') || !has('canonicalMovements')) { paintBody(box, {}); return; }

  const { workout } = parse(text());
  let timeline;
  try { timeline = compile(workout); } catch { paintBody(box, {}); return; }

  const list = exposures(timeline).list;
  if (mode === 'aggregate') {
    paintBody(box, hoverMovement
      ? highlightStates(list, hoverMovement, AGG_COLOR, HI_COLOR)
      : aggregateStates(list, AGG_COLOR));
    return;
  }
  const report = muscleLoad(timeline);
  paintBody(box, heatStates(report.byMuscle, mode === 'heat-frequency' ? 'frequency' : 'volume', heatColor));
}

// --- per-section muscle "adds" ---------------------------------------------
// Below the body map, one terse line per top-level named section naming the
// distinct muscles that section brings in — its contribution, without splitting
// the one whole-workout map. Named-section workouts only: a plain sectionless
// workout renders nothing here (no container content, no heading). Shares
// `renderBody`'s inputs — it is called from there, so it survives every
// re-render path the same way — but re-derives from scratch to stay standalone.
const ADDS_CAP = 6;

function renderBlockAdds() {
  const box = el('block-adds');
  if (!box) return;
  box.innerHTML = '';
  if (!has('muscles') || !has('canonicalMovements')) return;

  const { workout } = parse(text());
  const sections = (workout.body ?? [])
    .filter((n) => n.node === 'block' && n.type === 'section');
  if (!sections.length) return;

  let timeline;
  try { timeline = compile(workout); } catch { return; }
  const list = exposures(timeline).list;
  const known = muscles();
  const nameOf = (id) => known.get(id).name.toLowerCase();

  for (const n of sections) {
    // Match the compiled top-level item by source line, not by position: a
    // top-level `xN` step or `every` interrupt can shift `root.items` out of
    // step with `workout.body`, but a section always compiles to one item.
    const ri = timeline.root.items.findIndex((it) => it.line === n.line);
    if (ri < 0) continue;

    const scoped = list.filter((e) => e.path[0] === ri && !e.unattributed);
    const seen = new Set();
    const primary = [];
    const secondary = [];
    for (const e of scoped) for (const id of e.primary)
      if (known.has(id) && !seen.has(id)) { seen.add(id); primary.push(id); }
    for (const e of scoped) for (const id of e.secondary)
      if (known.has(id) && !seen.has(id)) { seen.add(id); secondary.push(id); }

    let parts = [...primary.map(nameOf), ...secondary.map((id) => `${nameOf(id)} (light)`)];
    const over = parts.length > ADDS_CAP;
    if (over) parts = parts.slice(0, ADDS_CAP);
    const body = parts.length ? parts.join(', ') + (over ? ', …' : '') : '—';

    const label = (lines[n.line - 1] ?? '').trim().replace(/:.*/s, '') || n.name || 'section';
    const row = document.createElement('div');
    row.className = 'adds-line';
    const strong = document.createElement('span');
    strong.className = 'adds-label';
    strong.textContent = label;
    row.append(strong, document.createTextNode(` adds: ${body}`));
    box.append(row);
  }
}

const hoverBody = (attribution) => { hoverMovement = attribution; renderBody(); };
const unhoverBody = () => { hoverMovement = null; renderBody(); };

el('body-mode').addEventListener('change', renderBody);

// --- the editor tabs -------------------------------------------------------
// Outline and Text are two views of the same `lines`; only one shows at a
// time. `render()` keeps painting both — a switch just reveals one — so this
// is show/hide and nothing else. Default to Outline: the builder's pitch is
// that it is a GUI, not a text editor. Remembered like the body-map mode and
// the goals, so a reload keeps the mode. The `#dirty` "edited" badge lives on
// the Text tab, so it stays visible from the Outline tab when hand edits have
// drifted the text from canonical.
function setEditorView(view) {
  if (view !== 'text') view = 'outline';
  for (const b of document.querySelectorAll('.editor-tab'))
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  el('view-outline').classList.toggle('active', view === 'outline');
  el('view-text').classList.toggle('active', view === 'text');
  localStorage.setItem('wdl.editor-tab', view);
}
for (const b of document.querySelectorAll('.editor-tab'))
  b.addEventListener('click', () => setEditorView(b.dataset.view));
setEditorView(localStorage.getItem('wdl.editor-tab'));

// --- the margin tabs -----------------------------------------------------
// Analysis / Reads as, the two panels of the right column. Same show/hide
// nothing-else pattern as the editor tabs; the panels are always in the DOM
// (the body map's `attachZoom` mounts `#bodymap` at load and expects it to
// stay there). Remembered like the editor tab; default Analysis.
function setAnalysisTab(view) {
  if (view !== 'reads') view = 'analysis';
  for (const b of document.querySelectorAll('.right-tab'))
    b.setAttribute('aria-selected', String(b.dataset.rview === view));
  el('view-analysis').classList.toggle('active', view === 'analysis');
  el('view-reads').classList.toggle('active', view === 'reads');
  localStorage.setItem('wdl.analysis-tab', view);
}
for (const b of document.querySelectorAll('.right-tab'))
  b.addEventListener('click', () => setAnalysisTab(b.dataset.rview));
setAnalysisTab(localStorage.getItem('wdl.analysis-tab'));

// --- the movement drawer -----------------------------------------------------
// The palette is an overlay drawer behind the header's `☰` toggle at every
// width (R7 replaces it with the ⌘K / add-row modal). Open state persists so a
// reload keeps it, like the editor tab.
function setDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  el('palette-toggle').setAttribute('aria-expanded', String(open));
  el('drawer-backdrop').hidden = !open;
  try { localStorage.setItem('wdl.palette-open', open ? '1' : '0'); } catch { /* private mode */ }
}
el('palette-toggle').onclick = () => setDrawer(!document.body.classList.contains('drawer-open'));
el('drawer-close').onclick = () => setDrawer(false);
el('drawer-backdrop').onclick = () => setDrawer(false);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('drawer-open') && !composing) setDrawer(false);
});
{
  let open = false;
  try { open = localStorage.getItem('wdl.palette-open') === '1'; } catch { /* private mode */ }
  setDrawer(open);
}

// --- wiring ------------------------------------------------------------------

el('text').addEventListener('input', () => {
  lines = el('text').value.replace(/\n$/, '').split('\n');
  focused = null;
  renderOutline();
  renderReading();
  renderReadsAs();
  renderFindings();
  renderBody();
  el('board').href = `../display/#${encodeURIComponent(text())}`;
});

// Canonicalising is deliberately a button. Reformatting as a side effect of an
// edit moves the caret and rewrites lines you did not touch, which is how a
// builder earns a reputation for fighting you.
el('canon').onclick = () => {
  const { workout } = parse(text());
  lines = format(workout).replace(/\n$/, '').split('\n');
  render();
};

el('download').onclick = () => {
  const { workout } = parse(text());
  const name = (workout.title ?? 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name || 'workout'}.wdl`;
  a.click();
  URL.revokeObjectURL(url);
};

el('open').onclick = () => el('file').click();
el('file').addEventListener('change', async () => {
  const file = el('file').files?.[0];
  if (!file) return;
  lines = (await file.text()).replace(/\n$/, '').split('\n');
  detachServerWorkout();
  render();
});

for (const b of document.querySelectorAll('[data-add]')) {
  b.onclick = () => insert(focused, {
    step: '- 10 Movement',
    rest: 'rest 60s',
    block: '5 rounds:',
    comment: '// ',
  }[b.dataset.add]);
}

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  lines = (await file.text()).replace(/\n$/, '').split('\n');
  detachServerWorkout();
  render();
});



// --- the palette -------------------------------------------------------------

/**
 * Movements you can click or drag in.
 *
 * Drawn from the core set rather than all three thousand: the long tail is
 * machine variants and rehab work nobody writes into a workout, and a palette
 * you have to fight is not a palette. Search reaches the whole registry.
 *
 * A "set" is a named list of movement ids — `{name: [ids]}` in `localStorage`,
 * which stays the live store: a repertoire is a working preference, not
 * something a workout depends on, so it does not want a place in the repository.
 * A set can be composed by hand (drag a movement onto it, or "compose" it from
 * the palette), reordered, renamed, dropped whole into the outline, and — so it
 * can move between machines or outlive a cleared browser — exported to and
 * imported from a plain JSON file. The file is a carrier for the same shape,
 * not a format a workout is ever written in.
 */
let catalogue = [];
let vocabulary = [];
let sets = JSON.parse(localStorage.getItem('wdl.sets') || '{}');
const saveSets = () => localStorage.setItem('wdl.sets', JSON.stringify(sets));
/** The set currently being composed from the palette, if any. */
let composing = null;
/** Which set cards are expanded, so a redraw keeps them that way. */
const openSets = new Set();
/**
 * Muscles the movement must work — all of them, not any of them.
 *
 * Picking lats and biceps means "a movement that works both", which is a
 * pull-up. Or-semantics would mean "lats or biceps", which is most of the upper
 * body and no narrower than picking one. Selecting a second thing should always
 * show you less.
 */
const chosenMuscles = new Set();

/**
 * Matched against primary movers only, the same reading `level: primary` has
 * everywhere else in this project. Counting a muscle a movement merely assists
 * makes "hits the lats" true of almost anything you can hang from.
 */
const worksAll = (m) => {
  if (!chosenMuscles.size) return true;
  const primary = m.muscles?.primary ?? [];
  for (const id of chosenMuscles) if (!primary.includes(id)) return false;
  return true;
};

const matches = (m, q) => {
  if (!worksAll(m)) return false;
  // No text: the core set. A muscle filter narrows that rather than widening to
  // the whole registry — picking a filter and getting *more* than you had is a
  // thing no filter should ever do. Typing is how you reach past the core.
  if (!q) return m.core;
  // Lowercased over the whole thing, not just the tail: `.toLowerCase()` binds
  // to the literal it follows, so titles kept their capitals and searching for
  // `weighted` found nothing called `Weighted Chin-up`.
  const hay = [
    m.title, ...(m.pattern ?? []), ...(m.equipment ?? []),
    ...(m.muscles?.primary ?? []), ...(m.aliases ?? []),
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
};

function renderMuscleChips() {
  const box = el('muscle-chips');
  box.innerHTML = '';
  let region = null;
  for (const m of vocabulary) {
    if (m.region !== region) {
      region = m.region;
      const head = document.createElement('span');
      head.className = 'chip-region';
      head.textContent = region;
      box.append(head);
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = m.name;
    chip.setAttribute('aria-pressed', String(chosenMuscles.has(m.id)));
    chip.onclick = () => {
      if (chosenMuscles.has(m.id)) chosenMuscles.delete(m.id);
      else chosenMuscles.add(m.id);
      // A chosen set is a saved list of ids, so a muscle filter cannot narrow it
      // further without meaning two different things at once.
      el('set-pick').value = '';
      renderMuscleChips();
      renderPalette();
    };
    box.append(chip);
  }
  el('muscle-chosen').textContent = chosenMuscles.size
    ? `· ${[...chosenMuscles].map((id) => vocabulary.find((v) => v.id === id)?.name ?? id).join(' + ')}`
    : '';
}

/** The line a movement becomes. Distance-measured movements are not counted in reps. */
const lineFor = (m) => {
  const measures = m.measures ?? [];
  if (measures.includes('distance')) return `- 400m ${m.title}`;
  if (measures.includes('calories')) return `- 20cal ${m.title}`;
  return `- 10 ${m.title}`;
};

/** A movement id as its title, or the raw id if the catalogue has not loaded it. */
const titleOf = (id) => catalogue.find((m) => m.id === id)?.title ?? id;

function renderPalette() {
  const box = el('palette');
  const keepScroll = box.scrollTop;
  const q = el('search').value.trim();
  // While composing, the palette is a place to pick movements *into* a set, so
  // it ignores the set-pick filter and searches the whole catalogue.
  const chosen = composing ? undefined : sets[el('set-pick').value];
  const shown = chosen
    ? catalogue.filter((m) => chosen.includes(m.id))
    : catalogue.filter((m) => matches(m, q));

  const inComposed = composing ? new Set(sets[composing] ?? []) : null;

  box.innerHTML = '';
  for (const m of shown.slice(0, 300)) {
    const item = document.createElement('button');
    item.className = 'movement';
    item.type = 'button';
    item.draggable = true;
    item.dataset.id = m.id;
    item.title = [
      (m.muscles?.primary ?? []).join(', '),
      (m.equipment ?? []).join(', '),
    ].filter(Boolean).join('  ·  ');

    if (composing) {
      const held = inComposed.has(m.id);
      item.classList.toggle('in-set', held);
      item.setAttribute('aria-pressed', String(held));
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.textContent = held ? '✓' : '+';
      item.append(tick);
    }

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.title;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = (m.muscles?.primary ?? []).slice(0, 3).join(' ');
    item.append(name, meta);

    // Composing: a click toggles the movement in the set being built. Otherwise
    // a click adds it where you were last working, which is what "add this"
    // means when the caret is somewhere. Dragging always says where explicitly.
    item.onclick = composing
      ? () => {
          const cur = sets[composing] ?? [];
          sets[composing] = cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id];
          setsChanged();
        }
      : () => insert(focused, lineFor(m));
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/wdl-movement', lineFor(m));
      e.dataTransfer.setData('text/wdl-movement-id', m.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    item.addEventListener('mouseenter', () =>
      hoverBody({ primary: m.muscles?.primary ?? [], secondary: m.muscles?.secondary ?? [] }));
    item.addEventListener('mouseleave', unhoverBody);
    box.append(item);
  }
  const scope = chosen ? 'in this set' : el('search').value.trim() ? 'of all movements' : 'of the core set';
  el('palette-count').textContent = shown.length > 300
    ? `${shown.length} ${scope}, showing 300`
    : `${shown.length} ${scope}`;

  const hint = el('compose-hint');
  hint.hidden = !composing;
  if (composing) {
    hint.textContent = `Composing “${composing}” — click a movement to add or remove it. Esc when done.`;
  }
  box.scrollTop = keepScroll;
}

/** The set-pick filter dropdown: choose a set to show only its movements. */
function renderSets() {
  const pick = el('set-pick');
  const was = pick.value;
  pick.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'All movements';
  pick.append(none);
  for (const name of Object.keys(sets).sort()) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    pick.append(o);
  }
  pick.value = sets[was] ? was : '';
}

/** Everything a set change touches: persist, then redraw the three views of it. */
function setsChanged() {
  saveSets();
  renderSets();
  renderSetList();
  renderPalette();
}

/** The repertoire: one editable card per set. */
function renderSetList() {
  const box = el('set-list');
  box.innerHTML = '';
  const names = Object.keys(sets).sort();
  el('repertoire-count').textContent = names.length ? `· ${names.length}` : '';
  if (!names.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No sets yet. “New set”, or search then “Save showing”.';
    box.append(p);
    return;
  }
  for (const name of names) box.append(renderSetCard(name));
}

function renderSetCard(name) {
  const ids = sets[name] ?? [];
  const card = document.createElement('details');
  card.className = 'set-card';
  card.dataset.name = name;
  card.open = openSets.has(name) || composing === name;
  card.addEventListener('toggle', () => {
    if (card.open) openSets.add(name); else openSets.delete(name);
  });

  const summary = document.createElement('summary');
  const label = document.createElement('span');
  label.className = 'set-name';
  label.textContent = name;
  const count = document.createElement('span');
  count.className = 'set-n';
  count.textContent = ids.length;
  const actions = document.createElement('span');
  actions.className = 'set-actions';

  const act = (glyph, title, fn, pressed) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = glyph;
    b.title = title;
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    actions.append(b);
    return b;
  };

  act('+', composing === name ? 'Stop composing' : 'Compose — click palette movements to add or remove them',
    () => {
      composing = composing === name ? null : name;
      if (composing) { el('set-pick').value = ''; openSets.add(name); }
      renderSetList();
      renderPalette();
    }, composing === name);
  act('↧', 'Add every movement in this set to the outline', () => addSetToOutline(name));
  act('✎', 'Rename this set', () => renameSet(name));
  act('✕', 'Delete this set', () => {
    if (!confirm(`Delete the set “${name}”?`)) return;
    delete sets[name];
    openSets.delete(name);
    if (composing === name) composing = null;
    if (el('set-pick').value === name) el('set-pick').value = '';
    setsChanged();
  });

  summary.append(label, count, actions);
  card.append(summary);

  const list = document.createElement('ol');
  list.className = 'set-movements';
  if (!ids.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Empty — drag a movement here, or use Compose.';
    list.append(li);
  }
  ids.forEach((id, i) => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.textContent = titleOf(id);
    const up = document.createElement('button');
    up.type = 'button'; up.textContent = '↑'; up.title = 'Move up'; up.disabled = i === 0;
    up.onclick = () => { const a = sets[name]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setsChanged(); };
    const down = document.createElement('button');
    down.type = 'button'; down.textContent = '↓'; down.title = 'Move down'; down.disabled = i === ids.length - 1;
    down.onclick = () => { const a = sets[name]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setsChanged(); };
    const rm = document.createElement('button');
    rm.type = 'button'; rm.textContent = '✕'; rm.title = 'Remove from this set';
    rm.onclick = () => { sets[name] = sets[name].filter((x) => x !== id); setsChanged(); };
    li.append(nm, up, down, rm);
    list.append(li);
  });
  card.append(list);

  // A movement dragged from the palette lands in the set.
  card.addEventListener('dragover', (e) => {
    if (![...(e.dataTransfer?.types ?? [])].includes('text/wdl-movement-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    card.dataset.drop = '';
  });
  card.addEventListener('dragleave', () => delete card.dataset.drop);
  card.addEventListener('drop', (e) => {
    delete card.dataset.drop;
    const id = e.dataTransfer.getData('text/wdl-movement-id');
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const cur = sets[name] ?? [];
    if (!cur.includes(id)) { sets[name] = [...cur, id]; openSets.add(name); setsChanged(); }
  });

  return card;
}

function renameSet(name) {
  const next = (prompt('Rename set', name) ?? '').trim();
  if (!next || next === name) return;
  if (sets[next] && !confirm(`Replace the existing set “${next}”?`)) return;
  sets[next] = sets[name];
  delete sets[name];
  if (openSets.delete(name)) openSets.add(next);
  if (composing === name) composing = next;
  if (el('set-pick').value === name) el('set-pick').value = next;
  setsChanged();
}

/** Drop every movement in a set into the outline as its own line, in order. */
function addSetToOutline(name) {
  const movs = (sets[name] ?? []).map((id) => catalogue.find((m) => m.id === id)).filter(Boolean);
  if (!movs.length) return;
  const after = focused ?? undefined;
  const self = after !== undefined ? spans(lines).get(after) : undefined;
  const at = self ? self.contentEnd : lines.length;
  const indent = after !== undefined ? ' '.repeat(indentOf(after)) : '  ';
  const block = movs.map((m) => indent + lineFor(m));
  apply([...lines.slice(0, at), ...block, ...lines.slice(at)], at + 1);
}

el('search').addEventListener('input', () => { el('set-pick').value = ''; renderPalette(); });
el('set-pick').addEventListener('change', renderPalette);
el('muscle-clear').onclick = () => {
  chosenMuscles.clear();
  renderMuscleChips();
  renderPalette();
};

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && composing) {
    composing = null;
    renderSetList();
    renderPalette();
  }
});

el('set-new').onclick = () => {
  const name = (prompt('Name the new set', 'My set') ?? '').trim();
  if (!name) return;
  if (sets[name] && !confirm(`Replace the existing set “${name}”?`)) return;
  sets[name] = sets[name] ?? [];
  el('repertoire').open = true;
  openSets.add(name);
  composing = name;
  el('set-pick').value = '';
  setsChanged();
};

el('set-save').onclick = () => {
  const q = el('search').value.trim();
  const name = (prompt('Name this set', q || 'My set') ?? '').trim();
  if (!name) return;
  if (sets[name] && !confirm(`Replace the existing set “${name}”?`)) return;
  sets[name] = catalogue.filter((m) => matches(m, q)).map((m) => m.id);
  el('repertoire').open = true;
  openSets.add(name);
  setsChanged();
};

el('set-export').onclick = () => {
  const payload = JSON.stringify({ format: 'wdl-movement-sets', version: 1, sets }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'movement-sets.json';
  a.click();
  URL.revokeObjectURL(url);
};

el('set-import').onclick = () => el('set-file').click();
el('set-file').addEventListener('change', async () => {
  const file = el('set-file').files?.[0];
  el('set-file').value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('That file is not valid JSON.');
    return;
  }
  // Accept either the exported envelope or a bare {name: [ids]} object.
  const incoming = data && typeof data === 'object' && !Array.isArray(data)
    ? (data.sets && typeof data.sets === 'object' && !Array.isArray(data.sets) ? data.sets : data)
    : null;
  if (!incoming) {
    alert('No movement sets found in that file.');
    return;
  }
  // Merge: a name in the file overwrites the local set, new names are added,
  // and local sets the file does not mention are left alone.
  let added = 0, replaced = 0, skipped = 0;
  for (const [name, ids] of Object.entries(incoming)) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) { skipped++; continue; }
    if (name in sets) replaced++; else added++;
    sets[name] = [...new Set(ids)];
  }
  el('repertoire').open = true;
  setsChanged();
  alert(`Imported ${added} new, replaced ${replaced}${skipped ? `, skipped ${skipped} malformed` : ''}. `
    + `${Object.keys(sets).length} sets now; any not in the file were kept.`);
});

// --- goals -------------------------------------------------------------------

/**
 * The workout measured against what it is for.
 *
 * The rules live in a goals file, checked by the same code the CLI runs, so the
 * builder has no opinion of its own about what a good workout is. It only asks
 * the question continuously instead of when you remember to.
 */
/**
 * The rules the workout is measured against — yours, not only the examples.
 *
 * The examples ship with the repository; anything you write lives in
 * `localStorage` next to the palette sets, for the same reason: a set of rules
 * you are still shaping is a working document, and making it a file in the
 * repository before it settles means committing drafts.
 *
 * `Download` writes it out as a `.wdlg` when it does settle, and that file is
 * the same one `wdl goals --goals` reads. Nothing here is a private format.
 */
let goals = null;
let goalSource = '';
let savedGoals = JSON.parse(localStorage.getItem('wdl.goals') || '{}');

const EXAMPLE = 'example:';
const SAVED = 'saved:';

function renderGoalPicker(select) {
  const pick = el('goal-pick');
  const was = select ?? pick.value;
  pick.innerHTML = '';
  const add = (value, label, into) => {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    (into ?? pick).append(o);
  };
  add('', 'no goals');
  const examples = document.createElement('optgroup');
  examples.label = 'Examples';
  for (const name of GOALS) add(EXAMPLE + name, name.replace(/\.wdlg$/, '').replace(/-/g, ' '), examples);
  pick.append(examples);
  const mine = Object.keys(savedGoals).sort();
  if (mine.length) {
    const group = document.createElement('optgroup');
    group.label = 'Yours';
    for (const name of mine) add(SAVED + name, name, group);
    pick.append(group);
  }
  add('custom', 'unsaved rules');
  pick.value = [...pick.options].some((o) => o.value === was) ? was : '';
  el('goal-drop').hidden = !pick.value.startsWith(SAVED);
}

/** Parse whatever is in the editor and report both halves: the rules, and the workout. */
function readGoals() {
  const errors = el('goal-errors');
  errors.innerHTML = '';
  if (!goalSource.trim()) { goals = null; return renderFindings(); }
  const parsed = parseGoals(goalSource);
  for (const e of parsed.errors) {
    const li = document.createElement('li');
    const where = document.createElement('span');
    where.className = 'where';
    where.textContent = e.line ? `${e.line}  ` : '';
    const body = document.createElement('span');
    body.className = 'error';
    body.textContent = e.message;
    li.append(where, body);
    errors.append(li);
  }
  // Rules that did parse still apply. Refusing to check anything because one
  // line is wrong hides the answer to a question you already asked correctly.
  goals = parsed;
  renderFindings();
}

function setGoalSource(text) {
  goalSource = text;
  el('goal-text').value = text;
  readGoals();
}

/**
 * What the rules made of the workout.
 *
 * A caveat is not a finding. "The amounts are floors" is true of every AMRAP
 * ever written and says how to *read* the findings; "quads: 2 movements, at
 * most 1" says the workout breaks a rule you set. Listed together in the same
 * colour, the first reads as a fifth complaint about a workout that has one.
 * So they are separated: notes above, in the margin's voice, and the list holds
 * only things that are actually wrong.
 */
function renderFindings() {
  const list = el('findings');
  const notes = el('goal-notes');
  list.innerHTML = '';
  notes.replaceChildren();
  notes.hidden = true;

  // One per line. Concatenated into a paragraph they ran together into a single
  // sentence about two unrelated things — "…no fixed rep count. No muscle data
  // for bike or rower or skierg, tiebreak: time + rounds, so no rule can see
  // them." — which reads as one long complaint rather than two short facts.
  const note = (message) => {
    const div = document.createElement('div');
    div.textContent = message;
    notes.append(div);
    notes.hidden = false;
  };
  const say = (severity, message) => {
    const li = document.createElement('li');
    const body = document.createElement('span');
    body.className = severity;
    body.textContent = message;
    li.append(body);
    list.append(li);
  };

  if (!goals || !goals.rules.length) return note('No rules to check against.');
  if (!has('canonicalMovements') || !has('muscles')) {
    return say('warning', 'no muscle data loaded — nothing can be checked');
  }
  let report;
  try {
    report = check(compile(parse(text()).workout), goals);
  } catch (e) {
    return say('error', `cannot check: ${e.message}`);
  }

  // Both of these change what the numbers mean, so they are said before them.
  if (report.unbounded) {
    note('Open-ended, so the amounts are floors — an AMRAP has no fixed rep count.');
  }
  for (const name of report.unresolved) {
    note(`No muscle data for “${name}” — no rule can see it.`);
  }

  if (!report.findings.length) return say('ok', 'every rule satisfied');
  for (const f of report.findings) {
    say('error', `${f.rule}: ${f.message}${f.count > 1 ? `  (×${f.count})` : ''}`);
  }
}

el('goal-pick').addEventListener('change', async () => {
  const value = el('goal-pick').value;
  el('goal-drop').hidden = !value.startsWith(SAVED);
  if (!value || value === 'custom') return setGoalSource(value === 'custom' ? goalSource : '');
  if (value.startsWith(SAVED)) return setGoalSource(savedGoals[value.slice(SAVED.length)] ?? '');
  try {
    const r = await fetch(new URL(`../../examples/goals/${value.slice(EXAMPLE.length)}`, location.href));
    setGoalSource(await r.text());
  } catch (e) {
    console.warn('no goals:', e.message);
    setGoalSource('');
  }
});

el('goal-edit').onclick = () => {
  const box = el('goal-text');
  box.hidden = !box.hidden;
  el('goal-edit').textContent = box.hidden ? 'Edit rules' : 'Hide rules';
  if (!box.hidden) box.focus();
};

// Editing detaches from whatever it was loaded from: what is in the box is what
// is being checked, and leaving the picker on `rotate muscles` while the rules
// say something else would be a lie about which is which.
el('goal-text').addEventListener('input', () => {
  goalSource = el('goal-text').value;
  const pick = el('goal-pick');
  if (pick.value !== 'custom') { pick.value = 'custom'; el('goal-drop').hidden = true; }
  readGoals();
});

el('goal-open').onclick = () => el('goal-file').click();
el('goal-file').addEventListener('change', async () => {
  const file = el('goal-file').files?.[0];
  if (!file) return;
  el('goal-text').hidden = false;
  el('goal-edit').textContent = 'Hide rules';
  setGoalSource(await file.text());
  el('goal-pick').value = 'custom';
  el('goal-drop').hidden = true;
});

el('goal-save').onclick = () => {
  if (!goalSource.trim()) return;
  const name = prompt('Name these rules', el('goal-pick').value.replace(/^saved:/, '') || 'My goals');
  if (!name) return;
  savedGoals[name] = goalSource;
  localStorage.setItem('wdl.goals', JSON.stringify(savedGoals));
  renderGoalPicker(SAVED + name);
};

// The file this writes is the one `wdl goals --goals` reads. Rules drafted here
// are not in a private format; they are the same artifact, earlier.
el('goal-download').onclick = () => {
  if (!goalSource.trim()) return;
  const chosen = el('goal-pick').value;
  const base = chosen.startsWith(SAVED) ? chosen.slice(SAVED.length)
    : chosen.startsWith(EXAMPLE) ? chosen.slice(EXAMPLE.length).replace(/\.wdlg$/, '')
    : (parseGoals(goalSource).title ?? 'goals');
  const name = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'goals';
  const url = URL.createObjectURL(new Blob([goalSource], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.wdlg`;
  a.click();
  URL.revokeObjectURL(url);
};

el('goal-drop').onclick = () => {
  const name = el('goal-pick').value.slice(SAVED.length);
  if (!name || !confirm(`Delete the rules "${name}"?`)) return;
  delete savedGoals[name];
  localStorage.setItem('wdl.goals', JSON.stringify(savedGoals));
  renderGoalPicker('');
  setGoalSource('');
};

// --- accounts: sign in, My workouts, sharing --------------------------------
//
// Additive on top of everything above. Signed out, the builder is exactly what
// it was — Download .wdl / Open… a local file still the only persistence, and
// none of this shown. Signed in (Google, via PocketBase — DEC-016), the current
// buffer can be saved to an account, listed, reopened, renamed, deleted, and
// given a share link. `packages/core` never hears about any of it: a stored
// workout is just its `.wdl` text in a column.

/**
 * The server workout the buffer is currently attached to, or `null` for a
 * local/new buffer. Set by opening one from the list or by the first Save;
 * cleared by Open… a local file, a file drop, or Sign out. Editing the buffer
 * keeps the attachment, so Save updates the same record rather than forking.
 */
let openWorkout = null;
/** The signed-in user's workouts, newest edit first. Refreshed after each write. */
let mineList = [];
/** A one-line status shown in the panel — the outcome of the last action. */
let mineNote = '';

const detachServerWorkout = () => { openWorkout = null; renderMinePanel(); };

/** The `#` title the parser reads off the current buffer, if any. */
const currentTitle = () => parse(text()).workout.title ?? '';

const flashMine = (message) => { mineNote = message; renderMinePanel(); };

/** `updated` as a coarse "when" — PocketBase autodate is `YYYY-MM-DD HH:MM:SS.sssZ`. */
function relTime(s) {
  if (!s) return '';
  const then = new Date(s.replace(' ', 'T'));
  const secs = (Date.now() - then.getTime()) / 1000;
  if (!Number.isFinite(secs)) return '';
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return then.toLocaleDateString();
}

async function startSignIn() {
  try {
    // The redirect leaves and re-enters the page; keep the buffer across it.
    localStorage.setItem('wdl.pb-draft', text());
    await beginGoogleSignIn(location.href);
  } catch (e) {
    localStorage.removeItem('wdl.pb-draft');
    flashMine(`Sign-in could not start: ${e.message}`);
    alert(`Sign-in could not start: ${e.message}`);
  }
}

function renderIdentity() {
  const box = el('identity');
  box.innerHTML = '';
  const user = currentUser();
  if (!user) {
    el('mine').hidden = true;
    el('mine').open = false;
    const b = document.createElement('button');
    b.id = 'signin';
    b.textContent = 'Sign in with Google';
    b.onclick = startSignIn;
    box.append(b);
    return;
  }
  el('mine').hidden = false;
  if (user.avatarUrl) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = user.avatarUrl;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    box.append(img);
  }
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = user.name || user.email || 'Signed in';
  const out = document.createElement('button');
  out.textContent = 'Sign out';
  out.onclick = () => {
    signOut();
    openWorkout = null;
    mineList = [];
    mineNote = '';
    renderIdentity();
    renderMinePanel();
  };
  box.append(who, out);
}

async function refreshMineList() {
  try {
    mineList = await listMine();
  } catch (e) {
    mineList = [];
    mineNote = `Could not load your workouts: ${e.message}`;
  }
}

function hintP(text) {
  const p = document.createElement('p');
  p.className = 'menu-hint';
  p.textContent = text;
  return p;
}

function iconBtn(glyph, title, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'menu-icon';
  b.textContent = glyph;
  b.title = title;
  b.onclick = fn;
  return b;
}

function renderMinePanel() {
  const panel = el('mine-panel');
  if (!panel) return;
  panel.innerHTML = '';

  if (!currentUser()) {
    panel.append(hintP('Sign in to save workouts to your account.'));
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'menu-row';
  const save = document.createElement('button');
  save.textContent = openWorkout ? 'Save' : 'Save to my workouts';
  save.onclick = saveWorkout;
  actions.append(save);
  if (openWorkout) {
    const copy = document.createElement('button');
    copy.textContent = 'Save as copy';
    copy.onclick = saveAsCopy;
    actions.append(copy);
  }
  panel.append(actions);

  if (mineNote) panel.append(hintP(mineNote));
  if (openWorkout) panel.append(renderShareRow());

  const list = document.createElement('div');
  list.className = 'mine-list';
  if (!mineList.length) {
    list.append(hintP('No saved workouts yet.'));
  } else {
    for (const w of mineList) list.append(renderMineRow(w));
  }
  panel.append(list);
}

function renderShareRow() {
  const row = document.createElement('div');
  row.className = 'menu-row share-row';

  const label = document.createElement('span');
  label.className = 'share-label';
  label.textContent = 'Sharing';

  const sel = document.createElement('select');
  for (const v of ['private', 'unlisted', 'public']) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.append(o);
  }
  sel.value = openWorkout.visibility || 'private';
  sel.onchange = async () => {
    const want = sel.value;
    try {
      const rec = await pbUpdate(openWorkout.id, { visibility: want });
      openWorkout.visibility = rec.visibility;
      await refreshMineList();
      flashMine(want === 'private'
        ? 'Now private — the link resolves only for you.'
        : want === 'unlisted'
          ? 'Now unlisted — anyone with the link can open it.'
          : 'Now public.');
    } catch (e) {
      sel.value = openWorkout.visibility || 'private';
      flashMine(`Could not change sharing: ${e.message}`);
    }
  };

  const copy = document.createElement('button');
  copy.textContent = 'Copy link';
  copy.onclick = async () => {
    const url = shareUrl(openWorkout.id);
    try {
      await navigator.clipboard.writeText(url);
      flashMine('Link copied to the clipboard.');
    } catch {
      flashMine(url);
    }
  };

  row.append(label, sel, copy);
  return row;
}

function renderMineRow(w) {
  const row = document.createElement('div');
  row.className = 'mine-row';
  if (openWorkout?.id === w.id) row.classList.add('current');

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'mine-open';
  const title = document.createElement('span');
  title.className = 'mine-title';
  title.textContent = w.title || 'Untitled workout';
  const when = document.createElement('span');
  when.className = 'mine-when';
  when.textContent = relTime(w.updated);
  open.append(title, when);
  open.onclick = () => openMine(w);

  row.append(open, iconBtn('✎', 'Rename', () => renameMine(w)), iconBtn('✕', 'Delete', () => deleteMine(w)));
  return row;
}

async function saveWorkout() {
  if (!currentUser()) return;
  const title = currentTitle() || openWorkout?.title || 'Untitled workout';
  try {
    const rec = openWorkout
      ? await pbUpdate(openWorkout.id, { source: text(), title })
      : await pbCreate({ title, source: text() });
    openWorkout = { id: rec.id, title: rec.title, visibility: rec.visibility };
    await refreshMineList();
    flashMine('Saved.');
  } catch (e) {
    flashMine(`Could not save: ${e.message}`);
  }
}

async function saveAsCopy() {
  if (!currentUser()) return;
  const base = currentTitle() || openWorkout?.title || 'Untitled workout';
  try {
    const rec = await pbCreate({ title: `${base} (copy)`, source: text() });
    openWorkout = { id: rec.id, title: rec.title, visibility: rec.visibility };
    await refreshMineList();
    flashMine('Saved as a new copy.');
  } catch (e) {
    flashMine(`Could not save a copy: ${e.message}`);
  }
}

async function openMine(w) {
  try {
    const rec = await pbGetById(w.id);
    lines = (rec.source || '').replace(/\n$/, '').split('\n');
    if (!lines.length) lines = [''];
    openWorkout = { id: rec.id, title: rec.title, visibility: rec.visibility };
    mineNote = '';
    focused = null;
    el('mine').open = false;
    render();
    renderMinePanel();
  } catch (e) {
    flashMine(`Could not open “${w.title || 'Untitled workout'}”: ${e.message}`);
  }
}

async function renameMine(w) {
  const next = (prompt('Rename workout', w.title || '') ?? '').trim();
  if (!next || next === w.title) return;
  try {
    const rec = await pbUpdate(w.id, { title: next });
    if (openWorkout?.id === w.id) openWorkout.title = rec.title;
    await refreshMineList();
    flashMine('Renamed.');
  } catch (e) {
    flashMine(`Could not rename: ${e.message}`);
  }
}

async function deleteMine(w) {
  if (!confirm(`Delete “${w.title || 'Untitled workout'}”? This cannot be undone.`)) return;
  try {
    await pbRemove(w.id);
    if (openWorkout?.id === w.id) openWorkout = null;
    await refreshMineList();
    flashMine('Deleted.');
  } catch (e) {
    flashMine(`Could not delete: ${e.message}`);
  }
}

// --- bootstrap ---------------------------------------------------------------
// Last, because everything above declares what it needs and this hands it over.

// The core is handed its data; it reads no files itself. Each of these makes a
// different part of the app work, and each is loaded separately so that missing
// one degrades that part rather than taking the builder down with it.
const load = (url) => fetch(new URL(url, location.href))
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`))));

// The curated registry: autocomplete, and the name checks in `validate`.
const curated = load(REGISTRY)
  .then((data) => {
    provide({ movements: () => data.movements });
    curatedMovements = data.movements;
  })
  .catch((e) => console.warn('no movement registry:', e.message));

// The merged corpus: the palette, and everything the goal rules read. Larger,
// and wanted a moment later, so it does not hold up the first render.
const analysis = Promise.all([load(CANONICAL), load(MUSCLES)])
  .then(([movements, muscles]) => {
    provide({ canonicalMovements: () => movements.movements, muscles: () => muscles.muscles });
    catalogue = movements.movements;
    vocabulary = muscles.muscles;
    renderMuscleChips();
    renderPalette();
    renderSetList();
    renderFindings();
    renderBody();
  })
  .catch((e) => {
    console.warn('no analysis data:', e.message);
    el('palette-count').textContent = 'movement data unavailable';
  });

renderGoalPicker(EXAMPLE + GOALS[0]);
renderSets();
renderSetList();
curated.finally(render);
analysis.then(() => el('goal-pick').dispatchEvent(new Event('change')));

// Accounts: paint the signed-out state immediately (a stored token, if any, is
// still unverified), then revalidate it against the server and, if it holds,
// pull the workout list.
renderIdentity();
renderMinePanel();
refreshAuth().then((user) => {
  renderIdentity();
  if (user) refreshMineList().then(renderMinePanel);
});
