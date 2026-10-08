import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { QuestionConfig, QuestionType } from "./types";

// 写真からの設問読み取り（任意機能）。ANTHROPIC_API_KEY が無い場合は使わず、手入力で登録する。
export const ocrEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const ExtractedSchema = z.object({
  questions: z.array(
    z.object({
      question_type: z.enum(["free_text", "list", "two_category", "multi_field", "commitment"]),
      prompt: z.string(),
      description: z.string(),
      list_count: z.number(),
      field_labels: z.array(z.string()),
      section_labels: z.array(z.string()),
      section_hints: z.array(z.string()),
      column_labels: z.array(z.string()),
    }),
  ),
});

const PROMPT = `これは社内の営業研修ワークブックのページ写真です。ページに印刷されている「設問（ワーク）」をすべて、書かれている順に読み取ってください。
文字は写真のとおり正確に書き写し、要約・言い換え・補完をしないでください。読めない文字は「□」にしてください。
各設問の question_type は次から選びます:
- free_text: 自由記述の回答欄が1つ
- list: ①②③…のように決まった個数の回答欄が並ぶ（list_count にその個数）
- two_category: 「満たされているもの／足りないもの」のように2つに分けて書く（column_labels に2つの見出し。小問①②③があれば section_labels と、各小問の「例：…」を section_hints に同じ順で）
- multi_field: 見出しごとに回答欄が分かれる（field_labels に各見出し）
- commitment: 「実行への決意」の欄
prompt は設問本文、description は「※」で始まる注意書きなど補足（なければ空文字）。使わない項目は 0 や空配列にしてください。設問が無ければ questions を空配列にしてください。`;

export type ExtractedQuestion = {
  question_type: QuestionType;
  prompt: string;
  description: string;
  config: QuestionConfig;
};

export async function extractQuestions(image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }) {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractedSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("この写真からは設問を読み取れませんでした。手入力で登録してください。");
  }
  return response.parsed_output.questions.map((q): ExtractedQuestion => {
    const key = (prefix: string, i: number) => `${prefix}${i + 1}`;
    let config: QuestionConfig = {};
    if (q.question_type === "list") config = { count: Math.max(1, Math.min(20, Math.round(q.list_count) || 3)) };
    if (q.question_type === "multi_field")
      config = { fields: q.field_labels.map((label, i) => ({ key: key("f", i), label })) };
    if (q.question_type === "two_category") {
      const cols = q.column_labels.length === 2 ? q.column_labels : ["満たされているもの", "足りないもの"];
      config = {
        columns: cols.map((label, i) => ({ key: key("c", i), label })),
        ...(q.section_labels.length
          ? { sections: q.section_labels.map((label, i) => ({ key: key("s", i), label, ...(q.section_hints[i] ? { hint: q.section_hints[i] } : {}) })) }
          : {}),
      };
    }
    return { question_type: q.question_type, prompt: q.prompt, description: q.description, config };
  });
}
