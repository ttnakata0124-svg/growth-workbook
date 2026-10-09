-- 6桁のログインコード（PIN）
-- 一度メールアドレス＋パスワードでログインした端末だけで使える。
-- 端末は httpOnly Cookie のランダムなトークン（DBにはハッシュのみ）で識別する。
-- どちらの表もサーバー（service role）からのみ読み書きし、利用者からは見えない。
create table public.login_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.login_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index login_devices_user_idx on public.login_devices (user_id);

alter table public.login_pins enable row level security;
alter table public.login_devices enable row level security;
revoke all on public.login_pins, public.login_devices from public, anon, authenticated;
