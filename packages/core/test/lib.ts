/** Minimal zero-dependency test harness. */
let suite = '';
const results: { suite: string; name: string; error?: string; pending?: boolean }[] = [];

export function describe(name: string, fn: () => void) {
  const prev = suite; suite = name; fn(); suite = prev;
}

export function it(name: string, fn: () => void) {
  try { fn(); results.push({ suite, name }); }
  catch (e) { results.push({ suite, name, error: (e as Error).message }); }
}

/** A case the suite acknowledges but does not yet enforce. Keeps known gaps visible. */
export function pending(name: string, why: string) {
  results.push({ suite, name: `${name} — ${why}`, pending: true });
}

export function eq(actual: unknown, expected: unknown, what = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what ? what + ': ' : ''}expected ${b}, got ${a}`);
}

export function ok(cond: unknown, what = 'expected truthy') {
  if (!cond) throw new Error(what);
}

export function report(): number {
  const failed = results.filter((r) => r.error);
  const pend = results.filter((r) => r.pending);
  const bySuite = new Map<string, typeof results>();
  for (const r of results) {
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, []);
    bySuite.get(r.suite)!.push(r);
  }
  console.log();
  for (const [name, rs] of bySuite) {
    const bad = rs.filter((r) => r.error).length;
    const pd = rs.filter((r) => r.pending).length;
    const total = rs.length - pd;
    console.log(`  ${bad ? '✗' : '✓'} ${name.padEnd(28)} ${total - bad}/${total}${pd ? `  (${pd} pending)` : ''}`);
  }
  if (failed.length) {
    console.log('\n  failures:');
    for (const f of failed) console.log(`    ${f.suite} › ${f.name}\n      ${f.error}`);
  }
  if (pend.length) {
    console.log('\n  pending — known gaps, not yet enforced:');
    for (const p of pend) console.log(`    ${p.suite} › ${p.name}`);
  }
  const total = results.length - pend.length;
  console.log(`\n  ${total - failed.length}/${total} passing${pend.length ? `, ${pend.length} pending` : ''}\n`);
  return failed.length ? 1 : 0;
}
