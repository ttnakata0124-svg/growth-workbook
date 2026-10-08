"use client";

import { circled, sectionsOf } from "@/lib/questions";
import type { AnswerContent, Question } from "@/lib/types";
import { AutoTextarea } from "./auto-textarea";

type Props = {
  question: Pick<Question, "id" | "question_type" | "config">;
  value: AnswerContent | undefined;
  onChange: (next: AnswerContent) => void;
};

export function AnswerEditor({ question, value, onChange }: Props) {
  const { question_type: type, config } = question;
  const id = (k: string) => `a-${question.id}-${k}`;

  if (type === "free_text" || type === "commitment") {
    return (
      <div>
        <label htmlFor={id("text")} className="sr-only">回答</label>
        <AutoTextarea
          id={id("text")}
          minRows={type === "commitment" ? 5 : 7}
          placeholder={config.placeholder ?? "ここに回答を入力（音声入力も使えます）"}
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
    );
  }

  if (type === "list") {
    const count = config.count ?? 1;
    const items = value?.items ?? [];
    const n = Math.max(count, items.length);
    const setItem = (i: number, v: string) => {
      const next = Array.from({ length: n }, (_, j) => items[j] ?? "");
      next[i] = v;
      onChange({ items: next });
    };
    return (
      <div className="space-y-3">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex items-start gap-2">
            <label htmlFor={id(String(i))} className="mt-3 w-6 shrink-0 text-center text-lg font-bold text-gold">{circled(i)}</label>
            <AutoTextarea id={id(String(i))} minRows={2} value={items[i] ?? ""} onChange={(e) => setItem(i, e.target.value)} />
          </div>
        ))}
        {config.allow_add && (
          <button
            type="button"
            className="btn btn-outline btn-sm ml-8"
            onClick={() => onChange({ items: [...Array.from({ length: n }, (_, j) => items[j] ?? ""), ""] })}
          >
            ＋ 回答欄を追加
          </button>
        )}
      </div>
    );
  }

  const values = value?.values ?? {};
  const setValue = (k: string, v: string) => onChange({ values: { ...values, [k]: v } });

  if (type === "multi_field") {
    return (
      <div className="space-y-5">
        {(config.fields ?? []).map((f) => (
          <div key={f.key}>
            <label htmlFor={id(f.key)} className="label">{f.label}</label>
            {f.hint && <p className="-mt-1 mb-1.5 text-xs text-muted">{f.hint}</p>}
            {f.single_line ? (
              <input id={id(f.key)} className="field" value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value)} />
            ) : (
              <AutoTextarea id={id(f.key)} minRows={3} value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // two_category
  const columns = config.columns ?? [];
  return (
    <div className="space-y-6">
      {sectionsOf(config).map((s) => (
        <fieldset key={s.key} className="space-y-3">
          {s.label && <legend className="mb-1 font-bold leading-snug text-navy">{s.label}</legend>}
          {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
          {columns.map((c) => {
            const k = `${s.key}.${c.key}`;
            return (
              <div key={k}>
                <label htmlFor={id(k)} className="label">{c.label}</label>
                <AutoTextarea id={id(k)} minRows={2} value={values[k] ?? ""} onChange={(e) => setValue(k, e.target.value)} />
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
