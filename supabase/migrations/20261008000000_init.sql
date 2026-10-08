-- MY GROWTH WORKBOOK 初期スキーマ
-- 構造: courses → chapters → questions / attempts → answers
-- 方針:
--   * 回答本文 (answers) は本人のみ参照・更新できる。管理者用のポリシーは一切作らない。
--   * 管理者の進捗確認は回答本文を参照しない SECURITY DEFINER 関数 (admin_*) のみで行う。
--   * 設問・章は物理削除せずアーカイブ（archived_at）する。
--   * 回答保存時に設問のスナップショットを残し、設問を編集しても過去の履歴が変わらないようにする。

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'employee' check (role in ('employee', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 権限判定（RLS 内で再帰しないよう SECURITY DEFINER）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- auth.users 作成時に profile を自動作成。role は必ず employee から始まる
-- （メタデータで role を渡しても無視する）。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 権限・有効状態の変更は管理者（またはサーバー側の service role / SQL 直接実行）だけが行える。
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active
      or new.id is distinct from old.id) then
    -- auth.uid() が null = service role / postgres による直接操作
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'permission denied: role/is_active can only be changed by an admin';
    end if;
    -- 管理者が自分自身の権限を外して管理者不在になる事故を防ぐ
    if auth.uid() = old.id and (new.role <> 'admin' or not new.is_active) then
      raise exception 'admins cannot demote or deactivate themselves';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: admin read all" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "profiles: admin update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses / chapters / questions
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  chapter_number integer not null,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chapters_course_idx on public.chapters (course_id, sort_order);

-- question_type:
--   free_text     自由記述                       config: { "placeholder"?: text }
--   list          指定個数の複数回答             config: { "count": n, "allow_add"?: bool }
--   two_category  2分類の記述                    config: { "columns": [{key,label}x2], "sections"?: [{key,label,hint?}] }
--   multi_field   複数項目ごとの自由記述         config: { "fields": [{key,label,hint?}] }
--   commitment    実行への決意（自由記述）       config: {}
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete restrict,
  sort_order integer not null default 0,
  question_type text not null
    check (question_type in ('free_text', 'list', 'two_category', 'multi_field', 'commitment')),
  prompt text not null,
  description text not null default '',
  config jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_chapter_idx on public.questions (chapter_id, sort_order);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();
create trigger chapters_touch before update on public.chapters
  for each row execute function public.touch_updated_at();
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

-- 教材写真（Storage: course-images バケット、非公開）
create table public.chapter_images (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  storage_path text not null unique,
  extracted_text text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- attempts / answers
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete restrict,
  attempt_number integer not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, chapter_id);
-- 同じ章で進行中のセッションは1つだけ
create unique index attempts_one_in_progress
  on public.attempts (user_id, chapter_id) where status = 'in_progress';

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  content jsonb not null default '{}'::jsonb,
  question_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- 回答保存時の整合性チェックと設問スナップショット
create or replace function public.prepare_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.attempts%rowtype;
  q public.questions%rowtype;
begin
  select * into a from public.attempts where id = new.attempt_id;
  if a.id is null or a.user_id <> new.user_id then
    raise exception 'invalid attempt';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'attempt is already completed';
  end if;
  if tg_op = 'UPDATE' then
    -- 紐付けは変更不可
    new.attempt_id := old.attempt_id;
    new.question_id := old.question_id;
    new.user_id := old.user_id;
    new.question_snapshot := old.question_snapshot;
    new.created_at := old.created_at;
  else
    select * into q from public.questions where id = new.question_id;
    if q.id is null or q.chapter_id <> a.chapter_id then
      raise exception 'question does not belong to this chapter';
    end if;
    new.question_snapshot := jsonb_build_object(
      'prompt', q.prompt,
      'description', q.description,
      'question_type', q.question_type,
      'config', q.config,
      'sort_order', q.sort_order
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger answers_prepare
  before insert or update on public.answers
  for each row execute function public.prepare_answer();

create or replace function public.touch_attempt_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attempts set last_activity_at = now() where id = new.attempt_id;
  return new;
end;
$$;

create trigger answers_touch_attempt
  after insert or update on public.answers
  for each row execute function public.touch_attempt_activity();

-- ---------------------------------------------------------------------------
-- RLS: 教材
-- ---------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.chapter_images enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;

-- ポリシー同士が相互参照して再帰しないよう、判定は SECURITY DEFINER 関数にまとめる
create or replace function public.chapter_is_live(p_chapter_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapters c join public.courses co on co.id = c.course_id
    where c.id = p_chapter_id
      and c.is_published and c.archived_at is null
      and co.is_published and co.archived_at is null
  );
$$;

create or replace function public.has_attempt_in_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.attempts t join public.chapters c on c.id = t.chapter_id
    where c.course_id = p_course_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.has_attempt_in_chapter(p_chapter_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.attempts t where t.chapter_id = p_chapter_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.has_answered_question(p_question_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.answers a where a.question_id = p_question_id and a.user_id = auth.uid()
  );
$$;

-- 社員: 公開中の教材 + 自分が取り組んだことのある教材（履歴表示のため）
create policy "courses: read" on public.courses
  for select to authenticated using (
    (is_published and archived_at is null)
    or public.is_admin()
    or public.has_attempt_in_course(id)
  );
create policy "courses: admin insert" on public.courses
  for insert to authenticated with check (public.is_admin());
create policy "courses: admin update" on public.courses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "chapters: read" on public.chapters
  for select to authenticated using (
    public.chapter_is_live(id)
    or public.is_admin()
    or public.has_attempt_in_chapter(id)
  );
create policy "chapters: admin insert" on public.chapters
  for insert to authenticated with check (public.is_admin());
create policy "chapters: admin update" on public.chapters
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "questions: read" on public.questions
  for select to authenticated using (
    (archived_at is null and public.chapter_is_live(chapter_id))
    or public.is_admin()
    or public.has_answered_question(id)
  );
create policy "questions: admin insert" on public.questions
  for insert to authenticated with check (public.is_admin());
create policy "questions: admin update" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- 教材・章・設問の物理削除ポリシーは作らない（アーカイブ方式）

create policy "chapter_images: admin only" on public.chapter_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: 回答（本人のみ。管理者ポリシーは意図的に作らない）
-- ---------------------------------------------------------------------------
create policy "attempts: read own" on public.attempts
  for select to authenticated using (user_id = auth.uid());
-- attempts の作成・完了は下の関数経由のみ（直接の insert/update/delete は不可）

create policy "answers: read own" on public.answers
  for select to authenticated using (user_id = auth.uid());
create policy "answers: insert own" on public.answers
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.attempts t
      where t.id = attempt_id and t.user_id = auth.uid() and t.status = 'in_progress'
    )
  );
create policy "answers: update own" on public.answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 回答セッション操作
-- ---------------------------------------------------------------------------

-- 章の進行中セッションを返す。なければ作成する（公開中の章のみ）。
create or replace function public.start_attempt(p_chapter_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.attempts%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into result from public.attempts
  where user_id = uid and chapter_id = p_chapter_id and status = 'in_progress';
  if found then
    return result;
  end if;

  if not public.chapter_is_live(p_chapter_id) then
    raise exception 'chapter is not available';
  end if;

  insert into public.attempts (user_id, chapter_id, attempt_number)
  values (
    uid, p_chapter_id,
    coalesce((select max(attempt_number) from public.attempts
              where user_id = uid and chapter_id = p_chapter_id), 0) + 1
  )
  on conflict (user_id, chapter_id) where status = 'in_progress' do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.attempts
    where user_id = uid and chapter_id = p_chapter_id and status = 'in_progress';
  end if;
  return result;
end;
$$;

create or replace function public.complete_attempt(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.attempts%rowtype;
begin
  update public.attempts
  set status = 'completed', completed_at = now(), last_activity_at = now()
  where id = p_attempt_id and user_id = auth.uid() and status = 'in_progress'
  returning * into result;
  if result.id is null then
    raise exception 'attempt not found or already completed';
  end if;
  return result;
end;
$$;

-- 回答が1つもない進行中セッションを取り消す（再挑戦を始めたがやめた場合など）
create or replace function public.discard_empty_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.attempts t
  where t.id = p_attempt_id and t.user_id = auth.uid() and t.status = 'in_progress'
    and not exists (select 1 from public.answers a where a.attempt_id = t.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 進捗（本人用 / 管理者用）。いずれも回答本文 (answers) を参照しない。
-- ---------------------------------------------------------------------------

-- 章ごとの進捗。p_user_id 省略時は本人。他人を指定できるのは管理者のみ。
create or replace function public.chapter_progress(p_user_id uuid default null)
returns table (
  user_id uuid,
  course_id uuid,
  chapter_id uuid,
  status text,               -- not_started / in_progress / completed
  completed_count integer,   -- 完了回数
  has_in_progress boolean,
  last_completed_at timestamptz,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if target <> auth.uid() and not public.is_admin() then
    raise exception 'permission denied';
  end if;

  return query
  select
    target,
    c.course_id,
    c.id,
    case
      when count(*) filter (where t.status = 'completed') > 0 then 'completed'
      when count(t.id) > 0 then 'in_progress'
      else 'not_started'
    end,
    (count(*) filter (where t.status = 'completed'))::integer,
    bool_or(t.status = 'in_progress') is true,
    max(t.completed_at),
    max(t.last_activity_at)
  from public.chapters c
  left join public.attempts t on t.chapter_id = c.id and t.user_id = target
  where c.archived_at is null
  group by c.course_id, c.id;
end;
$$;

-- 管理者用: 社員 × 公開中教材の進捗一覧
create or replace function public.admin_progress()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  course_id uuid,
  course_title text,
  completed_chapters integer,
  total_chapters integer,
  progress_percent integer,
  status text,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied';
  end if;

  return query
  with pub_chapters as (
    select c.id, c.course_id
    from public.chapters c join public.courses co on co.id = c.course_id
    where c.is_published and c.archived_at is null
      and co.is_published and co.archived_at is null
  ),
  per_course as (
    select
      p.id as uid, co.id as cid,
      (select count(*) from pub_chapters pc where pc.course_id = co.id)::integer as total,
      (select count(distinct t.chapter_id) from public.attempts t
         join pub_chapters pc on pc.id = t.chapter_id
        where t.user_id = p.id and pc.course_id = co.id and t.status = 'completed')::integer as done,
      (select count(*) from public.attempts t
         join public.chapters c on c.id = t.chapter_id
        where t.user_id = p.id and c.course_id = co.id)::integer as attempts_count,
      (select max(t.last_activity_at) from public.attempts t
         join public.chapters c on c.id = t.chapter_id
        where t.user_id = p.id and c.course_id = co.id) as last_at
    from public.profiles p
    cross join public.courses co
    where co.is_published and co.archived_at is null
  )
  select
    p.id, p.full_name, p.email, p.role, p.is_active,
    co.id, co.title,
    pc.done, pc.total,
    case when pc.total = 0 then 0 else floor(pc.done * 100.0 / pc.total)::integer end,
    case
      when pc.total > 0 and pc.done >= pc.total then 'completed'
      when pc.attempts_count > 0 then 'in_progress'
      else 'not_started'
    end,
    pc.last_at
  from per_course pc
  join public.profiles p on p.id = pc.uid
  join public.courses co on co.id = pc.cid
  order by p.full_name, co.sort_order;
end;
$$;

-- 関数の実行権限（anon には渡さない）
revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.complete_attempt(uuid) from public, anon;
revoke execute on function public.discard_empty_attempt(uuid) from public, anon;
revoke execute on function public.chapter_progress(uuid) from public, anon;
revoke execute on function public.admin_progress() from public, anon;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.complete_attempt(uuid) to authenticated;
grant execute on function public.discard_empty_attempt(uuid) to authenticated;
grant execute on function public.chapter_progress(uuid) to authenticated;
grant execute on function public.admin_progress() to authenticated;

-- anon は一切のテーブルを読めない（RLS で authenticated のみ許可しているが念のため）
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: 教材写真（非公開バケット）
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-images', 'course-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "course-images: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'course-images');
create policy "course-images: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'course-images' and public.is_admin());
create policy "course-images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'course-images' and public.is_admin());
create policy "course-images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'course-images' and public.is_admin());
