-- Teste para verificar se as tabelas existem no Supabase
SELECT 
    'organizations' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations'
    ) as exists
UNION ALL
SELECT 
    'profiles' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) as exists
UNION ALL
SELECT 
    'sm_auth_profiles' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sm_auth_profiles'
    ) as exists
UNION ALL
SELECT 
    'sm_meta_tokens' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sm_meta_tokens'
    ) as exists
UNION ALL
SELECT 
    'ad_accounts' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ad_accounts'
    ) as exists
UNION ALL
SELECT 
    'campaigns' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'campaigns'
    ) as exists
UNION ALL
SELECT 
    'daily_metrics' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daily_metrics'
    ) as exists;
