export type Role = "employee" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type Chapter = {
  id: string;
  course_id: string;
  chapter_number: number;
  title: string;
  description: string;
  sort_order: number;
  is_published: boolean;
  archived_at: string | null;
};

export type QuestionType = "free_text" | "list" | "two_category" | "multi_field" | "commitment";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  free_text: "自由記述",
  list: "指定個数の複数回答",
  two_category: "2分類の記述",
  multi_field: "複数項目ごとの自由記述",
  commitment: "実行への決意",
};

export type FieldDef = { key: string; label: string; hint?: string; single_line?: boolean };

export type QuestionConfig = {
  placeholder?: string;
  // list
  count?: number;
  allow_add?: boolean;
  // two_category
  columns?: FieldDef[];
  sections?: FieldDef[];
  // multi_field
  fields?: FieldDef[];
};

export type Question = {
  id: string;
  chapter_id: string;
  sort_order: number;
  question_type: QuestionType;
  prompt: string;
  description: string;
  config: QuestionConfig;
  archived_at: string | null;
  created_at: string;
};

// 回答内容（JSON）
//  free_text / commitment: { text }
//  list:                   { items: string[] }
//  two_category / multi_field: { values: { [key]: string } }  two_category のキーは "section.column"
export type AnswerContent = {
  text?: string;
  items?: string[];
  values?: Record<string, string>;
};

export type Attempt = {
  id: string;
  user_id: string;
  chapter_id: string;
  attempt_number: number;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
};

export type ChapterStatus = "not_started" | "in_progress" | "completed";

export const STATUS_LABELS: Record<ChapterStatus, string> = {
  not_started: "未着手",
  in_progress: "途中",
  completed: "完了",
};

export type ChapterProgressRow = {
  user_id: string;
  course_id: string;
  chapter_id: string;
  status: ChapterStatus;
  completed_count: number;
  has_in_progress: boolean;
  last_completed_at: string | null;
  last_activity_at: string | null;
};
