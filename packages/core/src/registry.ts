/** Loads the bundled movement registry (registry/movements.json). */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Registry, type MovementEntry } from './fold.ts';

const here = dirname(fileURLToPath(import.meta.url));

let cached: Registry | undefined;
let cachedCanonical: Registry | undefined;

/** The registry shipped with this package. Loaded once, on first use. */
export function defaultRegistry(): Registry {
  if (!cached) {
    const path = join(here, '../../../registry/movements.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { movements: MovementEntry[] };
    cached = new Registry(data.movements);
  }
  return cached;
}

/**
 * The merged corpus — every source, three thousand movements. A superset of the
 * curated registry, which is the first source in the merge and wins on conflict,
 * so nothing is lost by preferring this one. Analysis uses it because the
 * curated file alone leaves most of the world's movements without muscle data.
 *
 * Loaded separately and lazily: it is an order of magnitude larger, and parsing
 * is not free for callers who only need to resolve a name.
 */
export function canonicalRegistry(): Registry {
  if (!cachedCanonical) {
    const path = join(here, '../../../registry/movements.canonical.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { movements: MovementEntry[] };
    cachedCanonical = new Registry(data.movements);
  }
  return cachedCanonical;
}
