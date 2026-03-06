import fs from 'node:fs/promises';

const BASE = process.env.RADAR_BASE_URL || 'https://radar.1985119.xyz';
const ADMIN = process.env.RADAR_ADMIN_TOKEN || '';

if (!ADMIN) {
  console.error('Missing RADAR_ADMIN_TOKEN');
  process.exit(1);
}

const raw = await fs.readFile(new URL('./sources.json', import.meta.url), 'utf8');
const sources = JSON.parse(raw);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function importBatch(batch) {
  const body = {
    sources: batch.map(s => ({
      url: s.url,
      sourcePlatform: s.sourcePlatform,
      sourceName: s.sourceName,
      notes: `tier:${s.tier || 'secondary'} | category:${s.category || 'general'}`,
      maxPosts: s.maxPosts || 80,
      deepFetch: s.deepFetch !== false
    }))
  };

  const r = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': ADMIN
    },
    body: JSON.stringify(body)
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, raw: text };
  }
}

const groups = chunk(sources, 2);
let hadFailure = false;
const summary = [];

for (const batch of groups) {
  try {
    const res = await importBatch(batch);
    summary.push({ batch: batch.map(x => x.sourceName), ok: true, res });
    console.log('batch ok:', batch.map(x => x.sourceName).join(', '));
    console.log(JSON.stringify(res));
  } catch (e) {
    hadFailure = true;
    console.error('batch failed:', batch.map(x => x.sourceName).join(', '), String(e));

    for (const src of batch) {
      try {
        await sleep(1200);
        const res = await importBatch([src]);
        summary.push({ batch: [src.sourceName], ok: true, res });
        console.log('single ok:', src.sourceName);
        console.log(JSON.stringify(res));
      } catch (singleErr) {
        summary.push({ batch: [src.sourceName], ok: false, error: String(singleErr) });
        console.error('single failed:', src.sourceName, String(singleErr));
      }
    }
  }

  await sleep(1200);
}

console.log('final summary');
console.log(JSON.stringify(summary, null, 2));
if (hadFailure) process.exitCode = 2;
