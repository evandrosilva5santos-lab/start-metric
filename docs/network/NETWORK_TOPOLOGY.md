# Topologia de Rede & Integrações — Start Metric

**Data de Atualização:** 2026-03-20  
**Status:** Operacional (Meta v21.0 Conectada / Webhooks Configurados)

---

## 🗺️ Visão Geral da Arquitetura de Rede

```
[Cliente Final] ────── HTTPS ──────► [ Vercel Edge / Next.js 16 (apps/dashboard) ]
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      [ Meta Graph API ]           [ Evolution API ]           [ Supabase Cloud ]
      (v21.0 - Facebook)         (WhatsApp Automation)      (PostgreSQL + Auth + RLS)
   https://graph.facebook.com     https://<instance-url>     https://<project>.supabase.co
```

---

## 1. 🌐 Meta Ads Graph API (v21.0)

### Endpoints Principais
* **Base URL:** `https://graph.facebook.com/v21.0`
* **Autenticação:** Bearer Token / Query Param `access_token`
* **Tipos de Token em Uso:**
  * **System User Token (Permanente):** Token que não expira, vinculado ao Usuário do Sistema (`Conversions API System User`). Utilizado para jobs de sincronização contínua e leitura de contas no servidor.
  * **User OAuth Token (Rotativo):** Gerado via fluxo OAuth padrão (`/api/meta/oauth` ➔ `/api/meta/callback`).
  * **Page Token:** Token com permissão administrativa sobre páginas Facebook associadas.

### Segurança & Mitigação de Rate Limit (Erro 17)
* **Armazenamento:** Tokens salvos no banco são criptografados via `pgp_sym_encrypt` no PostgreSQL com a chave `SUPABASE_ENCRYPTION_KEY`.
* **Rate Limiting:** A Graph API impõe limites por aplicativo e por conta de anúncio. O backend implementa:
  * Cache curto (60 a 90 segundos) em consultas repetidas de insights.
  * Exponential Backoff automático com até 3 tentativas em erros 500/503.

---

## 2. 📱 WhatsApp & Evolution API (Webhooks)

### Fluxo de Comunicação Bidirecional
1. **Outbound (Disparo de Mensagens/Relatórios):**
   * O dashboard envia requisições autenticadas via header `apikey: EVOLUTION_API_KEY` para o endpoint da instância Evolution.
2. **Inbound (Eventos de Webhook):**
   * **Endpoint:** `POST /api/webhooks/whatsapp`
   * **Eventos Suportados:**
     * `connection.update`: Atualiza status da instância (`connected`, `disconnected`, `connecting`).
     * `qrcode.updated`: Recebe e atualiza o QR Code Base64 para escaneamento na tela de Settings.
   * **Proteção de Acesso:**
     * Validação obrigatória do segredo compartilhado via header `x-webhook-secret`, `x-evolution-signature` ou query param `?secret=WHATSAPP_WEBHOOK_SECRET`.

---

## 3. 🗄️ Supabase Cloud (Banco de Dados & Autenticação)

### Conectividade
* **API REST / PostgREST & Auth:** HTTPS porta 443
* **Conexão Direta PostgreSQL:** Porta 5432 (ou 6543 via Transaction Pooler)

### ⚠️ Resolução de Problemas: Erro `ENOTFOUND` (DNS)
Caso uma chamada ao Supabase retorne:
```text
Error: getaddrinfo ENOTFOUND <project-ref>.supabase.co
```
**Causa:** No plano gratuito do Supabase, projetos sem tráfego por mais de 7 dias são pausados automaticamente e o registro DNS do subdomínio é desativado.

**Procedimento de Recuperação:**
1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard).
2. Localize o projeto e clique em **"Restore Project"** (ou "Unpause").
3. Aguarde cerca de 2 a 3 minutos para a reativação do banco e propagação do DNS.
4. Se o projeto foi recriado ou teve o ID alterado, atualize as variáveis no `.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<novo-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<nova-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<novo-service-role-key>
   ```

---

## 4. 🚀 Hospedagem & Vercel (Produção)

### Configuração de Deploy do Monorepo
* **Root Directory na Vercel:** `apps/dashboard`
* **Variáveis de Ambiente Obrigatórias:**
  * `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN`, `META_REDIRECT_URI`
  * `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ENCRYPTION_KEY`
  * `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SECRET`
