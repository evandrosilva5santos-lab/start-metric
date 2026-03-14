-- SCHEMA: sm (Start Metric) - ROI de Tempo e Organização
-- Prefix: sm_ (Start Metric)

-- 1. SETOR: IDENTITY & ACCESS (Acesso e Perfil)
CREATE TABLE sm_auth_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_auth_profiles IS 'Dados estendidos de perfil do usuário vinculados ao Supabase Auth.';

-- 2. SETOR: META ADS (Conexão e Dados Brutos)
CREATE TABLE sm_meta_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    fb_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_meta_tokens IS 'Tokens de acesso à API do Facebook, isolados por usuário.';

CREATE TABLE sm_meta_accounts (
    id TEXT PRIMARY KEY, -- ID da Conta de Anúncios (act_...)
    token_id UUID REFERENCES sm_meta_tokens(id) ON DELETE CASCADE,
    name TEXT,
    currency TEXT,
    timezone_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_meta_accounts IS 'Contas de anúncios gerenciadas dentro do Start Metric.';

-- 3. SETOR: PERFORMANCE (Inteligência de Tráfego)
CREATE TABLE sm_perf_daily_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id TEXT REFERENCES sm_meta_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_spend NUMERIC(15,2) DEFAULT 0,
    total_impressions BIGINT DEFAULT 0,
    total_clicks BIGINT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    roas NUMERIC(5,2) GENERATED ALWAYS AS (CASE WHEN total_spend > 0 THEN total_revenue / total_spend ELSE 0 END) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, date)
);

COMMENT ON TABLE sm_perf_daily_metrics IS 'Métricas agregadas por dia: o pulso do ROI do investimento em tráfego.';

-- 4. SETOR: ASSETS (Gestão de Criativos)
CREATE TABLE sm_asset_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id TEXT REFERENCES sm_meta_accounts(id) ON DELETE CASCADE,
    meta_asset_id TEXT NOT NULL,
    asset_type TEXT, -- image, video
    preview_url TEXT,
    cached_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_asset_registry IS 'Catálogo de criativos puxados da Meta API.';
