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
 * so there is nothing here to shim, patch or substitute. **There is no module
 * resolution here and there should not be**: a specifier that needs resolving is
 * a specifier the browser cannot follow either. `src/grammar/vendor/` exists so
 * that the one library the core runs is reachable by relative path, and the
 * check at the bottom is what keeps it that way.
 *
 * A `.js` under `src/` is therefore a vendored file — already a browser module,
 * and verifiable against where it came from only while it is copied verbatim, so
 * it is copied verbatim. A `.d.ts` is types and nothing but types; there is
 * nothing in it to emit.
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
  if (name.endsWith('.d.ts')) return [];
  return /\.(ts|js)$/.test(name) ? [rel] : [];
});

/**
 * Every module specifier in a file: `from '…'`, a bare `import '…'` for effect,
 * and a dynamic `import('…')`.
 *
 * A static import is a statement, so it is read at the start of a line only —
 * `env.ts` tells a caller to `import "@wdl/core/node"` inside an error message,
 * and prose about importing is not importing.
 *
 * The same lines are in `packages/core/test/portable.test.ts`, which asks the
 * same question of the source. Kept in both rather than shared, because this
 * file is a standalone script and importing it would run it.
 */
const specifiers = (code) =>
  [...code.matchAll(/^\s*(?:import|export)\s*(?:[\w*{},\s]*\bfrom\s*)?['"]([^'"]+)['"]|(?:^|[^.\w$])import\s*\(\s*['"]([^'"]+)['"]/gm)]
    .map((m) => m[1] ?? m[2]);

function build() {
  const emitted = [];
  for (const rel of files('.')) {
    const source = readFileSync(join(SRC, rel), 'utf8');
    const code = rel.endsWith('.js') ? source
      : stripTypeScriptTypes(source).replace(/(from\s+|import\s*\()(['"])(\.[^'"]+?)\.ts\2/g,
        (m, kw, q, path) => `${kw}${q}${path}.js${q}`);
    const out = rel.replace(/\.ts$/, '.js');
    mkdirSync(dirname(join(OUT, out)), { recursive: true });
    writeFileSync(join(OUT, out), code);
    emitted.push(out);
  }

  // A browser resolves relative paths and nothing else. It has no node_modules,
  // no import map unless a page writes one, and no idea what `ohm-js` or
  // `node:fs` mean — it fails at load time with an error naming a module the app
  // author never mentioned. Every specifier that leaves here has to be one the
  // browser can follow on its own, so anything that is not relative is named
  // here, beside the file it is in.
  const leaked = emitted.flatMap((out) =>
    specifiers(readFileSync(join(OUT, out), 'utf8'))
      .filter((spec) => !spec.startsWith('.'))
      .map((spec) => `${out} imports '${spec}'`));
  return { emitted, leaked };
}

const report = () => {
  const { emitted, leaked } = build();
  console.log(`${emitted.length} modules -> ${OUT}`);
  if (leaked.length) {
    console.error('  these specifiers are not relative and a browser cannot resolve them:');
    for (const one of leaked) console.error(`    ${one}`);
    console.error('  src/ must stay portable: move a filesystem part to packages/core/node/,');
    console.error('  and vendor a library into src/grammar/vendor/ so it can be imported by path.');
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
