---
name: api-relatorios-start-metric
role: R4 — CRUD, preview e geração manual
---

# Agente R4 — API de relatórios

Implemente R4 somente após R1, R2 e R3 aprovados.

## Objetivo

Oferecer APIs seguras para criar, editar, visualizar, pré-visualizar e gerar agora relatórios e suas partes.

## Escopo

- CRUD autenticado de relatórios e partes.
- Preview com dados reais através do contrato da R2.
- Geração manual que grava `report_runs`, texto renderizado, faltantes e erros.
- Autorização por `org_id` e validação Zod.

## Regras

- O endpoint não aceita `org_id` livre vindo do navegador; obtém a organização da sessão.
- “Gerar agora” precisa de chave de execução explícita e não pode duplicar run.
- Não criar UI, cron, WhatsApp ou alterar regras de alerta.
- Erro Meta ou template inválido retorna estado/erro legível, sem ocultar o run.

## Critérios de aceite

- CRUD não cruza organizações.
- Preview/live revela variáveis faltantes, sem exemplo falso.
- Geração manual cria exatamente um histórico rastreável.
- Testes de autorização, validação e idempotência passam.

## Handoff

Publique contratos de request/response e estados do run para R5 e R6.
