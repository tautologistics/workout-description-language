#!/usr/bin/env node
/** wdl — format and check WDL files. */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';

const [cmd, ...args] = process.argv.slice(2);
const write = args.includes('-w') || args.includes('--write');
const files = args.filter((a) => !a.startsWith('-'));

if (!cmd || !['fmt', 'check'].includes(cmd) || files.length === 0) {
  console.error('usage: wdl <fmt|check> [-w] <file.wdl>...');
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const { workout, errors } = parse(src);
  for (const e of errors) {
    console.error(`${file}:${e.line}: ${e.message}`);
    failed++;
  }
  if (cmd === 'fmt') {
    const out = format(workout);
    if (write) { if (out !== src) writeFileSync(file, out); }
    else process.stdout.write(out);
  } else if (!errors.length) {
    console.log(`${file}: ok`);
  }
}
process.exit(failed ? 1 : 0);
