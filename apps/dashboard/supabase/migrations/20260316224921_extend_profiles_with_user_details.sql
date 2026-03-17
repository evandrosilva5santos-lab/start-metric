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
