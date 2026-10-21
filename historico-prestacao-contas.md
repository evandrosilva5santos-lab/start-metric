# Central de Histórico e Prestação de Contas — plano v3

## Goal
Registrar tudo o que foi feito para cada cliente (Meta + painel + manual) e gerar, com um clique, uma prestação de contas confiável. Desenho, decisões (D1–D36) e revisões: `docs/PLANO_HISTORICO_PRESTACAO_CONTAS.md`.

## No ar em 21/10/2026 (commits `fc80b6d7`, `f46d4d74`)
- [x] T3b aplicada (execuções, trava, cobertura) + pg_cron `start-metric-meta-activities` (minuto :07, URL no Vault).
- [x] Sincronização do histórico da Meta (motor por janelas, rota de cron, botão Atualizar) — 51 testes de unidade + 29 de banco.
- [x] Aba **Histórico** no Cliente 360° (`/clients/[id]?tab=historico`), só leitura, itens agrupados em rajadas. Testada no Chrome com o Moving.
- [ ] Falta: captura das ações do painel (T5), registrar/anotar motivo e detalhe (T6/T7), relatório (T8), aba Prestação de contas (T9).

## Tasks
**Fase A — base sem tocar no banco** (pode começar já)
- [ ] **T0 Infra** — `lib/activity/flags.ts` (D31); `lib/http/route.ts` extraído de `reports/http.ts`; PGlite como devDependency; scripts `test:activity` e `test` agregador. → Verify: `npm run test --workspace=start-metric` roda as suítes antigas e novas.
- [x] **T1a + T1b** feitas com TDD (commits `b78fbbbd` RED → `3ff9d0da` GREEN): 40 testes; cobertura de `src/lib/activity` em 99,6 % das linhas e 77,6 % dos ramos. Fixtures sintéticas no formato bruto (sem dados reais de clientes).
- [ ] **T1c** protótipo rodado em dados reais (Moving, 13–19/10): 2.256 eventos → 425 contam → **44 itens de trabalho**. **Aguardando você ler** `prototipo-moving-semana.txt`. Achados incorporados: Meta assina com `actor_id "0"`; inativo = 8 (anúncio), 7 (conjunto), 15 (campanha); 4 = reprovado; 18 = revisão; `since`/`until` são **inclusivos**; `/activities` consome a cota **ads_management**; a Meta guarda **> 13 meses**; itens de trabalho = **rajada** (mesmo ator + mesma ação, intervalo ≤ 5 min, qualquer conjunto).
- [ ] **T1a Leitura sem perdas** — `graphRequest` (D22) + parse com ids como texto + normalização (`event_type`, `object_type`) + `dedupe_key` estável com ordinal por janela (D3′, D20, D21); fixtures de texto bruto saneado (2 capturas). → Verify: testes — captura 1 e 2 = mesmas chaves; payload embaralhado = mesmas chaves; ids intactos.
- [ ] **T1b Classificação** — `classify.ts` com `CLASSIFIER_VERSION`, um caso por linha do catálogo + desconhecido. → Verify: testes verdes; nenhuma transição de revisão conta como trabalho.
- [ ] **T1c Formatador + protótipo** — títulos e frases pt-BR por tipo (centavos, códigos, títulos contraditórios); script somente leitura gera o relatório da semana passada do Moving; verifica as suposições da §8.3. → Verify: **você lê e diz se enviaria**.
- [x] **T2 Figma** — telas do Histórico, detalhe, registrar/anotar, gerador, página do relatório, Prestação de contas e estados, em 1440 e 390. Entregue em https://www.figma.com/design/eMb5uMXmHSR7zOVa6TlZ3o (arquivo próprio: o do Start Control está no limite de 3 páginas do plano Starter e usa a direção antiga). → Verify: **aguardando sua aprovação**.

**Fase B — banco (só com sua aprovação da migration)**
- [x] **T3a aplicada em 21/10/2026** com autorização (`20261022000000_activity_events.sql`, commit `8d716391`): 23 testes no PGlite, validação sem efeito no schema real, conferência pós-aplicação (tabelas, 5 vínculos presumidos, gatilho ok, desligar/religar conta ok em ROLLBACK).
- [ ] **T3a (descrição original)** `…_activity_events.sql` — eventos, `activity_event_raw`, revisões, vínculos com backfill, gatilhos (D23–D28, D35), RPCs insert/void/reassign/reclassify. → Verify: PGlite — duplicado = 1; UPDATE/DELETE/TRUNCATE barrados até para service role; RPC com id de outra org aborta.
- [ ] **T3b** `…_activity_sync.sql` — cobertura, execuções, `acquire_activity_sync_run`. → Verify: PGlite — segunda trava = "em andamento"; `stale` sem heartbeat; cobertura não regride.
- [ ] **T3c** `…_client_reports.sql` — relatórios + `activity_summary` (itens de trabalho por gaps-and-islands). → Verify: PGlite — final imutável; resumo de outra org vazio.

**Fase C — captura e sincronização**
- [ ] **T4a Plano de sync puro** — janelas adaptativas, cobertura, orçamento, cabeçalho de uso, fila (D20, D34). → Verify: Graph falsa — dia com 1.200 eventos completa; empate na divisa de página não perde evento; limite pausa só a conta.
- [ ] **T4b Serviço + cron** — rota `/api/cron/meta-activities` + migration `…_activity_schedule.sql` (pg_cron :07). → Verify: duas execuções = 0 novas; cobertura `complete`.
- [ ] **T4c Atualizar manual + nomes de campanha**. → Verify: segundo clique em 5 min é recusado; nomes resolvidos dentro do teto.
- [ ] **T5a Captura de campanha/conjunto** — `recordActivity` aguardado, leitura prévia, `succeeded|failed|unknown`, correção do 404 com validação de org (D32). → Verify: núcleo testado (Meta falha → `failed`; conjunto de outra org → 404 sem POST).
- [ ] **T5b Demais capturas** — contas, conexão Meta, clientes, relatórios. → Verify: testes de núcleo.

**Fase D — produto**
- [ ] **T6 APIs** — lista, detalhe, resumo, registrar, editar 15 min, anotar motivo, anular, reatribuir. → Verify: matriz rota × (outra org, outro cliente) = 404/vazio e 0 mutações.
- [ ] **T7 Aba Histórico**. → Verify: Chrome 1440/834/390, console e rede limpos.
- [ ] **T8a Relatório** — semana passada (fuso do cliente), rascunho → final, página imprimível, copiar WhatsApp/e-mail, anteriores. → Verify: fronteira de domingo 23:59; snapshot sem `raw`/URLs/ator.
- [ ] **T8b Enviar pelo WhatsApp do cliente** (P1, `whatsapp/send-to-client.ts`). → Verify: envio real só com sua confirmação.
- [ ] **T9 Aba Prestação de contas** + `toClientView()`. → Verify: teste unitário do que some + Chrome A–J.
- [ ] **T10 QA, build-fix, deploy** — liga `ACTIVITY_CAPTURE_ENABLED` antes da UI. → Verify: cobertura (D36) ≥ 99 % após 24 h; zero erro de console/rede.

**Caminho crítico:** T0 → T1a → T1b → T1c → T3a → T3b → T4a → T4b → T6 → T7 → T8a → T9 → T10. T2 corre junto da Fase A e precisa estar aprovado antes de T7.

## Done When
- [ ] Critérios de aceite das duas missões marcados com evidência, ou pendentes com o motivo.

## Notes
- **Rollback:** desligar as flags e o job no pg_cron. O histórico não se apaga; script de remoção pronto, só roda com sua autorização.
- **Testes que mexem em produção** (pausar campanha, enviar WhatsApp) só com sua confirmação.
- **Fora do MVP:** origem `detected`, IA, PDF gerado no servidor, rascunho automático de segunda, portal do cliente.
- O `/ecc:multi-plan` pede o plano em `.claude/plan/`; ficou na raiz, como manda o `/plan-writing`, para não ter duas cópias.
