import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

// ── Upstash Redis client (no extra package needed) ────────
// Vercel auto-creates these env vars when you connect Upstash
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

// ── helpers ───────────────────────────────────────────────

function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(data));
}

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const boundary = (() => {
      const ct = req.headers['content-type'] || '';
      const m = ct.match(/boundary=([^\s;]+)/);
      return m ? m[1] : null;
    })();
    if (!boundary) return reject(new Error('No boundary'));

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const parts = {};
      const sep = Buffer.from('\r\n--' + boundary);
      let pos = buf.indexOf('--' + boundary);

      while (pos !== -1) {
        const start = buf.indexOf('\r\n\r\n', pos);
        if (start === -1) break;
        const headerStr = buf.slice(pos, start).toString();
        const end = buf.indexOf(sep, start + 4);
        const body = end === -1 ? buf.slice(start + 4) : buf.slice(start + 4, end);

        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const fileMatch = headerStr.match(/filename="([^"]+)"/);
        const ctMatch   = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

        if (nameMatch) {
          const name = nameMatch[1];
          if (fileMatch) {
            parts[name] = {
              filename: fileMatch[1],
              contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
              data: body,
            };
          } else {
            parts[name] = body.toString().trim();
          }
        }
        pos = end === -1 ? -1 : buf.indexOf('\r\n--' + boundary, end);
      }
      resolve(parts);
    });
  });
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

async function handlePost(req, res) {
  try {
    const parts = await parseMultipart(req);

    const title   = parts.title   || 'Untitled Memory';
    const date    = parts.date    || '';
    const caption = parts.caption || '';
    const desc    = parts.desc    || '';
    const mood    = parts.mood    || 'rose';
    const special = parts.special === 'true';

    // Upload video to Blob if provided
    let videoUrl = null;
    if (parts.video && parts.video.data && parts.video.data.length > 0) {
      const ext = parts.video.filename.split('.').pop() || 'mp4';
      const blob = await put(
        `usflix/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
        parts.video.data,
        { access: 'public', contentType: parts.video.contentType }
      );
      videoUrl = blob.url;
    }

    // Upload thumbnail to Blob if provided
    let thumbUrl = null;
    if (parts.thumbnail && parts.thumbnail.data && parts.thumbnail.data.length > 0) {
      const ext = parts.thumbnail.filename.split('.').pop() || 'jpg';
      const blob = await put(
        `usflix/thumbs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
        parts.thumbnail.data,
        { access: 'public', contentType: parts.thumbnail.contentType }
      );
      thumbUrl = blob.url;
    }

    // Build episode object
    const episode = {
      id: 'ep_' + Date.now(),
      name: title,
      date,
      caption,
      desc,
      mood,
      special,
      videoUrl,
      thumbUrl,
      isNew: true,
      savedAt: new Date().toISOString(),
    };

    // Append to existing list in Upstash
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
