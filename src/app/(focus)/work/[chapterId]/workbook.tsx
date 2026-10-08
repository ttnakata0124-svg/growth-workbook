"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasAnyInput, isComplete } from "@/lib/questions";
import type { AnswerContent, Attempt, Chapter, Question } from "@/lib/types";
import { AnswerEditor } from "@/components/answer/answer-editor";

type SaveState = "saving" | "pending" | "saved" | "error";
type Draft = { content: AnswerContent; at: number };

const SAVE_DELAY_MS = 800;
const draftKey = (attemptId: string) => `gw:draft:${attemptId}`;
const posKey = (attemptId: string) => `gw:pos:${attemptId}`;

function readDrafts(attemptId: string): Record<string, Draft> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(attemptId)) ?? "{}");
  } catch {
    return {};
  }
}
function writeDrafts(attemptId: string, drafts: Record<string, Draft>) {
  try {
    if (Object.keys(drafts).length === 0) localStorage.removeItem(draftKey(attemptId));
    else localStorage.setItem(draftKey(attemptId), JSON.stringify(drafts));
  } catch {
    // ストレージが使えない環境でもサーバー保存は動く
  }
}

type Props = {
  course: { id: string; title: string };
  chapter: Chapter;
  attempt: Attempt;
  questions: Question[];
  initialAnswers: Record<string, { content: AnswerContent; updatedAt: string }>;
};

export function Workbook({ course, chapter, attempt, questions, initialAnswers }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const total = questions.length;

  const [answers, setAnswers] = useState<Record<string, AnswerContent>>(() =>
    Object.fromEntries(Object.entries(initialAnswers).map(([k, v]) => [k, v.content])),
  );
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // 保存処理から最新の回答を参照するための控え（update / 復元時に更新）
  const answersRef = useRef(answers);
  const saveRef = useRef<(qid: string) => Promise<boolean>>(async () => true);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Partial<Record<string, Promise<boolean>>>>({});
  const dirty = useRef<Set<string>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);

  const setState = (qid: string, s: SaveState) => setSaveStates((prev) => ({ ...prev, [qid]: s }));

  const saveNow = useCallback(
    async (qid: string): Promise<boolean> => {
      clearTimeout(timers.current[qid]);
      // 同じ設問の保存が走っていれば終わるのを待つ（順序を保証）
      if (inflight.current[qid]) await inflight.current[qid];
      if (!dirty.current.has(qid)) return true;
      dirty.current.delete(qid);
      const content = answersRef.current[qid] ?? {};
      setState(qid, "saving");
      const p = (async () => {
        const { error } = await supabase
          .from("answers")
          .upsert({ attempt_id: attempt.id, question_id: qid, content }, { onConflict: "attempt_id,question_id" });
        if (error) {
          dirty.current.add(qid);
          setState(qid, "error");
          // 通信エラー時は自動で再試行
          timers.current[qid] = setTimeout(() => void saveRef.current(qid), 4000);
          return false;
        }
        if (!dirty.current.has(qid)) {
          const drafts = readDrafts(attempt.id);
          delete drafts[qid];
          writeDrafts(attempt.id, drafts);
          setState(qid, "saved");
        }
        setLastSavedAt(new Date());
        return true;
      })();
      inflight.current[qid] = p;
      const ok = await p;
      delete inflight.current[qid];
      return ok;
    },
    [supabase, attempt.id],
  );

  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);

  const flushAll = useCallback(async () => {
    const ids = [...new Set([...dirty.current, ...Object.keys(inflight.current)])];
    const results = await Promise.all(ids.map((id) => saveNow(id)));
    return results.every(Boolean);
  }, [saveNow]);

  const update = (qid: string, content: AnswerContent) => {
    setAnswers((prev) => ({ ...prev, [qid]: content }));
    answersRef.current = { ...answersRef.current, [qid]: content };
    dirty.current.add(qid);
    // 先に端末内へ控えを保存（アプリを閉じても消えない）
    const drafts = readDrafts(attempt.id);
    drafts[qid] = { content, at: Date.now() };
    writeDrafts(attempt.id, drafts);
    setState(qid, "pending");
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => void saveNow(qid), SAVE_DELAY_MS);
  };

  // 初回表示：端末に残った未送信の控えを復元し、再開位置を決める
  useEffect(() => {
    const drafts = readDrafts(attempt.id);
    const restored: Record<string, AnswerContent> = {};
    for (const [qid, d] of Object.entries(drafts)) {
      if (!questions.some((q) => q.id === qid)) continue;
      const server = initialAnswers[qid];
      if (!server || new Date(server.updatedAt).getTime() < d.at) {
        restored[qid] = d.content;
        dirty.current.add(qid);
      }
    }
    if (Object.keys(restored).length > 0) {
      // 端末内の控え（localStorage）はマウント後にしか読めないため、ここで state に反映する
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers((prev) => ({ ...prev, ...restored }));
      answersRef.current = { ...answersRef.current, ...restored };
      void flushAll();
    }
    let start = 0;
    try {
      const saved = Number(localStorage.getItem(posKey(attempt.id)));
      if (Number.isInteger(saved) && saved >= 0 && saved <= total) start = saved;
      else throw new Error();
    } catch {
      const merged = { ...answersRef.current };
      const firstEmpty = questions.findIndex((q) => !hasAnyInput(merged[q.id]));
      start = firstEmpty === -1 ? total : firstEmpty;
    }
    setIndex(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(posKey(attempt.id), String(index));
    } catch {}
  }, [index, attempt.id]);

  // 画面を離れる・アプリを切り替える瞬間に保存
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushAll();
    };
    const onPageHide = () => void flushAll();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flushAll]);

  const go = (next: number) => {
    void flushAll();
    setIndex(Math.max(0, Math.min(total, next)));
    topRef.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };

  const states = Object.values(saveStates);
  const overall: SaveState | null = states.includes("error")
    ? "error"
    : states.includes("saving") || states.includes("pending")
      ? "saving"
      : lastSavedAt
        ? "saved"
        : null;

  const unanswered = questions.filter((q) => !isComplete(q, answers[q.id]));

  const complete = async () => {
    setCompleting(true);
    setCompleteError(null);
    const ok = await flushAll();
    if (!ok) {
      setCompleting(false);
      setCompleteError("保存できていない回答があります。通信状況を確認して、もう一度お試しください。");
      return;
    }
    const { error } = await supabase.rpc("complete_attempt", { p_attempt_id: attempt.id });
    if (error) {
      setCompleting(false);
      setCompleteError("章を完了できませんでした。もう一度お試しください。");
      return;
    }
    try {
      localStorage.removeItem(posKey(attempt.id));
      localStorage.removeItem(draftKey(attempt.id));
    } catch {}
    router.replace(`/history/${attempt.id}?done=1`);
    router.refresh();
  };

  const q = index < total ? questions[index] : null;
  const isCommitment = q?.question_type === "commitment";
  const regularNo = q ? questions.slice(0, index + 1).filter((x) => x.question_type !== "commitment").length : 0;

  return (
    <div ref={topRef} className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2.5">
          <Link href={`/courses/${course.id}`} onClick={() => void flushAll()} className="text-sm text-muted">
            ← 章一覧
          </Link>
          <SaveIndicator state={overall} at={lastSavedAt} />
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gold transition-[width]" style={{ width: `${(Math.min(index, total) / Math.max(total, 1)) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-36 pt-5">
        <p className="text-xs text-muted">{course.title}</p>
        <h1 className="text-lg font-bold leading-snug text-navy">
          第{chapter.chapter_number}章：{chapter.title}
        </h1>
        {attempt.attempt_number > 1 && (
          <p className="mt-1 inline-block rounded bg-gold-soft px-2 py-0.5 text-xs font-bold text-[#8a6a22]">
            {attempt.attempt_number}回目の取り組み
          </p>
        )}

        {total === 0 && <p className="card mt-6 p-6 text-center text-muted">この章にはまだ設問がありません。</p>}

        {q && (
          <section key={q.id} className="mt-5">
            <p className="text-sm font-bold text-muted">
              質問 {index + 1} / {total}
            </p>
            <div className={`mt-3 rounded-2xl p-5 ${isCommitment ? "border-2 border-gold bg-gold-soft/50" : "bg-soft"}`}>
              <p className={`text-xs font-bold tracking-wider ${isCommitment ? "text-[#8a6a22]" : "text-gold"}`}>
                {isCommitment ? "実行への決意" : `Q${regularNo}`}
              </p>
              <h2 className="mt-1 text-[1.15rem] font-bold leading-relaxed text-ink">{q.prompt}</h2>
              {q.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{q.description}</p>}
            </div>
            <div className="mt-5">
              <AnswerEditor question={q} value={answers[q.id]} onChange={(c) => update(q.id, c)} />
            </div>
          </section>
        )}

        {index === total && total > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-bold text-navy">回答の確認</h2>
            <p className="mt-1 text-sm text-muted">タップするとその質問に戻れます。</p>
            <ol className="mt-4 space-y-2">
              {questions.map((x, i) => {
                const done = isComplete(x, answers[x.id]);
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => go(i)} className="card flex w-full items-start gap-3 p-3 text-left">
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${done ? "bg-navy text-white" : "bg-red-50 text-red-700"}`}>
                        {done ? "回答済" : "未回答"}
                      </span>
                      <span className="line-clamp-2 text-sm">{x.question_type === "commitment" ? "【実行への決意】" : ""}{x.prompt}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {completeError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{completeError}</p>}
          </section>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <button type="button" className="btn btn-outline flex-1" onClick={() => go(index - 1)} disabled={index === 0}>
            前へ
          </button>
          {index < total ? (
            <button type="button" className="btn btn-primary flex-[2]" onClick={() => go(index + 1)}>
              {index === total - 1 ? "確認へ" : "次へ"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-gold flex-[2]"
              disabled={completing || total === 0}
              onClick={() => (unanswered.length > 0 ? setConfirming(true) : void complete())}
            >
              {completing ? "保存中…" : "この章を完了する"}
            </button>
          )}
        </div>
      </nav>

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <h2 id="confirm-title" className="text-lg font-bold text-navy">未回答の設問があります</h2>
            <p className="mt-2 text-sm">
              未回答（または一部未入力）の設問が <strong>{unanswered.length}問</strong> あります。このまま章を完了しますか？
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setConfirming(false)}>
                戻って入力する
              </button>
              <button
                type="button"
                className="btn btn-gold flex-1"
                onClick={() => {
                  setConfirming(false);
                  void complete();
                }}
              >
                完了する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state, at }: { state: SaveState | null; at: Date | null }) {
  if (!state) return <span className="text-xs text-muted">入力は自動で保存されます</span>;
  if (state === "error")
    return (
      <span role="status" className="text-xs font-bold text-red-700">
        保存できませんでした・再試行中
      </span>
    );
  if (state === "saving" || state === "pending")
    return (
      <span role="status" className="text-xs text-muted">
        保存中…
      </span>
    );
  return (
    <span role="status" className="text-xs text-navy">
      ✓ 保存済み{at ? ` ${at.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : ""}
    </span>
  );
}
