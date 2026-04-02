// api/episodes.js
// Vercel Serverless Function — handles GET and POST for episodes
// Videos are stored in Vercel Blob (free tier: 1GB)

import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

export const config = {
  api: {
    bodyParser: false, // needed for multipart/form-data (file uploads)
  },
};

// Parse multipart form data
async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].split('boundary=')[1];
      if (!boundary) return resolve({ fields: {}, file: null });

      const parts = body.toString('binary').split('--' + boundary);
      const fields = {};
      let file = null;

      parts.forEach(part => {
        if (part.includes('Content-Disposition')) {
          const nameMatch = part.match(/name="([^"]+)"/);
          const filenameMatch = part.match(/filename="([^"]+)"/);
          if (!nameMatch) return;

          const name = nameMatch[1];
          const headerEnd = part.indexOf('\r\n\r\n') + 4;
          const value = part.slice(headerEnd, part.lastIndexOf('\r\n'));

          if (filenameMatch) {
            file = {
              name: filenameMatch[1],
              data: Buffer.from(value, 'binary'),
              contentType: part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'video/mp4',
            };
          } else {
            fields[name] = value.trim();
          }
        }
      });

      resolve({ fields, file });
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const episodes = await kv.get('usflix:episodes') || [];
      return res.status(200).json({ success: true, episodes });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fields, file } = await parseFormData(req);
      const { title, date, desc, season, mood } = fields;

      if (!title) return res.status(400).json({ success: false, error: 'Title required' });

      // Upload video to Vercel Blob if provided
      let videoUrl = null;
      if (file && file.data) {
        const blob = await put(`videos/${Date.now()}-${file.name}`, file.data, {
          access: 'public',
          contentType: file.contentType,
        });
        videoUrl = blob.url;
      }

      // Load existing episodes
      const episodes = await kv.get('usflix:episodes') || [];

      const s = parseInt(season) || 2;
      const epNum = episodes.filter(e => e.season === s).length + 1;

      const newEp = {
        id: `ep-${Date.now()}`,
        title,
        date: date || 'A moment in time',
        desc: desc || 'A memory worth keeping.',
        season: s,
        mood: mood || '🌙',
        ep: `S${s} · E${epNum}`,
        progress: 0,
        isNew: true,
        videoUrl,
        createdAt: new Date().toISOString(),
      };

      episodes.push(newEp);
      await kv.set('usflix:episodes', episodes);

      return res.status(200).json({ success: true, episode: newEp });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
