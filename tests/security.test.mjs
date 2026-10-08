// RLS / 権限のテスト（ローカル Supabase に対して実行）
//   npm run test:security
// 前提: supabase start 済み・シード投入済み・テストユーザー作成済み（scripts/create-test-users.sh）
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

async function signIn(email, password) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, uid: data.user.id };
}

let admin, staff, staff2, service;
const CH1 = "00000000-0000-4000-8001-000000000001";
const COURSE = "00000000-0000-4000-8000-000000000001";

before(async () => {
  service = createClient(URL, SERVICE, opts);
  admin = await signIn("admin@example.com", "admin-pass-123");
  staff = await signIn("staff@example.com", "staff-pass-123");
  staff2 = await signIn("staff2@example.com", "staff-pass-123");
});

test("初期データ: 教材1・章5・設問28（決意5）が社員に見える", async () => {
  const { data: courses } = await staff.c.from("courses").select("id");
  assert.ok(courses.some((c) => c.id === COURSE));
  const seedChapters = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8001-${String(n).padStart(12, "0")}`);
  const { data: chapters } = await staff.c.from("chapters").select("id").in("id", seedChapters);
  assert.equal(chapters.length, 5);
  const { data: qs } = await staff.c.from("questions").select("id, question_type").in("chapter_id", seedChapters);
  assert.equal(qs.length, 28);
  assert.equal(qs.filter((q) => q.question_type === "commitment").length, 5);
});

test("未ログイン(anon)は教材も設問も読めない", async () => {
  const anon = createClient(URL, ANON, opts);
  const { data: qs } = await anon.from("questions").select("id");
  assert.equal((qs ?? []).length, 0);
  const { data: cs } = await anon.from("courses").select("id");
  assert.equal((cs ?? []).length, 0);
});

test("回答は本人だけが読める（他の社員・管理者は0件）", async () => {
  const { data: attempt, error } = await staff.c.rpc("start_attempt", { p_chapter_id: CH1 });
  assert.ifError(error);
  const { data: q } = await staff.c.from("questions").select("id").eq("chapter_id", CH1).order("sort_order").limit(1).single();
  const secret = "秘密の回答テキスト-" + Date.now();
  const { error: upErr } = await staff.c
    .from("answers")
    .upsert({ attempt_id: attempt.id, question_id: q.id, content: { items: [secret] } }, { onConflict: "attempt_id,question_id" });
  assert.ifError(upErr);

  const { data: own } = await staff.c.from("answers").select("content").eq("attempt_id", attempt.id);
  assert.equal(own[0].content.items[0], secret);

  for (const other of [staff2, admin]) {
    const { data: a } = await other.c.from("answers").select("*");
    assert.ok(a.every((row) => row.user_id === other.uid), "自分以外の回答が見えてはいけない");
    assert.ok(!JSON.stringify(a).includes(secret));
    const { data: t } = await other.c.from("attempts").select("*").eq("user_id", staff.uid);
    assert.equal(t.length, 0, "他人の回答セッションが見えてはいけない");
  }

  // 管理者用の進捗関数の結果に回答本文が含まれない
  const { data: progress, error: pErr } = await admin.c.rpc("admin_progress");
  assert.ifError(pErr);
  assert.ok(progress.length >= 3);
  assert.ok(!JSON.stringify(progress).includes(secret));
  const row = progress.find((r) => r.user_id === staff.uid);
  assert.deepEqual(
    Object.keys(row).sort(),
    ["completed_chapters", "course_id", "course_title", "email", "full_name", "is_active", "last_activity_at", "progress_percent", "role", "status", "total_chapters", "user_id"].sort(),
  );
  assert.equal(row.status, "in_progress");

  const { data: chProg } = await admin.c.rpc("chapter_progress", { p_user_id: staff.uid });
  assert.ok(!JSON.stringify(chProg).includes(secret));

  // 他人の回答を書き換えようとしても失敗する
  await staff2.c.from("answers").update({ content: { text: "改ざん" } }).eq("attempt_id", attempt.id);
  const { data: after } = await staff.c.from("answers").select("content").eq("attempt_id", attempt.id);
  assert.equal(after[0].content.items[0], secret);
});

test("社員は管理者用の集計・他人の進捗を取得できない", async () => {
  const { error } = await staff.c.rpc("admin_progress");
  assert.ok(error, "admin_progress は管理者専用");
  const { error: e2 } = await staff.c.rpc("chapter_progress", { p_user_id: staff2.uid });
  assert.ok(e2, "他人の chapter_progress は取得不可");
});

test("社員は自分を管理者に昇格できない", async () => {
  await staff.c.from("profiles").update({ role: "admin" }).eq("id", staff.uid);
  const { data } = await service.from("profiles").select("role").eq("id", staff.uid).single();
  assert.equal(data.role, "employee");
  const { error } = await staff.c.rpc("is_admin");
  // is_admin() は呼べても false
  if (!error) {
    const { data: isAdmin } = await staff.c.rpc("is_admin");
    assert.equal(isAdmin, false);
  }
});

test("社員は教材・章・設問を作成・変更できない", async () => {
  const { error } = await staff.c.from("courses").insert({ title: "不正な教材" });
  assert.ok(error);
  await staff.c.from("questions").update({ prompt: "改ざん" }).eq("chapter_id", CH1);
  const { data } = await service.from("questions").select("prompt").eq("chapter_id", CH1);
  assert.ok(data.every((q) => q.prompt !== "改ざん"));
  const { error: delErr, count } = await admin.c.from("questions").delete({ count: "exact" }).eq("chapter_id", CH1);
  assert.ok(delErr || count === 0, "設問は物理削除できない（アーカイブ方式）");
});

test("非公開の教材は社員に表示されない", async () => {
  const { data: hidden, error } = await admin.c.from("courses").insert({ title: "非公開テスト教材", is_published: false }).select().single();
  assert.ifError(error);
  const { data: ch } = await admin.c.from("chapters").insert({ course_id: hidden.id, chapter_number: 1, title: "テスト章", is_published: true }).select().single();
  const { data: list } = await staff.c.from("courses").select("id");
  assert.ok(!list.some((c) => c.id === hidden.id));
  const { error: startErr } = await staff.c.rpc("start_attempt", { p_chapter_id: ch.id });
  assert.ok(startErr, "非公開教材の章は開始できない");
  await admin.c.from("chapters").update({ archived_at: new Date().toISOString() }).eq("id", ch.id);
  await admin.c.from("courses").update({ archived_at: new Date().toISOString() }).eq("id", hidden.id);
});

test("完了した回答は後から変更できず、再挑戦は新しいセッションになる", async () => {
  const { data: first } = await staff2.c.rpc("start_attempt", { p_chapter_id: CH1 });
  const { data: q } = await staff2.c.from("questions").select("id").eq("chapter_id", CH1).order("sort_order").limit(1).single();
  await staff2.c.from("answers").upsert({ attempt_id: first.id, question_id: q.id, content: { items: ["1回目"] } }, { onConflict: "attempt_id,question_id" });
  const { error: cErr } = await staff2.c.rpc("complete_attempt", { p_attempt_id: first.id });
  assert.ifError(cErr);

  const { error: editErr } = await staff2.c.from("answers").update({ content: { items: ["書き換え"] } }).eq("attempt_id", first.id);
  assert.ok(editErr, "完了後の回答は変更不可");

  const { data: second } = await staff2.c.rpc("start_attempt", { p_chapter_id: CH1 });
  assert.notEqual(second.id, first.id);
  assert.equal(second.attempt_number, first.attempt_number + 1);
  const { data: old } = await staff2.c.from("answers").select("content").eq("attempt_id", first.id).single();
  assert.equal(old.content.items[0], "1回目");

  // 進捗: 完了1章 / 5章 = 20%
  const { data: progress } = await admin.c.rpc("admin_progress");
  const row = progress.find((r) => r.user_id === staff2.uid && r.course_id === COURSE);
  assert.ok(row.completed_chapters >= 1);
  assert.equal(row.progress_percent, Math.floor((row.completed_chapters * 100) / row.total_chapters));
});

test("教材写真は管理者のみアップロードでき、未ログインでは見られない", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const { error: staffErr } = await staff.c.storage.from("course-images").upload(`test/${Date.now()}.png`, png, { contentType: "image/png" });
  assert.ok(staffErr, "社員はアップロード不可");
  const path = `test/${Date.now()}.png`;
  const { error } = await admin.c.storage.from("course-images").upload(path, png, { contentType: "image/png" });
  assert.ifError(error);
  const anon = createClient(URL, ANON, opts);
  const { error: anonErr } = await anon.storage.from("course-images").download(path);
  assert.ok(anonErr, "未ログインではダウンロード不可");
  const { data: pub } = anon.storage.from("course-images").getPublicUrl(path);
  const res = await fetch(pub.publicUrl);
  assert.notEqual(res.status, 200, "公開URLでは見られない");
  await admin.c.storage.from("course-images").remove([path]);
});

test("公開サインアップはできない（管理者による登録のみ）", async () => {
  const anon = createClient(URL, ANON, opts);
  const { error } = await anon.auth.signUp({ email: `outsider-${Date.now()}@example.com`, password: "outsider-pass-123" });
  assert.ok(error, "サインアップは無効化されている");
});
