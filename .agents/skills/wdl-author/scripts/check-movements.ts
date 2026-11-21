#!/usr/bin/env node
/**
 * Which movements in a .wdl file does the registry know?
 *
 * `wdl check` validates structure but does not say when a movement name matches
 * nothing in the registry — and an unregistered movement silently drops out of
 * muscle, volume and goal analysis. This reports every step's movement (and
 * each `or` alternative) against the merged canonical corpus, so a drafted
 * workout can be corrected to a name the registry resolves before it is handed
 * over.
 *
 * Needs a checkout of the WDL repo, found in this order: $WDL_HOME, then the
 * nearest directory at or above the working directory holding
 * packages/core/node.ts, then the one above this script (the in-repo case).
 * Installed outside the repo, pass WDL_HOME=$(sh scripts/wdl-home.sh), which
 * falls back to a cached clone of the public GitHub mirror.
 * Node 22.6+ strips the types; nothing to install.
 *
 *   node <skill-dir>/scripts/check-movements.ts <file.wdl>...
 *
 * Exit status: 0 when every movement resolves, 1 when any is unregistered or
 * ambiguous, 2 on a usage or parse error.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The nearest directory at or above `from` that is a WDL checkout. */
function findUp(from: string): string | undefined {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'packages/core/node.ts'))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

const home =
  (process.env.WDL_HOME && findUp(process.env.WDL_HOME)) ??
  findUp(process.cwd()) ??
  findUp(dirname(fileURLToPath(import.meta.url)));
if (!home) {
  console.error('check-movements: no WDL checkout found. Run with WDL_HOME=$(sh <skill>/scripts/wdl-home.sh).');
  process.exit(2);
}
const { parse, canonicalRegistry } = await import(pathToFileURL(join(home, 'packages/core/node.ts')).href);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: check-movements.ts <file.wdl>...');
  process.exit(2);
}

/** Every step node in the tree, however deeply nested. Shape-agnostic on purpose. */
function* steps(value: unknown): Generator<any> {
  if (Array.isArray(value)) {
    for (const v of value) yield* steps(v);
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.node === 'step') yield obj;
    for (const v of Object.values(obj)) yield* steps(v);
  }
}

const registry = canonicalRegistry();
let bad = 0;

for (const file of files) {
  let tree: unknown;
  try {
    tree = parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${file}: parse failed — ${(err as Error).message}`);
    process.exit(2);
  }
  const seen = new Set<string>();
  for (const step of steps(tree)) {
    const names = [step.movement, ...((step.options ?? []) as any[]).map((o) => o.movement)];
    for (const name of names) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const r = registry.resolve(name);
      if (r.status === 'ok') {
        console.log(`ok          ${name}  →  ${r.entry.title} (${r.entry.id}, via ${r.via})`);
      } else if (r.status === 'ambiguous') {
        bad++;
        console.log(`AMBIGUOUS   ${name}  →  ${r.candidates.map((c) => c.title).join(' | ')}`);
      } else {
        bad++;
        console.log(`UNREGISTERED ${name}`);
      }
    }
  }
}

process.exit(bad ? 1 : 0);
