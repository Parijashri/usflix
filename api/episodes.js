import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

export const config = { api: { bodyParser: false } };

async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      const boundary = ct.split('boundary=')[1];
      if (!boundary) return resolve({ fields: {}, files: {} });

      const sep = Buffer.from('--' + boundary);
      const parts = [];
      let start = body.indexOf(sep) + sep.length + 2;
      while (start < body.length) {
        const end = body.indexOf(sep, start);
        if (end === -1) break;
        parts.push(body.slice(start, end - 2));
        start = end + sep.length + 2;
      }

      const fields = {}, files = {};
      parts.forEach(part => {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = part.slice(0, headerEnd).toString();
        const data = part.slice(headerEnd + 4);
        const nameMatch = header.match(/name="([^"]+)"/);
        const fileMatch = header.match(/filename="([^"]+)"/);
        const ctMatch = header.match(/Content-Type: ([^\r\n]+)/);
        if (!nameMatch) return;
        const name = nameMatch[1];
        if (fileMatch) {
          files[name] = { name: fileMatch[1], data, contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream' };
        } else {
          fields[name] = data.toString().trim();
        }
      });
      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
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
      const { fields, files } = await parseForm(req);
      const { title, date, desc, mood } = fields;
      if (!title) return res.status(400).json({ success: false, error: 'Title required' });

      // Upload video
      let videoUrl = null;
      if (files.video && files.video.data.length > 0) {
        const blob = await put(`videos/${Date.now()}-${files.video.name}`, files.video.data, {
          access: 'public', contentType: files.video.contentType
        });
        videoUrl = blob.url;
      }

      // Upload thumbnail
      let thumbUrl = null;
      if (files.thumbnail && files.thumbnail.data.length > 0) {
        const blob = await put(`thumbs/${Date.now()}-${files.thumbnail.name}`, files.thumbnail.data, {
          access: 'public', contentType: files.thumbnail.contentType
        });
        thumbUrl = blob.url;
      }

      const episodes = await kv.get('usflix:episodes') || [];
      const ep = {
        id: `ep-${Date.now()}`,
        name: title,
        date: date || '',
        caption: desc || '',
        mood: mood || '🌹',
        videoUrl,
        thumbUrl,
        isNew: true,
        createdAt: new Date().toISOString(),
      };
      episodes.push(ep);
      await kv.set('usflix:episodes', episodes);
      return res.status(200).json({ success: true, episode: ep });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
