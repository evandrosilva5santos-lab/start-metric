# Product Requirements Document (Focused)

## Visão geral e escopo prioritário

- Objetivo imediato: lançar subsistema completo de **Ads Management** e construir os módulos dependentes de **Relatórios Inteligentes** e **WhatsApp Automation**.
- Todas as outras camadas/etapas são adiadas para remoção ou arquivamento até validação dessas três frentes.

## 1. Ads Management (Foco principal)

### Objetivo

Permitir gestão nativa de campanhas do Meta e Google Ads dentro da plataforma, cobrindo o ciclo completo: visualização, edição, pausa, duplicação e sincronização de orçamentos.

### Funcionalidades-chave

- Tela de contas conectadas com filtros por workspace/cliente.
- Visão em tabela com campanhas, ROAS, CPA, gasto total e status.
- Ações sobre linhas: pausar/ativar campanha, alterar orçamento, duplicar estrutura.
- Logs de audit trail e validação RBAC antes de cada comando.
- Integração com workers/BullMQ para aplicar mudanças em lote e evitar throttling.

### Integração técnica

- Fluxo: `UI → Ads Service → Integration Layer → External API → Update DB`.
- Tokens e credenciais armazenados cripto em Supabase/Postgres.
- Fila (Redis/Bull) garante retries e deduplicação de chamadas.

## 2. Relatórios Inteligentes (Sequência imediata)

### Objetivo

Criar Report Builder que consome dados consolidados das contas e gera documentos dinâmicos exportáveis.

### Componentes mínimos

- **Data Aggregation Engine** consolidando spend, conversões, ROAS e métricas sociais.
- **Templates reutilizáveis** com variáveis (`{{client_name}}`, `{{spend}}`, `{{top_campaign}}`, etc.). Preview instantâneo.
- **Report Scheduler** permitindo definir frequência (diário, semanal, quinzenal, mensal) e destino (dashboard/WhatsApp).
- **Delivery & Logs** com histórico de envios e status (`pending`, `sent`, `failed`).

## 3. WhatsApp Automation (Entrega após relatórios)

### Objetivo

Enviar relatórios via WhatsApp utilizando vários números conectados e templates do bloco anterior.

### Funcionalidades

- **Account Manager:** conectar/remover números (WhatsApp Business API ou provider alternativo).
- **Template Engine** reaproveitando layouts dos Relatórios Inteligentes.
- **Scheduler Worker:** dispara mensagens conforme agendamento armazenado.
- **Retry & Audit:** retries com backoff, histórico de envios e alertas em caso de falha persistente.

## Roteiro imediato

1. Finalizar Ads Management (integrações Meta/Google, ações e filas).
2. Reaproveitar KPIs para criar o pipeline do Relatórios Inteligentes.
3. Integrar WhatsApp Automation como canal de distribuição dos relatórios agendados.

## Métricas de sucesso

- Ads Management em produção com pelo menos 1 cliente conectado e ações de pausar/editar funcionando.
- Relatórios sendo gerados e visualizados com templates dinâmicos.
- WhatsApp Automation enviando relatórios programados sem falhas críticas.
