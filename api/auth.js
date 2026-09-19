import { timingSafeEqual } from 'node:crypto';

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const isProduction = process.env.NODE_ENV === 'production';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    const pass = body.password || '';
    if (DASHBOARD_PASSWORD && safeEqual(pass, DASHBOARD_PASSWORD)) {
      return res.status(200).json({ ok: true, authenticated: true });
    }
    return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
  }

  return res.status(200).json({ requiresPassword: Boolean(DASHBOARD_PASSWORD) });
}
