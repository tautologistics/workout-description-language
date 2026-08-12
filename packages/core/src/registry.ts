/**
 * The movement registries, built from whatever the host provided.
 *
 * Reading them off disk is the host's job (`packages/core/node.ts` on Node, a
 * fetch in a browser). This module only turns the records into a `Registry`,
 * once, and hands the same one back.
 */
import { Registry } from './fold.ts';
import { required } from './env.ts';

let curated: Registry | undefined;
let canonical: Registry | undefined;
let curatedFrom: unknown;
let canonicalFrom: unknown;

/** The hand-kept registry. Small, vetted, and what validation consults. */
export function defaultRegistry(): Registry {
  const data = required('movements');
  // Rebuilt when the host provides different data — a test swapping in a
  // three-movement registry must not keep getting the old one.
  if (!curated || curatedFrom !== data) { curated = new Registry(data); curatedFrom = data; }
  return curated;
}

/**
 * The merged corpus — every source, three thousand movements. A superset of the
 * curated registry, which is the first source in the merge and wins on conflict,
 * so nothing is lost by preferring this one. Analysis uses it because the
 * curated file alone leaves most of the world's movements without muscle data.
 */
export function canonicalRegistry(): Registry {
  const data = required('canonicalMovements');
  if (!canonical || canonicalFrom !== data) { canonical = new Registry(data); canonicalFrom = data; }
  return canonical;
}
