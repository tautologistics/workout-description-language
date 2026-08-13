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

const REGISTRY = '../../registry/movements.json';
const CANONICAL = '../../registry/movements.canonical.json';
const MUSCLES = '../../registry/muscles.json';
const GOALS = ['rotate-muscles.wdlg', 'ramp-the-pull.wdlg'];
const el = (id) => document.getElementById(id);

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

  const dl = document.createElement('dl');
  const rows = [
    ['title', workout.title ?? '—'],
    ['cues', `${laid.cues.length}${laid.loops ? ' per pass' : ''}`],
    ['duration', laid.totalSeconds !== undefined
      ? `${Math.floor(laid.totalSeconds / 60)}:${String(Math.round(laid.totalSeconds % 60)).padStart(2, '0')}`
      : 'athlete-paced'],
    ...(laid.window ? [['window', `${laid.window / 60} min`]] : []),
    ...(laid.loops ? [['repeats', 'until the clock stops']] : []),
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  summary.append(dl);

  const steps = document.createElement('div');
  steps.className = 'steps';
  for (const cue of laid.cues.slice(0, 24)) {
    const row = document.createElement('div');
    row.className = `cue ${cue.kind}`;
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
let sets = JSON.parse(localStorage.getItem('wdl.sets') || '{}');

const matches = (m, q) => {
  if (!q) return m.core;
  const hay = `${m.title} ${(m.pattern ?? []).join(' ')} ${(m.equipment ?? []).join(' ')} `
    + `${(m.muscles?.primary ?? []).join(' ')} ${(m.aliases ?? []).join(' ')}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
};

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
  el('palette-count').textContent = shown.length > 300
    ? `${shown.length} movements, showing 300`
    : `${shown.length} movement${shown.length === 1 ? '' : 's'}`;
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
let goals = null;

function renderFindings() {
  const list = el('findings');
  list.innerHTML = '';
  const say = (severity, message) => {
    const li = document.createElement('li');
    const body = document.createElement('span');
    body.className = severity;
    body.textContent = message;
    li.append(body);
    list.append(li);
  };

  if (!goals) return say('warning', 'no goals loaded');
  if (!has('canonicalMovements') || !has('muscles')) {
    return say('warning', 'no muscle data loaded — nothing can be checked');
  }
  let report;
  try {
    report = check(compile(parse(text()).workout), goals);
  } catch (e) {
    return say('error', `cannot check: ${e.message}`);
  }
  if (report.unresolved.length) {
    say('warning', `no muscle data for ${report.unresolved.join(', ')} — invisible to every rule`);
  }
  if (report.unbounded) say('warning', 'open-ended: the amounts below are floors');
  if (!report.findings.length) return say('ok', 'every rule satisfied');
  for (const f of report.findings) {
    say('error', `${f.rule}: ${f.message}${f.count > 1 ? `  (×${f.count})` : ''}`);
  }
}

el('goal-pick').addEventListener('change', async () => {
  const name = el('goal-pick').value;
  if (!name) { goals = null; return renderFindings(); }
  try {
    const r = await fetch(new URL(`../../examples/goals/${name}`, location.href));
    goals = parseGoals(await r.text());
  } catch (e) {
    goals = null;
    console.warn('no goals:', e.message);
  }
  renderFindings();
});

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
    renderPalette();
    renderFindings();
  })
  .catch((e) => {
    console.warn('no analysis data:', e.message);
    el('palette-count').textContent = 'movement data unavailable';
  });

for (const name of GOALS) {
  const o = document.createElement('option');
  o.value = name;
  o.textContent = name.replace(/\.wdlg$/, '').replace(/-/g, ' ');
  el('goal-pick').append(o);
}
const none = document.createElement('option');
none.value = '';
none.textContent = 'no goals';
el('goal-pick').prepend(none);
el('goal-pick').value = GOALS[0];

renderSets();
curated.finally(render);
analysis.then(() => el('goal-pick').dispatchEvent(new Event('change')));
