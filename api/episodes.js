// ── Upstash Redis client ───────────────────────────────────
async function kvGet(key) {
  const res = await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
  );
  const data = await res.json();
  if (!data.result) return null;
  try { return JSON.parse(data.result); } catch { return data.result; }
}

async function kvSet(key, value) {
  await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(value)),
    }
  );
}

function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(data));
}

// ── GET /api/episodes ─────────────────────────────────────
async function handleGet(req, res) {
  try {
    const episodes = (await kvGet('usflix:episodes')) || [];
    json(res, 200, { success: true, episodes });
  } catch (err) {
    console.error('GET error', err);
    json(res, 500, { success: false, error: err.message });
  }
}

// ── POST /api/episodes ────────────────────────────────────
// Now receives JSON — files are already uploaded to Blob by the browser
async function handlePost(req, res) {
  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      req.on('error', reject);
    });

    const episode = {
      id: 'ep_' + Date.now(),
      name:     body.title    || 'Untitled Memory',
      date:     body.date     || '',
      caption:  body.caption  || '',
      desc:     body.desc     || '',
      mood:     body.mood     || '🌹',
      special:  body.special  || false,
      videoUrl: body.videoUrl || null,
      thumbUrl: body.thumbUrl || null,
      isNew: true,
      savedAt: new Date().toISOString(),
    };

    const existing = (await kvGet('usflix:episodes')) || [];
    existing.push(episode);
    await kvSet('usflix:episodes', existing);

    json(res, 200, { success: true, episode });
  } catch (err) {
    console.error('POST error', err);
    json(res, 500, { success: false, error: err.message });
  }
}

// ── router ────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  json(res, 405, { success: false, error: 'Method not allowed' });
}
