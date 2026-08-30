#!/usr/bin/env node
/**
 * Deploy the static builder + board to the public instance.
 *
 *   node scripts/deploy-web.mjs [--ssh user@host] [--remote-dir pb/pb_public]
 *                               [--dry-run] [--stage-only] [--skip-tests]
 *
 * The public instance (DEC-016, deploy/README.md) is one PocketBase process on
 * Chris's DreamHost VPS. The DreamHost panel proxy sends the *whole* domain to
 * PocketBase, so the static apps are served from PocketBase's own `pb_public/`
 * directory — there is no separate nginx root to point at. This script builds
 * the served subtree the way `scripts/serve.mjs` lays it out (repo-shaped, so
 * the apps' `../../build/...`, `../../spec/...`, `../../registry/...`,
 * `../../examples/...` relative fetches all resolve) and rsyncs it there.
 *
 * Steps, in order, bailing on the first failure:
 *   1. `npm --prefix packages/core test`   — never ship a red suite
 *   2. `node scripts/build-web.mjs`         — emit build/web/core/ as browser modules
 *   3. assemble build/deploy/pb_public/     — apps/, build/web/, the spec /
 *      registry / examples files the apps actually fetch, and a generated
 *      index.html that lands `/` on the builder
 *   4. `rsync -az --delete build/deploy/pb_public/ <ssh>:<remote-dir>/`
 *
 * The SSH target is not baked in: pass `--ssh user@host` or set WDL_DEPLOY_SSH
 * (e.g. `androidempathy_wex@wex.androidempathy.com`). With neither, every step
 * up to the rsync runs and the exact rsync command is printed for a hand /
 * paired run. `--stage-only` stops after step 3; `--dry-run` runs rsync with
 * `-n`; `--skip-tests` is for iterating on the layout only — never for a real
 * deploy.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const ssh = opt('--ssh', process.env.WDL_DEPLOY_SSH ?? '');
const remoteDir = opt('--remote-dir', process.env.WDL_DEPLOY_DIR ?? 'pb/pb_public');
const dryRun = flag('--dry-run');
const stageOnly = flag('--stage-only');
const skipTests = flag('--skip-tests');

const STAGE = 'build/deploy/pb_public';

// What the served tree must contain, repo-shaped. The directory copies are
// wholesale; the single files are the ones `apps/builder/builder.js` and
// `apps/display/board.js` fetch by name (grep them for the paths). Everything
// else in the repo — packages/, node_modules, docs/, .git, test/, the rest of
// spec/ and registry/ and examples/ — is deliberately not shipped.
const COPY = [
  ['apps', 'apps'],
  ['build/web', 'build/web'],
  ['examples/goals', 'examples/goals'],
  ['spec/grammar-0.1.ohm', 'spec/grammar-0.1.ohm'],
  ['registry/movements.json', 'registry/movements.json'],
  ['registry/movements.canonical.json', 'registry/movements.canonical.json'],
  ['registry/muscles.json', 'registry/muscles.json'],
];

// `/` lands on the builder. Generated here so `rsync --delete` cannot wipe a
// hand-placed file — anything in pb_public/ that this script does not write is
// removed on the next deploy.
const INDEX_HTML = `<!doctype html>
<meta charset="utf-8">
<title>WDL</title>
<meta http-equiv="refresh" content="0; url=/apps/builder/">
<link rel="canonical" href="/apps/builder/">
<style>body{font:15px/1.6 ui-monospace,monospace;margin:2rem auto;max-width:40rem;padding:0 1rem}a{color:inherit}</style>
<p><a href="/apps/builder/">WDL builder &rarr;</a></p>
<script>location.replace('/apps/builder/');</script>
`;

const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
};

// 1. Tests.
if (skipTests) {
  console.log('! --skip-tests: not running the suite (layout iteration only)');
} else {
  run('npm', ['--prefix', 'packages/core', 'test']);
}

// 2. Browser build.
run('node', ['scripts/build-web.mjs']);
if (!existsSync('build/web/core') || readdirSync('build/web/core').length === 0) {
  console.error('build/web/core is empty after build-web.mjs — aborting');
  process.exit(1);
}

// 3. Assemble the staging tree from scratch every run.
rmSync('build/deploy', { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const [from, to] of COPY) {
  if (!existsSync(from)) {
    console.error(`missing ${from} — aborting`);
    process.exit(1);
  }
  const dest = join(STAGE, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(from, dest, { recursive: true });
}
writeFileSync(join(STAGE, 'index.html'), INDEX_HTML);
console.log(`staged -> ${STAGE}/`);

if (stageOnly) {
  console.log('--stage-only: stopping before rsync');
  process.exit(0);
}

// 4. Push.
const rsyncArgs = ['-az', '--delete', ...(dryRun ? ['-n', '-v'] : []), `${STAGE}/`];
if (!ssh) {
  console.log('\nNo --ssh / WDL_DEPLOY_SSH set. Staging tree is ready; run:\n');
  console.log(`  rsync ${rsyncArgs.join(' ')} <user@host>:${remoteDir}/\n`);
  console.log('(that user@host is the DreamHost VPS account — see deploy/README.md)');
  process.exit(0);
}
run('rsync', [...rsyncArgs, `${ssh}:${remoteDir}/`]);
console.log(dryRun ? '\ndry run only — nothing was written' : '\ndeployed.');
