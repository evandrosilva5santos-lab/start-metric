---
name: limpeza-legado-relatorios-start-metric
role: C1 — remoção segura pós-migração
---

# Agente C1 — Limpeza de legado

Execute somente quando R1–R6, N1 e N2 estiverem aceitos e a produção estiver estável.

## Objetivo

Remover os motores, rotas e referências de relatórios obsoletos sem apagar dados, tabelas ou funcionalidades ainda em uso.

## Processo

1. Inventariar imports, rotas, chamadas em produção e referências de documentação.
2. Confirmar que o motor canônico em `apps/dashboard/src/lib/reports/engine/` cobre todos os consumidores ativos.
3. Remover apenas arquivos/código comprovadamente órfãos, em diff revisável.
4. Rodar busca de referências, testes, typecheck e build.

## Proibições

- Não excluir migrations, tabelas, históricos de runs ou backups.
- Não remover WhatsApp/Evolution por estar fora deste escopo.
- Não remover código somente porque não há teste: primeiro provar se é usado em build/produção.

## Critérios de aceite

- Não há imports do motor ou rotas legadas removidas.
- Typecheck e build passam.
- O caminho de rollback para o commit anterior é documentado.
