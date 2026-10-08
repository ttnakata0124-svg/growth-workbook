import { slotsFor, slotValue } from "@/lib/questions";
import type { AnswerContent, QuestionConfig, QuestionType } from "@/lib/types";

// 回答の読み取り専用表示（履歴・比較）
export function AnswerView({ type, config, content }: { type: QuestionType; config: QuestionConfig; content?: AnswerContent }) {
  const slots = slotsFor(type, config, content);
  return (
    <div className="space-y-2">
      {slots.map((s, i) => {
        const v = slotValue(type, content, s.key);
        const showGroup = s.group && s.group !== slots[i - 1]?.group;
        return (
          <div key={s.key}>
            {showGroup && <p className="mt-3 text-sm font-bold text-navy">{s.group}</p>}
            <div className={s.label ? "flex gap-2" : ""}>
              {s.label && <span className="shrink-0 text-sm font-bold text-gold">{s.label}{type === "list" ? "" : "："}</span>}
              <p className={`whitespace-pre-wrap break-words ${v ? "text-ink" : "text-sm text-gray-400"}`}>{v || "（未回答）"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
