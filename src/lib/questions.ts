import type { AnswerContent, FieldDef, Question, QuestionConfig, QuestionType } from "./types";

export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
export const circled = (i: number) => CIRCLED[i] ?? `(${i + 1})`;

export type AnswerSlot = { key: string; label: string; hint?: string; group?: string; singleLine?: boolean };

const isText = (t: QuestionType) => t === "free_text" || t === "commitment";

// two_category のセクション（未指定なら1セクション）
export function sectionsOf(config: QuestionConfig): FieldDef[] {
  return config.sections && config.sections.length > 0 ? config.sections : [{ key: "main", label: "" }];
}

// 回答欄を平らな一覧にする（表示・未回答判定・比較で共通利用）
export function slotsFor(type: QuestionType, config: QuestionConfig, content?: AnswerContent): AnswerSlot[] {
  if (isText(type)) return [{ key: "text", label: "" }];
  if (type === "list") {
    const n = Math.max(config.count ?? 1, content?.items?.length ?? 0);
    return Array.from({ length: n }, (_, i) => ({ key: String(i), label: circled(i) }));
  }
  if (type === "multi_field") {
    return (config.fields ?? []).map((f) => ({ key: f.key, label: f.label, hint: f.hint, singleLine: f.single_line }));
  }
  // two_category
  const cols = config.columns ?? [];
  return sectionsOf(config).flatMap((s) =>
    cols.map((c) => ({ key: `${s.key}.${c.key}`, label: c.label, group: s.label, hint: s.hint })),
  );
}

export function slotValue(type: QuestionType, content: AnswerContent | undefined, key: string): string {
  if (!content) return "";
  if (isText(type)) return content.text ?? "";
  if (type === "list") return content.items?.[Number(key)] ?? "";
  return content.values?.[key] ?? "";
}

// すべての回答欄（list は指定個数まで）が埋まっているか
export function isComplete(q: Pick<Question, "question_type" | "config">, content?: AnswerContent): boolean {
  const slots = slotsFor(q.question_type, q.config);
  return slots.every((s) => slotValue(q.question_type, content, s.key).trim() !== "");
}

export function hasAnyInput(content?: AnswerContent): boolean {
  if (!content) return false;
  if (content.text?.trim()) return true;
  if (content.items?.some((v) => v.trim())) return true;
  return Object.values(content.values ?? {}).some((v) => v.trim());
}
