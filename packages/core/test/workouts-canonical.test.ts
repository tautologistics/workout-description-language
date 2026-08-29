/**
 * registry/workouts.canonical.json must still be what the corpus derives.
 *
 * `interpretations.json` and `vocabulary.json` are guarded because their tests
 * re-derive from source and compare to the committed JSON. This one was not:
 * nothing in the suite ran `scripts/build-workouts.mjs` or checked its output,
 * so the parser could change its mind and the committed file could sit stale —
 * a wrong answer waiting for someone to read it (docs/context/topics/known-debts.md).
 *
 * So: re-run the deriver in process (`buildWorkoutsDoc`, the pure core of
 * `build-workouts.mjs`) and assert it equals the committed file, workout by
 * workout, ignoring the `generated` stamp — which changes on every rebuild.
 *
 * When a case here fails, regenerate deliberately and read the diff:
 *   node scripts/build-canonical.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { buildWorkoutsDoc } from '../../../scripts/build-workouts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const committed = JSON.parse(
  readFileSync(join(here, '../../../registry/workouts.canonical.json'), 'utf8'),
);
const fresh = buildWorkoutsDoc();

/** The `generated` stamp is `today()` — a rebuild always moves it, so it is not drift. */
const withoutStamp = (doc: Record<string, unknown>) => {
  const { generated, ...rest } = doc;
  return rest;
};

describe('workouts.canonical drift', () => {
  it('the envelope — comment, licence, count — is unchanged', () => {
    const c = withoutStamp(committed), f = withoutStamp(fresh);
    eq(f.$comment, c.$comment, '$comment');
    eq(f.licenceWarning, c.licenceWarning, 'licenceWarning');
    eq(f.count, c.count, 'count');
    eq(
      (f.workouts as { id: string }[]).map((w) => w.id),
      (c.workouts as { id: string }[]).map((w) => w.id),
      'workout ids, in order',
    );
  });

  const committedById = new Map(
    (committed.workouts as { id: string }[]).map((w) => [w.id, w]),
  );
  for (const w of fresh.workouts as { id: string }[]) {
    it(w.id, () => {
      const want = committedById.get(w.id);
      ok(want, `not in the committed file — run: node scripts/build-canonical.ts`);
      eq(w, want);
    });
  }
});
