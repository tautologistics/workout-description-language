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
  /**
   * Ids in the merged corpus this record is *the same movement as* — a
   * curator's answer where no rule over the two titles could reach it.
   *
   * The only field here that is neither advisory nor a fact about the movement:
   * it is an instruction to `scripts/dedupe-movements.mjs`, which absorbs what
   * it names and deletes it, so no record in the canonical corpus carries one.
   * Distinct from an alias, which says only that a name reaches this record.
   */
  sameAs?: string[];
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
  private byKey = new Map<string, MovementEntry>();
  private byAlias = new Map<string, MovementEntry[]>();
  readonly entries: MovementEntry[] = [];

  constructor(entries: MovementEntry[] = []) {
    for (const e of entries) this.add(e);
  }

  add(entry: MovementEntry) {
    this.entries.push(entry);
    this.byKey.set(fold(entry.id), entry);
    for (const a of [entry.title, ...(entry.aliases ?? [])]) {
      const k = fold(a);
      if (!this.byAlias.has(k)) this.byAlias.set(k, []);
      const list = this.byAlias.get(k)!;
      if (!list.includes(entry)) list.push(entry);
    }
  }

  /** `fold(id) === fold(title)` for every entry, plus no alias collisions. */
  validate(): string[] {
    const problems: string[] = [];
    for (const e of this.entries) {
      if (fold(e.id) !== fold(e.title)) {
        problems.push(`${e.id}: title "${e.title}" folds to "${fold(e.title)}", not "${fold(e.id)}"`);
      }
    }
    for (const [key, list] of this.byAlias) {
      if (list.length > 1) problems.push(`alias "${key}" maps to ${list.map((e) => e.id).join(', ')}`);
    }
    return problems;
  }

  private lookup(key: string): MovementEntry | MovementEntry[] | undefined {
    const direct = this.byKey.get(key);
    if (direct) return direct;
    const aliased = this.byAlias.get(key);
    if (aliased?.length === 1) return aliased[0];
    if (aliased && aliased.length > 1) return aliased;
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
