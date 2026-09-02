/**
 * A reusable form over one movement's curated fields — queue task M5, DEC-020.
 *
 * The curated movement layer now lives in a PocketBase `movements` collection
 * (`deploy/pocketbase/pb_migrations/1756800000_create_movements.js`), one column
 * per per-movement field in `registry/movements.json`. This widget edits one
 * such row and writes it back over `/api` — `POST` a new movement, `PATCH` an
 * existing one — always at `scope: "global"` (Phase 1 is global, admin-edited
 * movements only). It is the "one-at-a-time create/edit while building a
 * workout" surface the CSV curation flow was too coarse for (see
 * `docs/context/topics/builder-ux.md` "Accounts, IDs and layout").
 *
 * **Host-agnostic on purpose.** It touches no builder globals: the caller hands
 * it a container element, the three `/api` functions it needs, an optional
 * starting record, and an `onSaved` callback. So the same widget drops into a
 * standalone admin page or the board later with no edit here — the builder is
 * just its first consumer.
 *
 * **Enum controls validate against the registry vocabularies** spelled out in
 * `packages/core/src/fold.ts` (`MovementEntry`) and
 * `scripts/import-movement-curation.mjs`:
 *   force              push | pull | static
 *   mechanic           compound | isolation
 *   load               total | per-implement
 *   defaultLaterality  both | split | per-side
 *   lateralityAxis     arm | leg | side | hand | direction
 *   laterality         subset of { both, split, per-side }   (multi)
 *   measures           subset of { distance, calories }       (multi)
 * A `<select>` only offers its vocabulary plus an explicit "— unset —"; a value
 * outside it is never sent (and is defensively dropped in `collect()`).
 *
 * **Record shape written** mirrors `scripts/movements-to-db.mjs` (M3) so an M4
 * dump round-trips: the nine json fields pass shape-for-shape, the scalars map
 * straight, `scope: "global"`, `user` untouched. A field left empty is omitted
 * on create and cleared on update (json → `null`, scalar → `""`), exactly as M3
 * does, and `source` / `user` / timestamps are never written by this form.
 *
 * **The seven list fields are token inputs** (V5, 2026-09-02) — `aliases`,
 * `equipment`, `pattern`, `related`, `sameAs` and the two muscle lists render
 * `apps/shared/token-input.js` (chips + type-ahead + a filter/select picker)
 * instead of the comma-separated `<input>`s they shipped as. `collect()` emits
 * the same arrays it always did, so the request body, the write path and both
 * cross-field validations are untouched. Vocabularies come from
 * `apps/shared/vocab.js` — equipment and patterns fetched from `/api` with a
 * bundled offline fallback (V8), muscles from `registry/muscles.json` — except
 * `related` / `sameAs`, which type-ahead over whatever movement ids the host
 * passes in `opts.vocab`: the editor holds no movement list of its own, and
 * stays host-agnostic by asking for one rather than reaching for it.
 *
 * No `packages/core` change, no grammar/spec change, no registry-file write —
 * this is DB-only, same as M3.
 */

import { createTokenInput } from './token-input.js';
import { equipmentVocab, patternVocab, muscleIds } from './vocab.js';

/** json (array/object) columns — order matches the M1 migration + M3 script. */
const LIST_FIELDS = ['aliases', 'equipment', 'pattern', 'related', 'sameAs'];
/** Single-value enum columns and their exact vocabularies. */
const ENUMS = {
  force: ['push', 'pull', 'static'],
  mechanic: ['compound', 'isolation'],
  load: ['total', 'per-implement'],
  defaultLaterality: ['both', 'split', 'per-side'],
  lateralityAxis: ['arm', 'leg', 'side', 'hand', 'direction'],
};
/** Multi-value enum columns (a small checkbox group each). */
const MULTIS = {
  laterality: ['both', 'split', 'per-side'],
  measures: ['distance', 'calories'],
};
/**
 * The fields rendered as token inputs, and how each one behaves. `vocab` is the
 * default source; `opts.vocab[name]` overrides it, which is how the host feeds
 * `related` / `sameAs` the movement ids it already has in memory.
 *
 * `allowCustom` is false only for the two muscle fields: that vocabulary is
 * closed — the body map has one path per id and the registry build fails on
 * anything else — so an unrecognised muscle is a typo, not a new term. The
 * others are open, because a curator meeting a new implement should not have to
 * wait for a vocabulary release to write it down.
 */
const TOKEN_FIELDS = {
  aliases: { allowCustom: true, vocab: () => [], placeholder: 'type a name, Enter to add' },
  equipment: { allowCustom: true, vocab: equipmentVocab, placeholder: 'type or browse' },
  pattern: { allowCustom: true, vocab: patternVocab, placeholder: 'type or browse' },
  related: { allowCustom: true, vocab: () => [], placeholder: 'type a movement id' },
  sameAs: { allowCustom: true, vocab: () => [], placeholder: 'type a movement id' },
  musclesPrimary: { allowCustom: false, vocab: muscleIds, placeholder: 'type or browse' },
  musclesSecondary: { allowCustom: false, vocab: muscleIds, placeholder: 'type or browse' },
};

/** A readable-slug id: lowercase alphanumerics joined by single hyphens.
 *  Matches how registry ids look (`dumbbell-snatch`, `3-4-sit-up`, `90-90-hamstring`). */
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const h = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
};

/**
 * Normalise whatever the caller passed as `record` to the field set this form
 * edits. Accepts a PocketBase record (`{ id, movementId, … }`), a registry
 * entry (`{ id, title, … }`), or `null` (create mode).
 */
function readRecord(record) {
  if (!record) return { mode: 'create', pbId: null, movementId: '', fields: {} };
  const isPb = 'movementId' in record;
  const movementId = isPb ? record.movementId : record.id;
  const fields = {};
  for (const k of LIST_FIELDS) fields[k] = Array.isArray(record[k]) ? record[k] : [];
  for (const k of Object.keys(ENUMS)) fields[k] = typeof record[k] === 'string' ? record[k] : '';
  for (const k of Object.keys(MULTIS)) fields[k] = Array.isArray(record[k]) ? record[k] : [];
  fields.implements = Number.isFinite(record.implements) ? record.implements
    : record.implements ? Number(record.implements) : null;
  fields.title = record.title ?? '';
  fields.muscles = (record.muscles && typeof record.muscles === 'object') ? record.muscles : null;
  return { mode: 'edit', pbId: isPb ? record.id : null, movementId, fields };
}

/** A saved PocketBase record → the registry-entry shape a host keeps in memory. */
export function movementRecordToEntry(rec) {
  const entry = { id: rec.movementId, title: rec.title ?? '' };
  for (const k of [...LIST_FIELDS, ...Object.keys(MULTIS)]) {
    if (Array.isArray(rec[k]) && rec[k].length) entry[k] = rec[k];
  }
  if (rec.muscles && typeof rec.muscles === 'object' && Object.keys(rec.muscles).length) {
    entry.muscles = rec.muscles;
  }
  for (const k of Object.keys(ENUMS)) if (rec[k]) entry[k] = rec[k];
  if (rec.source) entry.source = rec.source;
  const impl = Number(rec.implements);
  if (Number.isInteger(impl) && impl > 0) entry.implements = impl;
  return entry;
}

/**
 * Mount the editor into `container`.
 *
 * @param {object}   opts
 * @param {Element}  opts.container   element the form's DOM is scoped to (cleared on mount)
 * @param {object|null} [opts.record] starting record — PB record, registry entry, or null to create
 * @param {object}   opts.api         { createMovement(fields), updateMovement(pbId, patch), getMovementByMovementId(id) }
 * @param {object}   [opts.vocab]     per-token-field vocabulary overrides, keyed by field name
 *                                    (`equipment`, `pattern`, `related`, `sameAs`, `musclesPrimary`,
 *                                    `musclesSecondary`, `aliases`) — each a `string[]` or a function
 *                                    returning one, possibly async. Anything not given falls back to
 *                                    `TOKEN_FIELDS`, so a host that passes nothing still works.
 * @param {object}   [opts.onCreateTerm] per-token-field "＋ new term" handlers, keyed by field name —
 *                                    each `async ({ termId, name }) => void`. Only the fields the host
 *                                    supplies get the affordance; the builder wires `equipment` /
 *                                    `pattern` for an admin (V9) and nothing else.
 * @param {Function} [opts.onSaved]   called with the saved record in registry-entry shape
 * @param {Function} [opts.onCancel]  called when the user cancels
 * @returns {{ destroy(): void, focus(): void }}
 */
export function createMovementEditor({ container, record = null, api, vocab = {}, onCreateTerm = {}, onSaved, onCancel }) {
  const state = readRecord(record);
  container.innerHTML = '';

  const controls = {};
  const errorBox = h('ul', { class: 'me-errors', hidden: true });
  const status = h('p', { class: 'me-status', hidden: true });

  /**
   * A field whose control is a single `<input>` / `<select>`. The `<label>`
   * wrapper is what makes the caption click through to it.
   */
  const field = (label, control, hint) => h(
    'label', { class: 'me-field' },
    h('span', { class: 'me-label', text: label }),
    control,
    hint ? h('span', { class: 'me-hint', text: hint }) : null,
  );

  /**
   * A field whose control holds a *group* of inputs — the checkbox groups, and
   * every token input.
   *
   * **Any control containing more than one input must use this, not `field()`.**
   * A `<label>` labels only its first labelable descendant, so a `<label>`
   * wrapper turns the caption into a control for whichever input happens to be
   * first: clicking the words "COUNTING MODES" ticked `both`, and "MEASURED
   * OUTPUT" ticked `distance` (found 2026-09-02, fixed here in V5). Stated as
   * the rule rather than as the two fields that broke, because the next grouped
   * field added to this form inherits the bug otherwise — same shape of mistake
   * as *A CSS rule with a `display` silently overrules `hidden`* in
   * `docs/context/topics/lessons-learned.md`.
   *
   * A `<div role="group" aria-labelledby>` names the set for assistive tech
   * without binding the caption to any one member of it.
   */
  let groupSeq = 0;
  const group = (label, control, hint) => {
    const capId = `me-g${++groupSeq}`;
    return h(
      'div', { class: 'me-field', role: 'group', 'aria-labelledby': capId },
      h('span', { class: 'me-label', id: capId, text: label }),
      control,
      hint ? h('span', { class: 'me-hint', text: hint }) : null,
    );
  };

  // --- movementId + title -------------------------------------------------
  controls.movementId = h('input', {
    type: 'text', class: 'me-input', value: state.movementId,
    autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
    readOnly: state.mode === 'edit',
  });
  controls.title = h('input', {
    type: 'text', class: 'me-input', value: state.fields.title ?? '',
    autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
  });

  // --- enum <select>s ---------------------------------------------------
  for (const [name, vocab] of Object.entries(ENUMS)) {
    const sel = h('select', { class: 'me-select' }, h('option', { value: '', text: '— unset —' }));
    for (const v of vocab) sel.append(h('option', { value: v, text: v }));
    sel.value = vocab.includes(state.fields[name]) ? state.fields[name] : '';
    controls[name] = sel;
  }

  // --- multi checkbox groups -----------------------------------------
  const multiGroups = {};
  for (const [name, vocab] of Object.entries(MULTIS)) {
    const chosen = new Set(state.fields[name] ?? []);
    const boxes = vocab.map((v) => {
      const cb = h('input', { type: 'checkbox', value: v, checked: chosen.has(v) });
      return { v, cb, label: h('label', { class: 'me-check' }, cb, h('span', { text: v })) };
    });
    multiGroups[name] = boxes;
    controls[name] = h('div', { class: 'me-checks' }, ...boxes.map((b) => b.label));
  }

  // --- implements -----------------------------------------------------
  controls.implements = h('input', {
    type: 'number', class: 'me-input me-num', min: '1', step: '1',
    value: state.fields.implements != null ? String(state.fields.implements) : '',
  });

  // --- the seven token inputs (V5) -----------------------------------
  // The five json list columns plus the two muscle lists. Each is a
  // `createTokenInput` — chips + type-ahead + a filter/select picker — mounted
  // into its own container so `collect()` can read the value back and
  // `destroy()` can tear it down.
  const m0 = state.fields.muscles ?? {};
  const startValue = {
    ...Object.fromEntries(LIST_FIELDS.map((k) => [k, state.fields[k] ?? []])),
    musclesPrimary: Array.isArray(m0.primary) ? m0.primary : [],
    musclesSecondary: Array.isArray(m0.secondary) ? m0.secondary : [],
  };
  const tokens = {};
  for (const [name, spec] of Object.entries(TOKEN_FIELDS)) {
    const host = h('div', { class: 'me-tokens' });
    controls[name] = host;
    tokens[name] = createTokenInput({
      container: host,
      value: startValue[name],
      vocab: vocab[name] ?? spec.vocab,
      allowCustom: spec.allowCustom,
      placeholder: spec.placeholder,
      onCreateTerm: onCreateTerm[name],
    });
  }

  // --- buttons ------------------------------------------------------
  const saveBtn = h('button', { type: 'button', class: 'me-save', text: state.mode === 'create' ? 'Create movement' : 'Save movement' });
  const cancelBtn = h('button', { type: 'button', class: 'me-cancel', text: 'Cancel' });

  const form = h(
    'form', { class: 'movement-editor' },
    h('h3', { class: 'me-title', text: state.mode === 'create' ? 'New movement' : `Edit ${state.movementId}` }),
    field('Movement id', controls.movementId,
      state.mode === 'create' ? 'lowercase, words joined by hyphens (dumbbell-snatch)' : 'the registry id — fixed once created'),
    field('Title', controls.title, 'how the movement reads on a line'),
    h('div', { class: 'me-row' },
      field('Force', controls.force),
      field('Mechanic', controls.mechanic),
      field('Load', controls.load)),
    h('div', { class: 'me-row' },
      field('Default laterality', controls.defaultLaterality),
      field('Laterality axis', controls.lateralityAxis),
      field('Implements', controls.implements, 'per-implement count')),
    h('div', { class: 'me-row' },
      group('Counting modes', controls.laterality),
      group('Measured output', controls.measures, 'the units this movement can be measured in — both is normal for an erg')),
    group('Aliases', controls.aliases, 'other names this movement answers to'),
    group('Equipment', controls.equipment),
    group('Movement patterns', controls.pattern, 'balance analysis only'),
    group('Related', controls.related, 'movement ids'),
    group('Same as', controls.sameAs, 'ids in the merged corpus'),
    h('div', { class: 'me-row' },
      group('Muscles — primary', controls.musclesPrimary),
      group('Muscles — secondary', controls.musclesSecondary)),
    errorBox,
    status,
    h('div', { class: 'me-actions' }, saveBtn, cancelBtn),
  );
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  container.append(form);

  // --- collect + validate --------------------------------------------
  function collect() {
    const errors = [];
    const movementId = controls.movementId.value.trim();
    const title = controls.title.value.trim();
    if (!movementId) errors.push('Movement id is required.');
    else if (state.mode === 'create' && !ID_RE.test(movementId)) {
      errors.push('Movement id must be lowercase alphanumerics joined by single hyphens (like "dumbbell-snatch").');
    }
    if (!title) errors.push('Title is required.');

    const fields = {};
    for (const [name, vocab] of Object.entries(ENUMS)) {
      const v = controls[name].value;
      if (v && !vocab.includes(v)) errors.push(`${name} "${v}" is not one of ${vocab.join(' / ')}.`);
      fields[name] = vocab.includes(v) ? v : '';
    }
    for (const [name, vocab] of Object.entries(MULTIS)) {
      fields[name] = multiGroups[name].filter((b) => b.cb.checked && vocab.includes(b.v)).map((b) => b.v);
    }
    // An axis only means something for a per-side count (import-movement-curation.mjs).
    if (fields.lateralityAxis && !fields.laterality.includes('per-side')) {
      errors.push('Laterality axis is set but "per-side" is not a counting mode — an axis only labels a per-side count.');
    }
    if (fields.defaultLaterality && !fields.laterality.includes(fields.defaultLaterality)) {
      errors.push(`Default laterality "${fields.defaultLaterality}" is not one of the ticked counting modes.`);
    }

    const implRaw = controls.implements.value.trim();
    if (implRaw) {
      const n = Number(implRaw);
      if (!Number.isInteger(n) || n < 1) errors.push('Implements must be a whole number ≥ 1.');
      else fields.implements = n;
    }

    for (const k of LIST_FIELDS) fields[k] = tokens[k].value();

    const primary = tokens.musclesPrimary.value();
    const secondary = tokens.musclesSecondary.value();
    const muscles = (state.fields.muscles && typeof state.fields.muscles === 'object')
      ? { ...state.fields.muscles } : {};
    if (primary.length) muscles.primary = primary; else delete muscles.primary;
    if (secondary.length) muscles.secondary = secondary; else delete muscles.secondary;
    fields.muscles = Object.keys(muscles).length ? muscles : null;

    return { movementId, title, fields, errors };
  }

  /** The request body — omit-empty on create, clear-empty on update (as M3 does). */
  function buildBody({ create }, movementId, title, fields) {
    const body = { movementId, title, scope: 'global' };
    const put = (k, val, empty) => {
      const isEmpty = val == null || val === '' || (Array.isArray(val) && val.length === 0);
      if (create) { if (!isEmpty) body[k] = val; }
      else body[k] = isEmpty ? empty : val;
    };
    for (const k of LIST_FIELDS) put(k, fields[k], null);
    for (const k of Object.keys(ENUMS)) put(k, fields[k], '');
    for (const k of Object.keys(MULTIS)) put(k, fields[k], null);
    put('implements', fields.implements ?? null, null);
    put('muscles', fields.muscles, null);
    return body;
  }

  function showErrors(list) {
    errorBox.innerHTML = '';
    for (const msg of list) errorBox.append(h('li', { text: msg }));
    errorBox.hidden = list.length === 0;
  }
  function setStatus(msg, kind) {
    status.textContent = msg;
    status.hidden = !msg;
    status.dataset.kind = kind || '';
  }

  let busy = false;
  async function save() {
    if (busy) return;
    const { movementId, title, fields, errors } = collect();
    showErrors(errors);
    if (errors.length) { setStatus('', ''); return; }

    busy = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    setStatus('Saving…', 'busy');
    try {
      let saved;
      if (state.mode === 'create') {
        saved = await api.createMovement(buildBody({ create: true }, movementId, title, fields));
      } else {
        let pbId = state.pbId;
        if (!pbId) {
          const found = await api.getMovementByMovementId(movementId);
          pbId = found?.id ?? null;
        }
        saved = pbId
          ? await api.updateMovement(pbId, buildBody({ create: false }, movementId, title, fields))
          : await api.createMovement(buildBody({ create: true }, movementId, title, fields));
      }
      setStatus('Saved.', 'ok');
      onSaved?.(movementRecordToEntry(saved), saved);
    } catch (e) {
      setStatus(e?.message || 'The save failed.', 'error');
    } finally {
      busy = false;
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  saveBtn.onclick = () => save();
  cancelBtn.onclick = () => onCancel?.();

  return {
    destroy() {
      for (const t of Object.values(tokens)) t.destroy();
      container.innerHTML = '';
    },
    focus() { (state.mode === 'create' ? controls.movementId : controls.title).focus(); },
  };
}
