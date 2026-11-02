// Shared Graph API collector — used by the browser (Live mode) and by
// scripts/sync-insights.mjs (GitHub Actions snapshot job). No dependencies.

export const PAGE_MATCH_DEFAULT = 'lab\\s*x|ปักปากกา|pakpakka|pak\\s*pakka';
export const TZ = '+07:00'; // Asia/Bangkok
export const DEMO_SOURCES = { facebook: ['followers', 'ads'], instagram: ['followers', 'engaged', 'reached', 'ads'] };
export const DEMO_LOCS = ['city', 'country'];

const RETRY_CODES = new Set([1, 2, 4, 17, 32, 341, 613, 80001, 80002, 80004, 80005, 80006, 80008]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class GraphError extends Error { constructor(m, code) { super(m); this.code = code; } }

/* ------------------------------ client ------------------------------ */
export function createClient({ token, ver = 'v24.0', log = () => {}, fetchImpl = globalThis.fetch.bind(globalThis), retries = 4 }) {
  async function fetchJson(url) {
    for (let a = 0; ; a++) {
      let r, j;
      try { r = await fetchImpl(url); j = await r.json().catch(() => ({})); }
      catch (e) { if (a < retries) { await sleep(1000 * 2 ** a); continue; } throw new GraphError('Network error: ' + e.message); }
      if (r.ok && !j.error) return j;
      const code = j.error?.code;
      if (a < retries && (RETRY_CODES.has(code) || r.status >= 500 || j.error?.is_transient)) {
        const wait = 2000 * 2 ** a; log(`rate-limit/transient (code ${code ?? r.status}) → รอ ${wait / 1000}s`); await sleep(wait); continue;
      }
      throw new GraphError(j.error?.message || `HTTP ${r.status}`, code);
    }
  }
  async function g(path, params = {}, tok = token) {
    const u = new URL(`https://graph.facebook.com/${ver}/${path}`);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    u.searchParams.set('access_token', tok);
    return fetchJson(u.toString());
  }
  async function gAll(path, params, tok = token, { maxPages = 40, stop } = {}) {
    const out = []; let j = await g(path, params, tok), n = 0;
    for (;;) {
      const d = j.data || []; out.push(...d); n++;
      if (stop && stop(d)) break;
      if (!j.paging?.next || n >= maxPages) break;
      j = await fetchJson(j.paging.next);
    }
    return out;
  }
  return { g, gAll, token, ver, log, fbViewStart: 0 };
}

export async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

/* ------------------------------ helpers ------------------------------ */
export function mval(m) {
  if (!m) return null;
  if (m.total_value && typeof m.total_value.value === 'number') return m.total_value.value;
  const v = m.values; if (!v || !v.length) return null;
  const x = v[v.length - 1].value;
  if (typeof x === 'number') return x;
  if (x && typeof x === 'object') return Object.values(x).reduce((a, b) => a + (+b || 0), 0);
  return null;
}
function adsPart(m) {
  if (!m) return null;
  const b = m.total_value?.breakdowns?.[0];
  if (b?.results) { let s = 0; for (const r of b.results) { const dv = String(r.dimension_values?.[0]).toLowerCase(); if (dv === 'true' || dv === '1' || dv === 'paid') s += +r.value || 0; } return s; }
  const x = m.values?.[m.values.length - 1]?.value;
  if (x && typeof x === 'object') { let s = 0; for (const [k, v] of Object.entries(x)) if (/^(true|1|paid)$/i.test(k)) s += +v || 0; return s; }
  return null;
}
const byName = data => Object.fromEntries((data || []).map(m => [m.name, m]));
const normG = g => { g = String(g).toLowerCase(); return g === 'f' || g === 'female' ? 'F' : g === 'm' || g === 'male' ? 'M' : 'U'; };

/* ------------------------------ periods ------------------------------ */
// id: 'YYYY-MM-H1' (1–15) | 'YYYY-MM-M' (full month)
export function periodRange(id) {
  const [y, m, k] = id.split('-');
  const last = new Date(Date.UTC(+y, +m, 0)).getUTCDate();
  return { since: `${y}-${m}-01`, until: `${y}-${m}-${k === 'H1' ? '15' : String(last).padStart(2, '0')}` };
}
export function prevPeriod(id) {
  const [y, m, k] = id.split('-');
  const d = new Date(Date.UTC(+y, +m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${k}`;
}
export function bangkokDate(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
}

/* ------------------------------ discovery ------------------------------ */
export async function discover(c) {
  let accounts = [];
  try {
    accounts = await c.gAll('me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username,followers_count}', limit: 100 });
  } catch (e) { c.log('me/accounts: ' + e.message); }
  if (!accounts.length) {
    const me = await c.g('me', { fields: 'id,name,instagram_business_account{id,username,followers_count}' });
    if (me.id) accounts = [{ ...me, access_token: c.token }];
  }
  const pages = accounts.map(a => ({ id: a.id, name: a.name, token: a.access_token || c.token, ig: a.instagram_business_account || null }));
  let adAccounts = [];
  try { adAccounts = await c.gAll('me/adaccounts', { fields: 'id,name,account_status,currency', limit: 200 }); }
  catch (e) { c.log('me/adaccounts: ' + e.message); }
  return { pages, adAccounts };
}

/* ------------------------------ content ------------------------------ */
const FB_VIEW_TRIES = [
  { metric: 'post_media_view', breakdown: 'is_from_ads' },
  { metric: 'post_media_view' },
  { metric: 'post_impressions,post_impressions_paid' },
];
async function fbPostViews(c, id, tok) {
  let lastErr;
  for (let i = c.fbViewStart; i < FB_VIEW_TRIES.length; i++) {
    try {
      const j = await c.g(`${id}/insights`, FB_VIEW_TRIES[i], tok);
      const m = byName(j.data);
      if (i < 2) { const mv = m.post_media_view; const v = mval(mv); if (v != null) return { views: v, fromAds: i === 0 ? adsPart(mv) : null }; }
      else { const v = mval(m.post_impressions); if (v != null) return { views: v, fromAds: mval(m.post_impressions_paid) }; }
    } catch (e) {
      lastErr = e;
      if (e.code === 100 && i === c.fbViewStart && i < FB_VIEW_TRIES.length - 1) { c.fbViewStart = i + 1; c.log(`FB views: metric "${FB_VIEW_TRIES[i].metric}" ใช้ไม่ได้ → ลองตัวถัดไป`); }
    }
  }
  if (lastErr) c.log(`FB insights ${id}: ${lastErr.message}`);
  return { views: 0, fromAds: null };
}
const IG_TRIES = ['views,reach,total_interactions,likes,comments,saved,shares', 'views,reach,total_interactions', 'reach,total_interactions', 'impressions,reach,engagement'];
async function igMediaInsights(c, id, tok) {
  for (const metric of IG_TRIES) { try { const j = await c.g(`${id}/insights`, { metric }, tok); return byName(j.data); } catch (e) { /* smaller set */ } }
  return {};
}
function newItem(o) {
  return Object.assign({ caption: '', thumb: '', permalink: '', created: null, mediaType: '', adOnly: false,
    api: null, paid: { views: 0, eng: 0, spend: 0, reach: 0, ads: new Set() }, org: { views: 0, eng: 0 }, tot: { views: 0, eng: 0 } }, o);
}
export function finalize(items, adsLoaded) {
  for (const it of items) {
    const p = it.paid;
    if (it.api) {
      if (!adsLoaded && it.api.fromAds != null) p.views = it.api.fromAds;
      it.org.views = it.api.fromAds != null ? Math.max(0, it.api.views - it.api.fromAds) : Math.max(0, it.api.views - p.views);
      it.org.eng = Math.max(0, it.api.eng - p.eng);
    }
    it.tot.views = it.org.views + p.views;
    it.tot.eng = it.org.eng + p.eng;
    it.isPaid = p.views > 0 || p.spend > 0;
  }
  return items;
}

/**
 * Collect content + paid data for [since, until] (YYYY-MM-DD, Bangkok time).
 * Returns { items, adIndex, adsLoaded, warnings }.
 */
export async function collectContent(c, { pages, adAccounts, since, until, concurrency = 6, onStatus = () => {} }) {
  const sinceMs = new Date(`${since}T00:00:00${TZ}`).getTime(), untilMs = new Date(`${until}T23:59:59${TZ}`).getTime();
  const sinceTs = Math.floor(sinceMs / 1000), untilTs = Math.floor(untilMs / 1000);
  const map = new Map(), warnings = [], adIndex = {}, inboxPaid = {};
  for (const p of pages) {
    onStatus(`${p.name}: ดึงโพสต์ Facebook…`);
    try {
      const posts = await c.gAll(`${p.id}/posts`, { fields: 'id,message,created_time,permalink_url,full_picture,status_type,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares', since: sinceTs, until: untilTs, limit: 100 }, p.token);
      c.log(`${p.name}: FB posts ${posts.length}`);
      let done = 0;
      await pool(posts, concurrency, async post => {
        const v = await fbPostViews(c, post.id, p.token);
        const eng = (post.reactions?.summary?.total_count || 0) + (post.comments?.summary?.total_count || 0) + (post.shares?.count || 0);
        map.set('fb:' + post.id, newItem({ key: 'fb:' + post.id, id: post.id, pageId: p.id, pageName: p.name, channel: 'facebook', caption: post.message || '',
          thumb: post.full_picture || '', permalink: post.permalink_url || '', created: post.created_time, mediaType: post.status_type || '', api: { views: v.views, fromAds: v.fromAds, eng } }));
        if (++done % 10 === 0) onStatus(`${p.name}: FB insights ${done}/${posts.length}`);
      });
    } catch (e) { warnings.push(`${p.name} FB: ${e.message}`); c.log(`${p.name} FB: ${e.message}`); }
    if (p.ig) {
      onStatus(`${p.name}: ดึงโพสต์ Instagram…`);
      try {
        const media = (await c.gAll(`${p.ig.id}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count', limit: 50 }, p.token,
          { maxPages: 60, stop: d => d.length && new Date(d[d.length - 1].timestamp).getTime() < sinceMs }))
          .filter(m => { const t = new Date(m.timestamp).getTime(); return t >= sinceMs && t <= untilMs; });
        c.log(`${p.name}: IG media ${media.length}`);
        let done = 0;
        await pool(media, concurrency, async m => {
          const ins = await igMediaInsights(c, m.id, p.token);
          const views = mval(ins.views) ?? mval(ins.impressions) ?? mval(ins.reach) ?? 0;
          const eng = mval(ins.total_interactions) ?? mval(ins.engagement) ?? ((m.like_count || 0) + (m.comments_count || 0) + (mval(ins.saved) || 0) + (mval(ins.shares) || 0));
          map.set('ig:' + m.id, newItem({ key: 'ig:' + m.id, id: m.id, pageId: p.id, pageName: p.name, channel: 'instagram', caption: m.caption || '',
            thumb: m.thumbnail_url || (m.media_type !== 'VIDEO' ? m.media_url : '') || '', permalink: m.permalink || '', created: m.timestamp,
            mediaType: (m.media_product_type === 'REELS' ? 'REELS' : m.media_type) || '', api: { views, fromAds: null, eng } }));
          if (++done % 10 === 0) onStatus(`${p.name}: IG insights ${done}/${media.length}`);
        });
      } catch (e) { warnings.push(`${p.name} IG: ${e.message}`); c.log(`${p.name} IG: ${e.message}`); }
    }
  }
  // Paid
  let adsLoaded = false;
  const pageById = Object.fromEntries(pages.map(p => [p.id, p]));
  for (const act of adAccounts) {
    onStatus(`Ads: ${act.name}…`);
    try {
      const rows = await c.gAll(`${act.id}/insights`, { level: 'ad', breakdowns: 'publisher_platform', fields: 'ad_id,ad_name,impressions,reach,spend,actions', time_range: { since, until }, limit: 500 });
      c.log(`Ads ${act.name}: ${rows.length} rows`);
      const adIds = [...new Set(rows.map(r => r.ad_id))];
      const creatives = {};
      for (let i = 0; i < adIds.length; i += 50) {
        const j = await c.g('', { ids: adIds.slice(i, i + 50).join(','), fields: 'creative{effective_object_story_id,effective_instagram_media_id,thumbnail_url,body,title,instagram_permalink_url}' });
        for (const [id, o] of Object.entries(j)) creatives[id] = o.creative || {};
      }
      for (const r of rows) {
        const cr = creatives[r.ad_id] || {};
        const story = cr.effective_object_story_id || '';
        const pageId = story.split('_')[0];
        const p = pageById[pageId]; if (!p) continue;
        const ch = r.publisher_platform === 'instagram' ? 'instagram' : 'facebook';
        const key = ch === 'instagram' ? (cr.effective_instagram_media_id ? 'ig:' + cr.effective_instagram_media_id : 'igad:' + story) : 'fb:' + story;
        let it = map.get(key);
        if (!it) {
          it = newItem({ key, id: ch === 'instagram' ? (cr.effective_instagram_media_id || story) : story, pageId, pageName: p.name, channel: ch, adOnly: true,
            caption: cr.body || cr.title || r.ad_name || '', thumb: cr.thumbnail_url || '',
            permalink: ch === 'instagram' ? (cr.instagram_permalink_url || '') : `https://www.facebook.com/${story}` });
          map.set(key, it);
        }
        const a = r.actions || []; const av = t => +(a.find(x => x.action_type === t)?.value || 0);
        it.paid.views += +r.impressions || 0;
        it.paid.reach += +r.reach || 0;
        it.paid.spend += +r.spend || 0;
        it.paid.eng += av('post_reaction') + av('comment') + av('post') + av('onsite_conversion.post_save');
        it.paid.ads.add(r.ad_id);
        const k = `${pageId}|${ch}`;
        const conv = av('onsite_conversion.messaging_conversation_started_7d');
        if (conv) inboxPaid[k] = (inboxPaid[k] || 0) + conv; (adIndex[k] ||= {}); (adIndex[k][act.id] ||= new Set()).add(r.ad_id);
      }
      adsLoaded = true;
    } catch (e) { warnings.push(`Ads ${act.name}: ${e.message}`); c.log(`Ads ${act.name}: ${e.message}`); }
  }
  return { items: finalize([...map.values()], adsLoaded), adIndex, adsLoaded, inboxPaid, warnings };
}

/* ------------------------------ inbox ------------------------------ */
// Per page × channel (Messenger / IG Direct) for [since, until]:
//   active  = conversations with ≥ 1 message in the period
//   new     = conversations whose first message falls in the period
//   msgsIn  = messages sent by customers in the period
//   paid    = conversations started from ads (Ads Insights: messaging_conversation_started_7d)
//   organic = max(0, new − paid)   (estimate)
// Needs pages_messaging (FB) / instagram_manage_messages (IG). Falls back to Page Insights
// page_messages_new_conversations_unique for Messenger when the Conversations API is not permitted.
export async function collectInbox(c, { pages, since, until, inboxPaid = {}, concurrency = 4, onStatus = () => {} }) {
  const sinceMs = new Date(`${since}T00:00:00${TZ}`).getTime(), untilMs = new Date(`${until}T23:59:59${TZ}`).getTime();
  const out = {}, warnings = [];
  for (const p of pages) for (const channel of ['facebook', 'instagram']) {
    if (channel === 'instagram' && !p.ig) continue;
    const key = `${p.id}|${channel}`, label = `${p.name} ${channel === 'facebook' ? 'Messenger' : 'IG Direct'}`;
    const paid = inboxPaid[key] || 0;
    onStatus(`${label}: ดึง inbox…`);
    try {
      const convs = (await c.gAll(`${p.id}/conversations`, { platform: channel === 'facebook' ? 'messenger' : 'instagram', fields: 'id,updated_time', limit: 100 }, p.token,
        { maxPages: 200, stop: d => d.length && new Date(d[d.length - 1].updated_time).getTime() < sinceMs }))
        .filter(cv => new Date(cv.updated_time).getTime() >= sinceMs);
      const selfIds = new Set([p.id, p.ig?.id].filter(Boolean));
      let active = 0, fresh = 0, msgsIn = 0, done = 0, failed = 0, lastErr = '';
      await pool(convs, concurrency, async cv => { try {
        let sawOlder = false, exhausted = true, inRange = 0, inbound = 0;
        let j = await c.g(`${cv.id}/messages`, { fields: 'created_time,from', limit: 100 }, p.token);
        for (let pages_ = 0; ; pages_++) {
          for (const m of j.data || []) {
            const t = new Date(m.created_time).getTime();
            if (t < sinceMs) { sawOlder = true; continue; }
            if (t > untilMs) continue;
            inRange++; if (!selfIds.has(m.from?.id)) inbound++;
          }
          if (sawOlder) break;
          if (!j.paging?.next) break;
          if (pages_ >= 20) { exhausted = false; break; }
          j = await c.g(`${cv.id}/messages`, { fields: 'created_time,from', limit: 100, after: j.paging.cursors?.after }, p.token);
        }
        if (inRange) { active++; if (!sawOlder && exhausted) fresh++; msgsIn += inbound; }
      } catch (e) { failed++; lastErr = e.message; }
        if (++done % 25 === 0) onStatus(`${label}: ${done}/${convs.length} แชท`);
      });
      if (convs.length && failed === convs.length) throw new GraphError(lastErr);
      if (failed) { warnings.push(`${label}: อ่านไม่ได้ ${failed}/${convs.length} แชท (${lastErr})`); c.log(`${label}: ${failed} แชทอ่านไม่ได้ — ${lastErr}`); }
      out[key] = { active, new: fresh, msgsIn, paid, organic: Math.max(0, fresh - paid), source: 'conversations', ...(failed ? { note: `อ่านไม่ได้ ${failed}/${convs.length} แชท` } : {}) };
      c.log(`${label}: ${convs.length} แชทที่อัปเดต, active ${active}, ใหม่ ${fresh}`);
    } catch (e) {
      c.log(`${label} conversations: ${e.message}`);
      if (channel === 'facebook') {
        try {
          const j = await c.g(`${p.id}/insights`, { metric: 'page_messages_new_conversations_unique', period: 'day',
            since: Math.floor(sinceMs / 1000), until: Math.floor(untilMs / 1000) + 1 }, p.token);
          const vals = j.data?.[0]?.values || [];
          if (vals.length) {
            const fresh = vals.reduce((s, v) => s + (+v.value || 0), 0);
            out[key] = { active: null, new: fresh, msgsIn: null, paid, organic: Math.max(0, fresh - paid), source: 'page_insights' };
            continue;
          }
        } catch (e2) { c.log(`${label} page_messages insights: ${e2.message}`); }
      }
      out[key] = { error: e.message + (/permission|\(#10\)|\(#200\)|\(#230\)/i.test(e.message) ? ` — token ต้องมีสิทธิ์ ${channel === 'facebook' ? 'pages_messaging' : 'instagram_manage_messages'}` : ''), paid };
      warnings.push(`${label} inbox: ${e.message}`);
    }
  }
  return { inbox: out, warnings };
}

/* ------------------------------ demographics ------------------------------ */
// acc = { page, channel } ; returns { ag:[{age,g,v}], loc:[{name,v}], unit, note }
export async function fetchDemographic(c, acc, src, loc, { adIndex = {}, since, until } = {}) {
  const res = { ag: [], loc: [], note: '' };
  if (src === 'ads') {
    const idx = adIndex[`${acc.page.id}|${acc.channel}`];
    if (!idx || !Object.keys(idx).length) throw new Error('ไม่มีแอดที่ผูกกับบัญชีนี้ในช่วงวันที่ที่เลือก');
    for (const [act, ids] of Object.entries(idx)) {
      const list = [...ids];
      for (let i = 0; i < list.length; i += 100) {
        const base = { level: 'account', fields: 'reach,impressions', time_range: { since, until }, limit: 500 };
        const flt = [{ field: 'ad.id', operator: 'IN', value: list.slice(i, i + 100) }];
        const run = async breakdowns => {
          try { return await c.gAll(`${act}/insights`, { ...base, breakdowns, filtering: [...flt, { field: 'publisher_platform', operator: 'IN', value: [acc.channel] }] }); }
          catch (e) { res.note = 'รวมทุก placement (กรอง platform ไม่ได้)'; return c.gAll(`${act}/insights`, { ...base, breakdowns, filtering: flt }); }
        };
        for (const r of await run('age,gender')) res.ag.push({ age: r.age, g: normG(r.gender), v: +r.reach || 0 });
        for (const r of await run(loc === 'city' ? 'region' : 'country')) res.loc.push({ name: loc === 'city' ? r.region : r.country, v: +r.reach || 0 });
      }
    }
    res.unit = 'reach';
    return res;
  }
  if (acc.channel === 'facebook') {
    if (src !== 'followers') throw new Error('Facebook Page รองรับเฉพาะ Followers (legacy) และ Ads audience');
    const tok = acc.page.token; let ok = false;
    try {
      const j = await c.g(`${acc.page.id}/insights`, { metric: 'page_fans_gender_age', period: 'lifetime' }, tok);
      const v = j.data?.[0]?.values?.slice(-1)[0]?.value || {};
      for (const [k, n] of Object.entries(v)) { const [gg, age] = k.split('.'); res.ag.push({ age, g: normG(gg), v: +n }); }
      ok = ok || Object.keys(v).length > 0;
    } catch (e) { c.log('page_fans_gender_age: ' + e.message); }
    try {
      const j = await c.g(`${acc.page.id}/insights`, { metric: loc === 'city' ? 'page_fans_city' : 'page_fans_country', period: 'lifetime' }, tok);
      const v = j.data?.[0]?.values?.slice(-1)[0]?.value || {};
      for (const [k, n] of Object.entries(v)) res.loc.push({ name: k, v: +n });
      ok = ok || Object.keys(v).length > 0;
    } catch (e) { c.log('page_fans_' + loc + ': ' + e.message); }
    if (!ok) throw new Error('Meta ยกเลิก metric ข้อมูลประชากรผู้ติดตามเพจ Facebook แล้ว — เลือก "Ads audience" แทน');
    res.unit = 'followers'; return res;
  }
  const metric = { followers: 'follower_demographics', engaged: 'engaged_audience_demographics', reached: 'reached_audience_demographics' }[src];
  const p = { metric, period: 'lifetime', metric_type: 'total_value' }; if (src !== 'followers') p.timeframe = 'this_month';
  const tok = acc.page.token;
  const j1 = await c.g(`${acc.page.ig.id}/insights`, { ...p, breakdown: 'age,gender' }, tok);
  for (const r of j1.data?.[0]?.total_value?.breakdowns?.[0]?.results || []) res.ag.push({ age: r.dimension_values[0], g: normG(r.dimension_values[1]), v: +r.value });
  const j2 = await c.g(`${acc.page.ig.id}/insights`, { ...p, breakdown: loc }, tok);
  for (const r of j2.data?.[0]?.total_value?.breakdowns?.[0]?.results || []) res.loc.push({ name: r.dimension_values[0], v: +r.value });
  if (!res.ag.length && !res.loc.length) throw new Error('ไม่มีข้อมูล (IG ต้องมีผู้ติดตาม ≥ 100 หรือยังไม่มีกิจกรรมในช่วงนี้)');
  res.unit = src === 'followers' ? 'followers' : 'accounts'; return res;
}

/* ------------------------------ snapshot ------------------------------ */
/** Build a serializable snapshot for one period (used by the sync job). */
export async function buildSnapshot(c, { pages, adAccounts, period, since, until, demographics = true, onStatus = () => {} }) {
  const { items, adIndex, adsLoaded, inboxPaid, warnings } = await collectContent(c, { pages, adAccounts, since, until, onStatus });
  const ib = await collectInbox(c, { pages, since, until, inboxPaid, onStatus });
  warnings.push(...ib.warnings);
  const demo = {};
  if (demographics) {
    for (const p of pages) for (const channel of ['facebook', 'instagram']) {
      if (channel === 'instagram' && !p.ig) continue;
      for (const src of DEMO_SOURCES[channel]) for (const loc of DEMO_LOCS) {
        try { demo[`${p.id}|${channel}|${src}|${loc}`] = await fetchDemographic(c, { page: p, channel }, src, loc, { adIndex, since, until }); }
        catch (e) { demo[`${p.id}|${channel}|${src}|${loc}`] = { error: e.message }; }
      }
    }
  }
  return {
    version: 1, period, since, until, fetchedAt: new Date().toISOString(), adsLoaded, warnings,
    pages: pages.map(p => ({ id: p.id, name: p.name, ig: p.ig ? { id: p.ig.id, username: p.ig.username || '' } : null })),
    items: items.map(it => ({
      key: it.key, id: it.id, pageId: it.pageId, pageName: it.pageName, channel: it.channel,
      caption: (it.caption || '').slice(0, 300), thumb: it.thumb, permalink: it.permalink, created: it.created, mediaType: it.mediaType, adOnly: it.adOnly,
      org: it.org, tot: it.tot, isPaid: it.isPaid,
      paid: { views: it.paid.views, eng: it.paid.eng, spend: Math.round(it.paid.spend * 100) / 100, reach: it.paid.reach, ads: it.paid.ads.size },
    })),
    demographics: demo,
    inbox: ib.inbox,
  };
}

/* ------------------------------ encryption ------------------------------ */
// AES-256-GCM, key = PBKDF2-SHA256(passphrase, salt, 210k). Works in browsers and Node ≥ 20.
const b64e = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptJson(obj, pass, iter = 210000) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iter);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, alg: 'AES-GCM/PBKDF2-SHA256', iter, salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) };
}
const keyCache = new Map();
export async function decryptJson(env, pass) {
  const ck = `${pass}|${env.salt}|${env.iter}`;
  let key = keyCache.get(ck);
  if (!key) { key = await deriveKey(pass, b64d(env.salt), env.iter); keyCache.set(ck, key); }
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) { throw new Error('รหัสผ่านไม่ถูกต้อง'); }
}
