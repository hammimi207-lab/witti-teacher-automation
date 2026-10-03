-- Run after class-announcements.sql, once before enabling template persistence.
-- Existing content and ownership remain unchanged.
begin;
alter table public.teacher_class_announcements
  add column if not exists title text not null default '공지 양식',
  add column if not exists category text not null default '일반';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcement_title_length' and conrelid = 'public.teacher_class_announcements'::regclass) then
    alter table public.teacher_class_announcements add constraint announcement_title_length check (char_length(btrim(title)) between 1 and 100);
    alter table public.teacher_class_announcements add constraint announcement_category_length check (char_length(btrim(category)) between 1 and 50);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teacher_class_announcements' and policyname = 'Teachers update own announcements') then
    create policy "Teachers update own announcements" on public.teacher_class_announcements
      for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
grant update on public.teacher_class_announcements to authenticated;
notify pgrst, 'reload schema';
commit;
