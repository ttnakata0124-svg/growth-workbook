"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QUESTION_TYPE_LABELS, type FieldDef, type QuestionConfig, type QuestionType } from "@/lib/types";
import { saveQuestion, saveQuestions, type QuestionInput } from "../../courses/actions";
import { AnswerEditor } from "@/components/answer/answer-editor";

const newKey = (prefix: string, list: FieldDef[]) => {
  let i = list.length + 1;
  while (list.some((f) => f.key === `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
};

export const emptyQuestion = (): QuestionInput => ({ question_type: "free_text", prompt: "", description: "", config: {} });

function defaultsFor(type: QuestionType, config: QuestionConfig): QuestionConfig {
  if (type === "list") return { count: config.count ?? 3, allow_add: config.allow_add };
  if (type === "multi_field") return { fields: config.fields?.length ? config.fields : [{ key: "f1", label: "" }, { key: "f2", label: "" }] };
  if (type === "two_category")
    return {
      columns: config.columns?.length === 2 ? config.columns : [{ key: "c1", label: "満たされているもの" }, { key: "c2", label: "足りないもの" }],
      sections: config.sections ?? [],
    };
  return {};
}

// 回答欄の項目リスト（見出し＋補足）を編集する
function FieldList({ label, items, onChange, prefix, withHint, fixed }: { label: string; items: FieldDef[]; onChange: (v: FieldDef[]) => void; prefix: string; withHint?: boolean; fixed?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="space-y-2">
        {items.map((f, i) => (
          <div key={f.key} className="rounded-lg border border-line p-2">
            <div className="flex gap-2">
              <input className="field py-2" placeholder="見出し" value={f.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              {!fixed && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="削除">
                  ×
                </button>
              )}
            </div>
            {withHint && (
              <input className="field mt-2 py-2 text-sm" placeholder="補足・例（任意）" value={f.hint ?? ""} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} />
            )}
          </div>
        ))}
      </div>
      {!fixed && (
        <button type="button" className="btn btn-outline btn-sm mt-2" onClick={() => onChange([...items, { key: newKey(prefix, items), label: "" }])}>
          ＋ 追加
        </button>
      )}
    </div>
  );
}

export function QuestionForm({ value, onChange }: { value: QuestionInput; onChange: (v: QuestionInput) => void }) {
  const c = value.config;
  const uid = useId();
  const set = (patch: Partial<QuestionConfig>) => onChange({ ...value, config: { ...c, ...patch } });
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor={`${uid}-type`}>回答形式</label>
        <select
          id={`${uid}-type`}
          className="field"
          value={value.question_type}
          onChange={(e) => {
            const t = e.target.value as QuestionType;
            onChange({ ...value, question_type: t, config: defaultsFor(t, c) });
          }}
        >
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${uid}-prompt`}>設問本文</label>
        <textarea id={`${uid}-prompt`} className="field" rows={3} value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor={`${uid}-desc`}>補足説明（任意）</label>
        <textarea id={`${uid}-desc`} className="field" rows={2} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      {value.question_type === "list" && (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor={`${uid}-count`}>回答欄の数</label>
            <input id={`${uid}-count`} type="number" min={1} max={20} className="field w-24" value={c.count ?? 3} onChange={(e) => set({ count: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 pb-3 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5" checked={!!c.allow_add} onChange={(e) => set({ allow_add: e.target.checked })} />
            社員が回答欄を追加できる
          </label>
        </div>
      )}
      {value.question_type === "multi_field" && (
        <FieldList label="回答項目" prefix="f" items={c.fields ?? []} onChange={(fields) => set({ fields })} withHint />
      )}
      {value.question_type === "two_category" && (
        <>
          <FieldList label="2つの分類（見出し）" prefix="c" items={c.columns ?? []} onChange={(columns) => set({ columns })} fixed />
          <FieldList label="小問（任意。例：①心構え ②知識 ③技術）" prefix="s" items={c.sections ?? []} onChange={(sections) => set({ sections })} withHint />
        </>
      )}
      <details className="rounded-lg bg-soft p-3">
        <summary className="cursor-pointer text-sm font-bold text-muted">社員側の表示プレビュー</summary>
        <div className="mt-3">
          <p className="mb-3 font-bold">{value.prompt || "（設問本文）"}</p>
          <AnswerEditor question={{ id: "preview", question_type: value.question_type, config: defaultsFor(value.question_type, c) }} value={undefined} onChange={() => {}} />
        </div>
      </details>
    </div>
  );
}

// 1問の追加・編集
export function QuestionEditor({ chapterId, initial, onDone, submitLabel = "保存" }: { chapterId: string; initial?: QuestionInput; onDone?: () => void; submitLabel?: string }) {
  const [value, setValue] = useState<QuestionInput>(initial ?? emptyQuestion());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <QuestionForm value={value} onChange={setValue} />
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveQuestion(chapterId, value);
              if (r.error) return setError(r.error);
              setError(null);
              if (!initial) setValue(emptyQuestion());
              router.refresh();
              onDone?.();
            })
          }
        >
          {pending ? "保存中…" : submitLabel}
        </button>
        {onDone && (
          <button type="button" className="btn btn-outline" onClick={onDone}>キャンセル</button>
        )}
      </div>
    </div>
  );
}

export function EditQuestionToggle({ chapterId, question }: { chapterId: string; question: QuestionInput }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>編集</button>;
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 p-4">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-5">
        <h3 className="mb-3 font-bold text-navy">設問を編集</h3>
        <p className="mb-3 rounded-lg bg-gold-soft px-3 py-2 text-xs">編集しても、社員の過去の回答履歴は回答時点の設問のまま残ります。</p>
        <QuestionEditor chapterId={chapterId} initial={question} onDone={() => setOpen(false)} />
      </div>
    </div>
  );
}

// 写真から読み取った設問の確認・修正 → まとめて登録
export function ExtractedReview({ chapterId, initial, onClose }: { chapterId: string; initial: QuestionInput[]; onClose: () => void }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-gold-soft px-3 py-2 text-sm">
        読み取り結果は自動抽出のため誤りがある場合があります。写真と見比べて確認・修正してから登録してください。
      </p>
      {items.map((q, i) => (
        <div key={i} className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-navy">{i + 1}問目</p>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>除外</button>
          </div>
          <QuestionForm value={q} onChange={(v) => setItems(items.map((x, j) => (j === i ? v : x)))} />
        </div>
      ))}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || items.length === 0}
          onClick={() =>
            start(async () => {
              const r = await saveQuestions(chapterId, items);
              if (r.error) return setError(r.error);
              router.refresh();
              onClose();
            })
          }
        >
          {pending ? "登録中…" : `${items.length}問を登録`}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}
