/**
 * Every documented form, pinned two ways.
 *
 * `corpus.test.ts` proves 190 real workouts round-trip. That is a test of
 * stability over the forms the corpus happens to use, and 13 of the 24
 * documented syntax features appear in none of them. This covers the language
 * instead of the sample, and it pins the *interpretation* rather than only the
 * round trip — because a misreading can round-trip perfectly. `10 Thruster
 * @95lb` is a text fixpoint, a canonical fixpoint, and wrong.
 *
 * When a case here fails, regenerate deliberately and read the diff:
 *   node test/golden/vocabulary.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok, pending } from './lib.ts';
import { allCases, digest } from './golden/vocabulary.ts';

const here = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(readFileSync(join(here, 'golden/vocabulary.json'), 'utf8'));

/** Forms whose pinned reading is known to be wrong. Pinned so a fix is visible. */
const KNOWN_WRONG: Record<string, string> = {
  'known-wrong :: 10 Thruster @95lb':
    '`@` with no space reads the load as a flag and drops it',
  'known-wrong :: 10 Thruster @2x35lb':
    '`@` with no space reads the load as a flag and drops it',
  'known-wrong :: 10 Thruster @24kg':
    '`@` with no space reads the load as a flag and drops it',
  'known-wrong :: 10 Thruster, @ 95lb':
    'a target after a comma is filed as a note, not a load',
  'known-wrong :: 10 Thruster, @ 24kg':
    'a target after a comma is filed as a note, not a load',
  'known-wrong :: 10 Thruster, @ 85% 1RM':
    'a target after a comma is filed as a note, not a load',
};

describe('vocabulary', () => {
  const cases = allCases();

  for (const { key, src } of cases) {
    const want = snapshot[key];
    it(key, () => {
      ok(want, `no snapshot entry — regenerate with: node test/golden/vocabulary.ts`);
      const got = digest(src);
      eq(got.errors, want.errors, 'errors');
      eq(got.canonical, want.canonical, 'canonical text');
      eq(got.ast, want.ast, 'interpretation');
    });
  }

  // The canonical form must be settled: formatting a canonical document again
  // changes neither its text nor its tree.
  it('every form has a settled canonical form', () => {
    const unsettled = cases.filter(({ src }) => !digest(src).fixpoint);
    eq(unsettled.map((c) => c.key), [], 'forms whose canonical form is not a fixpoint');
  });

  it('the snapshot has no stale entries', () => {
    const live = new Set(cases.map((c) => c.key));
    eq(Object.keys(snapshot).filter((k) => !live.has(k)), [], 'snapshot keys with no case');
  });

  for (const [key, why] of Object.entries(KNOWN_WRONG)) pending(key, why);
});
