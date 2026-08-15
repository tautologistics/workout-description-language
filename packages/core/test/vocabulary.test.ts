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
  'known-wrong :: 3x10 Curl':
    '`sets x reps` before the movement becomes the movement name; the quantity stays open',
  'known-wrong :: 5x5 Back Squat @ 225lb':
    '`sets x reps` before the movement becomes the movement name — spec §1 rule 4 writes it this way',
  'block/modifier :: target then for time':
    'the header `@` sweep is greedy and swallows the following `for time`, losing both',
  'score :: brace form without a primary':
    'with no `primary:` field the primary becomes the whole brace text, and the tiebreak is emitted twice',
  'score :: nested block form':
    'the nested `score:` block documented in spec §9.5 is dropped entirely — primary is empty',
  // Listed here as of 2026-08-15 as well as in `grammar.test.ts`'s REST_REJECTS,
  // because the two lists make two different claims and both are true of these
  // lines: no rule reads them, *and* what happens instead is wrong. They were
  // only ever in the rejects list, whose stated rationale was "the lines neither
  // implementation reads" — a framing that stopped meaning anything the day
  // there was one implementation. A defect under decision belongs in the same
  // pending machinery as every other one.
  'rest :: spelled-out seconds':
    'a spelled-out duration word is a step quantity but not a rest — the bound is dropped and reads as unbounded',
  'rest :: spelled-out minutes':
    'a spelled-out duration word is a step quantity but not a rest — the bound is dropped and reads as unbounded',
  'rest :: spelled-out hours':
    'a spelled-out duration word is a step quantity but not a rest — the bound is dropped and reads as unbounded',
};

/**
 * Forms whose canonical text is not a fixpoint, and why.
 *
 * Listed rather than excused. A form here is a form where `wdl fmt` twice does
 * not mean what `wdl fmt` once meant, which is a defect and not a taste — the
 * list exists so the count below stays honest while the cause is open, and so
 * that a form which *starts* settling fails as stale rather than sitting here
 * forever.
 *
 * Empty as of the swap (queue item 0a). Its one entry was
 * `10 Deadlift (105/145) unbroken`, where the first `wdl fmt` lost the loads
 * into the movement name and the second found them again; the grammar reads the
 * rx split wherever it appears, so the line settles on the first pass now.
 */
const KNOWN_UNSETTLED: Record<string, string> = {};

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
