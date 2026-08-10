/** Loads the bundled movement registry (registry/movements.json). */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Registry, type MovementEntry } from './fold.ts';

const here = dirname(fileURLToPath(import.meta.url));

let cached: Registry | undefined;

/** The registry shipped with this package. Loaded once, on first use. */
export function defaultRegistry(): Registry {
  if (!cached) {
    const path = join(here, '../../../registry/movements.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { movements: MovementEntry[] };
    cached = new Registry(data.movements);
  }
  return cached;
}
