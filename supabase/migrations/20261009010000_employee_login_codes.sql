-- 社員用の6桁ログインコード。コードだけで本人のアカウントに入れる（管理者は対象外）。
-- コードは全社員で重複しない。DBには SHA-256 のハッシュだけを保存する。
-- 総当たり対策として、失敗したログインを login_code_attempts に記録して回数を制限する。
-- どちらの表もサーバー（service role）からのみ読み書きし、利用者からは見えない。
create table public.login_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.login_code_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index login_code_attempts_ip_idx on public.login_code_attempts (ip_hash, created_at);
create index login_code_attempts_time_idx on public.login_code_attempts (created_at);

alter table public.login_codes enable row level security;
alter table public.login_code_attempts enable row level security;
revoke all on public.login_codes, public.login_code_attempts from public, anon, authenticated;
