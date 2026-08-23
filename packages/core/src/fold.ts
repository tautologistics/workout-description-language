/**
 * Movement name normalization (movement_registry_design.md §3).
 *
 * Two layers, kept strictly apart — conflating them is how naming systems
 * become unpredictable.
 *
 *   Layer 1  `fold()`   pure string work. No data, no ambiguity, same result
 *                       forever. Deliberately aggressive: the output is an
 *                       internal matching key that is never displayed, so
 *                       destroying readability costs nothing and collapses far
 *                       more spellings.
 *   Layer 2  `resolve()` registry lookup — aliases, abbreviations, plurals,
 *                       and a last-resort token-set match for word order.
 */

/** Tokens dropped before joining. `Clean & Jerk` and `Clean and Jerk` must agree. */
const STOPWORDS = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with']);

/** Implement and gym shorthand that composes across the whole vocabulary. */
export const TOKEN_EXPANSIONS: Record<string, string> = {
  db: 'dumbbell', kb: 'kettlebell', bb: 'barbell', sa: 'singlearm',
  c2b: 'chesttobar', t2b: 'toestobar', hspu: 'handstandpushup',
  ohs: 'overheadsquat', sdhp: 'sumodeadlifthighpull', du: 'doubleunder',
  bmu: 'barmuscleup', rmu: 'ringmuscleup', wb: 'wallball', hpc: 'hangpowerclean',
  s2o: 'shoulderoverhead', gtoh: 'groundoverhead',
};

export interface Folded { key: string; tokens: string[] }

/** Layer 1: split on non-alphanumerics, drop stopwords, join with nothing. */
export function foldTokens(input: string): Folded {
  const tokens = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t));
  return { key: tokens.join(''), tokens };
}

export function fold(input: string): string {
  return foldTokens(input).key;
}

/**
 * Depluralize a folded key. Applied only as a fallback *after* exact matching,
 * so `press` and `push-press` resolve before the rules can corrupt them.
 */
export function depluralize(key: string): string {
  if (/(ss|sis|us)$/.test(key)) return key;
  if (/ies$/.test(key)) return key.slice(0, -3) + 'y';
  // `ss`, not a lone `s`: `presses` is `press`, but `raises` is `raise`, and a
  // lone `s` in the pattern took the `e` with it and left `rais`.
  if (/(ch|sh|x|z|ss)es$/.test(key)) return key.slice(0, -2);
  if (/s$/.test(key) && key.length > 3) return key.slice(0, -1);
  return key;
}

/** Words that link two nouns, so the one before them is the head. */
const PREPOSITION = new Set([
  'to', 'over', 'under', 'onto', 'into', 'from', 'across', 'off', 'on', 'at', 'per', 'with',
]);

/** One word, made plural. The inverse of `depluralize` for the cases it handles. */
function pluralizeWord(word: string): string {
  if (/[^s]s$/i.test(word)) return word;                          // Knees, Toes: already plural
  if (/(ss|ch|sh|x|z)$/i.test(word)) return `${word}es`;          // Press, Snatch
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`; // Fly
  return `${word}s`;
}

/**
 * A movement name as it would be written for a count of more than one.
 *
 * A whiteboard says `21 Thrusters`, not `21 Thruster`, and a format whose whole
 * premise is that you can read it mid-workout cannot get that wrong. Nothing
 * about identity changes: `fold()` depluralizes, so the plural and the singular
 * resolve to the same movement, and this is purely how it reads.
 *
 * The head noun is not always the last word. Three rules, each earned by a real
 * name in the corpus:
 *
 * - A standalone preposition marks the head as the word before it, so
 *   `Lateral Burpee over Dumbbell` becomes `Lateral Burpees over Dumbbell`
 *   rather than pluralizing the dumbbell.
 * - A hyphenated compound with a preposition *inside* it is a name in its own
 *   right and is left alone: `Knees-to-Elbow`, `Toes-to-Bar`,
 *   `Ground-to-Overhead`. A trailing particle is not the same thing, so
 *   `Jump-Over` and `Pull-Up` still take an s.
 * - Otherwise the last hyphen segment of the last word takes it:
 *   `Chest-to-Bar Pull-Up` → `Chest-to-Bar Pull-Ups`, where the prepositional
 *   compound is only a modifier.
 */
export function pluralize(name: string): string {
  const words = name.split(' ');
  if (!words.length || !name.trim()) return name;
  // A template hole is a constraint, not a noun. `? squat` asks for a squat
  // pattern; `? squats` asks for nothing the registry has ever heard of.
  if (name.startsWith('?')) return name;

  // The head is the word before a standalone preposition, or the last word —
  // skipping anything with no letters in it, since `Back Flyes - With Bands`
  // would otherwise pluralize the dash.
  const letters = (w: string) => /[a-z]/i.test(w);
  const at = words.findIndex((w) => PREPOSITION.has(w.toLowerCase()));
  let head = at > 0 ? at - 1 : words.length - 1;
  while (head > 0 && !letters(words[head])) head--;
  if (!letters(words[head])) return name;

  const segments = words[head].split('-');
  // A preposition anywhere but the end makes this a name, not a compound noun.
  if (segments.slice(0, -1).some((s) => PREPOSITION.has(s.toLowerCase()))) return name;

  segments[segments.length - 1] = pluralizeWord(segments[segments.length - 1]);
  words[head] = segments.join('-');
  return words.join(' ');
}

export interface MovementEntry {
  /** Canonical id — a readable slug, chosen by the curator, never generated. */
  id: string;
  /** Canonical human rendering. The invariant is `fold(id) === fold(title)`. */
  title: string;
  aliases?: string[];
  /** Advisory validation hints. None is required to parse a file. */
  implements?: number;
  load?: 'total' | 'per-implement';
  /** Equipment-derived readouts. Reps and duration need no declaration. */
  measures?: ('distance' | 'calories')[];
  /** Counting modes this movement admits (registry §6). */
  laterality?: ('both' | 'split' | 'per-side')[];
  /** The mode to assume when the prescription is silent. Absent means there is
   *  no dominant convention, so the parser must ask rather than pick. */
  defaultLaterality?: 'both' | 'split' | 'per-side';
  /** Classification, for balance analysis only. */
  pattern?: string[];
  muscles?: {
    primary?: string[];
    secondary?: string[];
    /** Per muscle, how many sources named it [as a primary mover, as an assister]. */
    support?: Record<string, [number, number]>;
    /** How many sources made any muscle claim about this movement. */
    sources?: number;
  };
  related?: string[];
  external?: Record<string, string>;
}

export type Resolution =
  | { status: 'ok'; entry: MovementEntry; via: 'id' | 'alias' | 'plural' | 'abbreviation' | 'tokens' }
  | { status: 'ambiguous'; candidates: MovementEntry[] }
  | { status: 'unregistered'; raw: string };

export class Registry {
  /**
   * A record's own name for itself: its id and its title, which fold to the
   * same key by the invariant `validate()` enforces. List-valued so two records
   * claiming one name is reported rather than resolved by insertion order.
   */
  private byName = new Map<string, MovementEntry[]>();
  /** Explicit aliases, and only those — a statement about a name, not a name. */
  private byAlias = new Map<string, MovementEntry[]>();
  readonly entries: MovementEntry[] = [];

  constructor(entries: MovementEntry[] = []) {
    for (const e of entries) this.add(e);
  }

  add(entry: MovementEntry) {
    this.entries.push(entry);
    const claim = (map: Map<string, MovementEntry[]>, name: string) => {
      const k = fold(name);
      if (!k) return;
      if (!map.has(k)) map.set(k, []);
      const list = map.get(k)!;
      if (!list.includes(entry)) list.push(entry);
    };
    claim(this.byName, entry.id);
    claim(this.byName, entry.title);
    for (const a of entry.aliases ?? []) {
      // A record's own plural is not a claim about a name — it is the record's
      // name written for more than one, and `depluralize` reconstructs it
      // without help. Indexed as an alias it would sit a tier *above* the
      // singular, so `Squats` and `Squat` would answer with different
      // movements; indexed as a name it would exact-match before the plural
      // fallback could run and do the same. So it is not indexed at all. An
      // irregular plural, which the algorithm cannot reconstruct, is a real
      // alias and stays one.
      if (depluralize(fold(a)) === fold(entry.id)) continue;
      claim(this.byAlias, a);
    }
  }

  /**
   * `fold(id) === fold(title)` for every entry, plus every name answered by one
   * movement. A name held as one record's id and another's alias is *not* a
   * problem — `lookup` decides it, and `scripts/check-aliases.mjs` lists them.
   * What is left here is what no rule can decide.
   */
  validate(): string[] {
    const problems: string[] = [];
    for (const e of this.entries) {
      if (fold(e.id) !== fold(e.title)) {
        problems.push(`${e.id}: title "${e.title}" folds to "${fold(e.title)}", not "${fold(e.id)}"`);
      }
    }
    for (const [key, list] of this.byName) {
      if (list.length > 1) problems.push(`name "${key}" maps to ${list.map((e) => e.id).join(', ')}`);
    }
    for (const [key, list] of this.byAlias) {
      if (list.length > 1) problems.push(`alias "${key}" maps to ${list.map((e) => e.id).join(', ')}`);
    }
    return problems;
  }

  /**
   * Two tiers, and the order between them is the whole of this method.
   *
   * **An explicit alias outranks a record's own name.** The two are not the
   * same kind of statement. A record's id and title say what *it* is called; an
   * alias is a curator answering the question actually being asked — when
   * somebody writes this, whom do they mean. Where both answer, only one of
   * them was written about this name.
   *
   * The order used to be the other way round, which made the answer depend on
   * which record happened to be *named* after the contested spelling: `Squat`
   * found an imported record whose id is `squat` and threw away `air-squat`'s
   * alias saying that is what a bare squat means. Worse, it was silent — the id
   * matched, so the `ambiguous` branch below could never be reached, and the
   * curated registry and the canonical one disagreed about `Squat` without
   * anything saying so.
   */
  private lookup(key: string): MovementEntry | MovementEntry[] | undefined {
    for (const map of [this.byAlias, this.byName]) {
      const hit = map.get(key);
      if (hit?.length === 1) return hit[0];
      if (hit && hit.length > 1) return hit;
    }
    return undefined;
  }

  resolve(raw: string): Resolution {
    const { key, tokens } = foldTokens(raw);

    const attempts: [string, Resolution extends never ? never : 'id' | 'alias' | 'plural' | 'abbreviation'][] = [
      [key, 'alias'],
      [depluralize(key), 'plural'],
      [tokens.map((t) => TOKEN_EXPANSIONS[t] ?? t).join(''), 'abbreviation'],
      [depluralize(tokens.map((t) => TOKEN_EXPANSIONS[t] ?? t).join('')), 'abbreviation'],
    ];

    for (const [candidate, via] of attempts) {
      const hit = this.lookup(candidate);
      if (Array.isArray(hit)) return { status: 'ambiguous', candidates: hit };
      if (hit) return { status: 'ok', entry: hit, via: fold(hit.id) === candidate ? 'id' : via };
    }

    // Last resort: compare token multisets, so word order does not require an
    // alias for every permutation. Requires a unique match — this is the only
    // step that is not order-preserving, so it errors rather than guessing.
    const expanded = tokens.map((t) => TOKEN_EXPANSIONS[t] ?? t).map(depluralize).sort();
    const matches = this.entries.filter((e) => {
      const et = foldTokens(e.title).tokens.map(depluralize).sort();
      return et.length === expanded.length && et.every((t, i) => t === expanded[i]);
    });
    if (matches.length === 1) return { status: 'ok', entry: matches[0], via: 'tokens' };
    if (matches.length > 1) return { status: 'ambiguous', candidates: matches };

    return { status: 'unregistered', raw };
  }
}
