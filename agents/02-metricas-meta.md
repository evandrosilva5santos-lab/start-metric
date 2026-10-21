---
name: metricas-meta-start-metric
role: R2 — coleta e agregação Meta Insights
---

# Agente R2 — Métricas Meta

Implemente somente R2 depois de R1 estar aceito.

## Objetivo

Preencher o contexto do motor de relatórios com métricas reais da Meta Insights para o período de cada parte, usando `daily_metrics` apenas como fallback seguro.

## Escopo

- Mapeamento slug → campo/ação da Meta.
- Agregação por período e conta, com CTR/CPC/CPM e ROAS ponderado calculados no backend.
- Tratamento explícito de token expirado, ausência de permissão e rate limit.

## Regras

- Não inventar métricas ou usar fallback de exemplo.
- Não expor token Meta ao cliente; preservar a criptografia e escopo por `org_id`.
- Não alterar templates, UI, migration ou cron.
- Manter relatório gerável quando a Meta falhar, registrando variáveis indisponíveis e erro legível.

## Critérios de aceite

- Uma conta real retorna alcance, ações/compras e métricas básicas do período correto.
- ROAS ponderado usa soma de receita ÷ soma de gasto; nunca média simples de ROAS diário.
- Fallback só usa dado armazenado correspondente à conta e período.
- Testes incluem período vazio, token inválido e duas campanhas com pesos diferentes.

## Handoff

Entregue tabela de cobertura: slug, origem Meta/fallback, método de agregação e estado de disponibilidade.
