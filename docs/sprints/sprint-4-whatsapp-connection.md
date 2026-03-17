# SPRINT 4 — WHATSAPP CONNECTION (Conectar WhatsApp do Cliente)

**Duração estimada:** 2 semanas
**Prioridade:** 🟠 ALTO
**Dependências:** Sprint 1 concluído (tabela clients existe)
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Conectar o WhatsApp de cada cliente para dois fins principais:
1. **Mensuração de tráfego:** clientes que usam WhatsApp como destino de campanhas podem ter as conversas e leads rastreados
2. **Canal de entrega:** instância conectada será usada para enviar relatórios automáticos (Sprint 6)

Usaremos Evolution API (open-source, self-hosted) para o MVP, com preparação para integração com Meta WhatsApp Business API oficial.

---

## Contexto atual

| Item | Status |
|------|--------|
| `packages/whatsapp` | ✅ Client library básico existe |
| `whatsapp_instances` tabela | ✅ Existe no schema |
| `client_id` em whatsapp_instances | ❌ Não existe ainda |
| UI de conexão WhatsApp | ❌ Não existe |
| QR Code flow | ❌ Não existe |
| Webhook de status | ❌ Não existe |

---

## Etapas de execução

### S4.1 — Migration: atualizar `whatsapp_instances`
- Adicionar `client_id UUID FK → clients`
- Adicionar `qr_code TEXT` (base64)
- Adicionar `last_connected_at TIMESTAMPTZ`
- Atualizar RLS para incluir client_id na query

### S4.2 — Atualizar `packages/whatsapp/client.ts`
- `createInstance(name)` → POST /instance/create
- `getQRCode(instanceName)` → GET /instance/connect/{name} → retorna qrcode base64
- `getInstanceStatus(instanceName)` → GET /instance/connectionState/{name}
- `deleteInstance(instanceName)` → DELETE /instance/delete/{name}
- `sendTestMessage(instanceName, phone, message)` → POST /message/sendText/{name}

### S4.3 — API Routes de instâncias WhatsApp
- `POST /api/whatsapp/instances` → criar instância + iniciar conexão
- `GET /api/whatsapp/instances` → listar instâncias da org
- `GET /api/whatsapp/instances/[id]/status` → status + QR code atualizado
- `DELETE /api/whatsapp/instances/[id]` → desconectar e deletar
- `POST /api/whatsapp/instances/[id]/test` → enviar mensagem de teste

### S4.4 — Webhook receiver: `POST /api/webhooks/whatsapp`
- Receber eventos Evolution API: `connection.update`, `qrcode.updated`
- Atualizar `whatsapp_instances.status` e `qr_code`
- Atualizar `last_connected_at` quando status = connected

### S4.5 — UI: painel de conexão WhatsApp na página do cliente
- Seção "WhatsApp" em `/clients/[id]` ou aba dedicada
- Componente `WhatsAppConnectionPanel` com estados visuais:
  - Não conectado → botão "Conectar"
  - Conectando → QR code + instrução + timer
  - Conectado → badge verde + número + botões
  - Erro → badge vermelho + botão reconectar

### S4.6 — Polling de status
- Enquanto aguardando QR scan: polling a cada 3 segundos em `/api/whatsapp/instances/[id]/status`
- Parar polling quando status = connected ou timeout (120s)
- Atualizar QR code automaticamente (expira em 60s)

### S4.7 — Badge no card do cliente
- Card do cliente em `/clients` mostra badge de status WhatsApp
- Verde: "WhatsApp conectado"
- Cinza: "WhatsApp não conectado"

---

## Critérios de aceite

- [ ] Gestor consegue criar instância WhatsApp para um cliente
- [ ] QR Code é exibido e o cliente consegue escanear
- [ ] Após scan, status muda para "conectado" automaticamente
- [ ] Webhook recebe e processa eventos de status
- [ ] Card do cliente mostra badge de status WhatsApp
- [ ] Botão "Enviar mensagem de teste" funciona quando conectado

---

## Variáveis de ambiente necessárias

```
EVOLUTION_API_URL=https://sua-instancia.evolution.com
EVOLUTION_API_KEY=sua-chave-de-api
```

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL nova | CRIAR |
| `packages/whatsapp/src/client.ts` | MODIFICAR |
| `apps/dashboard/src/app/api/whatsapp/instances/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/whatsapp/instances/[id]/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/whatsapp/instances/[id]/status/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/whatsapp/instances/[id]/test/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/webhooks/whatsapp/route.ts` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx` | MODIFICAR |
| `apps/dashboard/src/components/whatsapp/WhatsAppConnectionPanel.tsx` | CRIAR |
| `apps/dashboard/src/components/clients/ClientCard.tsx` | CRIAR/MODIFICAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK: Next.js 16, React 19, TypeScript, Supabase PostgreSQL, Tailwind CSS v4.

BANCO RELEVANTE (tabela de instâncias WhatsApp):
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  instance_name TEXT NOT NULL UNIQUE,
  api_url TEXT,
  api_key TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'pending', -- pending|connecting|connected|disconnected|error
  qr_code TEXT, -- base64 do QR code atual
  webhook_url TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

EVOLUTION API (WhatsApp self-hosted):
Base URL: process.env.EVOLUTION_API_URL
Headers: { 'apikey': process.env.EVOLUTION_API_KEY }

Endpoints principais:
- POST /instance/create → { instanceName: string }
- GET /instance/connect/{instanceName} → { base64: "data:image/png;base64,..." } (QR code)
- GET /instance/connectionState/{instanceName} → { instance: { state: "open"|"close"|"connecting" } }
- DELETE /instance/delete/{instanceName} → { deleted: true }
- POST /message/sendText/{instanceName} → { number, textMessage: { text } }

WEBHOOK EVENTS (Evolution API envia para /api/webhooks/whatsapp):
{ event: "connection.update", instance: "nome", data: { state: "open"|"close" } }
{ event: "qrcode.updated", instance: "nome", data: { qrcode: { base64: "..." } } }

TAREFA: Implementar o módulo completo de conexão WhatsApp por cliente.

VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
WHATSAPP_WEBHOOK_SECRET= (para validar webhooks)
```

---

## PROMPT FRONTEND — WhatsAppConnectionPanel + Client page

```
Você é um engenheiro frontend sênior. Crie o componente de conexão WhatsApp para a página do cliente.

=== ARQUIVO: apps/dashboard/src/components/whatsapp/WhatsAppConnectionPanel.tsx ===

"use client"

Props:
interface WhatsAppConnectionPanelProps {
  clientId: string
  clientName: string
}

ESTADOS INTERNOS:
type ConnectionStatus = 'idle' | 'creating' | 'qr_pending' | 'connected' | 'disconnected' | 'error'

STATE MACHINE:
idle → (clique "Conectar") → creating → qr_pending → (scan QR) → connected
qr_pending → (timeout 120s) → error
connected → (clique "Desconectar") → disconnected
error → (clique "Tentar novamente") → creating

=== ESTADO 1: IDLE (não conectado) ===
Card com:
- Ícone MessageCircle grande em text-slate-600 (60px)
- Título: "Conectar WhatsApp"
- Subtítulo: "Conecte o WhatsApp do cliente para receber relatórios automáticos"
- Botão: "Conectar agora" — bg-emerald-400 text-slate-950 font-bold rounded-xl
  ícone: QrCode | onClick: handleConnect()

=== ESTADO 2: QR_PENDING ===
Card com:
- Título: "Escaneie o QR Code"
- Instrução: "No celular do cliente: WhatsApp → Configurações → Dispositivos vinculados → Adicionar dispositivo"
- QR Code: <img src={qrCode} className="w-48 h-48 rounded-xl border border-slate-700" />
  Se qrCode null: skeleton animado 192x192
- Timer: "QR expira em {countdown}s" — texto âmbar se < 30s
- Loading indicator: "Aguardando conexão..." com dots animados
- Botão cancelar: texto ghost

Polling:
useEffect com setInterval(3000) enquanto status === 'qr_pending'
GET /api/whatsapp/instances/{instanceId}/status
Se state === 'open': setStatus('connected'), clearInterval
Se timeout 120s: setStatus('error')

=== ESTADO 3: CONNECTED ===
Card com:
- Badge verde: "WhatsApp Conectado" (CheckCircle icon + bg-emerald-500/10 border-emerald-500/20)
- Número: phone_number (se disponível) ou "Conectado"
- Última conexão: "Conectado desde {data}"
- Botão "Enviar mensagem de teste": ícone Send, texto ghost emerald
  onClick: POST /api/whatsapp/instances/{id}/test → toast de resultado
- Botão "Desconectar": ícone WifiOff, vermelho, com confirmação modal

=== ESTADO 4: ERROR ===
Card com:
- Badge vermelho: "Erro na conexão"
- Mensagem de erro
- Botão "Tentar novamente": reinicia o flow

=== ANIMAÇÕES (Framer Motion) ===
AnimatePresence mode="wait" entre estados.
Cada estado: initial={{ opacity: 0, y: 10 }}, animate={{ opacity: 1, y: 0 }}, exit={{ opacity: 0, y: -10 }}

=== HANDLERS ===
handleConnect():
  1. POST /api/whatsapp/instances { client_id }
  2. Receber instanceId + primeiro QR code
  3. setStatus('qr_pending'), iniciar polling

handleDisconnect():
  1. Confirmar no modal
  2. DELETE /api/whatsapp/instances/{id}
  3. setStatus('idle')

TYPESCRIPT: strict, sem any. Icones: lucide-react.
IDIOMA: português brasileiro.
DESIGN: dark theme, slate-950 bg, emerald accent para WhatsApp (não cyan).
```

---

## PROMPT BACKEND — Evolution API + Routes + Webhook

```
Você é um engenheiro backend sênior. Implemente o backend do módulo WhatsApp.

=== PARTE 1: packages/whatsapp/src/client.ts (ATUALIZAR) ===

export class EvolutionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new EvolutionApiError(error.message, res.status)
    }
    return res.json()
  }

  async createInstance(instanceName: string): Promise<{ instance: { instanceName: string } }>
  async getQRCode(instanceName: string): Promise<{ base64: string }>
  async getConnectionState(instanceName: string): Promise<{ instance: { state: 'open'|'close'|'connecting' } }>
  async deleteInstance(instanceName: string): Promise<{ deleted: boolean }>
  async sendText(instanceName: string, phone: string, text: string): Promise<unknown>
}

export function createEvolutionClient(): EvolutionClient {
  const url = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!url || !key) throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY are required')
  return new EvolutionClient(url, key)
}

=== PARTE 2: API ROUTES ===

--- apps/dashboard/src/app/api/whatsapp/instances/route.ts ---

POST /api/whatsapp/instances
Body: { client_id: string }

1. Verificar auth + org_id
2. Verificar que client_id pertence à org
3. Gerar instanceName: `org-{orgId.slice(0,8)}-client-{clientId.slice(0,8)}-{Date.now()}`
4. Criar instância na Evolution API: evolutionClient.createInstance(instanceName)
5. Buscar QR code inicial: evolutionClient.getQRCode(instanceName)
6. Inserir em whatsapp_instances: { org_id, client_id, instance_name, api_url, status: 'connecting', qr_code }
7. Retornar: { data: { id, instance_name, qr_code, status } }

GET /api/whatsapp/instances
Listar instâncias da org (com client name via join)
WHERE status != 'deleted'

--- apps/dashboard/src/app/api/whatsapp/instances/[id]/status/route.ts ---

GET /api/whatsapp/instances/[id]/status

1. Buscar instância (verificar org_id)
2. Chamar evolutionClient.getConnectionState(instance_name)
3. Se state mudou: atualizar no banco
4. Se state = 'close' && qr_code expirado: buscar novo QR
5. Retornar: { data: { status, qr_code, phone_number } }

--- apps/dashboard/src/app/api/whatsapp/instances/[id]/route.ts ---

DELETE /api/whatsapp/instances/[id]
1. Buscar instância (verificar org_id)
2. Chamar evolutionClient.deleteInstance(instance_name)
3. Deletar registro do banco (ou UPDATE status = 'deleted')
4. Retornar: { data: { deleted: true } }

--- apps/dashboard/src/app/api/whatsapp/instances/[id]/test/route.ts ---

POST /api/whatsapp/instances/[id]/test
1. Buscar instância + verificar status = 'connected'
2. Body: { phone: string } (número para testar) — opcional, usar phone_number da instância
3. Enviar mensagem: evolutionClient.sendText(instance_name, phone, "✅ Teste de conexão — Start Metric")
4. Retornar: { data: { sent: true } }

--- apps/dashboard/src/app/api/webhooks/whatsapp/route.ts ---

POST /api/webhooks/whatsapp

Validar secret (header X-Evolution-Signature ou query param)
Body events:

case 'connection.update':
  state = event.data.state
  newStatus = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting'
  UPDATE whatsapp_instances SET status = newStatus, last_connected_at = (se open: now()) WHERE instance_name = event.instance

case 'qrcode.updated':
  UPDATE whatsapp_instances SET qr_code = event.data.qrcode.base64, status = 'connecting' WHERE instance_name = event.instance

MIGRATION SQL:
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ;

RLS: acesso por org_id.
INDEX: idx_whatsapp_instances_client_id ON whatsapp_instances(client_id).

TypeScript strict. Sem any. Tratamento completo de erros.
```
