#!/usr/bin/env node
/**
 * Emit the core as plain ES modules a browser can load.
 *
 *   node scripts/build-web.mjs [--watch]
 *
 * No bundler and no dependencies. Node ships a TypeScript type stripper, and
 * type stripping is the whole of what a browser needs: `src/` is already ES
 * modules with relative specifiers and imports nothing from `node:`. One rewrite
 * finishes the job — `.ts` becomes `.js` in every specifier.
 *
 * That the emit is this trivial is the point. Every module needing a filesystem
 * lives outside `src/`, and the core is handed its data rather than fetching it,
 * so there is nothing here to shim, patch or substitute.
 *
 * Type stripping blanks types out in place rather than removing them, so line
 * numbers survive and a stack trace in the browser points at the real source
 * line.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, watch } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const SRC = 'packages/core/src';
const OUT = 'build/web/core';

const files = (dir, prefix = '') => readdirSync(join(SRC, dir)).flatMap((name) => {
  const rel = prefix ? `${prefix}/${name}` : name;
  if (statSync(join(SRC, dir, name)).isDirectory()) return files(join(dir, name), rel);
  return name.endsWith('.ts') ? [rel] : [];
});

function build() {
  const emitted = [];
  for (const rel of files('.')) {
    let code = stripTypeScriptTypes(readFileSync(join(SRC, rel), 'utf8'));
    code = code.replace(/(from\s+|import\s*\()(['"])(\.[^'"]+?)\.ts\2/g,
      (m, kw, q, path) => `${kw}${q}${path}.js${q}`);
    const out = join(OUT, rel.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, code);
    emitted.push(rel);
  }

  // Anything still importing node: would fail in the browser at load time, with
  // an error naming a module the app author never mentioned. Say it here.
  const leaked = emitted.filter((rel) =>
    /from ['"]node:/.test(readFileSync(join(OUT, rel.replace(/\.ts$/, '.js')), 'utf8')));
  return { emitted, leaked };
}

const report = () => {
  const { emitted, leaked } = build();
  console.log(`${emitted.length} modules -> ${OUT}`);
  if (leaked.length) {
    console.error(`  these import node: builtins and will fail in a browser: ${leaked.join(', ')}`);
    console.error('  src/ must stay portable — move the filesystem part to packages/core/node/.');
    return 1;
  }
  return 0;
};

if (process.argv.includes('--watch')) {
  report();
  console.log('watching…');
  let pending;
  watch(SRC, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(() => report(), 50);
  });
} else {
  process.exit(report());
}
