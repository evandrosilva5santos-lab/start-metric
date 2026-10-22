# Paridade com o Metrifiquei — catálogo de variáveis + API pública

Estudo feito em 2026-10-21/22, a pedido do dono, a partir de:
- `https://v2.metrifiquei.com.br/app/variables` (catálogo de variáveis, 137 no total)
- `https://docs.metrifiquei.com.br/` (API pública REST, OpenAPI 3.1, baixada em `api-1.json`, 52 rotas / 12 áreas)

Só leitura: nenhum login, nenhuma ação de salvar/gerar/conectar foi feita nos dois sites.

## 1. Catálogo de variáveis

137 variáveis no Metrifiquei, contra ~90 (estáticas + por tipo de ação da Meta) no nosso
`src/lib/reports/engine/catalog.ts`. Por categoria:

| Categoria | Metrifiquei | Start Metric | Lacuna |
|---|---|---|---|
| Métricas | 56 | ~14 Meta + ~3 Google | Quase todo o Instagram orgânico (23 var.) e boa parte do Google |
| Conversões | 11 | 2 Google + ações Meta dinâmicas | `google_all_conversions`, `google_all_roas`, taxas conv./interação |
| Custos | 2 | 2 Google + ações Meta dinâmicas | ok, cobertura equivalente |
| Vídeo | 3 (TrueView, Google) | 8 (Meta, formato diferente) | Nenhuma das do Google; as nossas são só Meta |
| Identificação | 25 | ~10 | Variáveis "(total)" que escolhem Meta ou Google automaticamente; IDs/nomes de grupo e campanha do Google |
| Meta-dados | 18 | ~1 (`meta_currency`) | Ranking de palavras-chave (Google), orçamento diário, objetivo, tipo/valor de resultado |
| Universais | 11 | 11 | Igual |
| Calculadas | 11 | 10 | Falta nada relevante (`ctr` duplicado lá, não aqui) |

### Variáveis "(total)" — não temos o conceito

O Metrifiquei resolve automaticamente qual canal usar por cliente (`{{impressions}}`, `{{clicks}}`,
`{{spend}}`, `{{reach}}`, `{{account_balance}}`, `{{campaign_id}}`, `{{campaign_name}}`, `{{ad_id}}`,
`{{ad_name}}`, `{{adset_id}}`, `{{adset_name}}`, `{{account_name}}`, `{{currency}}`) — soma Meta+Google
quando o cliente tem os dois, ou usa o que existir. Hoje nosso catálogo só tem variáveis por canal
(`meta_spend`, `google_spend`, ...); quem monta o relatório tem que escolher a variável certa à mão.
**Recomendação:** adicionar um pequeno conjunto de variáveis "totais" no motor de relatórios que somem
(métricas) ou escolham (identificação) entre os canais ativos do cliente.

### Google Ads: cobertura rala (12 de 40)

Com a integração nova (`src/lib/google-ads/`), já sincronizamos `spend`, `impressions`, `clicks`,
`conversions`, `conversions_value`, e calculamos `ctr`/`cpc`/`cpm`/`cost_per_conversion`/`roas` em
`gaql.ts#summarizeMetrics`. Faltam no catálogo (a maioria não tem como vir do GAQL básico, precisa de
campos extras na query ou outro relatório da API):
`google_search_impression_share`, `google_content_budget_lost_impression_share`,
`google_search_budget_lost_impression_share`, `google_search_rank_lost_impression_share`,
`google_top_impression_percentage`, `google_absolute_top_impression_percentage`, `google_quality_score`,
`google_account_balance`, `google_account_name`, `google_campaign_id/name`, `google_adset_id/name`,
`google_ad_id/name`, `google_currency`, `google_all_conversions[_value]`, `google_all_roas`,
`google_conversions_from_interactions_rate`, `google_cost_per_all_conversions`,
`google_all_keywords_simple/ranking`, `google_top_1/3/5_keywords_ranking`,
`google_trueview_average_cpv`, `google_video_trueview_view_rate/views`.

**Nota de nomenclatura:** o Metrifiquei usa `google_conversions_value` (plural); nosso catálogo tem
`google_conversion_value` (singular) — o dado sincronizado na tabela já é `conversions_value`
(`google_ads_daily_metrics.conversions_value`). Vale corrigir o slug do catálogo para bater com o dado.

### Instagram orgânico — não existe no Start Metric

23 variáveis (`instagram_reach`, `instagram_followers_count`, `instagram_engagement_rate`,
`instagram_gender_*_pct`, `instagram_top_cities`, etc.) dependem de uma integração com a Instagram
Graph API que não existe no projeto. Não é Google nem Meta Ads — é o perfil do Instagram (orgânico).
Fica fora do catálogo até essa integração existir.

## 2. API pública (`docs.metrifiquei.com.br`) — 12 áreas, 52 rotas

O arquivo baixado tem o OpenAPI completo em `~/Downloads/api-1.json`. Resumo por área, comparado com
o que existe hoje em `apps/dashboard`:

| Área (tag) | O que é no Metrifiquei | Equivalente no Start Metric | Lacuna |
|---|---|---|---|
| **Clients** | CRUD completo + arquivar/restaurar + reordenar + contatos (múltiplos, com principal) + segmento/produto/squad/responsável + localização (lat/lng) + banner | `clients` table básica (nome, e-mail, telefone, whatsapp, nicho, notas) | Sem segmento, produto, squad, responsável, múltiplos contatos, localização, reordenação manual |
| **Taxonomy** | `segments` e `products` (nome + cor), para classificar clientes | Não existe | Módulo novo, pequeno |
| **Connections** | Conexões Meta/Google por org, abstraídas (`provider`, `status`, `expires_at`) | `meta_connections` + `google_ads_connections`, cada um com seu próprio schema/rota | Já equivalente em dado; API pública não existe (não é prioridade — uso interno) |
| **Providers** | Canais de **entrega** (WhatsApp, e-mail) com status de conexão | Instâncias Evolution por cliente (`whatsapp_instances`) | Falta provedor de e-mail; falta "provider" como conceito de org (hoje é por cliente) |
| **Templates** | Templates de mensagem reaproveitáveis, com `channel` (Google/Meta/Todos), filtro por objetivo/seleção/texto, nível de agrupamento (conta/campanha/conjunto/anúncio), condicionais (`se métrica operador valor, mensagem X senão Y`), preview e validação | Não existe como entidade — o motor de relatórios (`reports/engine`) já sabe montar texto, mas não há "template" salvo e reaproveitável entre clientes | Módulo médio: salvar/testar templates de texto com variáveis + condicionais |
| **Variables** | Catálogo consultável via API, filtrável por canal | `catalog.ts` estático, só usado internamente | Baixa prioridade (uso interno já cobre) |
| **Reports** | Relatórios recorrentes: partes (`standard`/`ai_analysis`/`dashboard_pdf`), modo agregado/detalhado, ordenação, limite de itens, múltiplas fontes por parte, canais de envio (WhatsApp/e-mail/API), `send_mode` combinado/separado, frequência (diária/semanal/quinzenal/mensal), horário fixo ou janela, duplicar, enviar agora | `report-runs` + `reports/engine` já geram relatório sob demanda (manual) | Falta: agendamento recorrente automático, parte "análise por IA" (a OmniRoute `0_Free` cai bem aqui), parte "PDF do dashboard", duplicar relatório, "enviar agora" por API |
| **Dashboards** | Dashboard por cliente com compartilhamento público (com ou sem senha) e embed | `shared_links` (compartilhamento simples, já citado como tendo RLS desabilitada — ver pendências gerais) | Falta o conceito de "dashboard" editável (hoje é só visão fixa) e o toggle de público/senha/embed |
| **Alerts** | Dois níveis: `Alert` (por cliente, limiar simples: saldo/erro/métrica) e `AlertRule` (por campanha/conjunto/anúncio, com **ação automática**: pausar, ativar, diminuir ou aumentar orçamento) + `AlertTemplate` (mensagem reutilizável) + janela de horário + "desativar após enviar" | `lib/alerts/evaluator.ts` cobre ROAS/CPA/gasto sem conversão/CTR/erro de API, com triagem manual | **Lacuna grande:** não temos regras que tomam ação sozinhas (pausar campanha, subir/baixar orçamento). Isso é automação real, não só aviso — cruza com a Central de Histórico (toda ação automática precisa virar evento auditável) |
| **Members** | Lista de usuários da org (para atribuir tarefas/deals) | `profiles`/sessão de usuário existe, mas sem conceito de "membro atribuível" | Pequeno, pré-requisito de Tasks/Deals |
| **Tasks** | Quadro Kanban por board/coluna (`todo/doing/done`), tarefa com cliente, squad, responsável(is) humano(s) e **agentes de IA**, prioridade, prazo, atividade (comentários + eventos) | Não existe | Módulo grande — gestão interna da agência, não é dado de anúncio |
| **Deals** | Pipeline de vendas (funil com etapas `open/won/lost`), campos customizados por funil, motivo de perda, atividade | Não existe | Módulo grande — CRM comercial da agência (fechar novos clientes), distinto da Carteira de clientes já atendidos |

### Achado mais importante para priorizar: regras de alerta com ação automática

`AlertRuleInput.action: pause | activate | decrease_budget | increase_budget` — o Metrifiquei não só
avisa, ele **executa** a ação no Google/Meta Ads quando a métrica cruza o limite (por campanha, conjunto
ou anúncio), com `action_percent` para os ajustes de orçamento. Isso é uma automação de verdade, maior
que qualquer coisa que temos hoje. Se formos atrás disso, cada ação automática tem que:
1. Escrever na conta via API (já temos o caminho para pausar campanha — ver pendência T5 da Central de
   Histórico);
2. Gerar um evento na Central de Histórico como "feito pelo painel/automação", não manual;
3. Ter como desfazer/auditar quem configurou a regra.

## 3. Prioridades recomendadas (combinando com o estudo anterior do app)

**P0 — fecha o básico que já começamos**
1. Variáveis Google no motor de relatórios (catálogo + leitura), já apontado no estudo anterior.
2. Variáveis "totais" (Meta+Google) no catálogo — mencionadas acima.
3. Corrigir `google_conversion_value` → `google_conversions_value` no catálogo.

**P1 — automações que mais pedem**
4. Regras de alerta com ação automática (pausar/ativar/orçamento) — maior ganho percebido pelo dono,
   mas é o item mais arriscado (escreve na conta do cliente).
5. Templates reaproveitáveis de mensagem (condicionais inclusos) — destrava relatórios mais ricos sem
   reescrever texto por cliente.
6. Agendamento recorrente de relatórios (hoje é só geração manual) + "parte de análise por IA" via
   OmniRoute.

**P2 — módulos novos, maiores, fora do núcleo de anúncios**
7. Segmentos/Produtos (taxonomia de clientes) — pequeno, mas destrava filtros melhores na Carteira.
8. Dashboards compartilháveis com senha/embed (hoje só existe link simples).
9. Tasks (quadro Kanban interno) e Deals (CRM de vendas) — são produtos à parte, não dado de mídia;
   avaliar se cabem no Start Metric ou se é melhor manter fora por enquanto.
10. Instagram orgânico — precisa de integração nova (Instagram Graph API), do zero.

## 4. Onde ficam os artefatos coletados

- `~/Downloads/api-1.json` — OpenAPI completo baixado do docs.metrifiquei.com.br (52 rotas, schemas
  completos). Fonte primária para qualquer implementação futura destes módulos.
- Este arquivo — leitura humana, não é lido pelo motor de relatórios.
