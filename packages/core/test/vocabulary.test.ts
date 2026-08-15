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
  'known-wrong :: 10 Thruster @95':
    '`@` with no space reads the load as a flag and drops it, unit or no unit',
  'known-wrong :: 10 Thruster @85% 1RM':
    '`@` with no space stops the flag at the `%` and leaves `% 1RM` in the movement name',
  'known-wrong :: 18 Thruster @115lb @tiebreak':
    '`@` with no space reads the load as a second flag and drops it',
  'known-wrong :: 10 Thruster, @ 95lb':
    'a target after a comma is filed as a note, not a load',
  'known-wrong :: 10 Thruster, @ 24kg':
    'a target after a comma is filed as a note, not a load',
  'known-wrong :: 10 Thruster, @ 85% 1RM':
    'a target after a comma is filed as a note, not a load',
  'known-wrong :: 10 Deadlift (105/145) each arm':
    'an rx split before a space-separated qualifier is swallowed into the movement name',
  'known-wrong :: 10 DB Snatch (50/35lb) each side':
    'an rx split before a space-separated qualifier is swallowed into the movement name',
  'known-wrong :: 10 Deadlift (women 105lb / men 145lb) each arm':
    'an rx split before a space-separated qualifier is swallowed into the movement name',
  'known-wrong :: 10 Deadlift (105/145) unbroken':
    'an rx split before a space-separated flag is swallowed into the movement name',
  'known-wrong :: 10 Deadlift (women 105lb / men 145lb) unbroken':
    'an rx split before a space-separated flag is swallowed into the movement name',
};

/**
 * Forms whose canonical text is not a fixpoint, and why.
 *
 * Listed rather than excused. A form here is a form where `wdl fmt` twice does
 * not mean what `wdl fmt` once meant, which is a defect and not a taste — the
 * list exists so the count below stays honest while the cause is open, and so
 * that a form which *starts* settling fails as stale rather than sitting here
 * forever. Same contract as the exclusions in `grammar.test.ts`.
 */
const KNOWN_UNSETTLED: Record<string, string> = {
  'known-wrong :: 10 Deadlift (105/145) unbroken':
    'formats to `10 Deadlifts (105/145), unbroken`, and the comma form reparses as an rx — '
    + 'so the first pass loses the loads and the second finds them again',
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
  it(`every form but ${Object.keys(KNOWN_UNSETTLED).length} has a settled canonical form`, () => {
    const unsettled = cases.filter(({ src }) => !digest(src).fixpoint).map((c) => c.key);
    eq(unsettled.filter((key) => !(key in KNOWN_UNSETTLED)), [],
      'forms whose canonical form is not a fixpoint');
    // And the other direction: a listed form that has started settling is a
    // fix nobody wrote down, so the list has to notice.
    eq(Object.keys(KNOWN_UNSETTLED).filter((key) => !unsettled.includes(key)), [],
      'listed as unsettled, but settles now — take it off the list');
  });

  it('the snapshot has no stale entries', () => {
    const live = new Set(cases.map((c) => c.key));
    eq(Object.keys(snapshot).filter((k) => !live.has(k)), [], 'snapshot keys with no case');
  });

  for (const [key, why] of Object.entries(KNOWN_WRONG)) pending(key, why);
});
