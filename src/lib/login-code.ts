import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

// 社員用の6桁ログインコード。コードだけで本人を特定してログインする。
// login_codes / login_code_attempts は service role 専用（利用者からは RLS で見えない）。

// 総当たり対策：同じ接続元は15分で10回、全体では1時間に200回まで失敗できる。
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_FAILURES = 10;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX_FAILURES = 200;

// メールアドレスなしで作った社員に付ける、ログインには使わない内部用アドレス。
export const PLACEHOLDER_EMAIL_DOMAIN = "staff.growth-workbook.invalid";
export const isPlaceholderEmail = (email: string) => email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);

const hashCode = (code: string) => createHash("sha256").update(`growth-workbook:${code}`).digest("hex");

// 重複しない新しいコードを発行して保存し、そのコードを返す（以前のコードは使えなくなる）。
export async function issueLoginCode(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { error } = await admin
      .from("login_codes")
      .upsert({ user_id: userId, code_hash: hashCode(code), created_at: new Date().toISOString() });
    if (!error) return code;
    if (error.code !== "23505") return null; // 重複以外のエラー
  }
  return null;
}

export async function hasLoginCode(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("login_codes").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function revokeLoginCode(userId: string) {
  await createAdminClient().from("login_codes").delete().eq("user_id", userId);
}

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`ip:${ip}`).digest("hex");
}

export type CodeLookup = { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" };

// コードに一致する社員を探す。失敗は記録し、多すぎる場合はしばらく受け付けない。
export async function findUserByCode(code: string): Promise<CodeLookup> {
  const admin = createAdminClient();
  const ipHash = await clientIpHash();
  const now = Date.now();
  const [{ count: ipFailures }, { count: allFailures }] = await Promise.all([
    admin
      .from("login_code_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(now - IP_WINDOW_MS).toISOString()),
    admin
      .from("login_code_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(now - GLOBAL_WINDOW_MS).toISOString()),
  ]);
  if ((ipFailures ?? 0) >= IP_MAX_FAILURES || (allFailures ?? 0) >= GLOBAL_MAX_FAILURES) {
    return { ok: false, reason: "locked" };
  }

  const { data } = await admin.from("login_codes").select("user_id").eq("code_hash", hashCode(code)).maybeSingle();
  if (data) return { ok: true, userId: data.user_id };

  await admin.from("login_code_attempts").insert({ ip_hash: ipHash });
  // 古い記録は消しておく
  await admin.from("login_code_attempts").delete().lt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  return { ok: false, reason: "invalid" };
}
