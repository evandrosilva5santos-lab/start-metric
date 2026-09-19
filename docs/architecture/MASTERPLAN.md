# Masterplan focado: Ads Management → Relatórios Inteligentes → WhatsApp Automation

## Elevator pitch revisado

Uma plataforma SaaS para agências e gestores de tráfego executarem, otimizarem e comunicarem campanhas sem sair da própria interface: Ads Management nativo, relatórios inteligentes e envio automatizado via WhatsApp.

## Prioridades atuais

1. **Ads Management** (Nível 1)
2. **Relatórios Inteligentes** (Nível 2)
3. **WhatsApp Automation** (Nível 3)

## Estrutura enxuta

### 1. Ads Management

- Painel de contas conectadas (Meta + Google). Filtros por workspace/cliente.
- Tabela com campanhas + ROAS/CPA/gasto + status.
- Ações: pausar/ativar, editar orçamento, duplicar campanha (incluir adsets/ads), logs em `ActivityLogs`.
- Workers / BullMQ garantem execução em lote com retries e backoff.
- Tokens criptografados e validações RBAC guardam segurança.

### 2. Relatórios Inteligentes

- Engines: Data Aggregation (normaliza spend/conversões/engajamento) e Template Builder.
- Templates com variáveis dinâmicas e preview imediato.
- Exportações: PDF, CSV, downloads manuais.
- Scheduler conecta relatórios a agendamentos definidos por frequência e hora.
- Logs de envio + status para auditoria.

### 3. WhatsApp Automation

- **Account Manager:** conectar múltiplos números (Business API ou provider alternativo).
- **Template Engine** reaproveita dados do Relatório Inteligente.
- **Scheduler Worker** dispara mensagens segundo agendamentos e templates.
- **Retry/Alert:** falhas notificadas no dashboard e com retries (pending → sent/fail).

## Tech stack (sem alterações)

- Frontend: Next.js + Tailwind.
- Backend: Node.js / NestJS + Workers (BullMQ/Redis).
- Banco: PostgreSQL (Supabase) para controles multi-tenant e audit logging.
- Integrações: Meta/Google APIs + WhatsApp Business.

## Próximos passos

1. Finalizar Ads Management com flows de edição e sincronização.
2. Criar pipeline de relatórios baseados nos dados consolidados.
3. Ligar WhatsApp Automation ao scheduler de relatórios.

## Notas de limpeza

- Outras etapas do PRD original foram removidas desta versão; caso precise resgatar, use histórico git.
