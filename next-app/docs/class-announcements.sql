-- Apply once in the project's Supabase SQL editor before deploying this feature.
-- Safe to rerun: no existing announcements are removed.
begin;
create table if not exists public.teacher_class_announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists teacher_class_announcements_owner_date
  on public.teacher_class_announcements(user_id, created_at desc);
alter table public.teacher_class_announcements enable row level security;
revoke all on public.teacher_class_announcements from anon;
grant select, insert, delete on public.teacher_class_announcements to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teacher_class_announcements' and policyname = 'Teachers read own announcements') then
    create policy "Teachers read own announcements" on public.teacher_class_announcements
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teacher_class_announcements' and policyname = 'Teachers create own announcements') then
    create policy "Teachers create own announcements" on public.teacher_class_announcements
      for insert to authenticated with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teacher_class_announcements' and policyname = 'Teachers delete own announcements') then
    create policy "Teachers delete own announcements" on public.teacher_class_announcements
      for delete to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
