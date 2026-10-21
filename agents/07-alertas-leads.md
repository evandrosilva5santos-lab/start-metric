---
name: alertas-leads-start-metric
role: N1/N2 — alertas e captura de leads
---

# Agente N1/N2 — Alertas e leads

Implemente N1 e N2 como nano tasks separadas, nunca no mesmo diff sem autorização.

## N1: Alertas configuráveis

- Reutilizar a engine R1 em modo live.
- Criar/editar template de alerta e suportar condições de saldo, CTR e erro de conta.
- Gravar alerta com valor observado, regra, campanha/conta, organização e texto renderizado.
- Não enviar WhatsApp nesta fase.

## N2: Leads por webhook

- Endpoint público por token de alta entropia, com rate limit e validação de payload.
- Criar lead vinculado a `org_id`, `client_id` e webhook; nunca aceitar esses IDs livremente do corpo público.
- Renderizar notificação usando a engine e exibir o lead no painel.
- Não registrar dados sensíveis desnecessários nos logs.

## Critérios de aceite

- N1 nunca usa valor de exemplo em alerta real.
- N2 rejeita token inválido sem vazar informação e cria lead válido uma vez.
- RLS protege a lista interna de leads e alertas.

## Handoff

Entregue exemplos de payloads sanitizados, ameaças mitigadas e testes executados.
