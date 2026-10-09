import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";

// 6桁のログインコード（PIN）。端末 Cookie と PIN の両方がそろったときだけログインできる。
// login_pins / login_devices は service role 専用（利用者からは RLS で見えない）。

export const DEVICE_COOKIE = "gw_device";
export const PIN_MAX_FAILURES = 5;
const DEVICE_MAX_AGE = 60 * 60 * 24 * 400; // ブラウザ上限の400日

export const isValidPin = (pin: string) => /^\d{6}$/.test(pin);

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type DeviceLogin = {
  deviceId: string;
  userId: string;
  fullName: string;
  pinHash: string | null;
  failedCount: number;
};

// この端末に登録されたユーザーと PIN の状態。Cookie が無い・無効なら null。
export async function findDeviceLogin(): Promise<DeviceLogin | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const { data: device } = await admin
    .from("login_devices")
    .select("id, user_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!device) return null;
  const [{ data: profile }, { data: pin }] = await Promise.all([
    admin.from("profiles").select("full_name, is_active").eq("id", device.user_id).maybeSingle(),
    admin.from("login_pins").select("pin_hash, failed_count").eq("user_id", device.user_id).maybeSingle(),
  ]);
  if (!profile?.is_active) return null;
  return {
    deviceId: device.id,
    userId: device.user_id,
    fullName: profile.full_name,
    pinHash: pin?.pin_hash ?? null,
    failedCount: pin?.failed_count ?? 0,
  };
}

// この端末を userId の端末として登録し直す（以前の登録は消す）。
export async function registerDevice(userId: string) {
  await forgetDevice();
  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("login_devices").insert({ user_id: userId, token_hash: hashToken(token) });
  if (error) return;
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  });
}

// この端末の登録を解除する。
export async function forgetDevice() {
  const store = await cookies();
  const token = store.get(DEVICE_COOKIE)?.value;
  if (!token) return;
  await createAdminClient().from("login_devices").delete().eq("token_hash", hashToken(token));
  store.delete(DEVICE_COOKIE);
}

export async function hasPin(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("login_pins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
