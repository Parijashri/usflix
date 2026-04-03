import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Read filename and contentType from query params
    const { filename, contentType } = req.query;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    // Stream the raw body directly to Vercel Blob
    const blob = await put(filename, req, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
