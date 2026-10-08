#!/usr/bin/env bash
# ローカル Supabase をリセットし、シード投入とテストユーザー作成を行う（開発・テスト用）
set -euo pipefail
cd "$(dirname "$0")/.."
supabase db reset
node --env-file=.env.local scripts/create-user.mjs --email admin@example.com --password 'admin-pass-123' --name '管理 太郎' --admin
node --env-file=.env.local scripts/create-user.mjs --email staff@example.com --password 'staff-pass-123' --name '営業 花子'
node --env-file=.env.local scripts/create-user.mjs --email staff2@example.com --password 'staff-pass-123' --name '営業 次郎'
