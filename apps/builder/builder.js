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
import { format } from '../../build/web/core/format.js';
import { compile } from '../../build/web/core/timeline.js';
import { validate } from '../../build/web/core/validate.js';
import { run, roundLabel } from '../../build/web/core/run.js';
import { provide, has } from '../../build/web/core/env.js';
import { parseGoals, check } from '../../build/web/core/goals.js';

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
/** Which line the caret was on, so a redraw does not steal focus back to the top. */
let focused = null;

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
  renderFindings();
  const link = el('board');
  link.href = `../display/#${encodeURIComponent(text())}`;
}

function renderOutline() {
  const outline = el('outline');
  outline.innerHTML = '';
  const parsed = parse(text());
  const badLines = new Set(parsed.errors.map((e) => e.line));

  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const node = document.createElement('div');
      node.className = 'node';
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
      const input = document.createElement('input');
      input.className = 'line';
      input.value = logicalText(lines, n.line);
      input.setAttribute('list', 'movements');
      input.dataset.line = String(n.line);
      input.addEventListener('input', () => {
        // The indent is structure, and the outline is not where you change it —
        // that is what indent and outdent are for. `replaceLogical` keeps it.
        lines = replaceLogical(lines, n.line, input.value);
        el('text').value = text();
        renderReading();
        renderFindings();
      });
      input.addEventListener('change', () => render(n.line));
      input.addEventListener('focus', () => { focused = n.line; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); insert(n.line, ''); }
        if (e.key === 'Tab' && !e.shiftKey && input.selectionStart === input.value.length) {
          e.preventDefault(); shift(n.line, 2);
        }
      });

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
      node.draggable = true;
      node.dataset.line = String(n.line);
      node.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'INPUT') return e.preventDefault();   // let text select
        e.dataTransfer.setData('text/wdl-line', String(n.line));
        e.dataTransfer.effectAllowed = 'move';
        node.classList.add('dragging');
      });
      node.addEventListener('dragend', () => node.classList.remove('dragging'));
      node.addEventListener('dragover', (e) => {
        if (!dragKind(e)) return;
        e.preventDefault();
        const half = e.offsetY < node.offsetHeight / 2 ? 'before' : 'after';
        node.dataset.drop = half;
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
          moveTo(Number(e.dataTransfer.getData('text/wdl-line')), n.line, where);
        } else {
          // A palette drop lands beside what it was dropped on, not inside it.
          const anchor = where === 'before' ? previousSibling(n.line) : n.line;
          insert(anchor, e.dataTransfer.getData('text/wdl-movement'));
        }
      });

      node.append(rails, input, tools);
      outline.append(node);
      walk(n.children, depth + 1);
    }
  };

  walk(readLines(text()), 0);

  const restore = outline.querySelector(`input[data-line="${focused}"]`);
  if (restore && document.activeElement?.tagName !== 'TEXTAREA') {
    restore.focus();
    restore.setSelectionRange(restore.value.length, restore.value.length);
  }
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
  const dl = document.createElement('dl');
  const rows = [
    ['title', workout.title ?? '—'],
    ['cues', `${laid.cues.length}${laid.loops ? ' per pass' : ''}`],
    // A window is a clock you are racing; a duration is how long the work will
    // take. Reusing one label for both, and then printing the window beside it
    // in a different format, made an AMRAP look like it still had the for-time
    // reading stuck to it — the same number twice, under a word that had
    // quietly changed meaning.
    //
    // A cap is the third of those, and it had been wearing the second's label:
    // `duration 12:00` on a capped for-time reads as *this takes twelve
    // minutes*, when what it says is *this is over by twelve minutes*. The
    // number is the same and the sentence is not, so it gets its own word.
    ...(laid.window
      ? [['clock', clock(laid.window)]]
      : laid.maxSeconds !== undefined
      ? [['cap', `at most ${clock(laid.maxSeconds)}`]]
      : [['duration', laid.totalSeconds !== undefined ? clock(laid.totalSeconds) : 'athlete-paced']]),
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

  const steps = document.createElement('div');
  steps.className = 'steps';
  // A cue inside a cycle comes round again, and the list is the only place that
  // is visible at a glance — the summary line says which cues repeat, but
  // counting to them is work the reader should not have to do.
  const cycleOf = (i) => laid.cycles.find((c) => i >= c.from && i < (c.to ?? laid.cues.length));
  for (const cue of laid.cues.slice(0, 24)) {
    const cycle = cycleOf(cue.index);
    const row = document.createElement('div');
    row.className = `cue ${cue.kind}${cycle ? ' looping' : ''}`;
    if (cycle) {
      if (cue.index === cycle.from) row.classList.add('cycle-start');
      if (cue.index === (cycle.to ?? laid.cues.length) - 1) row.classList.add('cycle-end');
    }
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(cue.index + 1);
    const label = document.createElement('span');
    const round = roundLabel(cue.rounds);
    label.textContent = round ? `${cue.label}  ·  ${round}` : cue.label;
    row.append(n, label);
    steps.append(row);
  }
  if (laid.cues.length > 24) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `…and ${laid.cues.length - 24} more`;
    steps.append(more);
  }
  summary.append(steps);

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

// --- wiring ------------------------------------------------------------------

el('text').addEventListener('input', () => {
  lines = el('text').value.replace(/\n$/, '').split('\n');
  focused = null;
  renderOutline();
  renderReading();
  renderFindings();
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
  render();
});

for (const b of document.querySelectorAll('[data-add]')) {
  b.onclick = () => insert(focused, {
    step: '- 10 Movement',
    rest: 'rest 60s',
    block: '5 rounds:',
  }[b.dataset.add]);
}

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  lines = (await file.text()).replace(/\n$/, '').split('\n');
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
 * A "set" is whatever is showing, saved under a name. That is deliberately not a
 * new file format — it is a working preference, not something a workout depends
 * on, and inventing an artifact for it would mean inventing a grammar, a parser
 * and a place for it to live before knowing whether anyone wants one.
 */
let catalogue = [];
let vocabulary = [];
let sets = JSON.parse(localStorage.getItem('wdl.sets') || '{}');
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

function renderPalette() {
  const box = el('palette');
  const q = el('search').value.trim();
  const chosen = sets[el('set-pick').value];
  const shown = chosen
    ? catalogue.filter((m) => chosen.includes(m.id))
    : catalogue.filter((m) => matches(m, q));

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

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.title;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = (m.muscles?.primary ?? []).slice(0, 3).join(' ');
    item.append(name, meta);

    // Click adds where you were last working, which is what "add this" means
    // when the caret is somewhere. Dragging says where explicitly.
    item.onclick = () => insert(focused, lineFor(m));
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/wdl-movement', lineFor(m));
      e.dataTransfer.effectAllowed = 'copy';
    });
    box.append(item);
  }
  const scope = chosen ? 'in this set' : el('search').value.trim() ? 'of all movements' : 'of the core set';
  el('palette-count').textContent = shown.length > 300
    ? `${shown.length} ${scope}, showing 300`
    : `${shown.length} ${scope}`;
}

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

el('search').addEventListener('input', () => { el('set-pick').value = ''; renderPalette(); });
el('set-pick').addEventListener('change', renderPalette);
el('muscle-clear').onclick = () => {
  chosenMuscles.clear();
  renderMuscleChips();
  renderPalette();
};

el('set-save').onclick = () => {
  const q = el('search').value.trim();
  const name = prompt('Name this set', q || 'My set');
  if (!name) return;
  sets[name] = catalogue.filter((m) => matches(m, q)).map((m) => m.id);
  localStorage.setItem('wdl.sets', JSON.stringify(sets));
  renderSets();
  el('set-pick').value = name;
  renderPalette();
};

el('set-drop').onclick = () => {
  const name = el('set-pick').value;
  if (!name || !confirm(`Delete the set "${name}"?`)) return;
  delete sets[name];
  localStorage.setItem('wdl.sets', JSON.stringify(sets));
  renderSets();
  renderPalette();
};

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
    const list = el('movements');
    for (const m of data.movements) {
      const option = document.createElement('option');
      option.value = `- 10 ${m.title}`;
      option.label = m.title;
      list.append(option);
    }
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
    renderFindings();
  })
  .catch((e) => {
    console.warn('no analysis data:', e.message);
    el('palette-count').textContent = 'movement data unavailable';
  });

renderGoalPicker(EXAMPLE + GOALS[0]);
renderSets();
curated.finally(render);
analysis.then(() => el('goal-pick').dispatchEvent(new Event('change')));
