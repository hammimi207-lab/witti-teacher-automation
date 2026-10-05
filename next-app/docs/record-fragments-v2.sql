-- Review against the live Supabase schema before running. Additive only; no backfill or legacy writes.
begin;
create extension if not exists pgcrypto;

-- Fail before creating anything if the legacy schema differs from the inspected schema.
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'play_sessions' and column_name = 'session_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'generated_texts' and column_name = 'id' and udt_name = 'int8'
  ) or not exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'photo_records' and column_name = 'id' and udt_name = 'int8'
  ) then
    raise exception 'Legacy schema differs from reviewed Record Fragment v2 preflight';
  end if;
end $$;

create table if not exists public.record_fragments (
  fragment_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  class_id uuid,
  record_type text not null check (record_type in ('text','voice','play_photo','record_photo','video','artifact')),
  record_subtype text check (record_subtype in ('handwritten_note','postit','play_flow','observation_sheet','board_documentation','other')),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  raw_text text,
  teacher_note text,
  tags text[] not null default '{}',
  play_topic text,
  legacy_session_id uuid,
  legacy_generated_text_id bigint,
  legacy_photo_record_id bigint,
  deleted_at timestamptz,
  unique (fragment_id, user_id),
  check (record_type = 'record_photo' or record_subtype is null)
);
create unique index if not exists record_fragments_legacy_text_key on public.record_fragments(user_id, legacy_generated_text_id) where legacy_generated_text_id is not null;
create unique index if not exists record_fragments_legacy_photo_key on public.record_fragments(user_id, legacy_photo_record_id) where legacy_photo_record_id is not null;
create index if not exists record_fragments_owner_time on public.record_fragments(user_id, recorded_at desc) where deleted_at is null;

create table if not exists public.record_fragment_children (
  fragment_id uuid not null,
  user_id uuid not null,
  child_id uuid not null,
  primary key (fragment_id, child_id),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);

create table if not exists public.record_audio (
  fragment_id uuid primary key,
  user_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_ms bigint check (duration_ms >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  transcription_status text not null default 'not_requested'
    check (transcription_status in ('not_requested','pending','done','error')),
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);
create index if not exists record_audio_owner_started on public.record_audio(user_id, started_at desc);
create table if not exists public.record_transcriptions (
  transcription_id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null,
  user_id uuid not null,
  raw_transcription text not null,
  teacher_edited_transcription text,
  model text,
  created_at timestamptz not null default now(),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);
create index if not exists record_transcriptions_fragment_time on public.record_transcriptions(fragment_id, created_at desc);

create table if not exists public.record_photos (
  photo_id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null,
  user_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (fragment_id, storage_bucket, storage_path),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);
create table if not exists public.record_files (
  file_id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null,
  user_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint check (size_bytes >= 0),
  duration_ms bigint check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);

create table if not exists public.play_clusters (
  cluster_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text,
  created_at timestamptz not null default now(),
  unique (cluster_id, user_id)
);
create table if not exists public.play_fragment_links (
  cluster_id uuid not null,
  fragment_id uuid not null,
  user_id uuid not null,
  link_source text not null check (link_source in ('ai','teacher')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (cluster_id, fragment_id),
  foreign key (cluster_id, user_id) references public.play_clusters(cluster_id, user_id) on delete cascade,
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);
create unique index if not exists play_fragment_one_confirmed on public.play_fragment_links(fragment_id) where confirmed_at is not null;

create table if not exists public.play_stories (
  story_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text,
  teacher_text text,
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);
create table if not exists public.play_story_fragments (
  story_id uuid not null,
  fragment_id uuid not null,
  user_id uuid not null,
  position integer not null check (position >= 0),
  primary key (story_id, fragment_id),
  unique (story_id, position),
  foreign key (story_id, user_id) references public.play_stories(story_id, user_id) on delete cascade,
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);

create table if not exists public.ai_interpretations (
  interpretation_id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('summary','extracted_text','other')),
  content text not null,
  model text,
  created_at timestamptz not null default now(),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);
create index if not exists ai_interpretations_fragment_kind_time on public.ai_interpretations(fragment_id, kind, created_at desc);
create table if not exists public.teacher_edits (
  edit_id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null,
  user_id uuid not null,
  field_name text not null check (field_name in ('raw_text','teacher_note','teacher_edited_transcription','play_topic','record_subtype')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  foreign key (fragment_id, user_id) references public.record_fragments(fragment_id, user_id) on delete cascade
);

-- Every new table has an owner column and matching authenticated policies.
do $$
declare table_name text;
begin
  foreach table_name in array array['record_fragments','record_fragment_children','record_audio','record_transcriptions','record_photos','record_files','play_clusters','play_fragment_links','play_stories','play_story_fragments','ai_interpretations','teacher_edits'] loop
    execute format('alter table public.%I enable row level security', table_name);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_select_own') then
      execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', table_name || '_select_own', table_name);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_insert_own') then
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', table_name || '_insert_own', table_name);
    end if;
    if table_name in ('record_fragments','record_audio','record_transcriptions','play_clusters','play_fragment_links','play_stories','play_story_fragments') then
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_update_own') then
        execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name || '_update_own', table_name);
      end if;
      execute format('grant select, insert, update on public.%I to authenticated', table_name);
    else
      execute format('grant select, insert on public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

-- Keep original voice files in a private bucket. The API checks ownership before reading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('record-audio', 'record-audio', false, 4000000, array['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'record-audio' and public) then
    raise exception 'record-audio bucket must be private';
  end if;
end $$;
commit;
