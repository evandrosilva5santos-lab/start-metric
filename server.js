import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import contasHandler from './api/contas.js';
import dadosHandler from './api/dados.js';
import campanhaHandler from './api/campanha.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const isProduction = process.env.NODE_ENV === 'production';

// Fail-closed: em produção o painel exige senha. Sem senha configurada, aborta.
if (isProduction && !DASHBOARD_PASSWORD) {
  console.error('[server] FATAL: DASHBOARD_PASSWORD não configurada em produção. Recusando iniciar.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

// Helper para parsear body JSON
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Comparação timing-safe de segredos
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Helper para validar senha — apenas via header, nunca query string
// (senha em URL vaza em logs de acesso, proxies e histórico do navegador).
function isAuthorized(req) {
  if (!DASHBOARD_PASSWORD) return !isProduction; // Dev local sem senha continua liberado
  return safeEqual(req.headers['x-dashboard-password'], DASHBOARD_PASSWORD);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Extender res para compatibilidade com Vercel Serverless Handler
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };

  req.query = query;

  // 1. Rota de Autenticação /api/auth
  if (pathname === '/api/auth') {
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const pass = body.password || '';
      if (DASHBOARD_PASSWORD && safeEqual(pass, DASHBOARD_PASSWORD)) {
        return res.status(200).json({ ok: true, authenticated: true });
      }
      return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
    }
    // GET check se senha é requerida
    return res.status(200).json({ requiresPassword: Boolean(DASHBOARD_PASSWORD) });
  }

  // 2. Proteção de API via senha
  if (pathname.startsWith('/api/')) {
    if (!isAuthorized(req)) {
      return res.status(401).json({
        error: 'Não autorizado. Senha do painel não fornecida ou incorreta.',
        requiresPassword: true,
      });
    }

    if (req.method === 'POST') {
      req.body = await parseBody(req);
    }

    if (pathname === '/api/contas') {
      return contasHandler(req, res);
    }
    if (pathname === '/api/dados') {
      return dadosHandler(req, res);
    }
    if (pathname === '/api/campanha') {
      return campanhaHandler(req, res);
    }

    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }

  // 3. Servir arquivos estáticos de public/
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  // Prevenir path traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.statusCode = 403;
    return res.end('Acesso negado');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback para index.html (SPA)
      filePath = path.join(__dirname, 'public', 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        return res.end('Erro ao ler arquivo estático');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log(`\x1b[32m● PAINEL DE ANÚNCIOS META ATIVO!\x1b[0m`);
  console.log(`URL Local:       \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`Proteção Senha:  \x1b[33m${DASHBOARD_PASSWORD ? 'ATIVADA' : 'DESATIVADA (apenas dev)'}\x1b[0m`);
  console.log('======================================================\n');
});
