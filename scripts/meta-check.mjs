#!/usr/bin/env node

/**
 * scripts/meta-check.mjs
 * Script para validação de conexão e leitura de contas de anúncios na Meta Graph API.
 * 
 * Uso:
 *   node --env-file=.env scripts/meta-check.mjs
 */

const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN || process.env.META_USER_TOKEN;
const appId = process.env.META_APP_ID;

if (!token) {
  console.error('\x1b[31m[ERRO]\x1b[0m Variável META_TOKEN (ou META_SYSTEM_TOKEN) não encontrada no .env');
  process.exit(1);
}

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getStatusLabel(status) {
  switch (status) {
    case 1:
      return '\x1b[32m● ATIVA\x1b[0m';
    case 2:
      return '\x1b[31m✕ DESATIVADA\x1b[0m';
    case 3:
      return '\x1b[33m▲ NÃO RESOLVIDA / EM ANÁLISE\x1b[0m';
    case 7:
      return '\x1b[33m▲ PENDENTE DE REVISÃO\x1b[0m';
    case 100:
      return '\x1b[31m✕ PENDENTE DE LIQUIDAÇÃO\x1b[0m';
    case 101:
      return '\x1b[31m✕ DESCONECTADA / FECHADA\x1b[0m';
    default:
      return `\x1b[37mSTATUS ${status}\x1b[0m`;
  }
}

async function checkMeta() {
  console.log('\n\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[1m  START METRIC — TESTE DE CONEXÃO META GRAPH API\x1b[0m');
  console.log('\x1b[36m====================================================\x1b[0m\n');
  console.log(`Versão da API: \x1b[33m${GRAPH_VERSION}\x1b[0m`);
  if (appId) console.log(`App ID: \x1b[33m${appId}\x1b[0m`);

  try {
    // 1. Validar /me
    console.log('\n\x1b[90m[1/3] Identificando credencial (/me)...\x1b[0m');
    const meRes = await fetch(`${BASE_URL}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const meData = await meRes.json();

    if (meData.error) {
      console.error('\n\x1b[31mErro na autenticação da Meta:\x1b[0m');
      console.error(`Código: ${meData.error.code} (Subcode: ${meData.error.error_subcode || 'N/A'})`);
      console.error(`Mensagem: ${meData.error.message}`);
      if (meData.error.code === 190) {
        console.error('\x1b[33m-> O token está inválido ou expirou. Gere um novo token de Usuário do Sistema.\x1b[0m');
      }
      process.exit(1);
    }

    console.log(`\x1b[32m✓ Conectado como:\x1b[0m \x1b[1m${meData.name}\x1b[0m (ID: ${meData.id})`);

    // 2. Buscar Contas de Anúncio
    console.log('\n\x1b[90m[2/3] Buscando contas de anúncios associadas (/me/adaccounts)...\x1b[0m');
    const accountsRes = await fetch(
      `${BASE_URL}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent&limit=100&access_token=${encodeURIComponent(token)}`
    );
    const accountsData = await accountsRes.json();

    if (accountsData.error) {
      console.error('\n\x1b[31mErro ao buscar contas de anúncios:\x1b[0m', accountsData.error.message);
      process.exit(1);
    }

    const accounts = accountsData.data || [];
    console.log(`\x1b[32m✓ Encontradas:\x1b[0m \x1b[1m${accounts.length} contas de anúncio\x1b[0m\n`);

    if (accounts.length === 0) {
      console.log('\x1b[33mAviso: Nenhuma conta de anúncios associada a este usuário/token.\x1b[0m');
      console.log('Certifique-se de adicionar as contas de anúncios ao Usuário do Sistema no Business Manager.');
      return;
    }

    console.log('\x1b[90m----------------------------------------------------------------------------------------------------------\x1b[0m');
    console.log(
      '\x1b[1m' +
        'ID da Conta'.padEnd(24) +
        'Nome'.padEnd(35) +
        'Status'.padEnd(18) +
        'Moeda'.padEnd(8) +
        'Fuso Horário'.padEnd(23) +
        'Gasto (7d)'.padEnd(14) +
        '\x1b[0m'
    );
    console.log('\x1b[90m----------------------------------------------------------------------------------------------------------\x1b[0m');

    // Buscar gastos dos últimos 7 dias para cada conta em paralelo
    const spendPromises = accounts.map(async (acc) => {
      let spendText = 'R$ 0,00';
      let rawSpend = 0;
      try {
        const insRes = await fetch(
          `${BASE_URL}/${acc.id}/insights?date_preset=last_7d&fields=spend&access_token=${encodeURIComponent(token)}`
        );
        const insData = await insRes.json();
        if (insData.data && insData.data.length > 0 && insData.data[0].spend) {
          rawSpend = parseFloat(insData.data[0].spend);
          spendText = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: acc.currency || 'BRL',
          }).format(rawSpend);
        }
      } catch {
        spendText = '—';
      }
      return { ...acc, rawSpend, spendText };
    });

    const accountsWithSpend = await Promise.all(spendPromises);
    // Ordenar: contas com gasto primeiro
    accountsWithSpend.sort((a, b) => b.rawSpend - a.rawSpend);

    for (const acc of accountsWithSpend) {
      const statusLabel = getStatusLabel(acc.account_status);
      const id = acc.id.padEnd(24);
      const name = (acc.name.length > 32 ? acc.name.substring(0, 29) + '...' : acc.name).padEnd(35);
      const curr = (acc.currency || 'BRL').padEnd(8);
      const tz = (acc.timezone_name || 'America/Sao_Paulo').padEnd(23);
      const spend = (acc.rawSpend > 0 ? `\x1b[32m${acc.spendText}\x1b[0m` : acc.spendText).padEnd(14);

      console.log(`${id}${name}${statusLabel.padEnd(27)}${curr}${tz}${spend}`);
    }

    console.log('\x1b[90m----------------------------------------------------------------------------------------------------------\x1b[0m\n');
    console.log('\x1b[32m✓ Conexão com a Meta API validada com sucesso!\x1b[0m\n');
  } catch (err) {
    console.error('\x1b[31mErro inesperado ao conectar:\x1b[0m', err.message);
    process.exit(1);
  }
}

checkMeta();
