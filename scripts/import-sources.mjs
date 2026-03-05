import fs from 'node:fs/promises';

const BASE = process.env.RADAR_BASE_URL || 'https://radar.1985119.xyz';
const ADMIN = process.env.RADAR_ADMIN_TOKEN || '';

if (!ADMIN) {
  console.error('Missing RADAR_ADMIN_TOKEN');
  process.exit(1);
}

const raw = await fs.readFile(new URL('./sources.json', import.meta.url), 'utf8');
const sources = JSON.parse(raw);

const body = {
  sources: sources.map(s => ({
    url: s.url,
    sourcePlatform: s.sourcePlatform,
    sourceName: s.sourceName,
    notes: `tier:${s.tier || 'secondary'}`
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
console.log('status', r.status);
console.log(text);
if (!r.ok) process.exit(2);
