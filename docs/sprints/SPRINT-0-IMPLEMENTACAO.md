# Sprint 0 — Instruções de Finalização

## Status Atual

✅ **Codificação 100% completa**
- Migration SQL criada
- API Route `/api/profile` implementada
- Página `/settings/profile` criada
- Header atualizado com dropdown do usuário
- Meta Ads callback fix aplicado

## Passos Restantes (Manual)

### 1. Aplicar Migration no Banco de Dados

**Opção A: Via Supabase Dashboard (Recomendado)**

1. Acesse: https://supabase.com/dashboard/project/etjqbqorawnnvdlmztka
2. Vá em: Database → SQL Editor
3. Crie um "New Query"
4. Copie e cole o SQL abaixo:

```sql
-- Sprint 0 - S0.2: Estender tabela profiles com campos de usuário completo
-- Adicionar: phone (se não existir), cpf, country, language, timezone, avatar_url, updated_at

-- Adicionar coluna phone (se não existir) - já referenciada no trigger de signup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Adicionar novos campos de perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Constraint única no CPF (quando preenchido)
-- índice parcial para permitir NULL e CPF único entre não-nulls
DROP INDEX IF EXISTS public.idx_profiles_cpf;
CREATE UNIQUE INDEX idx_profiles_cpf
  ON public.profiles(cpf)
  WHERE cpf IS NOT NULL AND cpf != '';

-- Trigger para updated_at em profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Atualizar políticas RLS para garantir que usuário pode ver e editar o próprio perfil
-- A política profiles_update_self_or_manager já permite update pelo próprio usuário
-- mas vamos adicionar políticas específicas para clareza

-- Política para SELECT do próprio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política para UPDATE do próprio perfil
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.phone IS 'Telefone de contato do usuário';
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário (formato: 000.000.000-00), único quando preenchido';
COMMENT ON COLUMN public.profiles.country IS 'País do usuário (código ISO 3166-1 alpha-2)';
COMMENT ON COLUMN public.profiles.language IS 'Idioma preferido do usuário (pt-BR, en-US, es)';
COMMENT ON COLUMN public.profiles.timezone IS 'Fuso horário preferido do usuário (IANA timezone database)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL da foto de avatar do usuário';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp da última atualização do perfil (mantido por trigger)';
```

5. Clique em "Run" (ou executar)
6. Verifique se não houveram erros

**Opção B: Via Supabase CLI (se tiver senha do DB)**

```bash
cd apps/dashboard
supabase db push
```

### 2. Configurar SMTP no Supabase

**IMPORTANTE:** Sem configurar SMTP, os usuários não receberão emails de confirmação de cadastro.

1. Acesse: https://supabase.com/dashboard/project/etjqbqorawnnvdlmztka
2. Vá em: Settings → Authentication → SMTP Settings
3. Escolha um provedor:

**Opção A: Resend (Recomendado)**
- Crie uma conta em https://resend.com
- Adicione seu domínio e verifique
- Copie a API Key
- No Supabase, preencha:
  - **Sender Email**: seu-email@seudominio.com
  - **Sender Name**: Start Metric
  - **SMTP Host**: smtp.resend.com
  - **SMTP Port**: 587
  - **SMTP User**: resend
  - **SMTP Password**: sua-api-key-do-resend
  - **Enable TLS**: ON

**Opção B: SendGrid**
- Crie uma conta em https://sendgrid.com
- Crie um API Key com permissão "Mail Send"
- No Supabase, preencha:
  - **Sender Email**: seu-email@seudominio.com
  - **Sender Name**: Start Metric
  - **SMTP Host**: smtp.sendgrid.net
  - **SMTP Port**: 587
  - **SMTP User**: apikey
  - **SMTP Password**: sua-api-key-do-sendgrid
  - **Enable TLS**: ON

4. Clique em "Save"
5. **Testar o envio:**
   - Role até a seção "Email Templates"
   - Clique em "Confirm signup"
   - Clique em "Send Test Email"
   - Coloque seu email pessoal
   - Verifique se o email chegou

### 3. Verificar Deploy no Vercel

O código já foi pushado, então o Vercel deve fazer deploy automático.

1. Acesse: https://vercel.com/evandrosilva5santos-lab/start-metric
2. Verifique se o deploy está "Ready"
3. Se houver erro, verifique os logs

### 4. Testar Funcionalidades

Após o deploy estar ready, teste:

1. **Acessar `/settings/profile`:**
   - Faça login em https://start-metric.vercel.app
   - Acesse: https://start-metric.vercel.app/settings/profile
   - Preencha os campos e salve
   - Verifique se salvou corretamente

2. **Testar Header:**
   - Clique no nome do usuário no topo direito
   - Verifique se o dropdown aparece com "Meu Perfil"

3. **Testar Meta Ads (se já tiver integrado):**
   - Acesse /settings/meta
   - Clique em "Vincular Conta Meta Ads"
   - Após OAuth, deve redirecionar para /settings/meta?connected=true
   - As contas devem aparecer após ~1.5s (refresh automático)

## Critérios de Aceite - Checklist

- [ ] Migration aplicada no banco
- [ ] SMTP configurado e testado
- [ ] Usuário consegue criar conta e receber email de confirmação
- [ ] Usuário consegue fazer login após confirmar email
- [ ] Página `/settings/profile` existe e salva todos os campos
- [ ] Header mostra dropdown com link para perfil
- [ ] Meta Ads callback redireciona corretamente para /settings/meta

## Próximos Passos

Após completar o Sprint 0, você pode prosseguir para:

- **Sprint 1:** Client Management (gestão de clientes)
- **Sprint 2:** Meta Ads Real (métricas reais da Meta)
- **Sprint 3:** Analytics Engine (motor de analytics)

Documentos dos sprints estão em: `docs/sprints/`
