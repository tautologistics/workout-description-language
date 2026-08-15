/**
 * The Node entry point: everything the core does, plus the data it needs.
 *
 * `src/` is deliberately free of `node:` imports — the parser, timeline
 * compiler, validator, goal checker and generator all run in a browser
 * unchanged. What they cannot do is find the movement corpus, so a host hands it
 * to them. This is that host for Node; a web app is the other one.
 *
 * Providers are thunks, so nothing is read until something asks. `wdl fmt` never
 * opens the three-thousand-record canonical corpus.
 *
 * Import this rather than `src/index.ts` on Node. Importing the latter alone
 * gets you a core that throws by name the first time it needs data.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provide } from './src/env.ts';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const registry = join(repo, 'registry');
const read = (name: string) => JSON.parse(readFileSync(join(registry, name), 'utf8'));

provide({
  // The grammar is the parser (see `src/grammar/parser.ts`), so this one is not
  // a feature switch: without it nothing parses at all. It is still a thunk and
  // still handed over rather than read from inside `src/`, because the rule that
  // `src/` opens no files does not bend for the file it happens to need most.
  grammar: () => readFileSync(join(repo, 'spec/grammar-0.1.ohm'), 'utf8'),
  movements: () => read('movements.json').movements,
  canonicalMovements: () => read('movements.canonical.json').movements,
  muscles: () => read('muscles.json').muscles,
  garminExercises: () => read('garmin-exercises.json'),
});

export * from './src/index.ts';
export { loadProgram, checkProgram } from './node/program.ts';
export type { LoadedProgram, LoadedSession } from './node/program.ts';
