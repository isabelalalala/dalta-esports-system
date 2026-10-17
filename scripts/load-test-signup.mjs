#!/usr/bin/env node
// Load test: N concurrent user signups through the same path the register form
// uses — Supabase Auth /auth/v1/signup (which also fires the handle_new_user
// profile trigger). No app server in this path; the test measures Auth + the
// profile trigger under concurrent load.
//
// Target selection (first match wins):
//   --url/--anon-key flags
//   SUPABASE_URL / SUPABASE_ANON_KEY env vars
//   local stack defaults (supabase start) — the safe default: disposable data,
//   no email spam, raised rate limit in supabase/config.toml
// Deliberately does NOT read .env: it usually points at a live project, and
// hosted Supabase rate-limits signups per IP + confirmation emails per hour
// (verified: 50/50 requests rejected with 429). Point at a hosted project only
// via the flags/env vars above, knowing what you're doing.
//
// Usage:
//   node scripts/load-test-signup.mjs                        # 1000 users, 100 concurrent, local stack
//   node scripts/load-test-signup.mjs --users 50 --concurrency 25
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/load-test-signup.mjs

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => [a.replace(/^--/, ''), arr[i + 1]])
);
const USERS = Number(args.users ?? 1000);
const CONCURRENCY = Number(args.concurrency ?? 100);
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const BASE_URL = (
  args.url ??
  process.env.SUPABASE_URL ??
  'http://127.0.0.1:54321'
).replace(/\/$/, '');
const ANON_KEY = args['anon-key'] ?? process.env.SUPABASE_ANON_KEY ?? LOCAL_ANON;

const run = `lt-${Date.now().toString(36)}`;
const results = { ok: 0, failed: 0, latencies: [], codes: new Map() };
let next = 0;

async function signup(i) {
  const email = `${run}-${i}@dalta-loadtest.local`;
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: `LoadTest-${i}-pwd`,
        data: { full_name: `Load Test ${i}`, privacy_consent_version: 'loadtest' },
      }),
    });
    const ms = performance.now() - t0;
    results.latencies.push(ms);
    results.codes.set(res.status, (results.codes.get(res.status) ?? 0) + 1);
    if (res.status === 200 && ((await res.json()).user?.id ?? null)) results.ok++;
    else results.failed++;
  } catch {
    results.latencies.push(performance.now() - t0);
    results.codes.set('ERR', (results.codes.get('ERR') ?? 0) + 1);
    results.failed++;
  }
}

async function worker() {
  while (next < USERS) await signup(next++);
}

console.log(`Signup load test: ${USERS} users, ${CONCURRENCY} concurrent`);
console.log(`Target: ${BASE_URL}/auth/v1/signup  (run id: ${run})\n`);

const t0 = performance.now();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, USERS) }, worker));
const secs = (performance.now() - t0) / 1000;

const p = (q) => {
  const s = [...results.latencies].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]?.toFixed(0) ?? '-';
};

console.log(`Done in ${secs.toFixed(1)}s  (${(USERS / secs).toFixed(0)} signups/s)`);
console.log(`OK: ${results.ok}   Failed: ${results.failed}`);
console.log(`Latency ms — p50: ${p(0.5)}  p95: ${p(0.95)}  p99: ${p(0.99)}`);
console.log('Status codes:', Object.fromEntries(results.codes));
console.log(`\nVerify profiles: select count(*) from profiles where email like '${run}-%';`);
process.exit(results.failed > 0 ? 1 : 0);
