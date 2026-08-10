/**
 * Sheiko notation -> WDL. Deliberately small and obvious, so the oracle in
 * interop.test.ts is testing the parser and timeline rather than this.
 *
 * Sheiko writes `percentage × reps × sets`, with a missing third number meaning
 * one set: `80%x3x5` is five sets of three at 80%.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export interface SheikoSet { load: string; reps: number; sets: number }

/** Split `50%x5, 80%x3x5` into loads, reps, and set counts. */
export function parseSheiko(spec: string): SheikoSet[] {
  return spec.split(',').map((chunk) => {
    const [load, reps, sets] = chunk.trim().split(/\s*x\s*/i);
    return { load: load.trim(), reps: Number(reps), sets: sets ? Number(sets) : 1 };
  });
}

export function toWdl(day: { id: string; exercises: { movement: string; sets: string }[] }, program: string): string {
  const lines = [`@program ${program}`, `@source sheiko`, '', `# ${program} — ${day.id}`, '', 'strength:'];
  for (const ex of day.exercises) {
    for (const s of parseSheiko(ex.sets)) {
      const load = s.load.endsWith('%') ? `${s.load} 1RM` : s.load;
      lines.push(`  - ${s.reps} ${ex.movement} @ ${load}${s.sets > 1 ? ` x${s.sets}` : ''}`);
    }
  }
  return lines.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = JSON.parse(readFileSync(join(here, 'sheiko-29.json'), 'utf8'));
  for (const day of data.days) {
    writeFileSync(join(here, `${day.id}.wdl`), toWdl(day, data.program));
  }
  console.log(`wrote ${data.days.length} days`);
}
