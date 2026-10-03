-- 읽기 전용 점검입니다. 데이터와 권한을 변경하지 않습니다.
-- Supabase SQL Editor에서 실행하고 결과 표를 확인하세요.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_schema_privilege('authenticated', 'public', 'USAGE') as schema_usage,
       has_table_privilege('authenticated', c.oid, 'SELECT') as can_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as can_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as can_update
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('generated_texts', 'play_sessions');

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('generated_texts', 'play_sessions');
