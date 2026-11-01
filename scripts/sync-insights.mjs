#!/usr/bin/env node
// Pull Graph API data per period and store encrypted snapshots in insights-dashboard/data/.
// Run by .github/workflows/insights-sync.yml (daily) — or locally:
//   FB_GRAPH_TOKEN=... DATA_PASSPHRASE=... node scripts/sync-insights.mjs
//
// Env:
//   FB_GRAPH_TOKEN   (required) System User / long-lived token
//   DATA_PASSPHRASE  (required) passphrase used to encrypt snapshots (dashboard asks for it)
//   GRAPH_VERSION    default v24.0
//   MONTHS           how many months back to (re)check, default 3 (current + 2 previous)
//   PERIODS          optional comma list to force, e.g. "2026-09-H1,2026-09-M"
//   FORCE            "true" → re-fetch even frozen periods
//   FREEZE_DAYS      days after period end before a snapshot is frozen, default 7
//   PAGE_MATCH       regex for page names, default LABX / ปักปากกา
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, discover, buildSnapshot, encryptJson, periodRange, bangkokDate, PAGE_MATCH_DEFAULT } from '../insights-dashboard/collect.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'insights-dashboard', 'data');
const env = process.env;
const token = env.FB_GRAPH_TOKEN, pass = env.DATA_PASSPHRASE;
if (!token || !pass) { console.error('ต้องตั้ง FB_GRAPH_TOKEN และ DATA_PASSPHRASE'); process.exit(1); }
if (pass.length < 12) { console.error('DATA_PASSPHRASE ควรยาวอย่างน้อย 12 ตัวอักษร'); process.exit(1); }
const MONTHS = +(env.MONTHS || 3), FREEZE = +(env.FREEZE_DAYS || 7), FORCE = env.FORCE === 'true';

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const today = bangkokDate(0), yesterday = bangkokDate(-1);

function targetPeriods() {
  if (env.PERIODS) return env.PERIODS.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  const [y, m] = today.split('-').map(Number);
  for (let i = 0; i < MONTHS; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push(`${ym}-H1`, `${ym}-M`);
  }
  return out;
}

async function main() {
  await mkdir(DATA, { recursive: true });
  let index = { version: 1, periods: {} };
  try { index = JSON.parse(await readFile(join(DATA, 'index.json'), 'utf8')); } catch { /* first run */ }

  const c = createClient({ token, ver: env.GRAPH_VERSION || 'v24.0', log: s => console.log('  ·', s) });
  const { pages: allPages, adAccounts } = await discover(c);
  const re = new RegExp(env.PAGE_MATCH || PAGE_MATCH_DEFAULT, 'i');
  const pages = allPages.filter(p => re.test(p.name));
  const acts = adAccounts.filter(a => a.account_status === 1);
  console.log(`Pages: ${pages.map(p => p.name + (p.ig ? ' (+IG)' : '')).join(', ') || '-'}`);
  console.log(`Ad accounts: ${acts.map(a => a.name).join(', ') || '-'}`);
  if (!pages.length) { console.error(`ไม่พบเพจที่ชื่อตรงกับ /${re.source}/ จาก ${allPages.length} เพจ`); process.exit(1); }

  let ok = 0, failed = 0;
  for (const id of targetPeriods()) {
    const r = periodRange(id);
    if (r.since > yesterday) { console.log(`- ${id}: ยังไม่เริ่ม → ข้าม`); continue; }
    const until = r.until < yesterday ? r.until : yesterday;
    const partial = until < r.until;
    const final = !partial && today > addDays(r.until, FREEZE);
    const prev = index.periods[id];
    if (prev?.final && !FORCE) { console.log(`- ${id}: frozen (${prev.fetchedAt}) → ข้าม`); continue; }
    console.log(`- ${id}: ดึง ${r.since} → ${until}${partial ? ' (ยังไม่ครบช่วง)' : ''}${final ? ' [freeze]' : ''}`);
    try {
      const t0 = Date.now();
      const snap = await buildSnapshot(c, { pages, adAccounts: acts, period: id, since: r.since, until, onStatus: s => console.log('   ', s) });
      Object.assign(snap, { partial, final, fullUntil: r.until });
      await writeFile(join(DATA, `${id}.json`), JSON.stringify(await encryptJson(snap, pass)));
      index.periods[id] = { since: r.since, until, fullUntil: r.until, partial, final, fetchedAt: snap.fetchedAt, items: snap.items.length, warnings: snap.warnings.length };
      console.log(`  ✓ ${snap.items.length} items, ${snap.warnings.length} warnings, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      ok++;
    } catch (e) { console.error(`  ✗ ${id}: ${e.message}`); failed++; }
  }
  index.updatedAt = new Date().toISOString();
  index.periods = Object.fromEntries(Object.entries(index.periods).sort(([a], [b]) => b.localeCompare(a)));
  await writeFile(join(DATA, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Done: ${ok} ok, ${failed} failed`);
  if (failed && !ok) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
