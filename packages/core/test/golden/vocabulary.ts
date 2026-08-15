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
  ] },
  { group: 'flags', lines: [
    '18 Thruster @ 115lb @tiebreak',
    '21 Thruster @tiebreak',
    'max Pull-Up, unbroken',
    '2 Front Squat, building',
    '10 Deadlift, reversed',
    '10 Deadlift, open',
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
    '10 Thruster @95lb',
    '10 Thruster @2x35lb',
    '10 Thruster @24kg',
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

  // --- preamble ---
  { group: 'preamble', name: 'title', src: '# Fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive', src: '@id fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directives many', src: '@id fran\n@author chris\nfor time:\n  - 21 Thruster @ 95lb' },
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
