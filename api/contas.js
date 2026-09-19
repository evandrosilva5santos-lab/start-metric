/**
 * api/contas.js
 * Lista as contas de anúncio vinculadas ao token da Meta.
 * Inclui cache em memória de 90s e proteção contra rate limit.
 */

const CACHE_TTL_MS = 90 * 1000;
let cache = {
  timestamp: 0,
  data: null,
};

export default async function handler(req, res) {
  // CORS: same-origin apenas — o painel é servido pelo mesmo servidor.

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN || process.env.META_USER_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'Variável META_TOKEN não configurada no .env do servidor.',
    });
  }

  // Verificar cache em memória
  const now = Date.now();
  const forceFresh = req.query?.fresh === 'true' || req.query?.fresh === '1';

  if (!forceFresh && cache.data && (now - cache.timestamp < CACHE_TTL_MS)) {
    return res.status(200).json({
      cached: true,
      cacheAgeSeconds: Math.round((now - cache.timestamp) / 1000),
      ...cache.data,
    });
  }

  const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
  const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

  try {
    // 1. Identificar usuário
    const meRes = await fetch(`${BASE_URL}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const meData = await meRes.json();

    if (meData.error) {
      if (meData.error.code === 17 && cache.data) {
        return res.status(200).json({
          cached: true,
          rateLimitHit: true,
          warning: 'Limite temporário da Meta atingido. Servindo dados em cache.',
          ...cache.data,
        });
      }
      return res.status(400).json({
        error: `Erro Meta (${meData.error.code}): ${meData.error.message}`,
        details: meData.error,
      });
    }

    // 2. Buscar contas de anúncios
    const accountsRes = await fetch(
      `${BASE_URL}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent&limit=100&access_token=${encodeURIComponent(token)}`
    );
    const accountsData = await accountsRes.json();

    if (accountsData.error) {
      if (accountsData.error.code === 17 && cache.data) {
        return res.status(200).json({
          cached: true,
          rateLimitHit: true,
          warning: 'Limite de chamadas atingido na Meta. Servindo cache recente.',
          ...cache.data,
        });
      }
      return res.status(400).json({
        error: `Erro ao listar contas (${accountsData.error.code}): ${accountsData.error.message}`,
      });
    }

    const rawAccounts = accountsData.data || [];

    // Formatar e ordenar contas (contas ativas primeiro)
    const accounts = rawAccounts.map((acc) => {
      let statusText = 'Desconhecido';
      let isActive = false;

      switch (acc.account_status) {
        case 1:
          statusText = 'Ativa';
          isActive = true;
          break;
        case 2:
          statusText = 'Desativada';
          break;
        case 3:
          statusText = 'Em análise';
          break;
        case 7:
          statusText = 'Pendente revisão';
          break;
        case 100:
          statusText = 'Pendente pagamento';
          break;
        case 101:
          statusText = 'Fechada';
          break;
        default:
          statusText = `Status ${acc.account_status}`;
      }

      return {
        id: acc.id,
        name: acc.name || acc.id,
        currency: acc.currency || 'BRL',
        timezone_name: acc.timezone_name || 'America/Sao_Paulo',
        account_status: acc.account_status,
        statusText,
        isActive,
        amount_spent_total: acc.amount_spent ? parseFloat(acc.amount_spent) / 100 : 0,
      };
    });

    // Ordenar: ativas primeiro, depois pelo nome
    accounts.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

    const responsePayload = {
      user: {
        id: meData.id,
        name: meData.name,
      },
      contas: accounts,
      total: accounts.length,
      timestamp: new Date().toISOString(),
    };

    // Gravar cache
    cache = {
      timestamp: now,
      data: responsePayload,
    };

    return res.status(200).json(responsePayload);
  } catch (err) {
    return res.status(500).json({
      error: 'Falha interna ao conectar com a API da Meta: ' + err.message,
    });
  }
}
