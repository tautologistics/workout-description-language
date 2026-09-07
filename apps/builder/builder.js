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
import { foldTokens, depluralize, TOKEN_EXPANSIONS } from '../../build/web/core/fold.js';
import { parseGoals, check } from '../../build/web/core/goals.js';
import { exposures, muscleLoad, musclesFor, muscles } from '../../build/web/core/muscles.js';
import { mountBody, paintBody, aggregateStates, highlightStates, heatStates, heatColor, attachZoom } from '../shared/body-map.js';
import {
  currentUser, beginGoogleSignIn, refreshAuth, signOut, updateHandle,
  listMine, getById as pbGetById, getByAnyId, create as pbCreate, update as pbUpdate,
  remove as pbRemove, shareUrl, searchWorkouts, getHandle,
  listMovements, createMovement, updateMovement, getMovementByMovementId, removeMovement,
  createEquipmentTerm, createPatternTerm,
} from '../shared/pocketbase.js';
import { createMovementEditor, movementRecordToEntry, movementEntryToRecord } from '../shared/movement-editor.js';
import { equipmentVocab, patternVocab } from '../shared/vocab.js';
import * as sets from '../shared/sets.js';
import * as goalsStore from '../shared/goals-store.js';

const GRAMMAR = '../../spec/grammar-0.1.ohm';
const REGISTRY = '../../registry/movements.json';
const CANONICAL = '../../registry/movements.canonical.json';
const MUSCLES = '../../registry/muscles.json';
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

// --- Text tab: the syntax-highlight layer ----------------------------------
// A transparent `#text` <textarea> rides over `#text-hl`, a <pre> holding the
// same text re-tokenised per keystroke. One colour per line kind, from the
// shared `--kind-*` palette (R3) so the Outline rails and the raw text read as
// one language. Purely lexical — the layer repaints on every `input` and cannot
// wait for a parse — but it mirrors `renderOutline`'s `data-kind` vocabulary.

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

const SECTION_LINE = /^(?:warm-?up|strength|skill|conditioning|accessory|cool-?down)\s*:$/i;

/** The kind of a raw source line, '' for blank. Matches the Outline's markers:
 *  title (`#`) / directive (`@`) only at zero indent (they are preamble), then
 *  comment (`//`), rest (`rest …`), a recognised `section:` word, any other
 *  colon-terminated `header:`, and everything else a `step`. */
function textLineKind(raw) {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('//')) return 'comment';
  if (!/^\s/.test(raw)) {
    if (t.startsWith('#')) return 'title';
    if (t.startsWith('@')) return 'directive';
  }
  if (/^rest(?:\s|$)/i.test(t)) return 'rest';
  if (t.endsWith(':')) return SECTION_LINE.test(t) ? 'section' : 'header';
  return 'step';
}

/** Repaint the highlight layer from the textarea's current value and re-sync
 *  its scroll. Cheap (O(text), full re-render) — the document is small. */
function paintTextHl() {
  const ta = el('text');
  el('text-hl').innerHTML = ta.value.split('\n').map((line) => {
    const kind = textLineKind(line);
    return kind ? `<span class="k-${kind}">${escapeHtml(line)}</span>` : escapeHtml(line);
  }).join('\n');
  el('text-hl').scrollTop = ta.scrollTop;
  el('text-hl').scrollLeft = ta.scrollLeft;
}

/** Set the textarea value from `lines` and repaint the layer with it — the two
 *  always move together, on `render()` and on the outline-row write-back paths
 *  that redraw without a full `render()`. */
function paintText() {
  el('text').value = text();
  paintTextHl();
}

function render(focusLine) {
  if (focusLine !== undefined) focused = focusLine;
  paintText();
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

/**
 * Normalize a string for a builder-side movement *search* — a substring / prefix
 * test, not core's exact-key lookup — by reusing the core primitives so the
 * palette agrees with `Registry.resolve()` about what counts as the same name:
 *
 *   - `foldTokens()` — NFKD, lowercase, split on every non-alphanumeric run, and
 *     drop the same stopwords core drops (`and/or/the/a/of/to/with`). So
 *     `bent-over row`, `bent over row` and `bent  over row` fold together, and
 *     `clean and jerk` == `clean jerk`.
 *   - `TOKEN_EXPANSIONS` — `bb`→`barbell`, `db`→`dumbbell`, `t2b`→`toestobar`, …
 *     mapped per folded token exactly as `resolve()` layer 2 does, so a typed
 *     `bb bent over row` reaches the full-word haystack. Applied on both the
 *     query and the candidate text, so it stays symmetric — a stored `bb row`
 *     alias is also reachable by typing `barbell`.
 *   - `depluralize()` — the folded-key plural rules, so `bent over rows` folds
 *     to the same key as `bent over row`.
 *
 * Joins with nothing; the caller does `includes` / `startsWith` on the result,
 * so partial-word matching (`thrust` → `Thruster`) still works — this does not
 * become an exact match.
 */
const searchKey = (s) =>
  depluralize(foldTokens(s).tokens.map((t) => TOKEN_EXPANSIONS[t] ?? t).join(''));

/** Curated movements whose name plausibly matches what is being typed, either way. */
const movementSuggestions = (fragment) => {
  const q = searchKey(fragment);
  if (!q) return [];
  return curatedMovements
    .filter((m) => {
      const t = searchKey(m.title);
      return t.startsWith(q) || q.startsWith(t) || t.includes(q);
    })
    .slice(0, 20);
};

/**
 * The directive keys the builder recognises on a zero-indent `@` line. This is
 * a *convention*, not grammar — `directiveKey = nameChar+` accepts anything —
 * so there is nothing to enumerate and the list is hand-held, one description
 * each. `fill` is what a pick lands (caret goes to its end): `@id ` leaves the
 * caret past the space ready for the value; `@x-` leaves it right after the
 * dash to finish the extension key. `@tiebreak` is deliberately absent — it is
 * a mid-line step marker (spec §9.6), never a preamble line.
 */
const DIRECTIVE_KEYS = [
  { key: '@wdl', fill: '@wdl ', desc: 'spec version (e.g. @wdl 0.1)' },
  { key: '@id', fill: '@id ', desc: 'stable workout id, often namespace:slug' },
  { key: '@date', fill: '@date ', desc: 'when it was performed / written' },
  { key: '@tags', fill: '@tags ', desc: 'comma-separated labels' },
  { key: '@author', fill: '@author ', desc: 'who wrote it' },
  { key: '@x-', fill: '@x-', desc: 'an extension attribute (e.g. @x-gym:…)' },
];

/** Recognised directive keys matching the key fragment typed so far (the text
 *  up to the first space). `@` alone offers all of them; `@x-anything` keeps
 *  matching the `@x-` entry. */
const directiveKeySuggestions = (value) => {
  const frag = (value.split(' ', 1)[0] || '').toLowerCase();
  return DIRECTIVE_KEYS.filter(({ key }) => {
    const k = key.toLowerCase();
    return k.startsWith(frag) || frag.startsWith(k);
  });
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
 * How many characters at the start of `fragment` the movement name occupies —
 * the seam a `»`-panel modifier splices in right after. When the typed name is
 * `entryTitle` verbatim that is `entryTitle.length`; when it is a plural or
 * other inflected form of it (`Dumbbell Snatches` for entry `Dumbbell Snatch`,
 * `Deadlift's` …) the match extends through the trailing letters/apostrophe of
 * that same word, so the token lands after the whole typed word rather than
 * mid-word (`Dumbbell Snatch (each side) es`). A name that does not start with
 * the title at all (an alias like `DB Snatch`) has no reliable seam, so the
 * caller's fallback of the whole fragment stands.
 */
const titleMatchLen = (fragment, entryTitle) => {
  if (!fragment.toLowerCase().startsWith(entryTitle.toLowerCase())) return fragment.length;
  const [tail] = fragment.slice(entryTitle.length).match(/^[a-z']*/i);
  return entryTitle.length + tail.length;
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
  // `per-side` inserts the parenthesised form (`(each side)` / `(each arm)` /
  // `(each direction)`), canonical since queue item 13b (DEC-019), and names the
  // axis the count runs across from `entry.lateralityAxis` — `arm|leg|side|hand|
  // direction`, a curated field (queue item 13a-curation) with a `side` fallback
  // when the movement has not been vetted for it.
  const axis = entry.lateralityAxis ?? 'side';
  const laterality = (entry.laterality ?? []).map((mode) => ({
    text: mode === 'split' ? '(split)' : mode === 'per-side' ? `(each ${axis})` : '(both)',
    label: mode === 'split' ? 'count divided across sides'
      : mode === 'per-side' ? (entry.lateralityAxis ? `full count each ${axis}` : 'full count per side')
      : 'both sides together',
    isDefault: mode === entry.defaultLaterality,
  }));
  const measures = (entry.measures ?? []).map((mode) => ({
    text: `, count ${mode === 'calories' ? 'cal' : mode}`,
    label: mode === 'calories' ? 'measured in calories' : 'measured in distance',
  }));
  // The per-implement seed keeps the `Nx` from `entry.implements` — real
  // information (how many implements) the author would otherwise have to know to
  // type, and a bare `@ Nx` with no weight round-trips clean through parse +
  // Canonicalise + diagnostics (a bare `@ ` alone is an *unreadable step* until
  // a weight follows, so dropping the seed would read worse, not better). What
  // was cryptic mid-edit was the *reading* of `@ 2x`, not its validity — so the
  // label names the finished shape and `applyModifier` drops a transient hint by
  // the caret after the pick.
  const load = entry.load
    ? entry.load === 'per-implement' && entry.implements
      ? {
          text: `@ ${entry.implements}x`,
          label: `load, per implement (${entry.implements}) — then type the weight: @ ${entry.implements}x35lb`,
          perImplement: entry.implements,
        }
      : { text: '@ ', label: 'takes a load' }
    : null;
  // Array.isArray, not just `?? []`: registry/movements.json carried
  // `equipment` as a bare string on 669 entries until 2026-08-25 (a curated
  // seed-file inconsistency `scripts/build-movements.mjs` only normalizes on
  // the canonical merge, not here) — `?? []` lets a truthy string straight
  // through, and `.join` below then throws. See lessons-learned.md.
  const equipment = Array.isArray(entry.equipment) ? entry.equipment : [];
  return { laterality, measures, load, equipment };
};

// Laterality modes are mutually exclusive (spec §4): a title line carries at
// most one, written either parenthesised — `(both)` / `(split)` / `(per-side)` /
// `(total)` (the grammar's `lateralityWord`) or `(each <limb>)` (the grammar's
// `laterality -- perSide`; `limbWord = arm|leg|side|hand|direction`, the
// canonical per-side form since queue item 13b) — or inline as the still-read
// bare `each|per <limb>` (the grammar's `trailingQualifier -- limb`). The `»`
// panel is an editor, so applying a laterality pick *replaces* whatever is
// already there rather than appending a second, contradictory token — and
// re-picking the mode already on the line clears it (toggle off).
const LATERALITY_RE = /\s*(?:\((?:both|split|per-side|total)\)|\((?:each|per)\s+(?:arm|leg|side|hand|direction)\)|\b(?:each|per)\s+(?:arm|leg|side|hand|direction)\b)/i;
// The measured-output comma modifier (`, count cal` / `, count distance`, and
// the `calories` / `reps` spellings): `s.measures` holds exactly one value, so
// a pick replaces any existing one the same way.
const MEASURE_RE = /\s*,\s*count\s+(?:cal|calories|distance|reps)\b/i;

/** The mutually-exclusive mode a laterality token (or a panel addition) denotes,
 *  so a re-pick of the same mode toggles off. Every `each|per <limb>` form,
 *  the parenthesised `(each <limb>)` form and the `(per-side)` spelling fold to
 *  `per-side`. */
const lateralityMode = (token) => {
  const m = token.trim().toLowerCase().match(/^\((both|split|total)\)$/);
  return m ? m[1] : 'per-side';
};
/** The measured-output mode a `, count <word>` token (or addition) denotes;
 *  `calories` and `cal` are the same mode. */
const measureMode = (token) =>
  token.trim().toLowerCase().replace(/^,\s*count\s+/, '').replace(/^calories$/, 'cal');

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
      paintText();
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

      // A transient one-liner under the input after a per-implement load pick,
      // where the seeded `@ Nx` reads as cryptic until the weight is typed (it
      // says how many implements, not a rep count). Cleared on the next
      // keystroke, on blur, and on a row re-render. Declared up here because the
      // `input` listeners below reference `clearModHint` at bind time.
      let modHint = null;
      const clearModHint = () => { modHint?.remove(); modHint = null; };
      const showModHint = (msg) => {
        clearModHint();
        modHint = document.createElement('div');
        modHint.className = 'mod-hint';
        modHint.textContent = msg;
        wrap.append(modHint);
      };

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
        paintText();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        const at = prefixLen + m.title.length;
        input.focus();
        input.setSelectionRange(at, at);
      };

      // A zero-indent `@` row with the caret still in the key (before the first
      // space) gets the directive-key list instead of movement names — a `@ 40kg`
      // load fragment is never at zero indent, but the indent is checked off the
      // raw source line anyway, not just `depth`.
      const inDirectiveKey = () => {
        if (depth !== 0 || /^\s/.test(lines[n.line - 1] ?? '')) return false;
        const v = input.value;
        if (!v.startsWith('@')) return false;
        const space = v.indexOf(' ');
        return space === -1 || (input.selectionStart ?? v.length) <= space;
      };

      const pickDirectiveKey = ({ fill }) => {
        input.value = fill;
        closeSuggestions();
        lines = replaceLogical(lines, n.line, input.value);
        paintText();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        input.focus();
        input.setSelectionRange(fill.length, fill.length);
      };

      const openSuggestions = () => {
        if (inDirectiveKey()) {
          const keys = directiveKeySuggestions(input.value);
          if (!keys.length) return closeSuggestions();
          suggestions.innerHTML = '';
          for (const d of keys) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'suggestion';
            item.textContent = `${d.key} — ${d.desc}`;
            item.onmousedown = (e) => e.preventDefault();   // keep focus in the input
            item.onclick = () => pickDirectiveKey(d);
            suggestions.append(item);
          }
          highlighted = -1;
          suggestions.hidden = false;
          return;
        }
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
        clearModHint();
        // The indent is structure, and the outline is not where you change it —
        // that is what indent and outdent are for. `replaceLogical` keeps it.
        lines = replaceLogical(lines, n.line, input.value);
        paintText();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        openSuggestions();
      });
      input.addEventListener('change', () => render(n.line));
      input.addEventListener('focus', () => { focused = n.line; });
      input.addEventListener('blur', closeSuggestions);
      input.addEventListener('blur', clearModHint);
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
        if (e.key === 'Enter') {
          e.preventDefault();
          // Enter summons the palette to add the next movement: it replaces this
          // row when the row is blank, otherwise inserts after it. (A bare blank
          // line never rendered as an outline row anyway — add spacing in Text.)
          openPalette(input.value.trim() ? {} : { replace: n.line });
          return;
        }
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
      const applyModifier = (entryTitle, addition, position, perImplement) => {
        const value = input.value;
        let next; let caretAt;
        if (position === 'title' || position === 'end') {
          // A mutually-exclusive class (laterality mode / measured output):
          // clear whatever is already on the line, then insert the pick —
          // unless it is the mode already there, which toggles it off. Strips
          // every matching token, so a line left doubled by the old
          // append-only behaviour cleans up in one pick.
          const re = position === 'title' ? LATERALITY_RE : MEASURE_RE;
          const modeOf = position === 'title' ? lateralityMode : measureMode;
          const existing = value.match(re);
          const base = value.replace(new RegExp(re.source, 'gi'), '').replace(/\s+$/, '');
          if (existing && modeOf(existing[0]) === modeOf(addition)) {
            next = base;                               // re-pick of the same mode: clear it
            caretAt = next.length;
          } else if (position === 'end') {
            next = base + addition;                    // measured output trails as a comma modifier
            caretAt = next.length;
          } else {
            // Laterality: the first inline word after the movement name (spec §4).
            const fragment = movementFragment(base);
            const prefixLen = base.length - fragment.length;
            const insertAt = prefixLen + titleMatchLen(fragment, entryTitle);
            const head = base.slice(0, insertAt);
            const rest = base.slice(insertAt);
            const lead = head && !head.endsWith(' ') ? ' ' : '';
            const trail = rest && !rest.startsWith(' ') && !rest.startsWith(',') ? ' ' : '';
            next = `${head}${lead}${addition}${trail}${rest}`;
            caretAt = head.length + lead.length + addition.length;
          }
        } else {
          // position === 'load': after any laterality, before comma modifiers.
          const fragment = movementFragment(value);
          const prefixLen = value.length - fragment.length;
          const titleEnd = prefixLen + titleMatchLen(fragment, entryTitle);
          const commaIdx = value.slice(titleEnd).indexOf(',');
          const insertAt = commaIdx === -1 ? value.length : titleEnd + commaIdx;
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
        paintText();
        renderReading();
        renderReadsAs();
        renderFindings();
        renderBody();
        input.focus();
        input.setSelectionRange(caretAt, caretAt);
        // The seeded `@ Nx` says how many implements, not a rep count — spell
        // that out by the caret until the weight is typed (the hint clears on
        // the next keystroke or blur).
        if (perImplement) {
          showModHint(`@ ${perImplement}x is a load in each of ${perImplement} implements — now type the weight: @ ${perImplement}x35lb`);
        }
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
        // Even with no modifiers to offer, the panel still opens for the M5
        // "edit this movement" control below.
        modifiers.innerHTML = '';
        // X2: flag a movement with no live DB row, at the top of the panel.
        const prov = movementDbState(entry.id);
        if (!prov.inDb) {
          const note = document.createElement('div');
          note.className = 'modifier-info db-note';
          note.textContent = prov.tier === 'curated-static'
            ? '● Not in the movement database yet — edit and save to commit it'
            : '○ Not curated — only in the merged movement corpus';
          modifiers.append(note);
        }
        for (const it of items) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'suggestion';
          b.textContent = `${it.text}${it.isDefault ? ' (default)' : ''} — ${it.label}`;
          b.onmousedown = (e) => e.preventDefault();
          b.onclick = () => applyModifier(entry.title, it.addition, it.position, it.perImplement);
          modifiers.append(b);
        }
        if (mods.equipment.length) {
          const info = document.createElement('div');
          info.className = 'modifier-info';
          info.textContent = `Equipment: ${mods.equipment.join(', ')}`;
          modifiers.append(info);
        }
        // M5: edit the curated movement itself (its fields in the DB), not the
        // line — opens the reusable movement editor for this entry.
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'suggestion modifier-edit';
        edit.textContent = `Edit “${entry.title}” — its curated fields`;
        edit.onmousedown = (e) => e.preventDefault();
        edit.onclick = () => { closeModifiers(); openMovementEditor({ id: entry.id, title: entry.title }); };
        modifiers.append(edit);
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
        // Shown for any row that names a curated movement: the panel offers the
        // modifiers the movement supports (if any) and, since M5, an "edit this
        // movement" control — so even a movement with nothing to splice is
        // reachable for editing from its step row.
        const title = movementOf.get(n.line);
        modCaret.hidden = !(title && movementEntry(title));
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
        paintText();
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
 * One cue as a row in a `.steps` list — the Reads-as tab's uncapped "show
 * every cue" expansion. The cycle-rail classes match `.steps .cue.looping`; the palette
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
 * The `@key value` preamble as a small metadata block — read straight off
 * `parse().workout.directives` (an insertion-ordered `Record<string,string>`;
 * core never interprets the values). It *describes* the workout, so it renders
 * apart from the cue list, and only when at least one directive is set — no
 * empty block, no heading. Read-only: the outline row inputs and the Text tab
 * stay the way to edit a directive. `@tags` splits to chips; every other key —
 * including any `@x-…` extension — is a verbatim key/value row.
 */
const DIRECTIVE_LABELS = { id: 'id', wdl: 'wdl', date: 'date', tags: 'tags', author: 'author' };

function renderDirectives(directives) {
  const box = el('directives');
  box.innerHTML = '';
  const keys = directives ? Object.keys(directives) : [];
  if (!keys.length) { box.hidden = true; return; }
  box.hidden = false;

  const dl = document.createElement('dl');
  for (const key of keys) {
    const dt = document.createElement('dt');
    dt.textContent = DIRECTIVE_LABELS[key] ?? key;   // `@x-gym` etc. shown as written
    const dd = document.createElement('dd');
    const value = directives[key];
    const tags = key === 'tags'
      ? value.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    if (tags.length) {
      const chips = document.createElement('span');
      chips.className = 'chips';
      for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = tag;
        chips.append(chip);
      }
      dd.append(chips);
    } else {
      dd.textContent = value;
    }
    dl.append(dt, dd);
  }
  box.append(dl);
}

/**
 * A builder-only suggesting diagnostic (Chris, 2026-09-01, "unit defaults"
 * rule 2). A bare unitless count on a machine that carries no load and measures
 * calories — `15 Row` on an erg — is ambiguous: `15` reads as reps, but the
 * thing a rower actually counts is calories. Unlike a unitless *load*, which is
 * now pounds by default (DEC-022, spec §7), this is NOT defaulted anywhere —
 * the parser keeps the count as written and the board renders it verbatim.
 * Where a workout is being *authored*, we say so: registry-derived, firing only
 * when the movement resolves to an entry whose `measures` include `calories`
 * and that has no `load`. Distance-only machines are left alone — a run is
 * genuinely written as a bare count sometimes, and `distance` needs its own
 * unit anyway (spec §3).
 */
function calorieUnitHints(workout) {
  const out = [];
  const visit = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.node === 'block') visit(n.children);
      else if (n.node === 'interrupt') visit(n.body);
      else if (n.node === 'step') {
        // `15 Row` parses `15` as reps; `15cal Row` parses as calories and
        // never reaches here. A step that already names a load, or already
        // carries a `, count …` measure modifier, has said what it means.
        if (n.quantity?.kind !== 'reps') continue;
        if ((n.targets ?? []).some((t) => t.kind === 'load')) continue;
        if ((n.measures ?? []).length) continue;
        const entry = movementEntry(n.movement);
        if (!entry || entry.load) continue;
        if (!(entry.measures ?? []).includes('calories')) continue;
        out.push({
          severity: 'warning',
          line: n.line,
          message: `${n.movement}: a bare count on a machine that measures calories — `
            + `did you mean "${n.quantity.value}cal ${n.movement}"?`,
        });
      }
    }
  };
  visit(workout.body);
  return out;
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
  // The directive metadata block repaints on the same path as the summary and
  // the cue list, so it survives outline edits, text edits, Canonicalise, file
  // open and tab switches. A parse that throws never reaches here (`parse`
  // returns errors rather than throwing), and a compile failure below still
  // leaves this painted — it is read off the parsed tree, not the run.
  renderDirectives(workout.directives);
  const summary = el('summary');
  const list = el('diagnostics');
  summary.innerHTML = '';
  list.innerHTML = '';

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

  // No per-cue list on this tab: it was a capped duplicate of the "Reads as"
  // tab's "show every cue" expansion (same `cueRow`), and it pushed the body
  // map and the goals block — the point of this tab — off the screen. The run
  // reads on "Reads as"; this tab is the summary band, the diagnostics, the
  // body map and the goals check.

  // Registry-backed checks need the registry. Without it the parse errors still
  // show; say what is missing rather than looking clean because half the checks
  // never ran.
  const diagnostics = [
    ...errors.map((e) => ({ severity: 'error', line: e.line, message: e.message })),
    ...(has('movements') ? validate(workout) : []),
    ...(has('movements') ? calorieUnitHints(workout) : []),
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

// --- the Reads-as tab: the run, two ways --------------------------------
// Two subsections, both always shown: a block-grouped reading off the parsed
// workout tree (headers carry their own rounds / scheme / window, so nothing is
// enumerated round-by-round), then the full uncapped per-cue list under it.
// This is the only place the run is enumerated; `renderReading` owns the
// summary band and the diagnostics on the Analysis tab. Separate function over
// `#view-reads`, touches neither.

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

  // Two subsections, both always shown: the terse block-grouped reading, then
  // the full uncapped per-cue list under it. The cue list sits at the bottom of
  // this panel and pushes nothing out of view, so there is nothing to gain by
  // hiding it behind a toggle.
  const groups = document.createElement('div');
  groups.className = 'reads';
  for (const n of workout.body) groups.append(readsNode(n));
  box.append(groups);

  const head = document.createElement('div');
  head.className = 'reads-cues-head';
  head.textContent = `every cue (${laid.cues.length})`;
  box.append(head);

  const full = document.createElement('div');
  full.className = 'steps reads-cues';
  let prevRound;
  laid.cues.forEach((cue, i) => {
    const row = cueRow(cue, laid);
    // A half-line gap where the round ticks over, so `5 rounds` reads as five
    // groups rather than one long column. The `round N/5` suffix and the rail
    // colour already say it; this just makes it scannable at speed.
    const round = roundLabel(cue.rounds);
    if (i > 0 && round && round !== prevRound) row.classList.add('round-start');
    prevRound = round;
    full.append(row);
  });
  box.append(full);
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

// --- the column splitter -----------------------------------------------
// A drag handle on the editor/margin border. The margin width is a CSS var on
// `.sheet` (`--right-col-w`); this sets it — clamped so neither column starves
// — and persists it. With nothing stored, the stylesheet's per-breakpoint
// fallback stands. Below 820px the sheet is one column and the handle is
// `display: none`, so this is inert there.
{
  const sheet = document.querySelector('.sheet');
  const splitter = document.querySelector('.col-resize');
  const RIGHT_MIN = 288;                        // 18rem — the summary <dl> + tabs
  const EDITOR_MIN = 22 * 16;                   // matches the grid's 22rem floor
  const clamp = (px) =>
    Math.round(Math.min(Math.max(px, RIGHT_MIN), Math.max(RIGHT_MIN, sheet.clientWidth - EDITOR_MIN - 6)));

  // `intended` is the user's chosen width, unclamped; it is re-clamped to the
  // current sheet on every paint, so shrinking the window narrows the margin
  // without losing the intent when the window grows back. `null` = no override,
  // the stylesheet's per-breakpoint fallback stands.
  let intended = Number(localStorage.getItem('wdl.right-col-w')) || null;
  const paint = () => {
    if (intended == null) sheet.style.removeProperty('--right-col-w');
    else sheet.style.setProperty('--right-col-w', `${clamp(intended)}px`);
  };
  const set = (px, persist) => {
    intended = px;
    paint();
    if (persist) { try { localStorage.setItem('wdl.right-col-w', String(clamp(px))); } catch { /* private mode */ } }
  };
  paint();

  if (splitter) {
    // Track the drag on `window`, not a captured pointer on the handle: the
    // move then fires for a plain mouse drag too, and an add-on-press /
    // remove-on-release listener pair needs no capture bookkeeping.
    const onMove = (e) => set(sheet.getBoundingClientRect().right - e.clientX, false);
    const end = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('mousemove', onMove);
      removeEventListener('pointerup', end);
      removeEventListener('mouseup', end);
      splitter.classList.remove('dragging');
      document.body.classList.remove('col-resizing');
      if (intended != null) set(clamp(intended), true);   // persist the settled width
    };
    const start = (e) => {
      if (e.button) return;                    // primary button / touch only
      addEventListener('pointermove', onMove);
      addEventListener('mousemove', onMove);
      addEventListener('pointerup', end);
      addEventListener('mouseup', end);
      splitter.classList.add('dragging');
      document.body.classList.add('col-resizing');
      e.preventDefault();
    };
    splitter.addEventListener('pointerdown', start);
    splitter.addEventListener('mousedown', start);
    // Double-click clears the override — back to the stylesheet default.
    splitter.addEventListener('dblclick', () => {
      intended = null;
      paint();
      try { localStorage.removeItem('wdl.right-col-w'); } catch { /* private mode */ }
    });
    splitter.addEventListener('keydown', (e) => {
      const base = intended != null ? clamp(intended) : splitter.nextElementSibling.getBoundingClientRect().width;
      const step = e.shiftKey ? 48 : 16;
      if (e.key === 'ArrowLeft') { set(base + step, true); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { set(base - step, true); e.preventDefault(); }
    });
    // Re-clamp the intent to the new sheet width; never widens past the intent.
    addEventListener('resize', paint);
  }
}

// --- the movement palette modal --------------------------------------------
// Summoned, never docked: ⌘K / Ctrl-K anywhere, or "+ movement" / Enter on a
// blank outline row. It carries the same three filters the drawer did — text
// (`#search`), muscle chips (`chosenMuscles` / `worksAll`, AND-combined) and
// saved set (`#set-pick`) — and `#repertoire` still lives inside it (R8 folds
// the set management in properly). Picking a movement inserts `lineFor(m)` at
// the focused row and closes.
const paletteModal = el('palette-modal');
/** A blank outline row that summoned the modal — replaced, not inserted after. */
let paletteReplaceLine = null;
/** The element to hand focus back to when the modal closes. */
let paletteReturnFocus = null;

function openPalette({ replace = null } = {}) {
  if (paletteModal.open) return;
  paletteReplaceLine = replace;
  paletteReturnFocus = document.activeElement;
  renderPalette();
  paletteModal.showModal();
  const search = el('search');
  search.focus();
  search.select();
}

function closePalette() {
  if (!paletteModal.open) return;
  paletteModal.close();
  paletteReplaceLine = null;
  const back = paletteReturnFocus;
  paletteReturnFocus = null;
  if (back && back.isConnected && typeof back.focus === 'function') back.focus();
}

/** A movement chosen in the modal: land it at the caret, then close. */
function pickFromPalette(m) {
  const replace = paletteReplaceLine;
  closePalette();
  if (replace != null && lines[replace - 1] !== undefined && !lines[replace - 1].trim()) {
    lines = replaceLogical(lines, replace, lineFor(m));
    render(replace);
  } else {
    insert(focused, lineFor(m));
  }
}

// Every close routes through `closePalette` so focus is handed back. Esc while
// composing a set exits compose mode first (the old drawer behaviour), leaving
// the modal open.
paletteModal.addEventListener('cancel', (e) => {
  e.preventDefault();
  if (composing) { composing = null; renderSetList(); renderPalette(); return; }
  closePalette();
});
paletteModal.addEventListener('click', (e) => {
  if (e.target === paletteModal) closePalette();   // backdrop
});
el('palette-close').onclick = () => closePalette();

addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
    if (e.isComposing) return;
    e.preventDefault();
    if (paletteModal.open) closePalette(); else openPalette();
  }
});

// --- the movement editor modal -------------------------------------------
// M5: the reusable `apps/shared/movement-editor.js` form, hosted here first.
// Reached from "＋ new movement" in the palette modal, an "edit" control on a
// palette card, and "Edit this movement…" in the step row's `»` panel. It
// writes a `scope: "global"` row via `/api` (`POST`/`PATCH`); signed out or
// non-admin the write 403s and the form shows the message. On a successful save
// `absorbMovement` folds the row into the in-memory registries so it shows in
// the palette / the `»` panel without a reload.
//
// **The editor opens on the DB row, never on an in-memory entry** (Chris,
// 2026-09-02, fixing a defect that shipped with M5). The three entry points used
// to hand `createMovementEditor` whichever movement object they had to hand, and
// two of them had the *canonical* merge (`registry/movements.canonical.json`,
// 5 sources unioned) rather than the curated layer the editor exists to edit. So
// the form showed merge output and a save wrote merge output into the curated
// row: `deadlift` gained equipment `["Barbell"]` that curation deliberately
// omits, `skierg` lost the alias `ski erg`, `muscles` carried the merge's
// `support` / `sources` metadata in, and six movements gained an alias another
// record holds as its name — which, since an alias outranks a name in
// `fold.ts`'s `lookup`, silently moved what that word resolves to everywhere.
// Nothing in the form said so and no test could see it.
//
// The fix is structural rather than per-call-site: this function takes an
// **identity** — `null` to create, or `{ id, title }` — and nothing else. It
// cannot be handed a record to display, so no caller can leak merge output into
// the form again by passing the object it happened to be holding. When a DB row
// exists, what fills the fields is always `getMovementByMovementId`, i.e.
// exactly the row a save will `PATCH` against.
//
// **X3 (2026-09-06) — the no-DB-row branch now pre-fills from the static file.**
// a643824's "id/title only, inventing nothing" was too austere for that case:
// promoting a movement meant retyping muscles / equipment / pattern / … that the
// curated `registry/movements.json` already holds. The static file is real
// curated data, not merge output, so when there is no DB row the form pre-fills
// from `movementEntryToRecord(curated ?? canonical)` — editor-owned fields only,
// canonical `support` / `sources` / `origin` / `muscleClaims` dropped, so a Save
// still cannot PATCH merge metadata in. a643824 stands unchanged where a DB row
// *does* exist.
const movementEditorModal = el('movement-editor-modal');
let movementEditorHandle = null;
/** Guards against a second open racing the first one's fetch. */
let movementEditorSeq = 0;

/**
 * Open the editor on a movement's **database row**.
 *
 * @param {null | {id: string, title?: string, duplicate?: boolean}} ref
 *   `null` creates a blank movement. Otherwise the row for `ref.id` is fetched
 *   and edited; if there is no row — the movement is in the merged corpus but
 *   not yet in the curated layer, which is true of most of it — the form
 *   pre-fills from the static registry record (X3), editor-owned fields only,
 *   and a Save commits it as a real DB row.
 *
 *   `ref.duplicate` (2026-09-06): the DB row for `ref.id` is fetched as the
 *   *source* for a brand-new movement — the "Duplicate movement" action. The row
 *   is sanitised through `movementRecordToEntry` → `movementEntryToRecord` (the
 *   X3 mappers: editor-owned keys only, `muscles` rebuilt as `{primary,
 *   secondary}`, canonical `support` / `sources` / `origin` dropped) and handed
 *   to the editor with `duplicate: true`, which opens create mode with every
 *   field kept and `movementId` blank + required. The source row is never
 *   touched; a Save `POST`s a new row.
 */
/**
 * V9: persist a curator's "＋ new term" from a token-input picker, then bust the
 * matching `dbVocab` cache so the next editor open re-fetches it. Throws on a
 * failed `POST` (e.g. a 403 for a non-admin) — `createTokenInput` catches that,
 * rolls its optimistic add back and shows the message inline.
 */
async function createVocabTermLive(createTerm, vocabClosure, { termId, name }) {
  await createTerm({ termId, name, synonyms: [] });
  vocabClosure.reset();
}

async function openMovementEditor(ref = null) {
  if (movementEditorModal.open) return;
  const seq = ++movementEditorSeq;
  const host = el('movement-editor-host');
  movementEditorHandle?.destroy();
  movementEditorHandle = null;

  // Open first, fill second: the fetch is same-origin and quick, but a click
  // with no response is worse than a moment of "Loading…", and a failure needs
  // somewhere to be shown.
  host.textContent = ref ? `Loading ${ref.id}…` : '';
  host.className = ref ? 'me-loading' : '';
  movementEditorModal.showModal();

  let record = null;
  if (ref?.id) {
    try {
      record = await getMovementByMovementId(ref.id);
    } catch (e) {
      if (seq !== movementEditorSeq || !movementEditorModal.open) return;
      // The read failed. If the X1 layer knows a live DB row backs this id, we
      // must not open a form off the static file — a Save would re-find that row
      // and PATCH file-derived values over it (the a643824 failure mode). So
      // keep the dead-end only then. Otherwise (`inDb` false — no row, or `/api`
      // absent entirely under `WDL_MOCK_API=0`, where `markStaticProvenance`
      // stamped every id false) fall through to the X3 static pre-fill below.
      if (movementDbState(ref.id).inDb) {
        host.textContent = `Could not read ${ref.id} from the movement database: ${e.message}`;
        return;
      }
      console.warn(`no /api movement row for ${ref.id} — opening the editor from the static file:`, e.message);
    }
    if (seq !== movementEditorSeq || !movementEditorModal.open) return;
    // No DB row yet (X3, 2026-09-06): pre-fill from the full static registry
    // record — the curated `registry/movements.json` entry first, else the
    // merged `registry/movements.canonical.json` one — mapped down to the fields
    // the editor owns (`movementEntryToRecord` drops canonical `support` /
    // `sources` / `origin` / `muscleClaims` etc.). The static file is real
    // curated data, so Saving is a review-and-commit and a `make movements:dump`
    // straight after shows 0 diff. This is the deliberate partial reversal of
    // a643824's "id/title only" — for the no-DB-row case only; a real row is
    // still fetched and used untouched above. Falls back to identity if the
    // movement is in neither static list.
    record ??= movementEntryToRecord(
      curatedMovements.find((m) => m.id === ref.id) ?? catalogue.find((m) => m.id === ref.id),
    ) ?? { id: ref.id, title: ref.title ?? '' };

    // Duplicate: the fetched row is the *source* for a new movement, not the row
    // to edit. Run it through the same X3 mappers the no-DB-row branch uses so
    // canonical cruft and nested `muscles` metadata can't ride along, and drop
    // the identity — the editor (`duplicate: true`) opens create mode with a
    // blank id. If the row is somehow missing, `record` stays as the static
    // pre-fill / identity and the editor still opens a sane create form.
    if (ref.duplicate && record && 'movementId' in record) {
      record = movementEntryToRecord(movementRecordToEntry(record));
    }
  }

  // X2: opened on a movement with no DB row. The title already reads "New
  // movement"; this adds which static source it came from — and distinguishes
  // the two tiers X3 will pre-fill from. `null` for `＋ new movement` (no ref)
  // and for a real DB row.
  // A duplicate opens in create mode from a real row — it is not a "no DB row"
  // case even though the sanitised source carries no `movementId`.
  const noDbRow = Boolean(ref?.id) && !ref?.duplicate && !(record && 'movementId' in record);
  const provenance = noDbRow ? { notInDb: true, tier: movementDbState(ref.id).tier } : null;

  host.textContent = '';
  host.className = '';
  movementEditorHandle = createMovementEditor({
    container: host,
    record,
    provenance,
    duplicate: Boolean(ref?.duplicate),
    api: { createMovement, updateMovement, getMovementByMovementId },
    // V5: the two id-valued token fields type-ahead over the movement lists this
    // page already holds — `related` over the curated registry, `sameAs` over the
    // merged corpus, matching what each field means. Read through a function so a
    // list still loading (or absorbed since) is picked up at open time. Equipment,
    // patterns and muscles need no override: `vocab.js` is their source.
    vocab: {
      related: () => (curatedMovements ?? []).map((m) => m.id).filter(Boolean).sort(),
      sameAs: () => (catalogue ?? []).map((m) => m.id).filter(Boolean).sort(),
    },
    // V9: an admin can mint a new global equipment / pattern term without leaving
    // the editor. Gated on `currentUser()?.admin` so a non-admin never sees the
    // row; the `@request.auth.admin = true` server rule (DEC-025) is the real
    // boundary and a 403 surfaces inline in the picker if it is ever shown. After
    // the POST the `dbVocab` cache is busted so the *next* editor open re-fetches
    // — the widget it was added from has already spliced it in live.
    onCreateTerm: currentUser()?.admin ? {
      equipment: (f) => createVocabTermLive(createEquipmentTerm, equipmentVocab, f),
      pattern: (f) => createVocabTermLive(createPatternTerm, patternVocab, f),
    } : undefined,
    // D5: an admin can soft-delete an existing movement from the editor — the
    // one record surface that never had a delete control. Gated on
    // `currentUser()?.admin` and on `record` being a real DB row (a movement
    // with no curated row yet opens in create mode and has nothing to delete);
    // the `@request.auth.admin = true` server rule is the real boundary. On
    // success `dropMovement` splices it out of the in-memory lists so the
    // palette loses it without a reload, then closes the modal.
    onDelete: (currentUser()?.admin && record && 'movementId' in record)
      ? () => dropMovement(record.id, record.movementId)
      : undefined,
    // Duplicate: same gate as Delete (admin + real DB row). Re-opens the editor
    // as a copy of this row — `openMovementEditor` re-fetches so the seed is the
    // authoritative current row, not the (possibly edited) open form. The editor
    // also gates the button on `state.pbId`, so this is belt-and-braces.
    onDuplicate: (currentUser()?.admin && record && 'movementId' in record)
      ? () => {
          const { movementId, title } = record;
          closeMovementEditor();
          openMovementEditor({ id: movementId, title, duplicate: true });
        }
      : undefined,
    onSaved: (entry) => { absorbMovement(entry); },
    onCancel: () => closeMovementEditor(),
  });
  movementEditorHandle.focus();
}

function closeMovementEditor() {
  if (movementEditorModal.open) movementEditorModal.close();
  movementEditorHandle?.destroy();
  movementEditorHandle = null;
}

movementEditorModal.addEventListener('cancel', (e) => { e.preventDefault(); closeMovementEditor(); });
movementEditorModal.addEventListener('click', (e) => {
  if (e.target === movementEditorModal) closeMovementEditor();
});

/**
 * Merge a just-saved movement (registry-entry shape) into the two in-memory
 * movement lists and re-provide them, so `defaultRegistry()` /
 * `canonicalRegistry()` rebuild and the palette / `»` panel see it at once. The
 * search box is pointed at the new movement so it surfaces in the palette even
 * though a fresh row carries no `core` flag.
 */
function absorbMovement(entry) {
  const merge = (arr) => {
    const i = arr.findIndex((m) => m.id === entry.id);
    const next = arr.slice();
    // X1: a just-saved movement now has a live DB row — stamp the provenance flag
    // so it matches what `applyDbLayer` would set on the next reload.
    if (i >= 0) next[i] = { ...next[i], ...entry, inDb: true };
    else next.push({ ...entry, inDb: true });
    return next;
  };
  if (Array.isArray(curatedMovements)) {
    curatedMovements = merge(curatedMovements);
    provide({ movements: () => curatedMovements });
  }
  if (Array.isArray(catalogue) && catalogue.length) {
    catalogue = merge(catalogue);
    provide({ canonicalMovements: () => catalogue });
  }
  closeMovementEditor();
  const search = el('search');
  if (search && paletteModal.open) { search.value = entry.title; }
  renderPalette();
  render();
}

/**
 * Soft-delete a movement (DEC-029), then splice it out of the two in-memory
 * movement lists and re-provide them — the mirror of `absorbMovement` — so the
 * palette / `»` panel lose it without a page reload. The server `PATCH` runs
 * first; on failure the editor keeps the modal open and shows the message, so
 * this only reaches the splice once the row is actually tombstoned. A fresh
 * page load would have dropped it anyway via the D2 `listMovements` filter and,
 * after `make movements:dump`, out of `registry/movements.json`.
 *
 * X1 soft-delete limitation (the accepted smaller scope): a movement that also
 * exists in `registry/movements.json` is spliced out here for the session, but a
 * reload rebuilds the static layer and `applyDbLayer` — seeing no DB row — keeps
 * the static-curated record (with `inDb:false`). So a soft-delete only *stays*
 * hidden across reloads for a movement that has **no** static-file record (one
 * created through the editor). Hiding a static-file movement for good needs a
 * tombstone the merge can see, or an X-series follow-up — flagged to Chris, not
 * built here.
 */
async function dropMovement(pbId, movementId) {
  await removeMovement(pbId);
  const without = (arr) => arr.filter((m) => m.id !== movementId);
  if (Array.isArray(curatedMovements)) {
    curatedMovements = without(curatedMovements);
    provide({ movements: () => curatedMovements });
  }
  if (Array.isArray(catalogue) && catalogue.length) {
    catalogue = without(catalogue);
    provide({ canonicalMovements: () => catalogue });
  }
  closeMovementEditor();
  renderPalette();
  render();
}

/**
 * X1 (Chris, 2026-09-06) — layer the DB movement list over the static curated
 * file. See DEC-020's *Corrected/extended 2026-09-06* note: the builder's
 * palette + analysis read `registry/movements.json` and
 * `registry/movements.canonical.json` as static files and never called
 * `listMovements()`, so the `movements` DB collection was invisible to them —
 * an editor create / edit / soft-delete showed for the session (via
 * `absorbMovement` / `dropMovement`) but reverted on a hard reload.
 *
 * Now `listMovements()` is fetched on bootstrap and merged into the in-memory
 * lists, keyed on `movementId` / `id`:
 *
 *   - **Curated list** (`curatedMovements`, what `provide({ movements })` hands
 *     core for `validate` name-checks and `resolve()`): a DB row **replaces**
 *     the static curated record of the same id — the DB is authoritative for the
 *     curated layer. DB-only rows are appended. Static records with no DB row
 *     keep their file values.
 *   - **Canonical corpus** (`catalogue`, what `renderPalette` and
 *     `canonicalRegistry()` / `musclesFor` read): the DB entry is **overlaid**
 *     onto the canonical record (`{ ...canonical, ...db }`) so canonical-only
 *     search fields (`external`, cross-source `aliases`, `muscleClaims`) survive
 *     while the curated fields win — the same shape `absorbMovement` already
 *     used for an in-session save. DB-only rows are appended; they carry no
 *     `core` flag, so they surface on a title search rather than in the default
 *     palette view. `registry/movements.canonical.json` itself stays a static
 *     build artefact (DEC-020) — only the in-memory array is layered.
 *
 * Provenance: every merged entry carries `inDb: boolean` — `true` iff a live DB
 * row backs it. X2 renders a "not in the database" marker off this; X3 pre-fills
 * the editor from the static record when it is `false`. X1 only has to set it
 * correctly and does not render it. (`inDb`, not a `source: 'db' | 'static-*'`
 * enum, because `source` is already a movement field — the upstream dataset
 * name; the static-curated vs static-canonical tier X2 wants is derivable from
 * whether the id is in `curatedMovements`.)
 *
 * `/api` absent or failing → `markStaticProvenance()` stamps `inDb:false` and
 * the static files stand unchanged (mirrors `apps/shared/vocab.js`'s
 * degrade-to-bundled-list pattern). `listMovements()`'s read rule is open
 * (`scope = "global" && deleted = null`), so this works signed out too.
 */
function applyDbLayer(rows) {
  const dbById = new Map();
  for (const row of rows) {
    // `movementRecordToEntry` maps a PB row to the registry-entry shape and
    // drops the canonical-only sub-objects (`support` / `sources` / `origin` /
    // `muscleClaims`) — only the fields the curated layer owns.
    const entry = movementRecordToEntry(row);
    entry.inDb = true;
    dbById.set(entry.id, entry);
  }

  if (Array.isArray(curatedMovements)) {
    const seen = new Set();
    const merged = curatedMovements.map((m) => {
      const db = dbById.get(m.id);
      if (db) { seen.add(m.id); return db; }          // DB wins — replace outright
      return { ...m, inDb: false };
    });
    for (const [id, entry] of dbById) if (!seen.has(id)) merged.push(entry);
    curatedMovements = merged;
    provide({ movements: () => curatedMovements });
  }

  if (Array.isArray(catalogue) && catalogue.length) {
    const seen = new Set();
    const merged = catalogue.map((m) => {
      const db = dbById.get(m.id);
      if (db) { seen.add(m.id); return { ...m, ...db, inDb: true }; }   // overlay — keep canonical-only fields
      return { ...m, inDb: false };
    });
    for (const [id, entry] of dbById) if (!seen.has(id)) merged.push({ ...entry, inDb: true });
    catalogue = merged;
    provide({ canonicalMovements: () => catalogue });
  }

  renderPalette();
  render();
}

/**
 * The `/api`-absent fallback for `applyDbLayer`: stamp `inDb:false` on every
 * static entry so X2 / X3 always find the flag, without re-providing or
 * re-rendering — core reads nothing off `inDb`, and the palette is already
 * painted from these same objects.
 */
function markStaticProvenance() {
  for (const m of (curatedMovements ?? [])) if (m.inDb === undefined) m.inDb = false;
  for (const m of (catalogue ?? [])) if (m.inDb === undefined) m.inDb = false;
  // X2: the first `renderPalette()` on the `/api`-absent path ran before these
  // flags were stamped. The marker logic already treats a falsy `inDb` as
  // "no row" (so that first paint is not wrong), but re-render so the DOM
  // settles on the explicit `false` — cheap (≤300 cards, no `provide()` /
  // core round-trip, which is what X1 was avoiding here).
  renderPalette();
}

el('movement-new').onclick = () => openMovementEditor(null);

// --- wiring ------------------------------------------------------------------

el('text').addEventListener('input', () => {
  lines = el('text').value.replace(/\n$/, '').split('\n');
  focused = null;
  paintTextHl();
  renderOutline();
  renderReading();
  renderReadsAs();
  renderFindings();
  renderBody();
  el('board').href = `../display/#${encodeURIComponent(text())}`;
});

// Keep the highlight layer locked to the textarea at every scroll offset.
el('text').addEventListener('scroll', () => {
  el('text-hl').scrollTop = el('text').scrollTop;
  el('text-hl').scrollLeft = el('text').scrollLeft;
});

// Replace the textarea's current selection (or insert at the caret) with `str`,
// via `execCommand` where it exists so the edit joins the native undo stack and
// fires `input` on its own; `setRangeText` is the fallback. Either way the
// existing `input` handler re-splits `lines` and repaints the layer.
function typeInText(ta, str) {
  ta.focus();
  let ok = false;
  try { ok = document.execCommand('insertText', false, str); } catch { ok = false; }
  if (!ok) {
    const { selectionStart: s, selectionEnd: e } = ta;
    ta.setRangeText(str, s, e, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Tab / Shift-Tab / Enter carry canonical two-space indent (spec §2) inside the
// raw editor instead of escaping it, selection-aware, and `lines`-preserving —
// every branch goes through `typeInText`, so the `#dirty` badge and undo keep
// working.
el('text').addEventListener('keydown', (e) => {
  if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
  const ta = e.target;
  const val = ta.value;
  const a = ta.selectionStart;
  const b = ta.selectionEnd;
  const lineStart = val.lastIndexOf('\n', a - 1) + 1;

  if (e.key === 'Tab' && a === b && !e.shiftKey) {
    e.preventDefault();
    typeInText(ta, '  ');
    return;
  }

  if (e.key === 'Tab') {
    // Selection or Shift-Tab: indent / dedent every touched line and hold the
    // selection over the same text.
    e.preventDefault();
    const selEnd = b > a && val[b - 1] === '\n' ? b - 1 : b;   // a trailing newline is not its own line
    let blockEnd = val.indexOf('\n', selEnd);
    if (blockEnd === -1) blockEnd = val.length;
    const block = val.slice(lineStart, blockEnd);   // whole lines, start of first to end of last
    let headDelta = 0;
    let totalDelta = 0;
    const out = block.split('\n').map((row, i) => {
      if (e.shiftKey) {
        const drop = row.startsWith('  ') ? 2 : row.startsWith(' ') ? 1 : 0;
        if (i === 0) headDelta = -drop;
        totalDelta -= drop;
        return row.slice(drop);
      }
      if (i === 0) headDelta = 2;
      totalDelta += 2;
      return '  ' + row;
    }).join('\n');
    if (out === block) return;   // Shift-Tab on already-flush lines — no edit, no undo entry
    ta.setSelectionRange(lineStart, lineStart + block.length);
    typeInText(ta, out);
    ta.setSelectionRange(Math.max(lineStart, a + headDelta), Math.max(lineStart, b + totalDelta));
    return;
  }

  if (e.key === 'Enter' && a === b) {
    // Carry the current line's leading indent onto the new line, plus two more
    // spaces when the line being left ends in `:` (indent into the block).
    const before = val.slice(lineStart, a);
    const indent = before.match(/^ */)[0];
    const extra = before.trimEnd().endsWith(':') ? '  ' : '';
    if (!indent && !extra) return;   // nothing to carry — leave Enter to the browser
    e.preventDefault();
    typeInText(ta, '\n' + indent + extra);
  }
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
  b.onclick = () => {
    // "+ movement" is the palette now; the other three drop a stub line as before.
    if (b.dataset.add === 'step') { openPalette(); return; }
    insert(focused, { rest: 'rest 60s', block: '5 rounds:', comment: '// ' }[b.dataset.add]);
  };
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
 * A "set" is a named, ordered list of movement ids. Since S2 (DEC-027) it is a
 * row in the `movement_sets` PocketBase collection, reached through the
 * host-agnostic `apps/shared/sets.js` model — `sets.list()` is the cache the
 * three views below render from, and every edit is an async write through
 * `sets.create` / `rename` / `setMovements` / `remove`. There is **no
 * `localStorage` store and no signed-out path**: signed out, the "Sets" section
 * and the `#set-pick` filter are hidden entirely (mirroring the *My workouts*
 * panel). A set can be composed by hand (drag a movement onto it, or "compose"
 * it from the palette), reordered, renamed, dropped whole into the outline, and
 * — so it can move between accounts — exported to and imported from a plain JSON
 * file (`movement-sets.json`, `{ format, version, sets }`). The file is a
 * carrier for the same shape, not a format a workout is ever written in.
 */
let catalogue = [];
let vocabulary = [];
/** The record id of the set currently being composed from the palette, if any. */
let composing = null;
/** Which set cards are expanded (by record id), so a redraw keeps them that way. */
const openSets = new Set();

/** One set from the model cache by record id (the `#set-pick` option value). */
const setByKey = (key) => sets.list().find((s) => s.id === key) ?? null;

// Movement-list edits (reorder, compose-toggle, drag-in, ⊕) are applied to an
// in-memory overlay and re-rendered at once, then written on a trailing edge —
// so clicking through a compose session or the ↑/↓ buttons does not fire a
// PATCH per click. `sets.setMovements` refreshes the model cache on success.
const pendingMovements = new Map();   // set id -> movements[] not yet written
const movementTimers = new Map();     // set id -> trailing-flush timer

/** A set's movement list, pending overlay first, then the last-loaded row. */
const localMovements = (set) => pendingMovements.get(set.id) ?? set.movements ?? [];

/** Re-render the three views of the repertoire from the model cache. */
function renderRepertoire() {
  renderSets();
  renderSetList();
  renderPalette();
}

/** Run a repertoire write, re-render regardless, and surface a failure inline-ish. */
async function editSet(op) {
  try { await op(); }
  catch (e) { alert(`Could not save that change: ${e.message}`); }
  renderRepertoire();
}

/** Optimistically set a set's movement list; flush the write on a trailing edge. */
function queueMovements(set, next) {
  pendingMovements.set(set.id, next);
  renderRepertoire();
  clearTimeout(movementTimers.get(set.id));
  movementTimers.set(set.id, setTimeout(() => flushMovements(set.id), 500));
}

async function flushMovements(id) {
  movementTimers.delete(id);
  const next = pendingMovements.get(id);
  if (!next) return;
  try {
    await sets.setMovements(id, next);
  } catch (e) {
    alert(`Could not save that change: ${e.message}`);
  } finally {
    if (pendingMovements.get(id) === next) pendingMovements.delete(id);
    renderRepertoire();
  }
}
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
  // Fold both sides through `searchKey` so the palette matches names the way
  // core `resolve()` does — separators collapse, plurals and `bb`/`db`-style
  // shorthand expand — instead of raw-lowercase substring (which is why
  // `bb bent over row` used to find nothing). Each haystack piece is folded on
  // its own and the pieces are space-joined, so a needle can't bridge two of
  // them; each query word is folded on its own, so a multi-word query still
  // ANDs its parts and `thrust` → `Thruster` still matches on `includes`.
  const needles = q.split(/\s+/).map(searchKey).filter(Boolean);
  if (!needles.length) return m.core;
  const hay = [
    m.title, ...(m.pattern ?? []), ...(m.equipment ?? []),
    ...(m.muscles?.primary ?? []), ...(m.aliases ?? []),
  ].map(searchKey).filter(Boolean).join(' ');
  return needles.every((n) => hay.includes(n));
};

/**
 * The single movement a typed query resolves to through core `Registry.resolve()`,
 * mapped into `catalogue` for rendering — or `undefined` when the name is
 * ambiguous, unregistered, or the registry has not loaded yet.
 *
 * Consults the **curated** registry only, like `movementEntry`. That is
 * deliberate: the alias-over-id ranking that makes this pin meaningful
 * (`bent over row` → Barbell Row, `squat` → Air Squat, both via an alias —
 * DEC-014) is a curated-layer property, and resolving over the full 3109-row
 * canonical corpus carries a much larger collision surface (e.g. the deliberate
 * `assault bike` → `Bike`, DEC-015) with no upside a "the answer is…" marker
 * could honestly claim. A name that lives only in the canonical corpus simply
 * gets no pin and stays in the folded list. Curated ids are a subset of
 * canonical ids (curated is the first source in the canonical merge), so
 * `entry.id` always maps into `catalogue`.
 */
function resolvedMovement(query) {
  if (!query || !has('movements')) return undefined;
  let res;
  try { res = defaultRegistry().resolve(query); } catch { return undefined; }
  if (res.status !== 'ok') return undefined;
  return catalogue.find((m) => m.id === res.entry.id);
}

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

/**
 * The movements the palette is currently showing — factored out of
 * `renderPalette` so a set card's "add the movements now showing" affordance
 * and the palette agree on what "showing" means. While composing, the set-pick
 * filter is ignored, exactly as in `renderPalette`.
 */
function shownMovements() {
  const q = el('search').value.trim();
  const chosen = composing ? null : setByKey(el('set-pick').value);
  const ids = chosen ? localMovements(chosen) : null;
  return ids
    ? catalogue.filter((m) => ids.includes(m.id))
    : catalogue.filter((m) => matches(m, q));
}

/**
 * X2 (Chris, 2026-09-06): provenance of a movement id against the X1 layered
 * lists — for the "not in the database" marker on the palette card, the step
 * `»` panel and the editor header.
 *
 *   - `inDb` — a live DB row backs this movement. Falsy also covers the
 *     `WDL_MOCK_API=0` window before `markStaticProvenance()` stamps the flag:
 *     the layer never confirmed a row, so "not in the DB" is the right reading
 *     either way (`m.inDb === undefined` and `=== false` are treated alike).
 *   - `tier` (only meaningful when `!inDb`) — `'curated-static'` if the id is in
 *     `curatedMovements` (i.e. `registry/movements.json`; a movement worth
 *     promoting), else `'canonical-only'` (only in the 5-source merge, never
 *     curated — e.g. `sandbag-bear-hug-squat`). Derived from curated-list
 *     membership, not a new `source` field: a DB-only row in `curatedMovements`
 *     carries `inDb:true`, so it never reaches the `tier` branch.
 */
function movementDbState(id) {
  const cat = catalogue.find((m) => m.id === id);
  const cur = curatedMovements.find((m) => m.id === id);
  const inDb = Boolean(cat?.inDb || cur?.inDb);
  return { inDb, tier: (!inDb && cur) ? 'curated-static' : 'canonical-only' };
}

function renderPalette() {
  const box = el('palette');
  const keepScroll = box.scrollTop;
  // While composing, the palette is a place to pick movements *into* a set, so
  // it ignores the set-pick filter and searches the whole catalogue.
  const composed = composing ? setByKey(composing) : null;
  const chosen = composing ? undefined : setByKey(el('set-pick').value);
  const shown = shownMovements();

  const inComposed = composed ? new Set(localMovements(composed)) : null;

  // X2: which ids are in the curated layer (`registry/movements.json`), so a
  // card with no DB row can say whether it is a curated-static movement (worth
  // promoting) or a canonical-only one. A DB-only row here is `inDb:true`, so it
  // never reaches the marker. Built once per render.
  const curatedIds = new Set(curatedMovements.map((m) => m.id));

  box.innerHTML = '';

  // P2: build one palette card. Extracted so the resolve-winner pin and the
  // folded-list body render identically.
  const movementCard = (m) => {
    const item = document.createElement('button');
    item.className = 'movement';
    item.type = 'button';
    item.draggable = true;
    item.dataset.id = m.id;
    item.title = [
      (m.muscles?.primary ?? []).join(', '),
      (m.equipment ?? []).join(', '),
    ].filter(Boolean).join('  ·  ');

    if (composed) {
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

    // X2: a quiet marker when no live DB row backs this movement — so Chris can
    // see at a glance what he still needs / wants to commit. `●` curated-static
    // (in `registry/movements.json`, no DB row — edit + Save promotes it), `○`
    // canonical-only (only in the 5-source merge). Falsy `inDb` (incl. the
    // `WDL_MOCK_API=0` window before `markStaticProvenance()` runs) counts as
    // "no row". A glyph, `aria-hidden`; the `title` carries the words.
    if (!m.inDb) {
      const curated = curatedIds.has(m.id);
      const mark = document.createElement('span');
      mark.className = curated ? 'db-mark' : 'db-mark db-mark--canonical-only';
      mark.textContent = curated ? '●' : '○';
      mark.setAttribute('aria-hidden', 'true');
      mark.title = curated
        ? 'Not in the movement database yet — edit and Save to commit it'
        : 'Not curated — only in the merged movement corpus';
      name.after(mark);
    }

    // M5: edit this movement's curated fields in the DB. Its own click stops the
    // card's "insert at caret" from also firing. Not shown while composing a set.
    if (!composed) {
      const edit = document.createElement('span');
      edit.className = 'movement-edit';
      edit.setAttribute('role', 'button');
      edit.tabIndex = 0;
      edit.title = `Edit “${m.title}”`;
      edit.textContent = '✎';
      const openEdit = (e) => { e.stopPropagation(); e.preventDefault(); openMovementEditor({ id: m.id, title: m.title }); };
      edit.addEventListener('click', openEdit);
      edit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openEdit(e); });
      edit.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });
      item.append(edit);
    }

    // Composing: a click toggles the movement in the set being built. Otherwise
    // a click lands it at the caret and closes the modal — "add this" where you
    // were last working. Dragging still says where explicitly.
    item.onclick = composed
      ? () => {
          const cur = localMovements(composed);
          const next = cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id];
          queueMovements(composed, next);
        }
      : () => pickFromPalette(m);
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/wdl-movement', lineFor(m));
      e.dataTransfer.setData('text/wdl-movement-id', m.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    item.addEventListener('mouseenter', () =>
      hoverBody({ primary: m.muscles?.primary ?? [], secondary: m.muscles?.secondary ?? [] }));
    item.addEventListener('mouseleave', unhoverBody);
    return item;
  };

  // P2: the movement this query resolves to through core `Registry.resolve()` —
  // pinned above the folded list with a marker so a name with one standard
  // answer (`bent over row` → Barbell Row, `squat` → Air Squat, both via an
  // alias — DEC-014) reads as that answer, not one of a dozen near-matches.
  // Plain free-text search only: a set-pick filter or a set being composed is a
  // different question. De-duplicated from the list body so it never shows twice.
  const query = el('search').value.trim();
  const pinned = (!composed && !chosen && query) ? resolvedMovement(query) : undefined;
  const body = pinned ? shown.filter((m) => m.id !== pinned.id) : shown;
  if (pinned) {
    const card = movementCard(pinned);
    card.classList.add('pinned');
    const mark = document.createElement('span');
    mark.className = 'pin-mark';
    mark.textContent = `↳ matches “${query}”`;
    card.insertBefore(mark, card.querySelector('.meta'));
    box.append(card);
  }
  for (const m of body.slice(0, 300 - (pinned ? 1 : 0))) box.append(movementCard(m));

  const scope = chosen ? 'in this set' : el('search').value.trim() ? 'of all movements' : 'of the core set';
  el('palette-count').textContent = shown.length > 300
    ? `${shown.length} ${scope}, showing 300`
    : `${shown.length} ${scope}`;

  const hint = el('compose-hint');
  hint.hidden = !composed;
  if (composed) {
    hint.textContent = `Composing “${composed.name}” — click a movement to add or remove it. Esc when done.`;
  }
  // While composing, the search below the set reads as "add movements to it".
  el('search').placeholder = composed ? `Add movements to “${composed.name}”` : 'Search movements';
  box.scrollTop = keepScroll;
}

/**
 * The set-pick filter dropdown: choose a set to show only its movements.
 * Hidden entirely when signed out (DEC-027 — sets are a signed-in feature).
 */
function renderSets() {
  const pick = el('set-pick');
  if (!currentUser()) { pick.hidden = true; pick.innerHTML = ''; return; }
  pick.hidden = false;
  const was = pick.value;
  pick.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'All movements';
  pick.append(none);
  for (const s of sets.list()) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.mine ? s.name : `${s.name} (library)`;
    pick.append(o);
  }
  pick.value = [...pick.options].some((o) => o.value === was) ? was : '';
}

/**
 * The repertoire: one card per set. Hidden entirely when signed out. A set you
 * do not own (an `org-library` set, or another person's public one) renders
 * read-only — the movement list and `↧` only, no compose / rename / reorder.
 */
function renderSetList() {
  const box = el('set-list');
  box.innerHTML = '';
  const section = el('repertoire');
  if (!currentUser()) { if (section) section.hidden = true; return; }
  if (section) section.hidden = false;
  const all = sets.list();
  el('repertoire-count').textContent = all.length ? `· ${all.length}` : '';
  if (!all.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No sets yet. “New set”, or search then “Save showing”.';
    box.append(p);
    return;
  }
  // The set being composed is the subject of the dialog — float it to the top.
  const ordered = composing
    ? [...all].sort((a, b) => (b.id === composing) - (a.id === composing))
    : all;
  for (const s of ordered) box.append(renderSetCard(s));
}

function renderSetCard(set) {
  const ids = localMovements(set);
  const editable = set.mine;
  const card = document.createElement('details');
  card.className = 'set-card';
  card.classList.toggle('readonly', !editable);
  card.classList.toggle('composing', composing === set.id);
  card.dataset.setId = set.setId;
  card.open = openSets.has(set.id) || composing === set.id;
  card.addEventListener('toggle', () => {
    if (card.open) openSets.add(set.id); else openSets.delete(set.id);
  });

  const summary = document.createElement('summary');
  const label = document.createElement('span');
  label.className = 'set-name';
  label.textContent = set.name;
  if (!editable) {
    const tag = document.createElement('span');
    tag.className = 'set-tag';
    tag.textContent = 'Library';
    label.append(tag);
  }
  const count = document.createElement('span');
  count.className = 'set-n';
  count.textContent = ids.length;
  count.title = `${ids.length} movement${ids.length === 1 ? '' : 's'}`;
  const actions = document.createElement('span');
  actions.className = 'set-actions';

  const act = (glyph, title, fn, { pressed, danger } = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = glyph;
    b.title = title;
    b.setAttribute('aria-label', title);
    if (danger) b.className = 'danger';
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    actions.append(b);
    return b;
  };

  // "Act on this set" — the per-card cluster, ordered edit-first: compose,
  // add-showing, then drop-into-outline, rename, delete. A read-only library
  // set gets only the one action that makes sense on it (drop into outline).
  if (editable) {
    act('＋',
      composing === set.id ? 'Stop composing' : 'Compose — click palette movements to add or remove them',
      () => {
        composing = composing === set.id ? null : set.id;
        if (composing) { el('set-pick').value = ''; openSets.add(set.id); }
        renderSetList();
        renderPalette();
      }, { pressed: composing === set.id });
    act('⊕', 'Add the movements now showing in the palette to this set',
      () => addShowingToSet(set));
  }
  act('↧', 'Add every movement in this set to the outline', () => addSetToOutline(set));
  if (editable) {
    act('✎', 'Rename this set', () => renameSet(set));
    act('✕', 'Delete this set', () => {
      if (!confirm(`Delete the set “${set.name}”? It can be restored by an admin.`)) return;
      openSets.delete(set.id);
      if (composing === set.id) composing = null;
      if (el('set-pick').value === set.id) el('set-pick').value = '';
      editSet(() => sets.remove(set.id));
    }, { danger: true });
  }

  summary.append(label, count, actions);
  card.append(summary);

  const list = document.createElement('ol');
  list.className = 'set-movements';
  if (!ids.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = editable
      ? 'Empty — drag a movement here, or use Compose.'
      : 'Empty.';
    list.append(li);
  }
  ids.forEach((id, i) => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.className = 'mv-name';
    nm.textContent = titleOf(id);
    li.append(nm);
    if (editable) {
      const tools = document.createElement('span');
      tools.className = 'mv-tools';
      const up = document.createElement('button');
      up.type = 'button'; up.textContent = '↑'; up.title = 'Move up'; up.disabled = i === 0;
      up.onclick = () => {
        const a = [...localMovements(set)];
        [a[i - 1], a[i]] = [a[i], a[i - 1]];
        queueMovements(set, a);
      };
      const down = document.createElement('button');
      down.type = 'button'; down.textContent = '↓'; down.title = 'Move down'; down.disabled = i === ids.length - 1;
      down.onclick = () => {
        const a = [...localMovements(set)];
        [a[i + 1], a[i]] = [a[i], a[i + 1]];
        queueMovements(set, a);
      };
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = '✕'; rm.title = 'Remove from this set';
      rm.onclick = () => queueMovements(set, localMovements(set).filter((x) => x !== id));
      tools.append(up, down, rm);
      li.append(tools);
    }
    list.append(li);
  });
  card.append(list);

  if (editable) {
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
      const cur = localMovements(set);
      if (!cur.includes(id)) { openSets.add(set.id); queueMovements(set, [...cur, id]); }
    });
  }

  return card;
}

function renameSet(set) {
  const next = (prompt('Rename set', set.name) ?? '').trim();
  if (!next || next === set.name) return;
  editSet(() => sets.rename(set.id, next));
}

/**
 * Fold the movements the palette is currently showing into a set — the
 * "from the current results" half of composing, the counterpart to the
 * checklist toggle. Order is preserved; movements already in the set are left
 * where they are, new ones are appended.
 */
function addShowingToSet(set) {
  const ids = shownMovements().map((m) => m.id);
  if (!ids.length) return;
  const merged = [...localMovements(set)];
  for (const id of ids) if (!merged.includes(id)) merged.push(id);
  openSets.add(set.id);
  queueMovements(set, merged);
}

/** Drop every movement in a set into the outline as its own line, in order. */
function addSetToOutline(set) {
  const movs = localMovements(set).map((id) => catalogue.find((m) => m.id === id)).filter(Boolean);
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
  // While the modal is open its own `cancel` handler owns Esc (exit compose,
  // else close). This covers the edge case of compose mode outliving a close.
  if (e.key === 'Escape' && composing && !paletteModal.open) {
    composing = null;
    renderSetList();
    renderPalette();
  }
});

el('set-new').onclick = async () => {
  const name = (prompt('Name the new set', 'My set') ?? '').trim();
  if (!name) return;
  try {
    const created = await sets.create({ name, movements: [] });
    openSets.add(created.id);
    composing = created.id;
    el('set-pick').value = '';
  } catch (e) {
    alert(`Could not create that set: ${e.message}`);
  }
  renderRepertoire();
};

el('set-save').onclick = async () => {
  const q = el('search').value.trim();
  const name = (prompt('Name this set', q || 'My set') ?? '').trim();
  if (!name) return;
  const movements = catalogue.filter((m) => matches(m, q)).map((m) => m.id);
  try {
    const created = await sets.create({ name, movements });
    openSets.add(created.id);
  } catch (e) {
    alert(`Could not create that set: ${e.message}`);
  }
  renderRepertoire();
};

el('set-export').onclick = () => {
  // The `movement-sets.json` carrier (DEC-027) — a name-keyed `{ name: [ids] }`
  // map inside `{ format, version, sets }`, the shape Import round-trips.
  const map = {};
  for (const s of sets.list()) map[s.name] = s.movements ?? [];
  const payload = JSON.stringify({ format: 'wdl-movement-sets', version: 1, sets: map }, null, 2);
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
  if (!currentUser()) { alert('Sign in to import sets to your account.'); return; }
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
  // Each entry becomes a *new* set of your own (DEC-027 — the carrier moves a
  // set between accounts; `setId` disambiguates a name clash with `-2`/`-3`).
  let created = 0, skipped = 0, failed = 0;
  for (const [name, ids] of Object.entries(incoming)) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) { skipped++; continue; }
    try {
      await sets.create({ name, movements: [...new Set(ids)] });
      created++;
    } catch {
      failed++;
    }
  }
  await sets.load();
  renderRepertoire();
  alert(`Imported ${created} new set${created === 1 ? '' : 's'}`
    + `${skipped ? `, skipped ${skipped} malformed` : ''}`
    + `${failed ? `, ${failed} failed to save` : ''}.`);
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
 * The rules the workout is measured against — the shipped defaults, and yours.
 *
 * Since the goals database epic ([DEC-028]) both live in the `goals` PocketBase
 * collection, reached through `apps/shared/goals-store.js`: the `global`
 * rulesets (the `examples/goals/*.wdlg` defaults, ingested as ownerless rows —
 * with the bundled files as an offline fallback) and, signed in, your own
 * `Saved` rulesets. `localStorage['wdl.goals']` is retired with no migration;
 * Saved is a signed-in-only feature, like Save to workouts.
 *
 * `Download` still writes the buffer out as a `.wdlg`, the same file
 * `wdl goals --goals` reads. Nothing here is a private format.
 */
let goals = null;
let goalSource = '';

const GLOBAL = 'global:';
const SAVED = 'saved:';

/** Surface a one-off goals error in the block's diagnostics list (cleared by the next parse). */
function showGoalError(message) {
  const li = document.createElement('li');
  const body = document.createElement('span');
  body.className = 'error';
  body.textContent = message;
  li.append(body);
  el('goal-errors').prepend(li);
}

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
  const global = document.createElement('optgroup');
  global.label = 'Global';
  for (const g of goalsStore.globals()) add(GLOBAL + g.goalId, g.title, global);
  if (global.childElementCount) pick.append(global);
  if (currentUser()) {
    const mine = goalsStore.mine();
    if (mine.length) {
      const group = document.createElement('optgroup');
      group.label = 'Saved';
      for (const g of mine) add(SAVED + g.goalId, g.title, group);
      pick.append(group);
    }
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
  const key = value.startsWith(SAVED) ? value.slice(SAVED.length) : value.slice(GLOBAL.length);
  try {
    const entry = await goalsStore.get(key);
    setGoalSource(entry?.source ?? '');
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

// A ruleset's name is its `.wdlg` `goals:` title (DEC-028 — `title` is
// `parseGoals(source).title`), not a prompted label; the collection needs it.
// Signed-in only, like Save to workouts. Re-saving the same title PATCHes the
// row it already resolves to rather than colliding on the unique `goalId`.
el('goal-save').onclick = async () => {
  if (!goalSource.trim()) return;
  if (!currentUser()) { showGoalError('Sign in to save rules to your account.'); return; }
  const title = (parseGoals(goalSource).title ?? '').trim();
  if (!title) { showGoalError('Add a `goals: <name>` header line before saving.'); return; }
  const existing = goalsStore.mine().find((g) => g.title === title);
  try {
    if (existing) {
      await goalsStore.update(existing.id, { title, source: goalSource });
    } else {
      const wait = goalsStore.create({ title, source: goalSource });
      renderGoalPicker();                       // the optimistic row is in the cache now
      await wait;
    }
    const saved = goalsStore.mine().find((g) => g.title === title);
    renderGoalPicker(saved ? SAVED + saved.goalId : '');
  } catch (e) {
    renderGoalPicker('custom');                 // roll the optimistic row back
    showGoalError(`Could not save: ${e.message}`);
  }
};

// The file this writes is the one `wdl goals --goals` reads. Rules drafted here
// are not in a private format; they are the same artifact, earlier.
el('goal-download').onclick = () => {
  if (!goalSource.trim()) return;
  const base = parseGoals(goalSource).title ?? 'goals';
  const name = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'goals';
  const url = URL.createObjectURL(new Blob([goalSource], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.wdlg`;
  a.click();
  URL.revokeObjectURL(url);
};

el('goal-drop').onclick = async () => {
  const value = el('goal-pick').value;
  if (!value.startsWith(SAVED)) return;
  const entry = goalsStore.mine().find((g) => g.goalId === value.slice(SAVED.length));
  if (!entry || !confirm(`Delete the rules "${entry.title}"? It can be restored by an admin.`)) return;
  try {
    await goalsStore.remove(entry.id);
  } catch (e) {
    showGoalError(`Could not delete: ${e.message}`);
    return;
  }
  renderGoalPicker('');
  setGoalSource('');
};

// --- accounts: sign in, Workouts menu, sharing -----------------------------
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

// --- search over own + public workouts (task L4, DEC-021) -------------------
// A debounced search box in the My-workouts panel. Non-empty query → the panel
// shows `searchWorkouts` hits (own + any public, each labelled whose) instead
// of the plain list; cleared → the plain list is back.

/** `null` while not searching; otherwise `[{ rec, label }]` for the last query. */
let mineSearchResults = null;
/** The live query string, kept so a panel re-render doesn't drop it. */
let mineSearchQuery = '';
/** Monotonic token — a slow search that resolves after a newer one is discarded. */
let mineSearchSeq = 0;
let mineSearchTimer = null;
/** The one persistent <input> node — re-appended (not rebuilt) so focus survives. */
let mineSearchInput = null;

function getMineSearchInput() {
  if (mineSearchInput) return mineSearchInput;
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'mine-search';
  input.placeholder = 'Search workouts by name or @id…';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = mineSearchQuery;
  input.oninput = () => onMineSearchInput(input.value);
  mineSearchInput = input;
  return input;
}

function onMineSearchInput(value) {
  mineSearchQuery = value;
  clearTimeout(mineSearchTimer);
  const term = value.trim();
  if (!term) {
    mineSearchResults = null;
    mineSearchSeq++; // cancel any in-flight resolve
    if (mineNote.startsWith('Search')) mineNote = '';
    renderMinePanel();
    return;
  }
  mineSearchTimer = setTimeout(() => runMineSearch(term), 220);
}

async function runMineSearch(term) {
  const seq = ++mineSearchSeq;
  try {
    const hits = await searchWorkouts(term);
    if (seq !== mineSearchSeq) return;
    const me = currentUser()?.id;
    const labelled = await Promise.all(hits.map(async (rec) => {
      if (rec.owner === me) return { rec, label: 'mine', mine: true };
      const h = await getHandle(rec.owner);
      return { rec, label: h ? `@${h}` : 'public', mine: false };
    }));
    if (seq !== mineSearchSeq) return;
    mineSearchResults = labelled;
    if (mineNote.startsWith('Search')) mineNote = '';
  } catch (e) {
    if (seq !== mineSearchSeq) return;
    mineSearchResults = [];
    mineNote = `Search failed: ${e.message}`;
  }
  renderMinePanel();
}

/**
 * Load a fetched workout row into the editor, making the one attach-vs-detach
 * call the builder makes everywhere: a row the signed-in user owns **attaches**
 * (`openWorkout` set, Save updates it); anyone else's — or any row while signed
 * out — opens as a **detached editable copy** (`openWorkout = null`, so the
 * first Save creates a fresh row re-namespaced to the user's handle by
 * `pocketbase.js`, the DEC-021 copy flow, no fork concept). Shared by the
 * *Workouts* panel's search hits (`openFoundWorkout`) and the board's Edit
 * round-trip (`?w=` on load, in the bootstrap).
 */
function openRecord(rec, mine) {
  lines = (rec.source || '').replace(/\n$/, '').split('\n');
  if (!lines.length) lines = [''];
  openWorkout = mine ? { id: rec.id, title: rec.title, visibility: rec.visibility } : null;
  focused = null;
  mineNote = mine
    ? ''
    : `Opened ${rec.wdlId || rec.title || 'workout'} — a read-only copy; Save makes it yours.`;
  el('mine').open = false;
  render();
  renderMinePanel();
}

/**
 * Open a search hit into the editor — `openRecord` with the hit's precomputed
 * `mine` flag (`rec.owner === currentUser()?.id`, set in `runMineSearch`).
 */
function openFoundWorkout(hit) {
  openRecord(hit.rec, hit.mine);
}

/**
 * Open a public workout on the board in a new tab, addressed by its `wdlId`
 * (`<handle>:<slug>`) — `getByAnyId` resolves that there — falling back to the
 * record id for a row without one. The builder header's *Open on the board ↗*
 * covers the *current buffer* (via the `#<source>` hash); this is the per-row
 * shortcut for a workout you have not opened.
 */
function openHitOnBoard(rec) {
  const key = rec.wdlId || rec.id;
  window.open(`../display/?w=${encodeURIComponent(key)}`, '_blank', 'noopener');
}

/**
 * A list of search hits. Each row: the title, an owner label, an `↗` "open on
 * the board" shortcut, and click-to-open into the editor (`openFoundWorkout` —
 * your own attaches, a public one opens as a detached read-only copy, the
 * DEC-021 copy flow).
 */
function renderHitList(hits, emptyMessage) {
  const list = document.createElement('div');
  list.className = 'mine-list';
  if (!hits.length) {
    list.append(hintP(emptyMessage));
    return list;
  }
  for (const hit of hits) {
    const row = document.createElement('div');
    row.className = 'mine-row';
    if (hit.mine && openWorkout?.id === hit.rec.id) row.classList.add('current');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'mine-open';
    const title = document.createElement('span');
    title.className = 'mine-title';
    title.textContent = hit.rec.title || hit.rec.wdlId || 'Untitled workout';
    const who = document.createElement('span');
    who.className = 'mine-label';
    if (hit.mine) who.classList.add('is-mine');
    who.textContent = hit.label;
    open.append(title, who);
    open.onclick = () => openFoundWorkout(hit);

    row.append(open, iconBtn('↗', 'Open on the board', () => openHitOnBoard(hit.rec)));
    list.append(row);
  }
  return list;
}

function renderSearchResults() {
  return renderHitList(mineSearchResults, 'No matches.');
}

// --- the Libraries chip row (task V2, DEC-021) -----------------------------
// The three curated org accounts own the L5/L6 benchmark library. A chip is
// pure sugar over the search box above: it types `<handle>:` into the field and
// lets the normal debounced `searchWorkouts` path run (the filter matches a
// `wdlId~` substring, so `crossfit:` returns exactly that namespace). No
// separate `listOrgWorkouts` fetch. The accounts ship as a constant rather than
// being discovered — the real PocketBase `users` list rule
// (`id = @request.auth.id`) resolves an org row for nobody, and the handles
// never change.
const ORG_ACCOUNTS = [
  { handle: 'crossfit', label: 'CrossFit' },
  { handle: 'hyrox', label: 'Hyrox' },
  { handle: 'tabata', label: 'Tabata' },
];

/** True when the live query is exactly `<handle>:` — the chip's lit state. */
const libraryChipActive = (handle) =>
  mineSearchQuery.trim().toLowerCase() === `${handle}:`;

/** The "Libraries" chip row — one chip per curated org; a click fills the
 *  search box with `<handle>:` (re-click or clearing the box returns to the
 *  plain saved list). The `.mine-examples` / `.examples-label` class names are
 *  L7's and stay — only the label the reader sees changed. */
function renderLibrariesRow() {
  const row = document.createElement('div');
  row.className = 'menu-row mine-examples';
  const label = document.createElement('span');
  label.className = 'examples-label';
  label.textContent = 'Libraries';
  row.append(label);
  for (const org of ORG_ACCOUNTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mine-chip';
    if (libraryChipActive(org.handle)) chip.classList.add('active');
    chip.textContent = org.label;
    chip.title = `Search @${org.handle}'s library`;
    chip.onclick = () => {
      const input = getMineSearchInput();
      input.value = libraryChipActive(org.handle) ? '' : `${org.handle}:`;
      onMineSearchInput(input.value);
    };
    row.append(chip);
  }
  return row;
}

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
    mineSearchResults = null;
    mineSearchQuery = '';
    mineSearchInput = null;
    sets.clear();
    goalsStore.clearMine();
    composing = null;
    openSets.clear();
    renderIdentity();
    renderMinePanel();
    renderRepertoire();
    renderGoalPicker();
  };
  box.append(who, renderHandle(user), out);
}

/**
 * The `@handle` shown beside the signed-in identity, with an edit affordance
 * (task L1, DEC-021). `user.handle` is briefly absent right after a first
 * sign-in — `ensureHandle()` in `pocketbase.js` is assigning one — so that
 * state reads as "assigning a handle…" rather than a blank space.
 */
function renderHandle(user) {
  const wrap = document.createElement('span');
  wrap.className = 'handle';
  if (!user.handle) {
    wrap.classList.add('pending');
    wrap.textContent = 'assigning a handle…';
    return wrap;
  }
  const label = document.createElement('span');
  label.className = 'handle-label';
  label.title = 'Your handle — the @id namespace for workouts you save';
  label.textContent = `@${user.handle}`;
  wrap.append(label, iconBtn('✎', 'Change handle', () => startEditHandle(wrap, user)));
  return wrap;
}

function startEditHandle(wrap, user) {
  wrap.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'handle-input';
  input.value = user.handle || '';
  input.maxLength = 63;
  input.spellcheck = false;

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'handle-btn';
  save.textContent = 'Save';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'handle-btn';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => renderIdentity();

  const error = document.createElement('div');
  error.className = 'handle-error';

  const commit = async () => {
    const next = input.value.trim().toLowerCase();
    if (next === user.handle) return renderIdentity();
    save.disabled = true;
    error.textContent = '';
    try {
      await updateHandle(next);
      renderIdentity();
    } catch (e) {
      save.disabled = false;
      error.textContent = e.message;
    }
  };
  save.onclick = commit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel.onclick(); }
  };

  wrap.append(input, save, cancel, error);
  input.focus();
  input.select();
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
  // `innerHTML = ''` blurs the search box; refocus it below if it was active.
  const searchWasActive = mineSearchInput && document.activeElement === mineSearchInput;
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

  panel.append(getMineSearchInput());
  if (searchWasActive) {
    const n = mineSearchInput.value.length;
    mineSearchInput.focus();
    mineSearchInput.setSelectionRange(n, n);
  }
  panel.append(renderLibrariesRow());

  if (mineNote) panel.append(hintP(mineNote));
  if (openWorkout) panel.append(renderShareRow());

  if (mineSearchResults !== null) {
    panel.append(renderSearchResults());
    return;
  }

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
  if (!confirm(`Delete “${w.title || 'Untitled workout'}”? It can be restored by an admin.`)) return;
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

// X1: the DB movement list, layered over the static curated file once both file
// loads have settled (so `curatedMovements` / `catalogue` are populated to merge
// into). Fetched now, in parallel with the files, so a slow `/api` never blanks
// the palette the files already filled. `/api` absent or failing → keep the
// file-only list, with `inDb:false` stamped for X2 / X3. See `applyDbLayer`.
const dbMovements = listMovements().catch((e) => {
  console.warn('no /api movement list — palette shows the static files only:', e.message);
  return null;
});
Promise.all([curated, analysis, dbMovements]).then(([, , rows]) => {
  if (Array.isArray(rows)) applyDbLayer(rows);
  else markStaticProvenance();
});

renderGoalPicker();
renderSets();
renderSetList();
curated.finally(render);

// The Global rulesets come from the `goals` collection, with the bundled
// `.wdlg` files as the offline fallback; select the first once it resolves, and
// load + check it once the muscle data is in too (the check needs both).
const goalsReady = goalsStore.loadGlobal()
  .then(() => renderGoalPicker(GLOBAL + (goalsStore.globals()[0]?.goalId ?? '')))
  .catch(() => {});
Promise.all([analysis.catch(() => {}), goalsReady])
  .then(() => el('goal-pick').dispatchEvent(new Event('change')));

// Accounts: paint the signed-out state immediately (a stored token, if any, is
// still unverified), then revalidate it against the server and, if it holds,
// pull the workout list.
renderIdentity();
renderMinePanel();

// `?w=<id|handle:slug>` — the board's "Edit in builder" round-trip. Load that
// saved workout into the editor once auth is settled (the attach-vs-detached
// call needs `currentUser()`), degrading to the default buffer with a warning
// on a failed fetch the way the registry loads above do. `?w=` is left in the
// address bar untouched, so a reload re-loads the same row.
const wParam = new URLSearchParams(location.search).get('w');

refreshAuth().then(async (user) => {
  renderIdentity();
  if (user) {
    refreshMineList().then(renderMinePanel);
    sets.load().then(renderRepertoire).catch(() => {});
    goalsStore.loadMine().then(() => renderGoalPicker()).catch(() => {});
  }
  if (wParam) {
    try {
      const rec = await getByAnyId(wParam);
      openRecord(rec, rec.owner === currentUser()?.id);
    } catch (e) {
      console.warn(`?w=${wParam}: could not load that workout —`, e.message);
    }
  }
});
