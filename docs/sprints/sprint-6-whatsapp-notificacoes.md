# SPRINT 6 — WHATSAPP NOTIFICAÇÕES (Disparo Agendado de Relatórios)

**Duração estimada:** 1 semana
**Prioridade:** 🟡 MÉDIO
**Dependências:** Sprint 4 (WhatsApp conectado) + Sprint 5 (Templates funcionando)
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Sistema de envio automático de relatórios via WhatsApp. O gestor agenda um relatório (template + cliente + frequência + horário) e a plataforma dispara automaticamente no horário programado, usando a instância WhatsApp conectada do cliente.

---

## Contexto atual

| Item | Status |
|------|--------|
| Tabela `scheduled_reports` | ✅ Existe no schema |
| Tabela `report_executions` | ✅ Existe no schema |
| `client_id` em `scheduled_reports` | ❌ Não existe |
| `whatsapp_instance_id` em `scheduled_reports` | ❌ Não existe |
| Cron de disparo | ❌ Não existe |
| UI de agendamento | ❌ Não existe |
| Fila BullMQ de envio | ❌ Não existe |

---

## Etapas de execução

### S6.1 — Migration: atualizar `scheduled_reports`
- Adicionar `client_id UUID FK → clients`
- Adicionar `whatsapp_instance_id UUID FK → whatsapp_instances`
- Adicionar `send_hour INT DEFAULT 8 CHECK (8 BETWEEN 0 AND 23)`
- Adicionar `send_day_of_week INT CHECK (0 BETWEEN 0 AND 6)`
- Adicionar `send_day_of_month INT CHECK (1 BETWEEN 1 AND 28)`
- Adicionar índices necessários

### S6.2 — Função `calculateNextRunAt()`
- Calcula a próxima data de execução baseado em `frequency` + `send_hour` + `send_day_of_week` + `send_day_of_month`
- Usa fuso horário da org (field `timezone` de profiles)
- Retorna string ISO timestamp

### S6.3 — API Routes de agendamento
- `GET /api/reports/schedules` → listar agendamentos
- `POST /api/reports/schedules` → criar
- `PATCH /api/reports/schedules/[id]` → editar/toggle active
- `DELETE /api/reports/schedules/[id]` → deletar
- `POST /api/reports/schedules/[id]/send-now` → disparo manual imediato

### S6.4 — Cron route: `/api/cron/notifications-dispatch`
- Autenticado via `CRON_SECRET` no header
- Roda a cada hora (Vercel cron: `0 * * * *`)
- Busca `scheduled_reports WHERE active=true AND next_run_at <= now()`
- Para cada: renderizar template → enviar WhatsApp → inserir `report_executions` → atualizar `next_run_at` + `last_run_at`

### S6.5 — UI: página `/reports/schedules`
- Lista de agendamentos ativos em tabela
- Toggle ativo/inativo
- Botão "Novo agendamento"
- Botão "Enviar agora" (disparo manual)

### S6.6 — UI: modal de criar agendamento
- Select de template
- Select de cliente
- Select de frequência: Diário / Semanal / Mensal
- Se semanal: day-of-week picker (seg, ter, qua, qui, sex, sáb, dom)
- Se mensal: day-of-month picker (1–28)
- TimePicker: horário de envio (HH:MM)
- Preview: "Próximo envio: Quinta-feira, 14 de março às 09:00"

### S6.7 — Histórico de envios
- Na página do cliente (`/clients/[id]`)
- Lista dos últimos 10 envios: data, template, status (entregue/erro), preview da mensagem
- Badge de status: verde (enviado), vermelho (erro)

### S6.8 — Vercel cron configuration
- Adicionar em `vercel.json`: `{ "crons": [{ "path": "/api/cron/notifications-dispatch", "schedule": "0 * * * *" }] }`

---

## Frequências suportadas

| Frequência | Configuração | Exemplo |
|------------|--------------|---------|
| Diário | send_hour = 9 | Todo dia às 09:00 |
| Semanal | send_day_of_week = 1, send_hour = 9 | Toda terça às 09:00 |
| Mensal | send_day_of_month = 15, send_hour = 9 | Todo dia 15 às 09:00 |

---

## Critérios de aceite

- [ ] Gestor consegue criar agendamento (template + cliente + frequência)
- [ ] Preview exibe data/hora do próximo envio corretamente
- [ ] Cron dispara relatórios no horário programado
- [ ] Histórico de envios aparece na página do cliente
- [ ] Botão "Enviar agora" funciona (disparo manual)
- [ ] Toggle de ativo/inativo funciona

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL nova | CRIAR |
| `packages/reports/src/scheduler.ts` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/reports/schedules/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/reports/schedules/SchedulesListPageClient.tsx` | CRIAR |
| `apps/dashboard/src/app/api/reports/schedules/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/reports/schedules/[id]/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/reports/schedules/[id]/send-now/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/cron/notifications-dispatch/route.ts` | CRIAR |
| `apps/dashboard/src/components/reports/ScheduleModal.tsx` | CRIAR |
| `apps/dashboard/src/components/clients/ClientReportHistory.tsx` | CRIAR |
| `vercel.json` | MODIFICAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK: Next.js 16, React 19, TypeScript, Supabase PostgreSQL, Tailwind CSS v4.

BANCO RELEVANTE:
- scheduled_reports: id, org_id, template_id, name, frequency (daily|weekly|monthly), send_hour, send_day_of_week, send_day_of_month, whatsapp_instance_id, active BOOLEAN, next_run_at, last_run_at, created_at, updated_at
- report_templates: id, org_id, name, message_template, metrics[]
- whatsapp_instances: id, org_id, client_id, instance_name, status, phone_number
- clients: id, org_id, name
- report_executions: id, scheduled_report_id, org_id, status (pending|sent|failed), generated_at, sent_at, error_message, file_url, created_at

FUNÇÃO PARA CALCULAR PRÓXIMA EXECUÇÃO:
calculateNextRunAt(frequency, sendHour, sendDayOfWeek, sendDayOfMonth, timezone) → Date

daily: próximo dia às sendHour:00
weekly: próxima ocorrência de sendDayOfWeek (0=Domingo) às sendHour:00
monthly: próxima ocorrência de sendDayOfMonth (1-28) às sendHour:00

Usar fuso horário da org (field timezone de profiles). Defaults: America/Sao_Paulo.

CRON EXECUTION:
POST /api/cron/notifications-dispatch
Header: x-cron-secret: CRON_SECRET
Executa a cada hora (Vercel cron: 0 * * * *)

Processo:
1. SELECT * FROM scheduled_reports WHERE active=true AND next_run_at <= now() AND org_id = get_user_org_id()
2. Para cada scheduled_report:
   a. Buscar template (template_id)
   b. Buscar cliente (via whatsapp_instance.client_id)
   c. buildVariables(orgId, clientId, last_run_at → now())
   d. renderTemplate(message_template, variables)
   e. Enviar via Evolution API (sendText)
   f. Inserir report_executions
   g. Atualizar scheduled_reports: last_run_at = now(), next_run_at = calculateNextRunAt(...)

TAREFA DESTE SPRINT:
Implementar o sistema completo de agendamento e disparo automático de relatórios via WhatsApp.
```

---

## PROMPT FRONTEND — UI de Agendamento

```
Você é um engenheiro frontend sênior. Crie a UI de agendamento de notificações WhatsApp.

=== ARQUIVO: apps/dashboard/src/components/reports/ScheduleModal.tsx ===

"use client"

Props: isOpen, onClose, onSaved

=== ESTADO DO FORMULÁRIO ===
interface ScheduleFormData {
  template_id: string
  client_id: string
  frequency: 'daily' | 'weekly' | 'monthly'
  send_hour: number // 0-23
  send_day_of_week?: number // 0-6 (se weekly)
  send_day_of_month?: number // 1-28 (se monthly)
}

=== LAYOUT DO MODAL ===
Container: max-w-lg mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-6

SEÇÃO 1: ESCOLHER TEMPLATE
Label: "Relatório (template)"
Select: buscar GET /api/reports/templates, listar opções
Exibição: nome + descrição curta

SEÇÃO 2: ESCOLHER CLIENTE
Label: "Cliente"
Select: buscar GET /api/clients, listar opções
Exibição: nome do cliente

SEÇÃO 3: FREQUÊNCIA
Label: "Frequência de envio"
Radio buttons: "Diário" | "Semanal" | "Mensal"
Ao selecionar: mostrar campos adicionais condicionais

SE FREQUÊNCIA = "DIÁRIO":
Label: "Horário de envio"
TimePicker: custom com select de horas (00–23) e minutos (00, 15, 30, 45)
Exemplo: "09:00"

SE FREQUÊNCIA = "SEMANAL":
Label: "Dia da semana"
Chips clicáveis (7 opções): "Segunda" "Terça" "Quarta" "Quinta" "Sexta" "Sábado" "Domingo"
Label: "Horário de envio"
Mesmo TimePicker acima

SE FREQUÊNCIA = "MENSAL":
Label: "Dia do mês"
Select: opções 1–28 (não 29–31 para evitar problemas com meses curtos)
Label: "Horário de envio"
Mesmo TimePicker acima

SEÇÃO 4: PREVIEW DO PRÓXIMO ENVIO
Box destacado: bg-slate-800/50 border border-slate-700 rounded-xl p-4
Título: "Próximo envio"
Conteúdo dinâmico baseado na seleção:
- Diário 09:00: "Todos os dias às 09:00"
- Semanal terça 09:00: "Todas as terças-feiras às 09:00"
- Mensal dia 15 09:00: "Todo dia 15 do mês às 09:00"

Adicionar: "Próximo: [data específica]" ex: "Quarta-feira, 14 de março de 2026 às 09:00"

Botões rodapé: "Cancelar" (ghost) | "Agendar" (bg-cyan-400 text-slate-950 font-bold)

=== VALIDAÇÃO ===
Zod schema:
{
  template_id: z.string().uuid()
  client_id: z.string().uuid()
  frequency: z.enum(['daily', 'weekly', 'monthly'])
  send_hour: z.number().min(0).max(23)
  send_day_of_week: z.number().min(0).max(6).optional()
  send_day_of_month: z.number().min(1).max(28).optional()
}
.refine(data => {
  if (data.frequency === 'weekly' && data.send_day_of_week === undefined) return false
  if (data.frequency === 'monthly' && data.send_day_of_month === undefined) return false
  return true
})

=== TIME PICKER COMPONENT ===
Componente customizado (não nativo):
Duas selects lado a lado:
- Horas: 00–23 (padrão 09)
- Minutos: 00, 15, 30, 45 (padrão 00)
Separador: ":"
Exibir visualmente: "09:00"

=== ARQUIVO: apps/dashboard/src/app/(dashboard)/reports/schedules/SchedulesListPageClient.tsx ===

TABELA DE AGENDAMENTOS:
Colunas: Template, Cliente, Frequência, Próximo envio, Status, Ações

Template: nome do template
Cliente: nome do cliente
Frequência: ex: "Semanal às Terças 09:00"
Próximo envio: ex: "14/03/2026 às 09:00" (formatRelativeTime)
Status: Badge toggle (verde=ativo, cinza=inativo)
Ações: "Editar" | "Enviar agora" | "Arquivar"

BOTÃO "ENVIAR AGORA":
POST /api/reports/schedules/[id]/send-now
Toast: "Relatório enviado com sucesso" ou "Erro ao enviar"

HISTÓRICO NA PÁGINA DO CLIENTE (/clients/[id]):
Seção "Relatórios enviados" com lista dos últimos 10 report_executions
Exibir: data, template, status (sent/failed), mensagem de erro se falhou

TYPESCRIPT: strict, sem any. Framer Motion no modal entrance.
IDIOMA: português brasileiro.
DESIGN: dark theme, cyan accent.
```

---

## PROMPT BACKEND — Cron + Scheduler + API

```
Você é um engenheiro backend sênior. Implemente o backend de agendamento e disparo de relatórios.

=== PARTE 1: MIGRATION SQL ===

ALTER TABLE public.scheduled_reports
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS send_hour INT DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS send_day_of_week INT CHECK (send_day_of_week BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS send_day_of_month INT CHECK (send_day_of_month BETWEEN 1 AND 28);

-- Índices
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run_at ON public.scheduled_reports(next_run_at)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org_id ON public.scheduled_reports(org_id);

-- RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_own_org" ON public.scheduled_reports
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "schedules_all_own_org" ON public.scheduled_reports
  FOR ALL USING (org_id = public.get_user_org_id());


=== PARTE 2: packages/reports/src/scheduler.ts ===

export function calculateNextRunAt(
  frequency: 'daily' | 'weekly' | 'monthly',
  sendHour: number,
  sendDayOfWeek?: number, // 0=Domingo
  sendDayOfMonth?: number, // 1-28
  timezone = 'America/Sao_Paulo'
): Date {
  const now = new Date()
  const targetDate = new Date()

  // Ajustar para o timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const tzDate = new Date(
    `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value} ${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`
  )

  targetDate.setTime(tzDate.getTime())
  targetDate.setHours(sendHour, 0, 0, 0)

  switch (frequency) {
    case 'daily':
      if (targetDate <= tzDate) {
        targetDate.setDate(targetDate.getDate() + 1)
      }
      break

    case 'weekly':
      if (sendDayOfWeek === undefined) throw new Error('sendDayOfWeek required for weekly')
      const currentDay = targetDate.getDay()
      const daysUntil = (sendDayOfWeek - currentDay + 7) % 7
      if (daysUntil === 0 && targetDate <= tzDate) {
        targetDate.setDate(targetDate.getDate() + 7)
      } else {
        targetDate.setDate(targetDate.getDate() + daysUntil)
      }
      break

    case 'monthly':
      if (sendDayOfMonth === undefined) throw new Error('sendDayOfMonth required for monthly')
      targetDate.setDate(sendDayOfMonth)
      if (targetDate <= tzDate) {
        targetDate.setMonth(targetDate.getMonth() + 1)
        targetDate.setDate(Math.min(sendDayOfMonth, new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()))
      }
      break
  }

  // Converter de volta para UTC para salvar no banco
  return targetDate
}


=== PARTE 3: API ROUTES ===

--- /api/reports/schedules/route.ts ---

GET: listar scheduled_reports da org
  - JOIN com templates e clients para exibir nomes
  - ORDER BY next_run_at ASC

POST: criar scheduled_report
  Body Zod: { template_id, client_id, frequency, send_hour, send_day_of_week?, send_day_of_month?, active = true }
  1. Buscar whatsapp_instance_id do cliente (status='connected')
  2. Calcular next_run_at com calculateNextRunAt()
  3. INSERT
  4. Retornar com template e client incluídos

--- /api/reports/schedules/[id]/route.ts ---

PATCH: editar + toggle active
  - Se toggling active: recalcular next_run_at se ativando

DELETE: deletar (soft: active=false ou hard delete)

--- /api/reports/schedules/[id]/send-now/route.ts ---

POST /api/reports/schedules/[id]/send-now
  1. Buscar scheduled_report (verificar org_id)
  2. Buscar template, client, whatsapp_instance
  3. buildVariables(orgId, client_id, last_run_at → now())
  4. renderTemplate()
  5. Enviar via Evolution API: sendText(instance_name, phone_number, rendered)
  6. Inserir report_executions (status='sent' ou 'failed')
  7. Retornar: { data: { sent, execution_id } }

--- /api/cron/notifications-dispatch/route.ts ---

POST /api/cron/notifications-dispatch

Validar: header 'x-cron-secret' === process.env.CRON_SECRET

Processo:
1. Buscar schedules para executar:
   const { data: schedules } = await supabase
     .from('scheduled_reports')
     .select(`
       id, template_id, client_id, whatsapp_instance_id,
       template:report_templates!inner(message_template),
       client:clients!inner(name),
       instance:whatsapp_instances!inner(instance_name, phone_number, status)
     `)
     .eq('active', true)
     .lte('next_run_at', new Date().toISOString())

2. Para cada schedule em paralelo (Promise.all):
   try {
     // Renderizar
     const variables = await buildVariables(...)
     const { rendered } = renderTemplate(template.message_template, variables)

     // Enviar WhatsApp
     await evolutionClient.sendText(instance.instance_name, instance.phone_number, rendered)

     // Registrar execução
     await supabase.from('report_executions').insert({
       scheduled_report_id: schedule.id,
       org_id: orgId,
       status: 'sent',
       generated_at: new Date().toISOString(),
       sent_at: new Date().toISOString(),
     })

     // Atualizar schedule
     const nextRunAt = calculateNextRunAt(...)
     await supabase.from('scheduled_reports')
       .update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt.toISOString() })
       .eq('id', schedule.id)
   } catch (err) {
     // Registrar falha
     await supabase.from('report_executions').insert({
       scheduled_report_id: schedule.id,
       org_id: orgId,
       status: 'failed',
       error_message: err.message,
       generated_at: new Date().toISOString(),
     })
   }

3. Retornar: { data: { executed: schedules.length } }


=== PARTE 4: vercel.json (ATUALIZAR) ===

{
  "crons": [
    {
      "path": "/api/cron/meta-sync",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/notifications-dispatch",
      "schedule": "0 * * * *"
    }
  ]
}

TypeScript strict. Sem any. Tratamento completo de erros e retries.
```
