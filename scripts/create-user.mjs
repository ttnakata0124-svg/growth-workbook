// 初期管理者・社員アカウントを作成するスクリプト（サーバー/手元PCで実行。ブラウザには出さない）
//
// 使い方:
//   node --env-file=.env.local scripts/create-user.mjs --email admin@example.com --password '********' --name '山田太郎' --admin
//   （--admin を付けると管理者、付けなければ一般社員）
//
// 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "" },
    admin: { type: "boolean", default: false },
  },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。");
  process.exit(1);
}
if (!values.email || !values.password || values.password.length < 8) {
  console.error("--email と 8文字以上の --password を指定してください。");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let userId;
const { data, error } = await supabase.auth.admin.createUser({
  email: values.email,
  password: values.password,
  email_confirm: true,
  user_metadata: { full_name: values.name },
});
if (error) {
  // 既に存在する場合は権限・氏名の更新だけ行う（再実行しても安全）
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === values.email.toLowerCase());
  if (!existing) {
    console.error("作成に失敗しました:", error.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log("既存ユーザーを更新します:", values.email);
} else {
  userId = data.user.id;
  console.log("ユーザーを作成しました:", values.email);
}

const update = { role: values.admin ? "admin" : "employee" };
if (values.name) update.full_name = values.name;
const { error: pErr } = await supabase.from("profiles").update(update).eq("id", userId);
if (pErr) {
  console.error("プロフィール更新に失敗しました:", pErr.message);
  process.exit(1);
}
console.log(`権限: ${update.role === "admin" ? "管理者" : "社員"}`);
