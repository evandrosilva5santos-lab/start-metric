#!/usr/bin/env node
// Testa o META_TOKEN e lista as contas de anúncio com o gasto dos últimos 7 dias.
// Uso: node --env-file=.env scripts/meta-check.mjs

const API = "https://graph.facebook.com/v21.0";
const TOKEN = process.env.META_TOKEN;

const ACCOUNT_STATUS = {
  1: "ATIVA",
  2: "DESATIVADA",
  3: "NÃO QUITADA",
  7: "EM ANÁLISE DE RISCO",
  8: "PENDENTE DE PAGAMENTO",
  9: "PERÍODO DE CARÊNCIA",
  100: "FECHAMENTO PENDENTE",
  101: "FECHADA",
};

// Códigos de erro da Graph API que têm causa-raiz conhecida em permissão/token.
const ERROR_HINTS = {
  190: "Token inválido, expirado ou revogado. Gere outro em Business Settings → Usuários do sistema → Gerar novo token.",
  102: "Sessão inválida. O token provavelmente é de usuário comum e expirou — use um token de usuário do sistema.",
  200: "Falta permissão. O token precisa dos escopos ads_read e ads_management, e o usuário do sistema precisa ter a conta de anúncios atribuída em 'Adicionar ativos'.",
  10: "Permissão negada. Verifique se o app tem acesso ao Business Manager dono da conta.",
  100: "Parâmetro inválido — confira o ID da conta ou os campos pedidos.",
  4: "Limite de requisições atingido. Aguarde alguns minutos.",
  17: "Limite de requisições por usuário atingido. Aguarde alguns minutos.",
  80004: "Limite de chamadas da conta de anúncios atingido. Aguarde alguns minutos.",
};

function fail(context, error) {
  console.error(`\n✗ Erro da Meta em ${context}:`);
  console.error(`  código:    ${error.code}${error.error_subcode ? ` (subcódigo ${error.error_subcode})` : ""}`);
  console.error(`  tipo:      ${error.type ?? "—"}`);
  console.error(`  mensagem:  ${error.message}`);
  if (error.fbtrace_id) console.error(`  fbtrace_id: ${error.fbtrace_id}`);
  const hint = ERROR_HINTS[error.code];
  if (hint) console.error(`\n  Provável causa: ${hint}`);
  process.exit(1);
}

async function graph(path, params, context) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);

  const res = await fetch(url);
  const body = await res.json();
  if (body.error) fail(context, body.error);
  return body;
}

// Janela de 7 dias encerrada ontem — evita o dia corrente, que ainda está sendo consolidado.
function last7Days() {
  const until = new Date(Date.now() - 86_400_000);
  const since = new Date(until.getTime() - 6 * 86_400_000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { since: iso(since), until: iso(until) };
}

if (!TOKEN) {
  console.error("✗ META_TOKEN não encontrado. Rode com: node --env-file=.env scripts/meta-check.mjs");
  process.exit(1);
}

const range = last7Days();

const { data: accounts } = await graph(
  "me/adaccounts",
  { fields: "id,name,account_status,currency,timezone_name" },
  "me/adaccounts",
);

if (!accounts?.length) {
  console.log("Token válido, mas nenhuma conta de anúncios está atribuída a ele.");
  console.log("Atribua a conta em Business Settings → Usuários do sistema → Adicionar ativos → Contas de anúncios.");
  process.exit(0);
}

console.log(`✓ Token válido — ${accounts.length} conta(s) encontrada(s)`);
console.log(`Gasto no período de ${range.since} a ${range.until}\n`);

for (const acc of accounts) {
  const { data: insights } = await graph(
    `${acc.id}/insights`,
    { fields: "spend", time_range: JSON.stringify(range) },
    `insights de ${acc.id}`,
  );

  const spend = Number(insights?.[0]?.spend ?? 0);
  const status = ACCOUNT_STATUS[acc.account_status] ?? `DESCONHECIDO (${acc.account_status})`;

  console.log(`${acc.name}`);
  console.log(`  id:      ${acc.id}`);
  console.log(`  status:  ${status}`);
  console.log(`  moeda:   ${acc.currency}`);
  console.log(`  fuso:    ${acc.timezone_name}`);
  console.log(`  gasto:   ${spend.toFixed(2)} ${acc.currency}\n`);
}
