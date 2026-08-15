/**
 * `src/` runs anywhere.
 *
 * The parser, timeline compiler, validator, goal checker and generator are the
 * majority of this project, and none of them should care what they are running
 * on. Everything that needs a filesystem lives outside `src/` — `node.ts` and
 * `node/` — and the core is handed its data rather than fetching it.
 *
 * This is a checked invariant rather than a convention, because it is the kind
 * that decays the moment one module adds one convenient import: the Node tests
 * keep passing, and the breakage only shows up in a browser months later.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { provide, required, reset, has } from '../src/env.ts';
import { defaultRegistry } from '../src/registry.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src');

const modules = (dir: string, prefix = ''): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) return modules(full, rel);
    // A `.d.ts` is types and nothing else — nothing emits it and nothing loads
    // it. A vendored `.js` is checked like everything else: it ships too.
    if (name.endsWith('.d.ts')) return [];
    return /\.(ts|js)$/.test(name) ? [rel] : [];
  });

/**
 * Every module specifier in a file: `from '…'`, a bare `import '…'` for effect,
 * and a dynamic `import('…')`.
 *
 * A static import is a statement, so it is read at the start of a line only.
 * That is not fussiness: `env.ts` tells a caller to `import "@wdl/core/node"`
 * in an error message, and reading imports anywhere in a file makes prose about
 * importing indistinguishable from importing.
 *
 * The same lines are in `scripts/build-web.mjs`, which asks the same question of
 * the emit. Kept in both rather than shared, because that file is a standalone
 * script and importing it would run it.
 */
const specifiers = (code: string): string[] =>
  [...code.matchAll(/^\s*(?:import|export)\s*(?:[\w*{},\s]*\bfrom\s*)?['"]([^'"]+)['"]|(?:^|[^.\w$])import\s*\(\s*['"]([^'"]+)['"]/gm)]
    .map((m) => m[1] ?? m[2]);

describe('src/ is portable', () => {
  it('imports by relative path and no other way', () => {
    // Not "imports nothing from node:", which is what this asked until
    // 2026-08-15 and is half the rule. A browser has no resolver: no
    // node_modules, no import map unless a page writes one. `node:fs` and
    // `ohm-js` fail there in exactly the same way, and the narrower test watched
    // `import * as ohm from 'ohm-js'` walk into `build/web/core/` and stay
    // there. Relative or nothing.
    const offenders = modules(src).flatMap((rel) =>
      specifiers(readFileSync(join(src, rel), 'utf8'))
        .filter((spec) => !spec.startsWith('.'))
        .map((spec) => `${rel} imports '${spec}'`));
    eq(offenders, [],
      'move a filesystem part to packages/core/node/; vendor a library into src/grammar/vendor/');
  });

  it('sees every way an import can be written', () => {
    // The rule above is worth exactly what the scan behind it is worth, and the
    // scan is a regex. `import * as ohm from 'ohm-js'` sat in `src/` through a
    // green suite because the old one looked for the word `node:`. So the forms
    // are enumerated here rather than trusted.
    const sample = `
      import * as ohm from 'ohm-js';
      import { readFileSync } from "node:fs";
      import './vendor/ohm.min.js';
      import type { Step } from '../ast.ts';
      export { parse } from '../parse.ts';
      export * from './ast.ts';
      export { local };
      const extras = await import('ohm-js/extras');
    `;
    eq(specifiers(sample), [
      'ohm-js', 'node:fs', './vendor/ohm.min.js', '../ast.ts',
      '../parse.ts', './ast.ts', 'ohm-js/extras',
    ], 'every specifier, and `export { local }` is not one');
    eq(specifiers(sample).filter((s) => !s.startsWith('.')),
      ['ohm-js', 'node:fs', 'ohm-js/extras'], 'and these three are what fails in a browser');
  });

  it('names no path into the repository', () => {
    // A module that knows where `registry/` lives is a module that cannot run
    // anywhere else, even if it reaches it through something other than fs.
    const offenders = modules(src).filter((rel) => {
      const code = readFileSync(join(src, rel), 'utf8');
      // env.ts lists the filenames in an error message; that is a hint, not a path.
      return rel !== 'env.ts' && /['"][^'"]*registry\/[a-z-]+\.json['"]/.test(code);
    });
    eq(offenders, []);
  });

  it('covers the whole core, not a subset of it', () => {
    const all = modules(src);
    ok(all.length >= 15, `${all.length} modules checked`);
    for (const expected of ['parse.ts', 'timeline.ts', 'validate.ts', 'goals.ts', 'generate.ts']) {
      ok(all.includes(expected), `${expected} is in the checked set`);
    }
  });
});

describe('the core is handed its data', () => {
  it('says what is missing rather than behaving as though nothing is', () => {
    // Only this key is dropped: `reset()` with no argument would take the muscle
    // vocabulary with it and break every test that runs after this one.
    // An empty registry would make every movement unregistered and quietly
    // switch off half of `validate`.
    const saved = required('movements');
    reset('movements');
    let message = '';
    try { defaultRegistry(); } catch (e) { message = (e as Error).message; }
    ok(message.includes('movements'), `names the data: ${message}`);
    ok(message.includes('registry/movements.json'), `says where it comes from: ${message}`);
    provide({ movements: () => saved });
  });

  it('takes a replacement, and forgets what it read before', () => {
    const saved = required('movements');
    provide({ movements: () => [{ id: 'only-thing', title: 'Only Thing' }] });
    eq(defaultRegistry().entries.length, 1);
    eq(defaultRegistry().resolve('Only Thing').status, 'ok');
    provide({ movements: () => saved });
    ok(defaultRegistry().entries.length > 1, 'and back again');
  });

  it('reads nothing until something asks', () => {
    let opened = 0;
    const saved = required('movements');
    provide({ movements: () => { opened++; return saved; } });
    eq(opened, 0, 'providing is not reading');
    defaultRegistry();
    defaultRegistry();
    eq(opened, 1, 'read once, then kept');
    provide({ movements: () => saved });
  });

  it('can be asked whether it has something, without demanding it', () => {
    ok(has('movements'));
    eq(has('garminExercises'), true, 'the node host provides all four');
  });
});
