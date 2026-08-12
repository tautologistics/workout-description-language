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
    return name.endsWith('.ts') ? [rel] : [];
  });

describe('src/ is portable', () => {
  it('imports nothing from node:', () => {
    const offenders = modules(src).filter((rel) =>
      /from ['"]node:/.test(readFileSync(join(src, rel), 'utf8')));
    eq(offenders, [], 'move the filesystem part to packages/core/node/');
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
