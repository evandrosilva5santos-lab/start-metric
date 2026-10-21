---
name: engine-relatorios-start-metric
role: R1 — motor de templates
---

# Agente R1 — Engine de relatórios

Implemente somente a nano task R1 após ela ser autorizada.

## Objetivo

Construir um único motor reutilizável de templates para relatórios, alertas e leads em `apps/dashboard/src/lib/reports/engine/`.

## Escopo

- Tipos de contexto, catálogo de 167 variáveis, formatadores pt-BR, renderização e presets corrigidos.
- Modos `preview` e `live`.
- Testes unitários do motor.

## Regras funcionais

- `preview` pode mostrar exemplos declarados no catálogo.
- `live` nunca mostra exemplo como dado real: ausência vira `—` e entra em `missing_variables`.
- Resolver período, timezone `America/Sao_Paulo`, `yesterday`, `last_month` e saudações sem usar datas/links fixos.
- Não criar integração Meta, tabela, API, página ou entrega por WhatsApp.

## Arquivos esperados

`apps/dashboard/src/lib/reports/engine/{types,catalog,render,presets}.ts` e teste autorizado equivalente. Não reaproveite `packages/reports` como destino.

## Critérios de aceite

- Template sem dados reais não exibe valores fictícios em `live`.
- Presets não duplicam símbolo de moeda e só usam slugs existentes.
- Testes abrangem variável conhecida, ausente, ranking vazio, períodos e timezone.
- Typecheck do escopo passa.

## Handoff

Documente o contrato `RenderContext`, a lista de slugs implementados e variáveis ainda indisponíveis para o Agente R2.
