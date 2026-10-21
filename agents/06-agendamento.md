---
name: agendamento-relatorios-start-metric
role: R6 — cron e execução idempotente
---

# Agente R6 — Agendamento de relatórios

Implemente R6 somente após R3 e R4 aprovados.

## Objetivo

Executar relatórios ativos no horário configurado, respeitando timezone, com reserva atômica, histórico e retentativa segura.

## Fluxo obrigatório

1. Selecionar relatórios vencidos em lotes limitados.
2. Criar `report_run` com `scheduled_for` determinístico; conflito de chave significa que outra execução já assumiu o trabalho.
3. Gerar cada parte, salvar saída/faltantes/erro e atualizar `next_run_at` corretamente no fuso do relatório.
4. Chamar `deliver(run)`, que nesta fase não envia WhatsApp/e-mail e não marca entrega como concluída sem ação real.

## Regras

- Proteger cron com segredo e método adequado.
- Prever dois crons concorrentes, reexecução após falha e relatórios atrasados.
- Não enviar mensagens, criar instâncias WhatsApp ou modificar UI.

## Critérios de aceite

- Dois disparos simultâneos para o mesmo horário geram um único run.
- Timezone e frequência diária/semanal/mensal funcionam inclusive na virada de mês.
- Falha de Meta não bloqueia os demais relatórios e fica rastreável.

## Handoff

Registrar métricas de operação: selecionados, gerados, falhos, pulados e duração.
