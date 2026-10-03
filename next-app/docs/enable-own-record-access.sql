-- Supabase SQL Editor에서 전체를 한 번 실행하세요.
-- 로그인 사용자의 본인 기록 SELECT / INSERT / UPDATE만 허용합니다.
-- 데이터 삭제, RLS 해제, 관리자 우회 권한 부여는 하지 않습니다.
-- 기존 정책이 발견되면 충돌 방지를 위해 변경 없이 중단합니다.
begin;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('play_sessions', 'generated_texts')
  ) then
    raise exception 'Existing policies found. Stop and review policies before applying this script.';
  end if;
end $$;

alter table public.play_sessions enable row level security;
alter table public.generated_texts enable row level security;

create policy teacher_sessions_select_own
on public.play_sessions for select to authenticated
using (user_id::text = (select auth.uid())::text);

create policy teacher_sessions_insert_own
on public.play_sessions for insert to authenticated
with check (user_id::text = (select auth.uid())::text);

create policy teacher_sessions_update_own
on public.play_sessions for update to authenticated
using (user_id::text = (select auth.uid())::text)
with check (user_id::text = (select auth.uid())::text);

create policy teacher_texts_select_own
on public.generated_texts for select to authenticated
using (user_id::text = (select auth.uid())::text);

create policy teacher_texts_insert_own
on public.generated_texts for insert to authenticated
with check (
  user_id::text = (select auth.uid())::text
  and exists (
    select 1 from public.play_sessions s
    where s.session_id = generated_texts.session_id
      and s.user_id::text = (select auth.uid())::text
  )
);

create policy teacher_texts_update_own
on public.generated_texts for update to authenticated
using (user_id::text = (select auth.uid())::text)
with check (
  user_id::text = (select auth.uid())::text
  and exists (
    select 1 from public.play_sessions s
    where s.session_id = generated_texts.session_id
      and s.user_id::text = (select auth.uid())::text
  )
);

grant usage on schema public to authenticated;
grant select, insert, update on public.play_sessions, public.generated_texts to authenticated;

-- 각 테이블의 자동 번호 열에 연결된 시퀀스가 있을 때만 USAGE 부여.
-- 다른 테이블의 시퀀스에는 권한을 부여하지 않습니다.
do $$
declare
  target record;
  sequence_name text;
begin
  for target in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('play_sessions', 'generated_texts')
  loop
    sequence_name := pg_get_serial_sequence(
      format('%I.%I', target.table_schema, target.table_name), target.column_name
    );
    if sequence_name is not null then
      execute format('grant usage on sequence %s to authenticated', sequence_name::regclass);
    end if;
  end loop;
end $$;

commit;

-- 실행 후 두 행의 권한은 true, 정책 개수는 각각 3이어야 합니다.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated', c.oid, 'SELECT') as can_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as can_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as can_update,
  (select count(*) from pg_policies p
   where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('play_sessions', 'generated_texts');
