-- Verificar políticas RLS principais (sprints 1-4)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('organizations', 'profiles', 'clients', 'ad_accounts', 'whatsapp_instances')
ORDER BY tablename, policyname;
