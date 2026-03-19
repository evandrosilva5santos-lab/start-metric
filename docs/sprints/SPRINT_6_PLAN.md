# Sprint 6: Agendamento Confiável, Retries e Observabilidade

**Data:** 2026-03-18
**Versão:** 1.0
**Status:** 📋 Planejamento
**Duração Estimada:** 2 semanas

---

## 📊 RESUMO EXECUTIVO

A **Sprint 6** foca em tornar o sistema **production-ready** com infraestrutura de agendamento confiável, lógica de retry robusta e observabilidade completa.

**Objetivo Principal:** Eliminar pontos únicos de falha e garantir visibilidade total do sistema em produção.

---

## 🎯 OBJETIVOS DA SPRINT

### Objetivo 1: Agendamento Confiável
- Substituir Vercel Cron por solução mais robusta
- Implementar job queue com priorização
- Garantir execução exactly-once para jobs críticos

### Objetivo 2: Retry Logic Robusto
- Implementar exponential backoff
- Dead letter queues para falhas permanentes
- Circuit breakers para APIs externas

### Objetivo 3: Observabilidade
- Métricas em tempo real
- Logs estruturados centralizados
- Alertas contextuais
- Dashboards operacionais

---

## 📋 BACKLOG DA SPRINT

### Epic 6.1: Job Queue e Agendamento

#### Story 6.1.1: Implementar BullMQ para Job Queue
**ID:** S6-1-1
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 8

**Descrição:**
Implementar BullMQ (ou alternativa compatível com Vercel) para gerenciar jobs assíncronos com persistência Redis.

**Critérios de Aceite:**
- [ ] Job queue configurada com Redis (Upstash/Standalone)
- [ ] Jobs podem ser agendados com delay
- [ ] Jobs têm prioridade (alta/média/baixa)
- [ ] Workers processam jobs concorrentemente
- [ ] Jobs falhados são retomados após restart

**Técnicas:**
- BullMQ ou Cloudflare Queues (compatível Vercel)
- Redis via Upstash (serverless) ou Neon
- Jobs: meta-sync, alerts-monitor, reports-generation

**Notas:**
- Vercel Cron tem limitações de 10s para jobs gratuitos
- BullMQ precisa de Redis persistente
- Alternativa: Cloudflare Workers + Queues

---

#### Story 6.1.2: Migrar Cron Jobs para Job Queue
**ID:** S6-1-2
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 5
**Depende:** S6-1-1

**Descrição:**
Migrar `/api/cron/meta-sync` e `/api/cron/alerts-monitor` para jobs agendados na queue.

**Critérios de Aceite:**
- [ ] `/api/cron/meta-sync` cria job na queue
- [ ] `/api/cron/alerts-monitor` cria job na queue
- [ ] Jobs processam em background (workers)
- [ ] Cron endpoints retornam imediatamente (202 Accepted)
- [ ] Health check endpoint monitora queue health

**Notas:**
- Mantém compatibilidade com webhooks existentes
- Jobs têm timeout configurável
- Status de jobs persiste para auditoria

---

### Epic 6.2: Retry Logic e Resiliência

#### Story 6.2.1: Implementar Exponential Backoff
**ID:** S6-2-1
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 5

**Descrição:**
Implementar lógica de retry com exponential backoff e jitter para chamadas de API externas.

**Critérios de Aceite:**
- [ ] RetryConfig com tentativas, delay, maxDelay
- [ ] Jitter aleatório para evitar thundering herd
- [ ] Retries para: Meta API, Evolution API, Supabase
- [ ] Logs estruturados para cada tentativa
- [ ] Métricas de retry rate por endpoint

**Configuração:**
```typescript
interface RetryConfig {
  maxAttempts: 3-5;
  initialDelay: 1000ms;
  maxDelay: 30000ms;
  backoffFactor: 2;
  jitter: true;
  retryableErrors: ['NETWORK', 'TIMEOUT', '5xx'];
}
```

**Notas:**
- Usar biblioteca: `retry` ou `axios-retry`
- Não retry em erros 4xx (exceto 429)
- Circuit breaker após 5 falhas consecutivas

---

#### Story 6.2.2: Dead Letter Queue (DLQ)
**ID:** S6-2-2
**Prioridade:** 🟡 ALTA
**Pontos:** 3
**Depende:** S6-1-1

**Descrição:**
Implementar DLQ para jobs que falharam após todos os retries.

**Critérios de Aceite:**
- [ ] Jobs com >5 retries movidos para DLQ
- [ ] DLQ tem endpoint de inspeção (`/api/admin/dlq`)
- [ ] Jobs podem ser reprocessados manualmente
- [ ] Alertas enviados quando DLQ cresce (>10 jobs)

**Campos do Job DLQ:**
```json
{
  "originalJob": { ... },
  "error": "error message",
  "stack": "stack trace",
  "attempts": 5,
  "lastAttemptAt": "timestamp",
  "queuedAt": "timestamp"
}
```

---

#### Story 6.2.3: Circuit Breakers
**ID:** S6-2-3
**Prioridade:** 🟡 ALTA
**Pontos:** 5

**Descrição:**
Implementar circuit breakers para APIs externas (Meta, Evolution, Supabase).

**Critérios de Aceite:**
- [ ] Circuit breaker por endpoint externo
- [ ] Estados: CLOSED, OPEN, HALF_OPEN
- [ ] Timeout configurável por serviço
- [ ] Fallback quando circuito aberto
- [ ] Métricas de circuit state

**Configuração:**
```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;      // abre após 5 falhas
  resetTimeout: 60000;      // tenta fech após 60s
  monitoringPeriod: 10000;  // janela de monitoramento
  halfOpenMaxCalls: 3;      // max chamadas em HALF_OPEN
}
```

---

### Epic 6.3: Observabilidade

#### Story 6.3.1: Logging Estruturado
**ID:** S6-3-1
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 3

**Descrição:**
Implementar logging estruturado com Pino ou Winston para todos os serviços.

**Critérios de Aceite:**
- [ ] Logs em formato JSON estruturado
- [ ] Níveis: debug, info, warn, error, fatal
- [ ] Contexto por request (requestId, userId, orgId)
- [ ] Logs sensíveis redatados automaticamente
- [ ] Console em dev, arquivo em prod

**Estrutura do Log:**
```json
{
  "level": "error",
  "time": "2026-03-18T10:30:00Z",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "orgId": "org_456",
  "msg": "Meta API request failed",
  "err": { "name": "APIError", "message": "...", "stack": "..." },
  "meta": { "endpoint": "/me/accounts", "attempt": 2 }
}
```

---

#### Story 6.3.2: Métricas em Tempo Real
**ID:** S6-3-2
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 5

**Descrição:**
Implementar coleta de métricas: request rate, error rate, latency, queue depth.

**Critérios de Aceite:**
- [ ] Métricas HTTP: latency, throughput, status codes
- [ ] Métricas de Queue: depth, processing rate, failure rate
- [ ] Métricas de DB: query time, connection pool
- [ ] Métricas de Negócio: active users, reports generated
- [ ] Export para Prometheus/Vercel Metrics

**Principais Métricas:**
- `http_request_duration_seconds{route, status}`
- `http_requests_total{route, status}`
- `queue_depth{name}`
- `queue_processing_time_seconds{name}`
- `db_query_duration_seconds{table, operation}`

---

#### Story 6.3.3: Dashboards Operacionais
**ID:** S6-3-3
**Prioridade:** 🟡 ALTA
**Pontos:** 5
**Depende:** S6-3-2

**Descrição:**
Criar dashboards em `/admin/analytics` para visibilidade operacional.

**Critérios de Aceite:**
- [ ] Dashboard de System Health (uptime, error rate, latency)
- [ ] Dashboard de Queue Jobs (depth, processing time, failures)
- [ ] Dashboard de API Externa (Meta, Evolution - status, latency)
- [ ] Dashboard de Business Metrics (active users, reports)
- [ ] Filtros por time range (1h, 24h, 7d, 30d)

**Páginas:**
- `/admin/analytics/system` - Saúde do sistema
- `/admin/analytics/queues` - Status das filas
- `/admin/analytics/apis` - APIs externas
- `/admin/analytics/business` - Métricas de negócio

---

#### Story 6.3.4: Alertas Contextuais
**ID:** S6-3-4
**Prioridade:** 🟡 ALTA
**Pontos:** 5
**Depende:** S6-3-1, S6-3-2

**Descrição:**
Implementar sistema de alertas com notificações (email, Slack, WhatsApp).

**Critérios de Aceite:**
- [ ] Alertas configurados via `/admin/alerts`
- [ ] Canais: Email, Slack webhook, WhatsApp
- [ ] Severidades: INFO, WARNING, ERROR, CRITICAL
- [ ] Regras: threshold-based, anomaly-based
- [ ] Silenciamento temporário de alertas

**Tipos de Alerta:**
- **Error Rate > 5%** (5 min) - CRITICAL
- **API Latency > 5s** (5 min) - WARNING
- **Queue Depth > 100** (1 min) - ERROR
- **Circuit Breaker OPEN** (imediato) - CRITICAL
- **DLQ Size > 10** (1 min) - ERROR

---

#### Story 6.3.5: Distributed Tracing (Opcional)
**ID:** S6-3-5
**Prioridade:** 🟢 MÉDIA
**Pontos:** 8
**Depende:** S6-3-1

**Descrição:**
Implementar distributed tracing com OpenTelemetry para rastrear requests através de microserviços.

**Critérios de Aceite:**
- [ ] Spans para cada operação crítica
- [ ] Trace propagation entre serviços
- [ ] Export para Jaeger/Tempo/Honeycomb
- [ ] Correlation de logs com traces
- [ ] Visualização de latency por span

---

### Epic 6.4: Infraestrutura de Deploy

#### Story 6.4.1: CI/CD Automático
**ID:** S6-4-1
**Prioridade:** 🟡 ALTA
**Pontos:** 5

**Descrição:**
Configurar GitHub Actions para CI/CD automatizado.

**Critérios de Aceite:**
- [ ] Pipeline de lint + typecheck + test em cada PR
- [ ] Pipeline de build em cada PR (preview)
- [ ] Deploy automático para main (produção)
- [ ] Rollback automático em caso de falha
- [ ] Status checks obrigatórios para merge

**Workflow:**
```yaml
on: pull_request
jobs:
  validate:
    - lint
    - typecheck
    - test
    - build
  preview:
    - deploy to Vercel (preview)
on: push to main
jobs:
  production:
    - deploy to Vercel (prod)
    - run smoke tests
    - notify on failure
```

---

#### Story 6.4.2: Health Checks
**ID:** S6-4-2
**Prioridade:** 🔴 CRÍTICA
**Pontos:** 3

**Descrição:**
Implementar endpoint `/health` com checks de dependências.

**Critérios de Aceite:**
- [ ] `/health` retorna status geral (200/503)
- [ ] `/health/ready` verifica dependências críticas
- [ ] `/health/live` verifica se servidor está vivo
- [ ] Checks: DB, Redis, Meta API, Evolution API
- [ ] Timeout de 5s para cada check

**Resposta:**
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "meta_api": "degraded",
    "evolution_api": "healthy"
  },
  "timestamp": "2026-03-18T10:30:00Z"
}
```

---

## 🔄 DEPENDÊNCIAS ENTRE STORIES

```
S6-1-1 (BullMQ)
  └─> S6-1-2 (Migrate Cron)

S6-1-1 (BullMQ)
  └─> S6-2-2 (DLQ)

S6-3-1 (Logging)
  └─> S6-3-5 (Tracing)

S6-3-2 (Metrics)
  └─> S6-3-3 (Dashboards)
  └─> S6-3-4 (Alerts)
```

---

## 📅 CRONOGRAMA SUGERIDO

| Semana | Stories | Foco |
|--------|---------|------|
| **Semana 1** | S6-1-1, S6-1-2, S6-2-1 | Job Queue e Retries |
| **Semana 2** | S6-2-2, S6-2-3, S6-3-1, S6-3-2, S6-4-2 | Resiliência e Observabilidade |
| **Opcional** | S6-3-3, S6-3-4, S6-3-5, S6-4-1 | Dashboards e CI/CD |

---

## 🎯 DEFINITION OF DONE

Uma Story está completa quando:

- [ ] Código implementado seguindo padrões do projeto
- [ ] Typecheck passa: `npm run typecheck`
- [ ] Lint passa: `npm run lint`
- [ ] Build passa: `npm run build`
- [ ] Testes unitários escritos (se aplicável)
- [ ] Documentação atualizada (README, docs/)
- [ ] Código review feito e aprovado
- [ ] Deploy em staging testado
- [ ] Logs e métricas verificadas

---

## 🚨 RISCOS E MITIGAÇÕES

### Risco 1: BullMQ Incompatível com Vercel Serverless
- **Probabilidade:** Alta
- **Impacto:** Alto
- **Mitigação:** Usar Cloudflare Workers Queues ou Upstash QStash

### Risco 2: Custo de Redis/Solução de Queue
- **Probabilidade:** Média
- **Impacto:** Médio
- **Mitigação:** Começar com tier gratuito de Upstash

### Risco 3: Sobrecarga de Logs/Métricas
- **Probabilidade:** Média
- **Impacto:** Médio
- **Mitigação:** Sampling de logs, retenção configurável

---

## 📊 MÉTRICAS DE SUCESSO

### Antes da Sprint 6
- **Retry Logic:** ❌ Não existe
- **Job Queue:** ❌ Vercel Cron (limitado)
- **Observabilidade:** ⚠️ Parcial (console.log)
- **MTTR:** ❌ Não medido
- **Uptime:** ⚠️ Não monitorado

### Após Sprint 6 (Meta)
- **Retry Logic:** ✅ Exponential backoff + DLQ
- **Job Queue:** ✅ BullMQ/Cloudflare Queues
- **Observabilidade:** ✅ Logs + Métricas + Dashboards
- **MTTR:** 🎯 < 15 minutos
- **Uptime:** 🎯 > 99.5%

---

## 📝 NOTAS TÉCNICAS

### Stack Sugerida

| Categoria | Tecnologia | Por que? |
|-----------|------------|----------|
| **Job Queue** | Cloudflare Workers Queues | Nativo serverless, sem Redis |
| **Retry Logic** | `retry-axios` | Leve, bem testado |
| **Circuit Breaker** | `opossum` ou custom | Configurável |
| **Logging** | `pino` | Rápido, estruturado |
| **Metrics** | Vercel Analytics ou Prometheus | Nativo ou padrão |
| **Tracing** | OpenTelemetry (opcional) | Padrão da indústria |
| **CI/CD** | GitHub Actions | Integrado com GitHub |

### Alternativas ao BullMQ no Vercel

1. **Cloudflare Workers Queues**
   - Pros: Serverless, barato
   - Cons: Precisa de Cloudflare Workers

2. **Upstash QStash**
   - Pros: Serverless, compatível com HTTP
   - Cons: Tier gratuito limitado

3. **Inngest**
   - Pros: Developer-friendly, dashboard
   - Cons: SaaS, custo

---

## 🔗 REFERÊNCIAS

- **Vercel Cron Limits:** https://vercel.com/docs/cron-jobs
- **Cloudflare Queues:** https://developers.cloudflare.com/queues/
- **Upstash QStash:** https://upstash.com/docs/qstash
- **BullMQ:** https://docs.bullmq.io/
- **OpenTelemetry:** https://opentelemetry.io/

---

**Próxima Sprint:** Sprint 7 - Análise de Criativos e IA

---

*Histórico de Alterações:*
- 2026-03-18: Criação do planejamento da Sprint 6
