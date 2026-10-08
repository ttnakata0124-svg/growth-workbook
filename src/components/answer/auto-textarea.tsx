"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

// 入力量に合わせて高さが伸びるテキストエリア（iPhone の音声入力もそのまま使える）
export function AutoTextarea({ minRows = 3, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} {...props} className={`field resize-none leading-relaxed ${props.className ?? ""}`} />;
}
