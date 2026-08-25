/**
 * The data the core needs, and the one place it comes from.
 *
 * Nothing under `src/` reads a file, knows a path, or imports a `node:` module.
 * The parser, the timeline compiler, the validator, the goal checker and the
 * generator all run unchanged in a browser, on a watch, or anywhere else,
 * because the corpora they consult are handed to them rather than fetched.
 *
 * A host provides them once at startup: `packages/core/node.ts` reads them off
 * disk, a web app fetches them. Providers are thunks, so nothing is read until
 * something actually asks — a `wdl fmt` never touches the three-thousand-record
 * canonical corpus.
 *
 * Asking for data nobody provided throws, naming what is missing. The quiet
 * alternative is worse than a crash: an empty movement registry makes every
 * movement unregistered, and half of `validate` silently stops having an
 * opinion.
 */

import type { MovementEntry } from './fold.ts';

export interface GarminCatalogue {
  categories: string[];
  exercises: { name: string; category: string; exercise: string }[];
}

export interface MuscleRecord {
  id: string;
  name: string;
  region: 'upper' | 'core' | 'lower';
}

/** Everything the core can be given. Each is optional; each throws where used if absent. */
export interface CoreData {
  /**
   * The normative grammar, as text. **`parse` does not work without it**, which
   * makes this the one entry here that is not optional in practice: the other
   * four switch a *feature* off, and this one is the parser. A host that forgets
   * it gets the error below on the first line it tries to read, which is the
   * intended outcome — see "Silence is worse than a crash" in
   * docs/context/topics/lessons-learned.md.
   */
  grammar: string;
  /** The hand-kept registry. What `validate` consults. */
  movements: MovementEntry[];
  /** The merged corpus — every source. What muscle analysis and generation consult. */
  canonicalMovements: MovementEntry[];
  /** The closed muscle vocabulary. */
  muscles: MuscleRecord[];
  /** Garmin Connect's own exercise catalogue, for export. */
  garminExercises: GarminCatalogue;
}

type Providers = { [K in keyof CoreData]?: () => CoreData[K] };

const providers: Providers = {};
const cache = new Map<keyof CoreData, unknown>();

const WHERE: Record<keyof CoreData, string> = {
  grammar: 'spec/grammar-0.1.ohm',
  movements: 'registry/movements.json',
  canonicalMovements: 'registry/movements.canonical.json',
  muscles: 'registry/muscles.json',
  garminExercises: 'registry/garmin-exercises.json',
};

/**
 * Hand the core its data. Call more than once to replace what was given — a
 * test that swaps in a three-movement registry, an app that loads the canonical
 * corpus only once the user asks for analysis.
 */
export function provide(next: Providers): void {
  for (const [key, fn] of Object.entries(next) as [keyof CoreData, () => unknown][]) {
    if (fn === undefined) continue;
    providers[key] = fn as never;
    cache.delete(key);   // a replaced provider must not serve the old value
  }
}

/** True when this data has been provided, so a caller can offer or withhold a feature. */
export function has(key: keyof CoreData): boolean {
  return providers[key] !== undefined;
}

/** The data, read on first use and kept. Throws, by name, if nobody provided it. */
export function required<K extends keyof CoreData>(key: K): CoreData[K] {
  if (!cache.has(key)) {
    const fn = providers[key];
    if (!fn) {
      throw new Error(
        `@wdl/core needs \`${key}\` and nobody provided it. On Node, import "@wdl/core/node" `
        + `instead of "@wdl/core/src/index.ts"; in a browser, call provide({ ${key}: () => data }) `
        + `with the contents of ${WHERE[key]} before parsing.`,
      );
    }
    cache.set(key, fn());
  }
  return cache.get(key) as CoreData[K];
}

/**
 * Forget a provider and anything read through it — or all of them, given no
 * argument. For tests, and for a host that wants to hand over different data.
 */
export function reset(key?: keyof CoreData): void {
  if (key) { delete providers[key]; cache.delete(key); return; }
  for (const k of Object.keys(providers) as (keyof CoreData)[]) delete providers[k];
  cache.clear();
}
