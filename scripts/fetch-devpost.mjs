import { readFile, writeFile } from 'node:fs/promises';
import { patchMeta } from './meta.mjs';

const USER = process.env.DEVPOST_USER || 'nvnj';
const UA = 'Mozilla/5.0 (compatible; nvnj-portfolio-sync/1.0; +https://nvnj.github.io)';

// Devpost slugs to ignore — duplicate submissions of the same project. Without
// this the sync appends a second card for the same build.
const IGNORE = new Set(['fairlane-eiw6yt']);

const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function get(url, accept) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return accept.includes('json') ? res.json() : res.text();
}

/* Tier 1: undocumented JSON representation. Devpost publishes no API, so this
   may simply 404 — that is expected, not an error worth failing on. */
async function viaJson() {
  const d = await get(`https://devpost.com/${USER}?format=json`, 'application/json');
  const list = d.software || d.projects || [];
  if (!list.length) throw new Error('json: no entries');
  return list.map(s => ({
    slug: String(s.url || '').split('/').filter(Boolean).pop(),
    name: s.name, url: s.url, tagline: s.tagline,
    likes: s.like_count ?? null, won: Boolean(s.winner)
  }));
}

/* Tier 2: HTML. Markup changes without notice; best-effort by design. */
async function viaHtml() {
  const html = await get(`https://devpost.com/${USER}`, 'text/html');
  const out = [];
  const blocks = html.split(/<a\s[^>]*class="[^"]*link-to-software/i).slice(1);
  for (const b of blocks) {
    const url = (b.match(/href="(https:\/\/devpost\.com\/software\/[^"]+)"/) || [])[1];
    const name = (b.match(/<h5[^>]*>([\s\S]*?)<\/h5>/) || [])[1];
    const tag = (b.match(/class="[^"]*tagline[^"]*"[^>]*>([\s\S]*?)</) || [])[1];
    const likes = (b.match(/like-count[^>]*>\s*(\d+)/) || [])[1];
    if (!url || !name) continue;
    out.push({
      slug: url.split('/').filter(Boolean).pop(),
      name: strip(name), url, tagline: tag ? strip(tag) : '',
      likes: likes ? Number(likes) : null,
      won: /winner/i.test(b.slice(0, 2500))
    });
  }
  if (!out.length) throw new Error('html: parsed 0 entries');
  return out;
}

async function main() {
  const file = JSON.parse(await readFile('data/hackathons.json', 'utf8'));
  let fetched = null, lastErr = null;

  for (const tier of [viaJson, viaHtml]) {
    try { fetched = await tier(); break; }
    catch (e) { lastErr = e; console.warn(`  ${tier.name}: ${e.message}`); }
  }

  if (!fetched) {
    console.error('Devpost sync failed — keeping committed data unchanged');
    return patchMeta('devpost', { ok: false, error: lastErr?.message || 'unknown' });
  }

  // Enrich, never overwrite: hand-written copy always wins.
  const bySlug = new Map(file.projects.map(p => [p.slug, p]));
  let added = 0;
  for (const f of fetched) {
    if (IGNORE.has(f.slug)) continue;
    const cur = bySlug.get(f.slug);
    if (cur) {
      if (f.likes != null) cur.likes = f.likes;
      if (f.won) cur.won = true;
      if (!cur.tagline && f.tagline) cur.tagline = f.tagline;
    } else {
      bySlug.set(f.slug, {
        ...f, hackathon: '', award: f.won ? 'Winner' : '',
        stack: [], year: new Date().getFullYear(), order: 99
      });
      added++;
    }
  }

  file.projects = [...bySlug.values()]
    .sort((a, b) => (b.won === true) - (a.won === true) || (a.order ?? 99) - (b.order ?? 99));
  file.fetchedAt = new Date().toISOString();
  file.user = USER;

  await writeFile('data/hackathons.json', JSON.stringify(file, null, 2) + '\n');
  await patchMeta('devpost', { ok: true, count: file.projects.length });
  console.log(`Devpost: ${file.projects.length} project(s)${added ? `, ${added} new` : ''}`);
}

main().catch(async (e) => {
  console.error('Devpost sync failed:', e.message);
  await patchMeta('devpost', { ok: false, error: e.message });
  process.exit(0);
});
