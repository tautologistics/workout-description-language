#!/usr/bin/env node
/** wdl — format and check WDL files. */
import '../node.ts';   // hands the core its data; src/ reads no files itself
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile, outline, fmtClock } from '../src/timeline.ts';
import { validate } from '../src/validate.ts';
import { divisions, resolve } from '../src/variants.ts';
import { exportZwo } from '../src/adapters/zwo.ts';
import { exportErg } from '../src/adapters/erg.ts';
import { exportFit } from '../src/adapters/fit.ts';
import { exportGarminConnect } from '../src/adapters/garmin-connect.ts';
import { parseGoals, check, checkSeries } from '../src/goals.ts';
import { parseResult, checkResult, resultSeries } from '../src/result.ts';
import { generate, generateProgram } from '../src/generate.ts';
import { loadProgram, checkProgram } from '../node/program.ts';

const [cmd, ...args] = process.argv.slice(2);
const write = args.includes('-w') || args.includes('--write');
const files = args.filter((a, i) => !a.startsWith('-')
  && !['--to', '-o', '--ftp', '--goals', '--seed', '--equipment', '--program', '--variant'].includes(args[i - 1] ?? ''));

const EXPORTERS = ['zwo', 'erg', 'mrc', 'fit', 'connect'] as const;
const toIdx = args.indexOf('--to');
const to = toIdx >= 0 ? args[toIdx + 1] : undefined;
const ftpIdx = args.indexOf('--ftp');
const ftpArg = ftpIdx >= 0 ? Number(args[ftpIdx + 1]) : undefined;
const outIdx = args.indexOf('-o');
const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;
const goalsIdx = args.indexOf('--goals');
const goalsPath = goalsIdx >= 0 ? args[goalsIdx + 1] : undefined;
const seedIdx = args.indexOf('--seed');
const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : undefined;
const programIdx = args.indexOf('--program');
const programPath = programIdx >= 0 ? args[programIdx + 1] : undefined;
const variantIdx = args.indexOf('--variant');
const variant = variantIdx >= 0 ? args[variantIdx + 1] : undefined;
const equipIdx = args.indexOf('--equipment');
const equipment = equipIdx >= 0 ? args[equipIdx + 1].split(',').map((x) => x.trim()) : undefined;

if (!cmd || !['fmt', 'check', 'timeline', 'export', 'goals', 'generate', 'program', 'result'].includes(cmd) || (files.length === 0 && !programPath)
    || (cmd === 'export' && !EXPORTERS.includes(to as any))
    || (cmd === 'goals' && !goalsPath)
    || (cmd === 'generate' && !goalsPath && !programPath)) {
  console.error('usage: wdl <fmt|check|timeline> [-w] [--variant <name>] <file.wdl>...');
  console.error('       --variant reads the file as one division: an rx split or a `variants:` entry');
  console.error('       wdl export --to <zwo|erg|mrc|fit|connect> [-o out] [--ftp N] [--no-power-targets] <file.wdl>');
  console.error('       wdl goals --goals <file.wdlg> <file.wdl>...   check workouts against a set of goals');
  console.error('       wdl generate --goals <file.wdlg> [--seed N] [--equipment a,b] <template.wdl>');
  console.error('              a template is a workout with `?` where a movement goes');
  console.error('       wdl program <file.wdlp>   check a training block against the goals it names');
  console.error('       wdl result [--goals <file.wdlg>] <file.wdlr>...   check what was done against');
  console.error('              what it was a result of, and the series against a `progress` rule');
  console.error('       wdl generate --program <file.wdlp> [-w] [--seed N] [--equipment a,b]');
  console.error('              fill the holes across a whole block, one choice per slot');
  process.exit(2);
}

/**
 * Four record types share one CLI, and only one of them can be rewritten in
 * place. `wdl fmt -w` reads anything as a workout, so pointed at a goals file, a
 * program or a **result** it would parse the fields as steps and write the
 * mangling back over the file. Everything else here is recoverable — a workout
 * can be retyped, a goals file rewritten — and a training log cannot.
 *
 * The extension is the whole of the check, deliberately: sniffing the contents
 * would be a fifth grammar guessing at the other four. A file with no extension
 * or an unexpected one is left alone, because the guard exists to catch the
 * obvious mistake (`wdl fmt -w *`) and not to police what anybody names a file.
 */
const KIND: Record<string, string> = {
  '': 'a workout', wdlg: 'a goals file', wdlp: 'a program', wdlr: 'a result',
};
const extensionOf = (f: string) => (f.match(/\.(wdl[gpr])$/i)?.[1] ?? '').toLowerCase();
/** What each verb's file arguments are. Everything not listed reads workouts. */
const READS: Record<string, string> = { program: 'wdlp', result: 'wdlr' };
for (const file of files) {
  const ext = extensionOf(file);
  const wanted = READS[cmd] ?? '';
  if (ext === wanted) continue;
  console.error(`${file} is ${KIND[ext]}, not ${KIND[wanted]} — \`wdl ${cmd}\` reads it as one`
    + (wanted === '' && write ? ', and `-w` would write the misreading back over it' : ''));
  process.exit(2);
}

// A program names its own goals and its own sessions, so it needs no flags.
if (cmd === 'program') {
  let bad = 0;
  for (const file of files) {
    const loaded = loadProgram(file);
    for (const e of loaded.errors) {
      console.error(`${file}${e.line ? `:${e.line}` : ''}: ${e.message}`);
      bad++;
    }
    if (!loaded.sessions.length) continue;
    const { perWorkout, findings } = checkProgram(loaded);
    if (loaded.program.title) console.log(loaded.program.title);
    console.log(`${loaded.sessions.length} sessions over ${loaded.program.cycles.length} cycles`
      + `, in ${new Set(loaded.sessions.map((s) => s.slot)).size} slots`);
    for (const { name, report } of perWorkout) {
      const notes = [
        ...(report.unresolved.length ? [`no muscle data for ${report.unresolved.join(', ')}`] : []),
        ...(report.unbounded ? ['open-ended: amounts below are floors'] : []),
      ];
      console.log(`\n${name}${notes.length ? `  (${notes.join('; ')})` : ''}`);
      if (!report.findings.length) console.log('  ok');
      for (const f of report.findings) {
        console.log(`  ${f.rule}: ${f.message}${f.count > 1 ? `  (×${f.count})` : ''}`);
        bad++;
      }
    }
    console.log('\nacross the block');
    if (!findings.length) console.log('  ok');
    for (const f of findings) { console.log(`  ${f.rule}: ${f.message}`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}

/**
 * `result` reads what was actually done.
 *
 * Two questions, and the second only when asked. Each record is checked against
 * its own snapshot — did this division exist, does this score have the shape the
 * workout declared, is a recorded load for a movement the workout contains. Then,
 * with `--goals`, the records are read **in date order as one series**, which is
 * the only way a `progress` rule about load can be asked at all: the weight on
 * the bar is a fact about an execution, so a series of executions is what has to
 * be compared.
 */
if (cmd === 'result') {
  let bad = 0;
  const results = [];
  for (const file of files) {
    const r = parseResult(readFileSync(file, 'utf8'));
    for (const e of r.errors) { console.error(`${file}:${e.line}: ${e.message}`); bad++; }
    const { diagnostics } = checkResult(r);
    for (const d of diagnostics) {
      const where = d.line ? `${file}:${d.line}` : file;
      console.log(`${where}: ${d.severity}: ${d.message}`);
      if (d.severity === 'error') bad++;
    }
    if (!r.errors.length && !diagnostics.length) console.log(`${file}: ok`);
    results.push(r);
  }

  if (goalsPath) {
    const goals = parseGoals(readFileSync(goalsPath, 'utf8'));
    for (const e of goals.errors) console.error(`${goalsPath}:${e.line}: ${e.message}`);
    if (goals.errors.length) process.exit(2);
    const series = resultSeries(results);
    if (!series.length) {
      console.error('nothing to check a series against: no result carries a snapshot');
      process.exit(2);
    }
    const { perWorkout, findings } = checkSeries(series, goals);
    for (const { name, report } of perWorkout) {
      const notes = [
        ...(report.unresolved.length ? [`no muscle data for ${report.unresolved.join(', ')}`] : []),
        ...(report.unbounded ? ['open-ended: amounts below are floors'] : []),
      ];
      console.log(`\n${name}${notes.length ? `  (${notes.join('; ')})` : ''}`);
      if (!report.findings.length) console.log('  ok');
      for (const f of report.findings) { console.log(`  ${f.rule}: ${f.message}${f.count > 1 ? `  (\u00d7${f.count})` : ''}`); bad++; }
    }
    console.log('\nacross the series');
    if (!findings.length) console.log('  ok');
    for (const f of findings) { console.log(`  ${f.rule}: ${f.message}`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}

// `generate` fills the `?` holes in a template so the result satisfies the
// goals. The structure stays the author's; only the movements are chosen.
if (cmd === 'generate' && programPath) {
  const loaded = loadProgram(programPath);
  // Workouts that will not read are expected here: they are templates full of
  // holes, and reading them is this command's job. Anything else is fatal.
  for (const e of loaded.errors) console.error(`${programPath}${e.line ? `:${e.line}` : ''}: ${e.message}`);
  // Generating against no rules is not generating; it is picking the first thing
  // that fits. Refuse rather than write six files nobody asked for.
  if (!loaded.goals.rules.length) {
    console.error(`${programPath}: no goals to generate against`);
    process.exit(2);
  }
  const dir = dirname(programPath);
  const entries = loaded.program.cycles.flatMap((c) =>
    c.entries.map((e) => ({ cycle: c.label, slot: e.slot, file: join(dir, e.file) })));
  const r = generateProgram(
    entries.map((e) => ({ name: `${e.cycle} · ${e.slot}`, slot: e.slot,
      workout: parse(readFileSync(e.file, 'utf8')).workout })),
    loaded.goals, { seed, equipment });

  let bad = 0;
  r.sessions.forEach((s, i) => {
    const out = format(s.workout);
    if (write) writeFileSync(entries[i].file, out);
    else { console.log(`--- ${entries[i].file}`); process.stdout.write(out); }
  });
  for (const h of r.unfilled) {
    console.error(`${programPath}: "? ${h.constraint.join(' ')}" left open — ${h.candidates.length
      ? 'no choice for it leaves the rules satisfiable' : 'nothing in the pool satisfies it'}`);
    bad++;
  }
  if (r.gaveUp) console.error(`${programPath}: gave up after ${r.searched} assignments; this is the best found`);
  for (const w of r.perWorkout) {
    for (const f of w.findings) { console.error(`${w.name}: ${f.rule}: ${f.message}`); bad++; }
  }
  for (const f of r.findings) { console.error(`across the block: ${f.rule}: ${f.message}`); bad++; }
  process.exit(bad ? 1 : 0);
}

if (cmd === 'generate') {
  const goals = parseGoals(readFileSync(goalsPath!, 'utf8'));
  for (const e of goals.errors) console.error(`${goalsPath}:${e.line}: ${e.message}`);
  if (goals.errors.length) process.exit(2);

  let bad = 0;
  for (const file of files) {
    const r = generate(parse(readFileSync(file, 'utf8')).workout, goals, { seed, equipment });
    process.stdout.write(format(r.workout));
    for (const h of r.unfilled) {
      const why = h.candidates.length
        ? `no choice for it leaves the rules satisfiable`
        : `nothing in the pool satisfies it`;
      console.error(`${file}${h.line ? `:${h.line}` : ''}: "? ${h.constraint.join(' ')}" left open — ${why}`);
      bad++;
    }
    if (r.gaveUp) console.error(`${file}: gave up after ${r.searched} assignments; this is the best found`);
    for (const f of r.findings) {
      console.error(`${file}: ${f.rule}: ${f.message}${f.count > 1 ? `  (×${f.count})` : ''}`);
      bad++;
    }
  }
  process.exit(bad ? 1 : 0);
}

// `goals` reads every file as one block, in the order given, because a
// `progress` rule is a statement about a series and cannot be checked one file
// at a time.
if (cmd === 'goals') {
  const goals = parseGoals(readFileSync(goalsPath!, 'utf8'));
  for (const e of goals.errors) console.error(`${goalsPath}:${e.line}: ${e.message}`);
  if (goals.errors.length) process.exit(2);
  if (goals.title) console.log(`goals: ${goals.title}`);

  const series = files.map((f) => {
    const w = parse(readFileSync(f, 'utf8')).workout;
    return { name: w.title || basename(f).replace(/\.wdl$/i, ''), timeline: compile(w) };
  });
  const { perWorkout, findings } = checkSeries(series, goals);
  let bad = 0;
  for (const { name, report } of perWorkout) {
    const notes = [
      ...(report.unresolved.length ? [`no muscle data for ${report.unresolved.join(', ')}`] : []),
      ...(report.unbounded ? ['open-ended: amounts below are floors'] : []),
    ];
    console.log(`\n${name}${notes.length ? `  (${notes.join('; ')})` : ''}`);
    if (!report.findings.length) console.log('  ok');
    for (const f of report.findings) { console.log(`  ${f.rule}: ${f.message}${f.count > 1 ? `  (×${f.count})` : ''}`); bad++; }
  }
  if (findings.length) {
    console.log(`\nacross the block`);
    for (const f of findings) { console.log(`  ${f.rule}: ${f.message}`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}

let failed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const parsed = parse(src);
  const { errors } = parsed;
  for (const e of errors) {
    console.error(`${file}:${e.line}: ${e.message}`);
    failed++;
  }
  // One hook for every verb, which is the point of the flag: `fmt`, `export`,
  // `timeline` and `check` all read the workout the chosen division reads, and
  // none of them knows whether the load came from an rx split or a `variants:`
  // entry. Applied before anything looks at the tree.
  let workout = parsed.workout;
  if (variant) {
    const r = resolve(workout, variant);
    for (const d of r.diagnostics) {
      console.error(`${file}${d.line ? `:${d.line}` : ''}: ${d.severity}: ${d.message}`);
      if (d.severity === 'error') failed++;
    }
    if (r.diagnostics.some((d) => d.severity === 'error')) continue;
    workout = r.workout;
  }
  if (cmd === 'fmt') {
    const out = format(workout);
    if (write) { if (out !== src) writeFileSync(file, out); }
    else process.stdout.write(out);
  } else if (cmd === 'export') {
    const t = compile(workout);
    const name = workout.title || basename(file).replace(/\.wdl$/i, '');
    const r = to === 'zwo' ? exportZwo(t, { name })
      : to === 'connect' ? exportGarminConnect(t, { name, powerTargets: !args.includes('--no-power-targets'), ftp: ftpArg })
      : to === 'fit' ? exportFit(t, { name })
      : exportErg(t, { mrc: to === 'mrc', name });
    for (const warn of r.warnings) console.error(`${file}: warning: ${warn}`);
    if (outPath) {
      writeFileSync(outPath, (r as any).bytes ?? r.output);
      console.error(`wrote ${outPath}`);
    } else if ((r as any).bytes) {
      console.error(`${file}: ${to} is binary — use -o to write it`);
    } else {
      process.stdout.write(r.output);
    }
  } else if (cmd === 'timeline') {
    const t = compile(workout);
    console.log(outline(t).join('\n'));
    console.log(t.estimatedSeconds !== undefined
      ? `\n  duration: ${fmtClock(t.estimatedSeconds)}`
      : '\n  duration: athlete-paced');
    for (const w of t.warnings) console.log(`  warning: ${w}`);
  } else if (cmd === 'check') {
    const diags = validate(workout);
    for (const d of diags) {
      const where = d.line ? `${file}:${d.line}` : file;
      console.log(`${where}: ${d.severity}: ${d.message}`);
      for (const c of d.candidates ?? []) console.log(`    - ${c}`);
    }
    if (diags.some((d) => d.severity === 'error')) failed++;
    if (!errors.length && !diags.length) console.log(`${file}: ok`);
  }
}
process.exit(failed ? 1 : 0);
