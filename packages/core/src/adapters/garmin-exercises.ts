/**
 * Resolve a WDL movement to a Garmin Connect exercise.
 *
 * Connect rejects a strength step whose `category` is not one of its own 47,
 * with `{"message":"Invalid category"}` — mechanically upper-casing a movement
 * name is not enough, as `HANG_POWER_CLEAN` proved. A hang power clean is
 * category `OLYMPIC_LIFT` with exercise `BARBELL_HANG_POWER_CLEAN`.
 *
 * Two vocabularies naming the same movements differently is exactly the problem
 * `fold()` exists for, so this reuses it — and resolves through our own registry
 * first, so an abbreviation like `KB Swing` becomes `Kettlebell Swing` before
 * Garmin's catalogue ever sees it.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fold, depluralize } from '../fold.ts';
import { defaultRegistry } from '../registry.ts';

export interface GarminExercise { name: string; category: string; exercise: string }

const here = dirname(fileURLToPath(import.meta.url));
let catalogue: { categories: string[]; exercises: GarminExercise[] } | undefined;

function load() {
  if (!catalogue) {
    catalogue = JSON.parse(
      readFileSync(join(here, '../../../../registry/garmin-exercises.json'), 'utf8'),
    );
  }
  return catalogue!;
}

export const garminCategories = () => load().categories;

/** Implement words Connect spells out where a whiteboard usually does not. */
const IMPLEMENTS = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine'];

export interface Resolved { category: string; exercise: string; via: string }

/** Both folds of a string: exact, and depluralised. */
const keys = (s: string) => {
  const k = fold(s);
  return [k, depluralize(k)];
};

export function resolveGarminExercise(movement: string): Resolved | undefined {
  const { exercises, categories } = load();
  if (!movement.trim()) return undefined;

  // Our own registry knows the canonical title and the aliases, so let it
  // normalise first: `KB Swing` -> `Kettlebell Swing`.
  const known = defaultRegistry().resolve(movement);
  const names = known.status === 'ok' ? [movement, known.entry.title] : [movement];
  const wanted = new Set(names.flatMap(keys));

  const hit = (e: GarminExercise, via: string): Resolved =>
    ({ category: e.category, exercise: e.exercise, via });

  // Display names first. Connect's own label is the better evidence, and a code
  // can repeat across categories — BACK_SQUAT lives under SANDBAG as well as
  // the barbell one, so matching codes first files a back squat as sandbag work.
  for (const e of exercises) {
    if (keys(e.name).some((k) => wanted.has(k))) return hit(e, 'name');
  }
  for (const prefix of IMPLEMENTS) {
    const qualified = new Set(names.flatMap((n) => keys(prefix + ' ' + n)));
    for (const e of exercises) {
      if (keys(e.name).some((k) => qualified.has(k))) return hit(e, `implied ${prefix}`);
    }
  }
  for (const e of exercises) {
    if (e.exercise && keys(e.exercise).some((k) => wanted.has(k))) return hit(e, 'code');
  }
  for (const c of categories) {
    if (keys(c).some((k) => wanted.has(k))) return { category: c, exercise: '', via: 'category' };
  }
  return undefined;
}
