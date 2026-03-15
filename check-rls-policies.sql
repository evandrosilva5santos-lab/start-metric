-- Verificar políticas RLS para organizations e profiles
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
WHERE tablename IN ('organizations', 'profiles')
ORDER BY tablename, policyname;
