/**
 * The vocabulary: every syntactic form the spec documents, one case each.
 *
 * Why this exists. `corpus.test.ts` parses 190 real workouts and checks that
 * each one round-trips, which is a strong test of *stability* and a weak test
 * of *correctness* — it only ever sees the forms the corpus happens to use.
 * Measured, 13 of the 24 documented syntax features appear in **zero** corpus
 * files: alternatives, rx splits, thresholds, `note:`, `variants:`, the inline
 * brace form and the rest. Every defect the grammar exploration turned up lived
 * in that gap.
 *
 * So this file is deliberately a *vocabulary* rather than a sample of real
 * workouts: one case per form, plus the combinations where two forms have to
 * agree with each other. Add a case here whenever the language grows a form,
 * and whenever a bug turns out to be a form nothing exercised.
 *
 * Regenerate the snapshot deliberately, then read the diff:
 *   node test/golden/vocabulary.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../src/parse.ts';
import { format } from '../../src/format.ts';

/** Step lines, wrapped in a minimal block by the harness. */
export const STEP_FORMS: { group: string; lines: string[] }[] = [
  { group: 'quantity/reps', lines: [
    '10 Push-Up',
    '1 Back Squat',
    '100 Pull-Up',
    '10 reps Push-Up',
    '1 rep Snatch',
  ] },
  { group: 'quantity/calories', lines: [
    '20cal Row',
    '20 cal Row',
    '15 calories Row',
    // Spelled out and unspaced. `20cal` and `20 calories` are both amounts;
    // this one is not, and the difference is an accident of `^(\d+)\s*cal$`
    // rather than a decision. Pinned so the reading is visible either way.
    '20calories Row',
  ] },
  { group: 'quantity/distance', lines: [
    '400m Run',
    '400 m Run',
    '400 meters Run',
    '400 metres Run',
    '5km Run',
    '1mi Run',
    '1 mile Run',
    '1.5mi Run',
    '100ft Sled Push',
    '50yd Buddy Carry',
    '1000m Row',
  ] },
  { group: 'quantity/duration', lines: [
    '12min Bike',
    '12 min Bike',
    '12 minutes Bike',
    '90s Plank',
    '90 sec Plank',
    '45 seconds Hollow Hold',
    '1h Ride',
    '1min30s Plank',
    '1h30min Ride',
    '1:30 Plank',
    '2min Row',
  ] },
  { group: 'quantity/other', lines: [
    '8-12 Dumbbell Curl',
    '10-15 Cable Fly',
    // Descending, which is not a range anyone means. `parseQuantity` requires
    // min < max and otherwise leaves the digits in the movement name; the
    // grammar cannot state that constraint, so this is where the two part.
    '10-5 Squat',
    '1+ Deadlift',
    'max Pull-Up',
    'max Bench Press',
    '2min max Push-Up',
    '1min max Wall Ball @ 20lb',
    'Row',
  ] },
  { group: 'quantity/threshold', lines: [
    'Bike until HR > 160bpm',
    'Bike until HR < 130bpm',
    'Row until HR < Z2',
    'Row until HR below Z2',
    'Bike until power > 250W',
    'Bike until power > Z3',
    'Run until HR above 150bpm',
    'Row until HR under 120bpm',
  ] },
  { group: 'movement/naming', lines: [
    'Clean & Jerk',
    '30 Clean & Jerk',
    '10 Chest-to-Bar Pull-Up',
    '10 Dumbbell Hang Clean to Overhead @ 50lb',
    '3/4 Sit-Up',
    '20 Sumo Deadlift High-Pull @ 95lb',
    '10 Burpee Box Jump-Over @ 24in',
  ] },
  { group: 'target/load', lines: [
    '10 Thruster @ 95lb',
    '10 Thruster @ 95 lb',
    '10 Thruster @ 95lbs',
    '10 Thruster @ 95#',
    '21 KB Swing @ 24kg',
    '21 KB Swing @ 1.5pood',
    '21 KB Swing @ 2pood',
    '200m Farmers Carry @ 2x24kg',
    '12 Dumbbell Curl @ 2x35lb',
  ] },
  { group: 'target/relative', lines: [
    '3 Back Squat @ 85% 1RM',
    '1 Deadlift @ 105% TM',
    '10min Bike @ 55% FTP',
    '3 Back Squat @ 85% of heavy-single',
    '5 Front Squat @ of heavy-single',
    '5 Press @ 75%',
  ] },
  { group: 'target/other', lines: [
    '20 Box Jump @ 24in',
    '20 Box Jump @ 24"',
    '20 Box Jump @ 60cm',
    '100 Wall Ball @ 20lb @ 10ft',
    '100 Wall Ball @ 9kg to 10ft',
    '1000m Run @ 5k pace',
    '10km Run @ marathon pace',
    '10min Run @ threshold pace',
    '2000m Row @ 1:45/500m',
    '20min Bike @ 250W',
    '20min Bike @ 90% FTP',
    '30min Run @ Z2',
    '30min Run @ 145bpm',
    '5 Back Squat @ RPE 8',
    '5 Back Squat @ RIR 2',
    // A number with no unit. It stays `raw` on purpose: `@95` is 95lb in one
    // gym and 95kg in another, and a `load` needs a unit to be worth anything to
    // volume analysis or an exporter. Reading it as `raw` says "a target was
    // written and it means nothing yet", which is true; picking a unit would be
    // an invention. The question of whether `Load` should be able to hold an
    // absent unit is open — see known-debts.md.
    '10 Thruster @ 95',
  ] },
  { group: 'flags', lines: [
    '18 Thruster @ 115lb @tiebreak',
    '21 Thruster @tiebreak',
    // Spaced, and letters — so a *target*, not a flag. The tight spelling is
    // what makes a flag, because a spaced target legitimately begins with a
    // letter (`@ Z2`, `@ RPE 8`, `@ of heavy-single`). Pinned so the asymmetry
    // is a stated reading rather than an artefact of which rule ran first.
    '21 Thruster @ tiebreak',
    'max Pull-Up, unbroken',
    '2 Front Squat, building',
    '10 Deadlift, reversed',
    '10 Deadlift, open',
    // Two of them, uncommaed, and one beside an `@` flag. The *order* they land
    // in `flags` is what these pin: `peelTrailingQualifiers` strips from the
    // end, so it reads right to left, and the `@` regex runs over the whole
    // line first so an `@` flag is always hoisted in front. Neither is a
    // decision, and a grammar reads left to right — so these are the two lines
    // that will move when the parser is swapped over.
    '10 Deadlift unbroken building',
    '10 Deadlift building @tiebreak',
  ] },
  { group: 'right-to-left', lines: [
    // The same artefact as the two flag lines above, in the two other places it
    // shows: the hand-written parser applies a step's parts *right to left*, and
    // a grammar reads left to right. Neither line is coherent input — both state
    // a laterality or a completion condition twice — but the reversal is real and
    // these are where it is visible, so they are pinned rather than left to turn
    // up as a surprise diff on the day of the swap.
    //
    // `peelTrailingQualifiers` strips `each leg` first, then the paren replace
    // overwrites `laterality` with `both`; the grammar reads the paren first and
    // `each leg` last, so `per-side` wins.
    '5 Squat (both) each leg',
    // The threshold match runs before `parseQuantity`, so `max` never leaves the
    // head and the movement is literally named `max Row`; the grammar takes `max`
    // as the leading quantity and the threshold replaces it.
    'max Row until HR < Z1',
  ] },
  { group: 'laterality', lines: [
    '10 Pistol (split)',
    '10 Pistol (both)',
    '10 Pistol (per-side)',
    '10 Pistol (total)',
    '14 DB Curl each arm',
    '12 Dumbbell Row each arm @ 60lb',
    '10 Lunge each leg',
    '20 Sledgehammer Strike each side',
    '10 Farmers Carry each hand',
    '10 Step-Up per leg',
    '21 DB Snatch first arm',
    '21 DB Snatch second arm',
    '10 KB Press left arm',
    '10 KB Press right arm',
  ] },
  { group: 'alternating', lines: [
    '10 alternating DB Snatch @ 50lb',
    '10 alt DB Snatch @ 50lb',
    '10 DB Snatch alternating',
    '10 DB Snatch, alternating',
  ] },
  { group: 'team', lines: [
    '100 Wall Ball @ 20lb shared',
    '20 Burpee synchronized',
    '11 Clean & Jerk @ 155lb each',
    '4000m Row shared',
    '55ft Partner Barbell Carry @ 315lb shared',
  ] },
  { group: 'modifiers', lines: [
    '3 Back Squat @ 70% 1RM, tempo 33X1',
    '6 Front Squat @ 185lb, tempo 30X1',
    '1min Row, count cal',
    '1min Row, count reps',
    '1min Row, count distance',
    '1min Row, count calories',
    '1 Burpee, +1 each round',
    '3 DB Hang Clean to Overhead @ 50lb, +3 each round',
    '10 Back Squat @ 225lb, note: "pause at the bottom"',
    '10 Back Squat @ 225lb, note: pause at the bottom',
    '10min Bike, ramp 50% -> 75% FTP',
    '400m Run, wearing a 20lb vest',
    '3 Bench Press @ 80% 1RM x5',
    '3 Bench Press @ 70% 1RM x2',
    '5 Deadlift x3',
  ] },
  { group: 'alternatives', lines: [
    '1min Bike or Row',
    '10 Pull-Up or 15 Ring Row',
    '20 Push-Up | 10 Handstand Push-Up',
    '20 Push-Up / 10 Handstand Push-Up',
    '1min Bike or Row or SkiErg',
    '10 Pull-Up or 15 Ring Row or 20 Banded Pull-Down',
  ] },
  { group: 'rx-by-division', lines: [
    '30 Clean & Jerk (women 105lb / men 145lb)',
    '30 Clean & Jerk (men 145lb / women 105lb)',
    '30 Deadlift (105/145)',
    '21 Deadlift (155/225lb)',
    '30 Clean & Jerk (w 105lb / m 145lb)',
    // The two ways of writing an rx *and* a qualifier that work, kept beside
    // the way that does not (see `known-wrong`). A comma before the qualifier
    // reads; so does writing the qualifier first. A space does not.
    '10 Deadlift (105/145), unbroken',
    '10 Deadlift each arm (105/145)',
  ] },
  { group: 'combinations', lines: [
    '10 DB Snatch each arm @ 45lb',
    '10-12 Bulgarian Split Squat each leg @ 2x40lb',
    '8-12 Dumbbell Curl each arm @ 2x35lb',
    '5 Turkish Get-Up each side @ 1.5pood',
    '100ft Walking Lunge (split), 45lb plate overhead',
    'DB Snatch (split) @ 50lb',
    'DB Snatch first arm @ 50lb',
    'max KB Snatch (split) @ 1.5pood',
    '40 Wall Ball @ 20lb shared',
    '18 Thruster @ 115lb @tiebreak, unbroken',
    '10 Thruster @ 95lb, tempo 31X1, +1 each round',
  ] },
  { group: 'fail-open', lines: [
    // Unrecognized input. Held today as a note, which is a meaning it should
    // not acquire — see known-debts.md and queue item 0.
    '10 Thruster @ 95lb, some phrase nobody taught the parser',
    '10 Thruster, with a band',
    '400m Run, barefoot',
  ] },
  { group: 'known-wrong', lines: [
    // Read wrongly today, and pinned here so the fix shows up as a diff rather
    // than as a silent change. `@` with no space after it is matched as a flag
    // before the target split ever runs, and `\w` matches digits — so the load
    // is lost, `wdl check` still says ok, and `wdl fmt` rewrites the line to
    // `- 10 Thrusters, 95lb`. See known-debts.md.
    //
    // The grammar now states the rule the other way and states it deliberately:
    // the first character after the `@` decides, a letter opens a flag and a
    // digit opens a target. So all six of these are grammar exclusions, and the
    // swap (queue item 0a) is the fix.
    '10 Thruster @95lb',
    '10 Thruster @2x35lb',
    '10 Thruster @24kg',
    // No unit at all, which is the case that shows the rule does not key on
    // one. `@95` is a target the grammar holds as `raw`; the parser makes it a
    // flag called `95`.
    '10 Thruster @95',
    // Worse than a lost load: `@(\w[\w-]*)` stops at the `%`, so `85` becomes a
    // flag and `% 1RM` is left in the text — the movement ends up named
    // `Thruster % 1RM`, which resolves to nothing and takes the step out of
    // muscle and volume analysis too.
    '10 Thruster @85% 1RM',
    // A flag beside a tight load on one line. The parser reads two flags and no
    // target; the grammar reads one of each.
    '18 Thruster @115lb @tiebreak',
    // `sets x reps` written *before* the movement, which is how gyms write it and
    // how spec §1's own design rule 4 writes it — `5x5 Back Squat @ 225lb` is the
    // example given for "must stay a one-liner". Neither implementation reads it:
    // `parseQuantity` matches no pattern on `5x5`, so the whole thing becomes the
    // movement *name*, the quantity is `open`, and `wdl fmt` writes
    // `- 5x5 Back Squats @ 225lb`. The trailing spelling (`5 Deadlift x3`) works
    // and is pinned under `modifiers`; the grammar agrees with the parser here
    // rather than inventing a form, so this is a shared defect and not an
    // exclusion. Found 2026-08-15 by widening the differential test's step source
    // to the vocabulary's whole-document forms. See known-debts.md.
    '3x10 Curl',
    '5x5 Back Squat @ 225lb',
    // The same load, lost a second way. `@` is only split out of the *first*
    // comma segment, so a target written after a comma never reaches
    // `targets` — `applyQualifier` falls through and files it as a note. Same
    // consequence as the trio above: invisible to analysis, the builder and the
    // board, and `wdl check` says ok. Found by the differential grammar test,
    // which reads it as a target. See known-debts.md.
    '10 Thruster, @ 95lb',
    '10 Thruster, @ 24kg',
    '10 Thruster, @ 85% 1RM',
    // An rx split with a qualifier after it, space-separated: the whole paren
    // is swallowed into the *movement name*. `peelRx` only fires at the end of
    // a segment, so `Deadlift (105/145)` becomes the name, both loads are lost,
    // and the name resolves to no registry entry — so the step falls out of
    // muscle and volume analysis too, which is one worse than the `@95lb`
    // family. `wdl fmt` then pluralizes the name it was given and writes
    // `10 Deadlift (women 105lb / men 145lb)s each arm`, which is the whiteboard
    // constraint failing out loud. A comma instead of the space reads correctly
    // — both spellings are pinned under `rx-by-division` above. Found 2026-08-15
    // by parsing in the browser; see known-debts.md.
    '10 Deadlift (105/145) each arm',
    '10 DB Snatch (50/35lb) each side',
    '10 Deadlift (women 105lb / men 145lb) each arm',
    // The same shape with a flag rather than a laterality. This one does not
    // even settle: `fmt` writes `10 Deadlifts (105/145), unbroken`, which
    // *reparses* as an rx — so one pass of the formatter changes the tree and
    // the second changes it back. Listed in KNOWN_UNSETTLED in vocabulary.test.ts.
    '10 Deadlift (105/145) unbroken',
    '10 Deadlift (women 105lb / men 145lb) unbroken',
  ] },
  { group: 'whitespace-and-case', lines: [
    '10   Thruster   @   95lb',
    '10 THRUSTER @ 95LB',
    '10 thruster @ 95lb',
  ] },
];

/** Whole-document forms: blocks, scoring, preamble. */
export const SOURCES: { group: string; name: string; src: string }[] = [
  // --- block headers ---
  { group: 'block/repeat', name: 'rounds', src: '3 rounds:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'round singular', src: '1 round:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'sets', src: '5 sets:\n  - 5 Back Squat @ 225lb' },
  { group: 'block/repeat', name: 'rounds for time', src: '3 rounds for time:\n  - 10 Push-Up' },
  { group: 'block/sequence', name: 'for time', src: 'for time:\n  - 10 Push-Up' },
  { group: 'block/sequence', name: 'bare sequence', src: 'sequence:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap', src: 'AMRAP 12min:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap bare minutes', src: 'AMRAP 12:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap unbounded', src: 'AMRAP:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'for duration', src: 'for 12min:\n  - Run' },
  { group: 'block/clock', name: 'emom', src: 'EMOM 10min:\n  - 5 Power Clean @ 155lb' },
  { group: 'block/clock', name: 'e2mom', src: 'E2MOM 20min:\n  - 5 Power Clean @ 155lb' },
  { group: 'block/clock', name: 'every until failure', src: 'every 1min until failure:\n  - 5 Burpee' },
  { group: 'block/clock', name: 'every x count', src: 'every 3min x 5:\n  - 400m Run' },
  { group: 'block/clock', name: 'every bare', src: 'every 90s:\n  - 3 Deadlift @ 315lb' },
  { group: 'block/clock', name: 'work window', src: 'work 20s:\n  - Push-Up' },
  { group: 'block/clock', name: 'minute entry', src: 'min 1: 12cal Row' },
  { group: 'block/clock', name: 'minute entry long', src: 'minute 1: 12cal Row' },
  { group: 'block/ladder', name: 'dash scheme', src: '21-15-9:\n  - Thruster @ 95lb\n  - Pull-Up' },
  { group: 'block/ladder', name: 'run scheme', src: '1..10:\n  - Power Clean @ 135lb' },
  { group: 'block/ladder', name: 'pyramid', src: '1..5..1:\n  - Power Clean @ 135lb' },
  { group: 'block/ladder', name: 'descending run', src: '10..1:\n  - Burpee' },
  { group: 'block/ladder', name: 'scheme with unit', src: '250-500-750 m:\n  - Row' },
  { group: 'block/ladder', name: 'interval pyramid', src: '1..5..1 min:\n  - Bike' },
  { group: 'block/other', name: 'attempts', src: '3 attempts:\n  - 1 Snatch @ 95% 1RM' },
  { group: 'block/other', name: 'team of', src: 'team of 2:\n  - 100 Wall Ball @ 20lb shared' },
  { group: 'block/other', name: 'tally', src: 'any order:\n  - 100 Pull-Up\n  - 200 Push-Up' },
  { group: 'block/other', name: 'superset', src: 'superset:\n  - 10 Bench Press @ 135lb\n  - 10 Bent-Over Row @ 95lb' },
  { group: 'block/other', name: 'complex', src: 'complex:\n  - 1 Power Clean\n  - 1 Front Squat\n  - 1 Push Jerk' },
  { group: 'block/other', name: 'build to', src: 'build to a heavy single in 15min as heavy-single:\n  - Snatch' },
  { group: 'block/other', name: 'build to without a label', src: 'build to a heavy single in 15min:\n  - Snatch' },
  // Unrecognized, and held rather than rejected: a named sequence keeping every
  // child, plus a report. Pinned because "fail open" is a property of the format
  // and not an implementation detail — see queue item 0.
  { group: 'block/other', name: 'unrecognized header', src: '3 rounds of madness:\n  - 10 Push-Up' },
  { group: 'block/section', name: 'warmup', src: 'warmup:\n  - 400m Run' },
  { group: 'block/section', name: 'strength', src: 'strength:\n  - 5 Back Squat @ 225lb' },
  { group: 'block/section', name: 'conditioning', src: 'conditioning:\n  - AMRAP 12min:\n      - 10 Burpee' },
  { group: 'block/section', name: 'cooldown', src: 'cooldown:\n  - 5min Bike' },
  { group: 'block/section', name: 'accessory', src: 'accessory:\n  - 3x10 Curl' },
  { group: 'block/section', name: 'skill', src: 'skill:\n  - 10min Handstand Practice' },

  // --- block modifiers ---
  { group: 'block/modifier', name: 'cap', src: 'for time, cap 12min:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'carry on overrun', src: 'for time, cap 12min, carry on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'cut on overrun', src: 'for time, cap 12min, cut on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'fail on overrun', src: 'for time, cap 12min, fail on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'wearing', src: 'for time, wearing a 20lb vest:\n  - 1mi Run' },
  { group: 'block/modifier', name: 'as label', src: '3 rounds, as main:\n  - 10 Push-Up' },
  { group: 'block/modifier', name: 'inherited target', src: '3 rounds @ 95lb:\n  - 10 Thruster\n  - 10 Push Press' },
  { group: 'block/modifier', name: 'flags', src: '3 rounds, unbroken:\n  - 10 Pull-Up' },
  // A header target written after a comma. The `@` sweep in `parseHeader` runs
  // over the *first* comma segment only, so this never reaches `inherited` —
  // `applyBlockModifier` falls through and files `@ 95lb` as a flag, where
  // nothing inherits it and the children are loadless. The header-level twin of
  // `known-wrong :: 10 Thruster, @ 95lb`. The grammar reads it correctly, so it
  // is a listed exclusion in grammar.test.ts and the swap is the fix.
  { group: 'block/modifier', name: 'target after a comma', src: '3 rounds, @ 95lb:\n  - 10 Thruster' },
  // A target and a `for time` on the same header, both ways round. Written
  // target-first the load *and* the score are lost: `@\s*([^,@]+)` is greedy to
  // the end of the segment, so `95lb for time` goes to `parseTarget` whole and
  // comes back a raw target. Written score-first both read correctly. The
  // grammar has the same greed here — its target text stops at a comma or an
  // `@` and not at a `for time` — so this is a shared defect rather than an
  // exclusion, and stating it apart would need a header-local target rule.
  // See known-debts.md.
  { group: 'block/modifier', name: 'target then for time', src: '3 rounds @ 95lb for time:\n  - 10 Thruster' },
  { group: 'block/modifier', name: 'for time then target', src: '3 rounds for time @ 95lb:\n  - 10 Thruster' },

  // --- scoring ---
  { group: 'score', name: 'simple', src: 'for time:\n  - 100 Burpee\nscore: time' },
  { group: 'score', name: 'rounds + reps', src: 'AMRAP 12min:\n  - 10 Burpee\nscore: rounds + reps' },
  { group: 'score', name: 'per round', src: '5 rounds:\n  - 500m Row\nscore: time per round' },
  { group: 'score', name: 'min per round', src: '5 rounds:\n  - 500m Row\nscore: min per round' },
  { group: 'score', name: 'max per round', src: '5 rounds:\n  - 3 Back Squat\nscore: max per round' },
  { group: 'score', name: 'sum per round', src: '5 rounds:\n  - max Pull-Up\nscore: sum per round' },
  { group: 'score', name: 'sum of blocks', src: 'for time:\n  - 100 Burpee\nscore: sum of blocks' },
  { group: 'score', name: 'on cap', src: 'for time, cap 12min:\n  - 100 Burpee\nscore: time\non cap: reps completed' },
  { group: 'score', name: 'tiebreak', src: 'for time:\n  - 100 Burpee\nscore: time\ntiebreak: reps at 5min' },
  { group: 'score', name: 'brace form', src: 'for time:\n  - 100 Burpee\nscore: {primary: time, tiebreak: reps at 5min}' },
  { group: 'score', name: 'on a block', src: '3 rounds:\n  - 10 Push-Up\n  score: time' },
  { group: 'score', name: 'rounds + reps per round', src: '5 rounds:\n  - 10 Burpee\nscore: rounds + reps per round' },
  // A brace with no `primary:` field. `primary` becomes the *whole brace text* —
  // `{tiebreak: reps at 5min}` — which is not a thing anything can rank by, and
  // the canonical form then states the tiebreak twice: once inside the brace it
  // re-emits as `raw`, and once as its own `tiebreak:` line. Both halves are
  // defects and both are reproduced by the grammar, because a `primary` that
  // defaults to the raw text is what `parseScore` says. See known-debts.md.
  { group: 'score', name: 'brace form without a primary', src: 'for time:\n  - 100 Burpee\nscore: {tiebreak: reps at 5min}' },
  // The nested block form, which spec §9.5 and §9.6 both document. It is dropped
  // *entirely*: `parseScore` is handed `score:` with nothing after it, so
  // `primary` is the empty string, the children are never looked at, `wdl check`
  // says ok, and `wdl fmt` writes a bare `score:`. Found 2026-08-15 while stating
  // the score line in the grammar. See known-debts.md.
  { group: 'score', name: 'nested block form', src: 'for time:\n  - 100 Burpee\nscore:\n  primary: time\n  on cap: reps' },

  // --- preamble ---
  { group: 'preamble', name: 'title', src: '# Fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive', src: '@id fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directives many', src: '@id fran\n@author chris\nfor time:\n  - 21 Thruster @ 95lb' },
  // Not one of the 190 corpus workouts writes a directive, so these five are the
  // only coverage the forms have. `@id` takes an optional `namespace:` prefix and
  // is never derived from the contents (roadmap §3.2.1); a value is otherwise
  // uninterpreted, which is what makes `@tags`' commas ordinary text and a
  // directive with no value at all legitimate.
  { group: 'preamble', name: 'version directive', src: '@wdl 0.1\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'namespaced id', src: '@id crossfit:fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive with commas', src: '@tags conditioning, benchmark\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'date directive', src: '@date 2026-08-09\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive with no value', src: '@draft\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'comment own line', src: '// a note about this one\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'comment trailing', src: 'for time:\n  - 21 Thruster @ 95lb  // heavy' },

  // --- variants ---
  { group: 'variants', name: 'nested', src: 'variants:\n  women:\n    load: 65lb\n  men:\n    load: 95lb\nfor time:\n  - 21 Thruster' },
  { group: 'variants', name: 'inline brace', src: 'variants:\n  women: {load: 65lb}\n  men: {load: 95lb}\nfor time:\n  - 21 Thruster' },

  // --- rest ---
  { group: 'rest', name: 'duration', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min' },
  { group: 'rest', name: 'seconds', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 90s' },
  { group: 'rest', name: 'bare minutes word', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3 m' },
  { group: 'rest', name: 'as needed', src: '5 sets:\n  - 1 Snatch\n  rest as needed' },
  { group: 'rest', name: 'equal to work', src: '5 sets:\n  - 30s Bike\n  rest = work' },
  { group: 'rest', name: 'equal to work words', src: '5 sets:\n  - 30s Bike\n  rest equal to work' },
  { group: 'rest', name: 'after last', src: '5 sets:\n  - 30s Bike\n  rest 1min after last' },
  { group: 'rest', name: 'active recovery', src: '5 sets:\n  - 400m Run\n  rest 400m Jog' },
  { group: 'rest', name: 'threshold', src: '5 sets:\n  - 500m Row\n  rest until HR < 120bpm' },
  { group: 'rest', name: 'threshold zone', src: '5 sets:\n  - 500m Row\n  rest until HR < Z2' },
  // A rest line is the one place a duration's internal spacing is free, because
  // no movement name follows it for the spaces to be confused with —
  // `parseDuration` strips whitespace before matching. Pinned so that licence is
  // a stated property rather than a side effect of one `replace`.
  { group: 'rest', name: 'loose spacing', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 1 min 30 s' },
  { group: 'rest', name: 'bare minutes', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3' },
  { group: 'rest', name: 'clock', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 1:30' },
  // `after last` on each of the other four kinds of bound. All four are *parsed*
  // correctly and then **lost by the formatter**: `restText` returns early for
  // `as needed`, `= work`, active recovery and a threshold, so only a plain
  // duration ever gets ` after last` appended. So `wdl fmt` quietly turns "rest
  // only after the last round" into "rest between every round", which is a
  // different workout. Invisible to the fixpoint check, because the *second*
  // format of the shortened line is stable — one more way a round trip proves
  // stability and not correctness. Found 2026-08-15 by writing these
  // permutations while stating the rest line in the grammar. See known-debts.md.
  { group: 'rest', name: 'as needed after last', src: '5 sets:\n  - 1 Snatch\n  rest as needed after last' },
  { group: 'rest', name: 'equal to work after last', src: '5 sets:\n  - 30s Bike\n  rest = work after last' },
  { group: 'rest', name: 'active recovery after last', src: '5 sets:\n  - 400m Run\n  rest 400m Jog after last' },
  { group: 'rest', name: 'threshold after last', src: '5 sets:\n  - 500m Row\n  rest until HR < 120bpm after last' },
  // Spelled-out duration words, which work in a *step's* quantity position and in
  // none of these. `45 seconds Plank` is 45 seconds; `rest 45 seconds` is an
  // `unreadable rest duration` error **and** a rest with no bound at all, which
  // reads as unbounded. Spec §3 says these spellings are accepted "wherever a
  // duration is expected", and a rest is a duration position. Neither
  // implementation reads them, so these are listed as parser *rejects* in
  // grammar.test.ts rather than as disagreements — the one shape a differential
  // test cannot see on its own. Found 2026-08-15 by typing lines into the
  // browser. See known-debts.md.
  { group: 'rest', name: 'spelled-out seconds', src: '5 sets:\n  - 30s Bike\n  rest 45 seconds' },
  { group: 'rest', name: 'spelled-out minutes', src: '5 sets:\n  - 30s Bike\n  rest 2 mins' },
  { group: 'rest', name: 'spelled-out hours', src: '5 sets:\n  - 30s Bike\n  rest 1 hour' },

  // --- overlays and nesting ---
  { group: 'structure', name: 'interrupt overlay', src: 'AMRAP 20min:\n  - 10 Burpee\n  every 1min: 5 Push-Up' },
  { group: 'structure', name: 'choice block', src: 'for time:\n  choice:\n    - 1000m Row\n    - 800m Run\n    - 2000m Bike' },
  { group: 'structure', name: 'inline brace body', src: '8 rounds: { work 20s: Pull-Up, rest 10s }' },
  { group: 'structure', name: 'nested blocks', src: '3 rounds:\n  - AMRAP 3min:\n      - 10 Burpee\n  rest 1min' },
  { group: 'structure', name: 'deep nesting', src: 'conditioning:\n  - 3 rounds:\n      - AMRAP 2min:\n          - 5 Pull-Up' },
  { group: 'structure', name: 'many top-level blocks', src: 'warmup:\n  - 400m Run\nstrength:\n  - 5 Back Squat @ 225lb\nconditioning:\n  - AMRAP 10min:\n      - 10 Burpee' },
];

/** Compare ASTs ignoring source position and comment placement. */
export function strip(v: any): any {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v).sort()) {
      if (k === 'line' || k === 'comments') continue;
      const s = strip(v[k]);
      if (s !== undefined && !(Array.isArray(s) && s.length === 0)) o[k] = s;
    }
    return o;
  }
  return v;
}

/** Wrap a bare step line in the smallest block that can hold it. */
export const wrap = (line: string) => `for time:\n  - ${line}`;

/**
 * Two different properties, and conflating them is how a wrong reading survives.
 *
 * `ast` pins what the input *means* — the correctness half. Only a pinned
 * interpretation catches a misreading: `10 Thruster @95lb` is a perfect text
 * fixpoint and a perfectly stable canonical form, and it is still wrong,
 * because the load became a flag. Nothing about round-tripping can see that.
 * A human reading `flags: ["95lb"]` in this snapshot's diff can.
 *
 * `fixpoint` pins that the canonical form is settled — the stability half.
 * Formatting once may legitimately change the tree (`Push-Up` is pluralized to
 * `Push-Ups`); formatting *twice* must not change anything.
 */
export function digest(src: string) {
  const first = parse(src);
  const canonical = format(first.workout).trim();

  const second = parse(canonical);
  const again = format(second.workout).trim();
  const third = parse(again);

  return {
    canonical,
    errors: first.errors.map((e) => `L${e.line} ${e.message}`),
    ast: strip(first.workout),
    fixpoint: canonical === again
      && JSON.stringify(strip(second.workout)) === JSON.stringify(strip(third.workout)),
  };
}

export function allCases(): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  for (const { group, lines } of STEP_FORMS) {
    for (const line of lines) out.push({ key: `${group} :: ${line}`, src: wrap(line) });
  }
  for (const { group, name, src } of SOURCES) {
    out.push({ key: `${group} :: ${name}`, src });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out: Record<string, unknown> = {};
  for (const { key, src } of allCases()) out[key] = digest(src);
  writeFileSync(join(here, 'vocabulary.json'), JSON.stringify(out, null, 1) + '\n');
  const cases = Object.values(out) as { errors: string[]; fixpoint: boolean }[];
  console.log(`snapshot written for ${cases.length} forms`);
  console.log(`  ${cases.filter((c) => c.errors.length).length} produce a parse error`);
  console.log(`  ${cases.filter((c) => !c.fixpoint).length} whose canonical form is not a fixpoint`);
  void readFileSync; // keep the import honest when the snapshot is only written
}
