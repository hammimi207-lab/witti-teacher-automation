-- Apply after record-fragments-v2.sql. Audio metadata is specific to voice fragments.
-- Use this only if the earlier version of record-fragments-v2.sql was already applied.
begin;
alter table public.record_audio add column if not exists started_at timestamptz;
alter table public.record_audio add column if not exists ended_at timestamptz;
alter table public.record_audio add column if not exists transcription_status text not null default 'not_requested'
  check (transcription_status in ('not_requested','pending','done','error'));
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.record_audio'::regclass and conname = 'record_audio_time_order') then
    alter table public.record_audio add constraint record_audio_time_order check (ended_at is null or started_at is null or ended_at >= started_at);
  end if;
end $$;
create index if not exists record_audio_owner_started on public.record_audio(user_id, started_at desc);
grant update on public.record_audio to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'record_audio' and policyname = 'record_audio_update_own') then
    create policy record_audio_update_own on public.record_audio for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-audio', 'record-audio', false, 4000000, array['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;
do $$ begin
  if exists (select 1 from storage.buckets where id = 'record-audio' and public) then
    raise exception 'record-audio bucket must be private';
  end if;
end $$;
commit;
