"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { QuestionConfig, QuestionType } from "@/lib/types";

const QUESTION_TYPES: QuestionType[] = ["free_text", "list", "two_category", "multi_field", "commitment"];

async function db() {
  await requireAdmin();
  return createClient();
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = () => revalidatePath("/", "layout");

// 並べ替え：同じ親の中で前後と入れ替え、1..n に振り直す
async function move(table: "courses" | "chapters" | "questions", id: string, dir: "up" | "down") {
  const supabase = await db();
  const parentCol = table === "chapters" ? "course_id" : table === "questions" ? "chapter_id" : null;
  const { data: row } = await supabase.from(table).select("*").eq("id", id).single();
  if (!row) return;
  let q = supabase.from(table).select("id, sort_order").is("archived_at", null).order("sort_order").order("created_at");
  if (parentCol) q = q.eq(parentCol, (row as Record<string, string>)[parentCol]);
  const { data: siblings } = await q;
  const list = (siblings ?? []).map((s) => s.id as string);
  const i = list.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((sid, idx) => supabase.from(table).update({ sort_order: idx + 1 }).eq("id", sid)));
  done();
}

// ---- 教材 ----
export async function createCourse(formData: FormData) {
  const supabase = await db();
  const title = str(formData, "title");
  if (!title) return;
  const { data: last } = await supabase.from("courses").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data } = await supabase
    .from("courses")
    .insert({ title, description: str(formData, "description"), sort_order: (last?.sort_order ?? 0) + 1, is_published: false })
    .select("id")
    .single();
  done();
  if (data) redirect(`/admin/courses/${data.id}`);
}

export async function updateCourse(formData: FormData) {
  const supabase = await db();
  const id = str(formData, "id");
  await supabase
    .from("courses")
    .update({ title: str(formData, "title"), description: str(formData, "description"), is_published: formData.get("is_published") === "on" })
    .eq("id", id);
  done();
}

export async function moveCourse(formData: FormData) {
  await move("courses", str(formData, "id"), str(formData, "dir") as "up" | "down");
}

export async function archiveCourse(formData: FormData) {
  const supabase = await db();
  await supabase.from("courses").update({ archived_at: new Date().toISOString(), is_published: false }).eq("id", str(formData, "id"));
  done();
  redirect("/admin/courses");
}

// ---- 章 ----
export async function createChapter(formData: FormData) {
  const supabase = await db();
  const courseId = str(formData, "course_id");
  const title = str(formData, "title");
  if (!title) return;
  const { data: chapters } = await supabase.from("chapters").select("chapter_number, sort_order").eq("course_id", courseId).is("archived_at", null);
  const maxNum = Math.max(0, ...(chapters ?? []).map((c) => c.chapter_number));
  const maxSort = Math.max(0, ...(chapters ?? []).map((c) => c.sort_order));
  const number = Number(str(formData, "chapter_number")) || maxNum + 1;
  const { data } = await supabase
    .from("chapters")
    .insert({ course_id: courseId, title, chapter_number: number, sort_order: maxSort + 1, is_published: false })
    .select("id")
    .single();
  done();
  if (data) redirect(`/admin/chapters/${data.id}`);
}

export async function updateChapter(formData: FormData) {
  const supabase = await db();
  await supabase
    .from("chapters")
    .update({
      title: str(formData, "title"),
      chapter_number: Number(str(formData, "chapter_number")) || 1,
      description: str(formData, "description"),
      is_published: formData.get("is_published") === "on",
    })
    .eq("id", str(formData, "id"));
  done();
}

export async function moveChapter(formData: FormData) {
  await move("chapters", str(formData, "id"), str(formData, "dir") as "up" | "down");
}

export async function archiveChapter(formData: FormData) {
  const supabase = await db();
  const { data } = await supabase
    .from("chapters")
    .update({ archived_at: new Date().toISOString(), is_published: false })
    .eq("id", str(formData, "id"))
    .select("course_id")
    .single();
  done();
  if (data) redirect(`/admin/courses/${data.course_id}`);
}

// ---- 設問 ----
export type QuestionInput = {
  id?: string;
  question_type: QuestionType;
  prompt: string;
  description: string;
  config: QuestionConfig;
};

function sanitize(input: QuestionInput): QuestionInput | null {
  if (!QUESTION_TYPES.includes(input.question_type)) return null;
  const prompt = input.prompt?.trim();
  if (!prompt) return null;
  const clean = (arr?: { key: string; label: string; hint?: string; single_line?: boolean }[]) =>
    (arr ?? [])
      .filter((f) => f.label?.trim())
      .map((f) => ({ key: f.key, label: f.label.trim(), ...(f.hint?.trim() ? { hint: f.hint.trim() } : {}), ...(f.single_line ? { single_line: true } : {}) }));
  let config: QuestionConfig = {};
  switch (input.question_type) {
    case "list":
      config = { count: Math.min(20, Math.max(1, Math.floor(Number(input.config.count) || 1))), ...(input.config.allow_add ? { allow_add: true } : {}) };
      break;
    case "multi_field":
      config = { fields: clean(input.config.fields) };
      if (!config.fields?.length) return null;
      break;
    case "two_category":
      config = { columns: clean(input.config.columns).slice(0, 2), sections: clean(input.config.sections) };
      if (config.columns?.length !== 2) return null;
      if (!config.sections?.length) delete config.sections;
      break;
  }
  return { ...input, prompt, description: input.description?.trim() ?? "", config };
}

export async function saveQuestion(chapterId: string, input: QuestionInput): Promise<{ error?: string }> {
  const supabase = await db();
  const q = sanitize(input);
  if (!q) return { error: "設問本文と回答欄の設定を確認してください。" };
  const row = { question_type: q.question_type, prompt: q.prompt, description: q.description, config: q.config };
  if (q.id) {
    const { error } = await supabase.from("questions").update(row).eq("id", q.id).eq("chapter_id", chapterId);
    if (error) return { error: "保存できませんでした。" };
  } else {
    const { data: last } = await supabase
      .from("questions")
      .select("sort_order")
      .eq("chapter_id", chapterId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("questions").insert({ ...row, chapter_id: chapterId, sort_order: (last?.sort_order ?? 0) + 1 });
    if (error) return { error: "保存できませんでした。" };
  }
  done();
  return {};
}

export async function saveQuestions(chapterId: string, inputs: QuestionInput[]): Promise<{ error?: string; saved?: number }> {
  let saved = 0;
  for (const input of inputs) {
    const r = await saveQuestion(chapterId, { ...input, id: undefined });
    if (r.error) return { error: `${saved + 1}問目：${r.error}`, saved };
    saved++;
  }
  return { saved };
}

export async function moveQuestion(formData: FormData) {
  await move("questions", str(formData, "id"), str(formData, "dir") as "up" | "down");
}

// 削除はアーカイブ（既存の回答履歴は残る）
export async function archiveQuestion(formData: FormData) {
  const supabase = await db();
  const restore = formData.get("restore") === "1";
  await supabase.from("questions").update({ archived_at: restore ? null : new Date().toISOString() }).eq("id", str(formData, "id"));
  done();
}

// ---- 教材写真 ----
export async function uploadChapterImage(formData: FormData): Promise<{ error?: string }> {
  const supabase = await db();
  const chapterId = str(formData, "chapter_id");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "画像を選択してください。" };
  const { data: auth } = await supabase.auth.getUser();
  for (const file of files) {
    if (!file.type.startsWith("image/")) return { error: "画像ファイルを選択してください。" };
    if (file.size > 10 * 1024 * 1024) return { error: "1枚10MBまでの画像にしてください。" };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `chapters/${chapterId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("course-images").upload(path, file, { contentType: file.type });
    if (error) return { error: "アップロードに失敗しました。" };
    await supabase.from("chapter_images").insert({ chapter_id: chapterId, storage_path: path, created_by: auth.user?.id });
  }
  done();
  return {};
}

export async function deleteChapterImage(formData: FormData) {
  const supabase = await db();
  const id = str(formData, "id");
  const { data } = await supabase.from("chapter_images").select("storage_path").eq("id", id).single();
  if (data) {
    await supabase.storage.from("course-images").remove([data.storage_path]);
    await supabase.from("chapter_images").delete().eq("id", id);
  }
  done();
}

// ---- 写真から設問を読み取る（任意。APIキーが無い場合は手入力） ----
export async function extractFromImage(imageId: string): Promise<{ error?: string; questions?: QuestionInput[] }> {
  const supabase = await db();
  const { ocrEnabled, extractQuestions } = await import("@/lib/ocr");
  if (!ocrEnabled()) return { error: "自動読み取りは未設定です（ANTHROPIC_API_KEY）。写真を見ながら手入力してください。" };
  const { data: img } = await supabase.from("chapter_images").select("storage_path").eq("id", imageId).single();
  if (!img) return { error: "画像が見つかりません。" };
  const { data: blob, error } = await supabase.storage.from("course-images").download(img.storage_path);
  if (error || !blob) return { error: "画像を読み込めませんでした。" };
  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"] as const).find((t) => t === blob.type) ?? null;
  if (!mediaType) return { error: "JPEG / PNG / WebP の画像を使ってください（HEIC は自動読み取り非対応）。" };
  try {
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const questions = await extractQuestions({ data, mediaType });
    await supabase
      .from("chapter_images")
      .update({ extracted_text: questions.map((q) => q.prompt).join("\n") })
      .eq("id", imageId);
    return { questions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "読み取りに失敗しました。" };
  }
}
