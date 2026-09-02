/**
 * A reusable token/chip input over a list of strings — queue task V4.
 *
 * Three things, always the same three, at every vocabulary size:
 *   1. removable **chips** for the current value;
 *   2. a text **entry with type-ahead** over `vocab` — arrow-key highlight,
 *      Enter or click to add, and (when `allowCustom`) a `＋ Add "x"` row for a
 *      token the vocabulary does not know;
 *   3. below the field, a **filter/select picker** — a filter box over a
 *      scrollable checklist of the whole vocabulary, click to toggle a term in
 *      or out.
 *
 * **One composition, no size-driven variants.** There is deliberately no count
 * threshold and no "show the first 15, then More": a filterable, bounded,
 * scrolling picker already scales from 0 terms to 1000 without changing shape,
 * and a second layout would double the surface a reader has to learn for no
 * gain. The only thing a vocabulary's *size* changes is scrolling; the only
 * thing its *absence* changes is that the picker is not rendered at all (a
 * free-token field like `aliases` is chips + entry, nothing else). Settled as
 * DEC-024.
 *
 * **Host-agnostic on purpose**, exactly like `movement-editor.js`: it touches no
 * builder globals — the caller hands it a container, a value, a vocabulary and
 * an `onChange`. The CSS lives in `apps/builder/builder.css` on the shared
 * `--ink` / `--dim` / `--rule` / `--accent` / `--page` / `--panel` tokens, so
 * the widget carries no host-specific look and a second host restyles nothing.
 *
 * That CSS relies on the host having the `[hidden] { display: none !important }`
 * rule (builder.css does, and for the reason recorded in lessons-learned — an
 * author `display` silently overrules the attribute). The menu and the picker
 * are shown/hidden by `.hidden`, so a host without that rule shows them always
 * rather than breaking.
 */

/** Same tiny builder as `movement-editor.js` — both modules stay self-contained. */
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

/** Comparison key — a vocabulary is lowercase, what a person types may not be. */
const norm = (s) => String(s).trim().toLowerCase();

/** Trimmed, order-preserving, case-insensitively de-duplicated. */
const dedupe = (list) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = String(raw).trim();
    if (t && !seen.has(norm(t))) { seen.add(norm(t)); out.push(t); }
  }
  return out;
};

/** Unique per widget, so `aria-controls` / `aria-activedescendant` can point at it. */
let uid = 0;

/**
 * Mount a token input into `container`.
 *
 * @param {object}   opts
 * @param {Element}  opts.container      element the widget's DOM is scoped to (cleared on mount)
 * @param {string[]} [opts.value]        the starting tokens
 * @param {string[]|Function} [opts.vocab]  the known terms, or a function returning them (may be async)
 * @param {boolean}  [opts.allowCustom]  may a token outside `vocab` be added? (default true)
 * @param {string}   [opts.placeholder]  placeholder for the text entry
 * @param {Function} [opts.onChange]     called with the new value array after every change
 * @returns {{ value(): string[], focus(): void, destroy(): void }}
 */
export function createTokenInput({
  container, value = [], vocab = [], allowCustom = true, placeholder = '', onChange,
} = {}) {
  const id = `ti${++uid}`;
  let chosen = dedupe(value);
  /** The resolved vocabulary. Empty until `vocab` settles — and possibly for good. */
  let terms = [];
  /** The type-ahead rows currently offered; `null` marks the `＋ Add "…"` row. */
  let options = [];
  let hi = -1;
  let alive = true;

  container.innerHTML = '';

  const chipBox = h('div', { class: 'ti-chips' });
  const entry = h('input', {
    type: 'text', class: 'ti-entry', placeholder,
    autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
    role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list',
    'aria-controls': `${id}-menu`,
  });
  const browse = h('button', {
    type: 'button', class: 'ti-browse', text: '▾', hidden: true,
    'aria-expanded': 'false', 'aria-controls': `${id}-picker`,
    'aria-label': 'Browse the full list', title: 'Browse the full list',
  });
  const field = h('div', { class: 'ti-field' }, chipBox, entry, browse);

  const menu = h('ul', { class: 'ti-menu', id: `${id}-menu`, role: 'listbox', hidden: true });

  const filter = h('input', {
    type: 'text', class: 'ti-filter', placeholder: 'Filter…',
    autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
    'aria-label': 'Filter the list',
  });
  const list = h('div', { class: 'ti-list' });
  const picker = h('div', { class: 'ti-picker', id: `${id}-picker`, hidden: true }, filter, list);

  container.append(h('div', { class: 'ti' }, field, menu, picker));

  // --- value ---------------------------------------------------------------

  function commitValue(next) {
    const before = chosen;
    chosen = dedupe(next);
    if (before.length === chosen.length && before.every((t, i) => t === chosen[i])) return;
    renderChips();
    syncPicker();
    onChange?.(chosen.slice());
  }

  /**
   * Add a term, spelled the way the vocabulary spells it when it knows it.
   * Returns whether it was taken — a closed vocabulary rejects an unknown term,
   * and the caller leaves the text in the box rather than clearing it, so the
   * refusal is visible instead of looking like a silent success.
   */
  function add(raw) {
    const t = String(raw).trim();
    if (!t) return false;
    const known = terms.find((v) => norm(v) === norm(t));
    if (!known && !allowCustom) return false;
    commitValue([...chosen, known ?? t]);
    return true;
  }

  const remove = (t) => commitValue(chosen.filter((c) => norm(c) !== norm(t)));

  // --- chips ---------------------------------------------------------------

  function renderChips() {
    chipBox.innerHTML = '';
    for (const t of chosen) {
      const x = h('button', {
        type: 'button', class: 'ti-x', text: '×',
        'aria-label': `Remove ${t}`, title: `Remove ${t}`,
      });
      x.onclick = () => { remove(t); entry.focus(); };
      chipBox.append(h('span', { class: 'ti-chip' }, h('span', { text: t }), x));
    }
  }

  // --- type-ahead ----------------------------------------------------------

  /** Unchosen terms matching `q`, prefix matches first. Empty `q` offers them all. */
  function suggest(q) {
    const taken = new Set(chosen.map(norm));
    const pool = terms.filter((t) => !taken.has(norm(t)));
    if (!q) return pool;
    const starts = pool.filter((t) => norm(t).startsWith(q));
    return [...starts, ...pool.filter((t) => !norm(t).startsWith(q) && norm(t).includes(q))];
  }

  function renderMenu({ force = false } = {}) {
    const typed = entry.value.trim();
    const q = norm(typed);
    const hits = (q || force) ? suggest(q) : [];
    const canAdd = allowCustom && typed
      && !terms.some((t) => norm(t) === q)
      && !chosen.some((t) => norm(t) === q);

    options = [...hits, ...(canAdd ? [null] : [])];
    menu.innerHTML = '';
    if (!options.length) { closeMenu(); return; }

    options.forEach((t, i) => {
      const row = t === null
        ? h('li', { class: 'ti-opt ti-add', role: 'option', id: `${id}-o${i}`, text: `＋ Add "${typed}"` })
        : h('li', { class: 'ti-opt', role: 'option', id: `${id}-o${i}`, text: t });
      // `mousedown` rather than `click`: the entry must not blur before we act.
      row.addEventListener('mousedown', (e) => { e.preventDefault(); if (add(t ?? typed)) clearEntry(); });
      menu.append(row);
    });
    if (hi >= options.length) hi = options.length - 1;
    paintHighlight();
    menu.hidden = false;
    entry.setAttribute('aria-expanded', 'true');
  }

  function paintHighlight() {
    [...menu.children].forEach((row, i) => row.classList.toggle('on', i === hi));
    if (hi >= 0) {
      entry.setAttribute('aria-activedescendant', `${id}-o${hi}`);
      menu.children[hi]?.scrollIntoView({ block: 'nearest' });
    } else entry.removeAttribute('aria-activedescendant');
  }

  function closeMenu() {
    menu.hidden = true;
    menu.innerHTML = '';
    options = [];
    hi = -1;
    entry.setAttribute('aria-expanded', 'false');
    entry.removeAttribute('aria-activedescendant');
  }

  function clearEntry() { entry.value = ''; closeMenu(); }

  entry.addEventListener('input', () => { hi = -1; renderMenu(); });

  entry.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (menu.hidden) { hi = -1; renderMenu({ force: true }); }
      if (!options.length) return;
      e.preventDefault();
      // Cycles -1 (nothing highlighted, so Enter still commits what was typed)
      // → 0 … n-1 → -1, in both directions.
      const n = options.length;
      hi = e.key === 'ArrowDown' ? (hi + 1 >= n ? -1 : hi + 1) : (hi - 1 < -1 ? n - 1 : hi - 1);
      paintHighlight();
      return;
    }
    if (e.key === 'Enter') {
      // Always swallowed: this widget lives inside a <form> whose submit saves.
      e.preventDefault();
      if (hi >= 0 && hi < options.length) { if (add(options[hi] ?? entry.value)) clearEntry(); }
      else if (entry.value.trim() && add(entry.value)) clearEntry();
      return;
    }
    if (e.key === ',') { e.preventDefault(); if (add(entry.value)) clearEntry(); return; }
    if (e.key === 'Escape' && !menu.hidden) {
      // Swallow it, or a hosting <dialog> takes it as "close the modal".
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      return;
    }
    if (e.key === 'Backspace' && !entry.value && chosen.length) {
      e.preventDefault();
      remove(chosen[chosen.length - 1]);
    }
  });

  // The old fields were comma-separated, so a pasted "a, b, c" still means three.
  entry.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[\n,]/.test(text)) return;
    e.preventDefault();
    const kept = text.split(/[\n,]/).filter((part) => !add(part) && part.trim());
    entry.value = kept.join(', ');   // whatever a closed vocabulary refused stays visible
    renderMenu();
  });

  entry.addEventListener('blur', () => { if (!menu.hidden) closeMenu(); });
  field.addEventListener('mousedown', (e) => { if (e.target === field || e.target === chipBox) entry.focus(); });

  // --- the filter/select picker -------------------------------------------

  const boxes = new Map();

  function renderList() {
    const q = norm(filter.value);
    boxes.clear();
    list.innerHTML = '';
    const shown = terms.filter((t) => !q || norm(t).includes(q));
    if (!shown.length) {
      list.append(h('p', { class: 'ti-empty', text: q ? 'No term matches that filter.' : 'No terms.' }));
      return;
    }
    const taken = new Set(chosen.map(norm));
    for (const t of shown) {
      const cb = h('input', { type: 'checkbox', checked: taken.has(norm(t)) });
      cb.onchange = () => (cb.checked ? add(t) : remove(t));
      boxes.set(norm(t), cb);
      list.append(h('label', { class: 'ti-term' }, cb, h('span', { text: t })));
    }
  }

  /** Keep the checkboxes honest without rebuilding the list (scroll + focus survive). */
  function syncPicker() {
    const taken = new Set(chosen.map(norm));
    for (const [key, cb] of boxes) cb.checked = taken.has(key);
  }

  filter.addEventListener('input', renderList);
  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !picker.hidden) { e.preventDefault(); e.stopPropagation(); togglePicker(false); }
  });

  function togglePicker(open = picker.hidden) {
    picker.hidden = !open;
    browse.setAttribute('aria-expanded', String(open));
    browse.textContent = open ? '▴' : '▾';
    if (open) { renderList(); filter.focus(); } else { browse.focus(); }
  }
  browse.onclick = () => togglePicker();

  // --- vocabulary ----------------------------------------------------------

  (async () => {
    let resolved = [];
    try {
      resolved = typeof vocab === 'function' ? await vocab() : vocab;
    } catch { resolved = []; }
    if (!alive) return;
    terms = dedupe(resolved);
    // No vocabulary means no picker and no type-ahead — chips and free text only.
    browse.hidden = terms.length === 0;
    if (!terms.length) picker.hidden = true;
    else if (!picker.hidden) renderList();
  })();

  renderChips();

  return {
    value: () => chosen.slice(),
    focus: () => entry.focus(),
    destroy() { alive = false; container.innerHTML = ''; },
  };
}
