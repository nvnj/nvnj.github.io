import { readFile, writeFile } from 'node:fs/promises';
import { patchMeta } from './meta.mjs';

const USER = process.env.GH_USER || 'nvnj';
const TOKEN = process.env.GH_TOKEN;
const TOPIC = 'portfolio';

const LANG_COLORS = {
  Python:'#3572A5', PHP:'#4F5D95', JavaScript:'#f1e05a', TypeScript:'#3178c6',
  'C++':'#f34b7d', C:'#555555', Java:'#b07219', HTML:'#e34c26', CSS:'#563d7c',
  Shell:'#89e051', 'Jupyter Notebook':'#DA5B0B', Dockerfile:'#384d54', Go:'#00ADD8'
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': `${USER}-portfolio-sync`,
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
    }
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function allRepos() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh(`/users/${USER}/repos?per_page=100&sort=pushed&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function main() {
  let overrides = {};
  try { overrides = JSON.parse(await readFile('data/overrides.json', 'utf8')); } catch {}

  const repos = await allRepos();
  const picked = [];

  for (const r of repos) {
    if (r.fork || r.archived || r.private) continue;
    const topics = (Array.isArray(r.topics) && r.topics.length)
      ? r.topics
      : ((await gh(`/repos/${USER}/${r.name}/topics`)).names || []);
    if (!topics.includes(TOPIC)) continue;

    const o = overrides[r.name] || {};
    let langs = [];
    try { langs = Object.keys(await gh(`/repos/${USER}/${r.name}/languages`)).slice(0, 4); } catch {}

    picked.push({
      name: r.name,
      title: o.title || r.name,
      blurb: o.blurb || r.description || '',
      url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      languageColor: LANG_COLORS[r.language] || '#7C8385',
      stars: r.stargazers_count,
      pushedAt: r.pushed_at,
      topics: topics.filter(t => !['portfolio', 'pinned', 'wip'].includes(t)),
      stack: (o.stack && o.stack.length) ? o.stack : langs,
      facts: o.facts || null,
      featured: o.featured === true || topics.includes('pinned'),
      wip: topics.includes('wip'),
      order: o.order ?? 999
    });
  }

  picked.sort((a, b) => a.order - b.order || new Date(b.pushedAt) - new Date(a.pushedAt));

  await writeFile('data/github.json',
    JSON.stringify({ user: USER, fetchedAt: new Date().toISOString(), repos: picked }, null, 2) + '\n');
  await patchMeta('github', { ok: true, count: picked.length });
  console.log(`GitHub: ${picked.length} repo(s) tagged "${TOPIC}"`);
  if (!picked.length) console.log(`  (tag repos with the topic "${TOPIC}" to publish them)`);
}

main().catch(async (err) => {
  console.error('GitHub sync failed:', err.message);
  await patchMeta('github', { ok: false, error: err.message });
  process.exit(0);   // last-good data still ships; never break the deploy
});
