import { readFile, writeFile } from 'node:fs/promises';

/** Record a sync outcome. On failure the previous successful `at` is KEPT,
 *  so the page can show the last real sync instead of a fake "just now". */
export async function patchMeta(key, patch) {
  let meta = {};
  try { meta = JSON.parse(await readFile('data/meta.json', 'utf8')); } catch { /* first run */ }
  const prev = meta[key] || {};
  meta[key] = patch.ok
    ? { ok: true, at: new Date().toISOString(), count: patch.count ?? prev.count ?? 0, error: null }
    : { ok: false, at: prev.at ?? null, count: prev.count ?? 0, error: patch.error || 'unknown' };
  await writeFile('data/meta.json', JSON.stringify(meta, null, 2) + '\n');
}
