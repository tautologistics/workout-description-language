#!/usr/bin/env node
/** wdl — format and check WDL files. */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile, outline, fmtClock } from '../src/timeline.ts';

const [cmd, ...args] = process.argv.slice(2);
const write = args.includes('-w') || args.includes('--write');
const files = args.filter((a) => !a.startsWith('-'));

if (!cmd || !['fmt', 'check', 'timeline'].includes(cmd) || files.length === 0) {
  console.error('usage: wdl <fmt|check|timeline> [-w] <file.wdl>...');
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
  } else if (cmd === 'timeline') {
    const t = compile(workout);
    console.log(outline(t).join('\n'));
    console.log(t.estimatedSeconds !== undefined
      ? `\n  duration: ${fmtClock(t.estimatedSeconds)}`
      : '\n  duration: athlete-paced');
    for (const w of t.warnings) console.log(`  warning: ${w}`);
  } else if (!errors.length) {
    console.log(`${file}: ok`);
  }
}
process.exit(failed ? 1 : 0);
