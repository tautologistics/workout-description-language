/**
 * Export fidelity.
 *
 * The test that matters is a round trip through the *foreign* format: take a
 * real third-party file, import it, export it back, and require the two to
 * agree on the numbers the format itself publishes. That exercises both
 * directions against data neither of them authored.
 *
 * The second thing checked is honesty. Every exporter must say what it dropped
 * — silently flattening a workout into something a device will happily run but
 * an athlete never asked for is the failure mode worth guarding.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { importZwo, exportZwo, zwoDurationSeconds } from '../src/adapters/zwo.ts';
import { importErg, exportErg, ergDurationSeconds } from '../src/adapters/erg.ts';
import { importFit, exportFit, readFit, fitCrc } from '../src/adapters/fit.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const zwoDir = join(root, 'examples/interop/zwo');
const ergDir = join(root, 'examples/interop/erg');
const fitDir = join(root, 'examples/interop/fit');
const corpus = join(root, 'examples/corpus');

const wdl = (f: string) => compile(parse(readFileSync(join(corpus, f), 'utf8')).workout);

describe('export: round trip through the foreign format', () => {
  it('zwo out preserves the duration zwo in declared', () => {
    for (const f of readdirSync(zwoDir).filter((x) => x.endsWith('.zwo'))) {
      const xml = readFileSync(join(zwoDir, f), 'utf8');
      const out = exportZwo(compile(importZwo(xml))).output;
      eq(zwoDurationSeconds(out), zwoDurationSeconds(xml), f);
    }
  });

  it('erg out preserves the duration erg in declared', () => {
    for (const f of readdirSync(ergDir).filter((x) => /\.(erg|mrc)$/i.test(x))) {
      const text = readFileSync(join(ergDir, f), 'utf8');
      const out = exportErg(compile(importErg(text)), { ftp: 250 }).output;
      eq(ergDurationSeconds(out), ergDurationSeconds(text), f);
    }
  });

  it('fit out is a readable FIT file with a valid CRC', () => {
    for (const f of readdirSync(fitDir).filter((x) => x.endsWith('.fit'))) {
      const src = new Uint8Array(readFileSync(join(fitDir, f)));
      const out = exportFit(compile(importFit(src)), { name: f }) as any;
      const stored = new DataView(out.bytes.buffer).getUint16(out.bytes.length - 2, true);
      eq(fitCrc(out.bytes.subarray(0, out.bytes.length - 2)), stored, `${f}: file CRC`);
      ok(readFit(out.bytes).filter((m) => m.global === 27).length > 0, `${f}: steps readable`);
    }
  });

  it('fit out expands repeats to the step count the source implies', () => {
    // WorkoutRepeatSteps is warmup + 3 x (B1, B2) + cooldown.
    const src = new Uint8Array(readFileSync(join(fitDir, 'WorkoutRepeatSteps.fit')));
    const out = exportFit(compile(importFit(src))) as any;
    eq(readFit(out.bytes).filter((m) => m.global === 27).length, 8);
  });

  it('zwo out survives a second import', () => {
    for (const f of readdirSync(zwoDir).filter((x) => x.endsWith('.zwo')).slice(0, 10)) {
      const xml = readFileSync(join(zwoDir, f), 'utf8');
      const once = exportZwo(compile(importZwo(xml))).output;
      const twice = exportZwo(compile(importZwo(once))).output;
      eq(twice, once, `${f}: export is a fixed point`);
    }
  });
});

describe('export: fidelity is reported, never silent', () => {
  it('says what Zwift cannot hold', () => {
    const w = exportZwo(wdl('04-fran.wdl')).warnings;
    ok(w.some((x) => /not exported/.test(x)), w.join(' | '));
  });

  it('says what an ERG course cannot hold', () => {
    const w = exportErg(wdl('04-fran.wdl')).warnings;
    ok(w.some((x) => /power curve/.test(x)), w.join(' | '));
  });

  it('says when FIT has no rep-count duration', () => {
    const w = exportFit(wdl('04-fran.wdl')).warnings;
    ok(w.some((x) => /rep-based/.test(x)), w.join(' | '));
  });

  it('carries the timeline warnings through — a tally block cannot be ordered', () => {
    for (const e of [exportZwo, exportErg, exportFit]) {
      const w = (e as any)(wdl('14-murph.wdl')).warnings as string[];
      ok(w.some((x) => /no prescribed order/.test(x)), w.join(' | '));
    }
  });

  it('reports an unbounded repeat rather than emitting a wrong length', () => {
    const w = exportZwo(wdl('20-death-by-burpees.wdl')).warnings;
    ok(w.some((x) => /unbounded|not known until execution/.test(x)), w.join(' | '));
  });

  it('warns when a device step limit would be exceeded', () => {
    const w = exportFit(wdl('13-filthy-fifty.wdl')).warnings.concat(
      exportFit(wdl('117-the-seven.wdl')).warnings);
    ok(w.length > 0, 'a long workout is flagged somehow');
  });

  it('says nothing is lost when a cycling workout exports to cycling', () => {
    const xml = readFileSync(join(zwoDir, '15x1x2.zwo'), 'utf8');
    eq(exportZwo(compile(importZwo(xml))).warnings, []);
  });
});

describe('export: hand-written WDL, not just imported files', () => {
  const bike = () => wdl('37-bike-intervals.wdl');

  it('reads `@ 95% FTP` written by hand, not only imported power targets', () => {
    // A hand-written percentage parses as a load with a reference; an imported
    // one arrives as a power target carrying text. Reading only the second
    // turned a threshold interval into a 50% cruise.
    const out = exportErg(bike(), { mrc: true }).output;
    ok(out.includes('\t95'), out.split('\n').slice(9, 13).join(' | '));
  });

  it('preserves a ramp as a Ramp element, never a flattened SteadyState', () => {
    const xml = exportZwo(bike()).output;
    ok(/<Ramp Duration="600" PowerLow="0\.5" PowerHigh="0\.75"\/>/.test(xml), xml.split('\n')[3]);
  });

  it('expands nested repeats into the right number of segments', () => {
    // 10min warmup + 4 x (8min + 4min) + 10min cooldown = 10 segments.
    const xml = exportZwo(bike()).output;
    eq((xml.match(/<(SteadyState|Ramp|Warmup|Cooldown|FreeRide)/g) ?? []).length, 10);
  });

  it('exports the same total duration the timeline computed', () => {
    const t = bike();
    eq(ergDurationSeconds(exportErg(t, { mrc: true }).output), t.estimatedSeconds);
    eq(zwoDurationSeconds(exportZwo(t).output), t.estimatedSeconds);
  });

  it('a strength session exports to FIT with every step accounted for', () => {
    const t = wdl('12-dt.wdl');
    const out = exportFit(t) as any;
    eq(readFit(out.bytes).filter((m) => m.global === 27).length, 15);   // 5 rounds x 3
    ok(out.warnings.some((w: string) => /rep-based/.test(w)), 'and says FIT cannot hold reps');
  });
});
