// 6桁のログインコード（PIN）でのログイン。前提は workbook.spec.ts と同じ。
import { expect, test } from "@playwright/test";

const USER = { email: "staff2@example.com", password: "staff-pass-123" };

test.describe.configure({ mode: "serial" });

test("コードを設定した端末では6桁のコードだけでログインできる", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(USER.email);
  await page.getByLabel("パスワード").fill(USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  await page.goto("/account");
  await page.getByLabel("ログインコード（6桁の数字）").fill("123456");
  await page.getByLabel("ログインコード（確認）").fill("123456");
  await page.getByRole("button", { name: "コードを設定" }).click();
  await expect(page.getByText("ログインコードを設定しました")).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL((u) => u.pathname === "/login");
  await expect(page.getByText("営業 次郎 さん")).toBeVisible();

  // 間違ったコード
  await page.getByLabel("6桁のログインコード").fill("000000");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("コードが正しくありません")).toBeVisible();

  await page.getByLabel("6桁のログインコード").fill("123456");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("営業 次郎 さん").first()).toBeVisible();
});

test("コードを5回まちがえるとコードでは入れず、パスワードでログインすると戻る", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(USER.email);
  await page.getByLabel("パスワード").fill(USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/account");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL((u) => u.pathname === "/login");

  for (let i = 0; i < 5; i++) {
    await page.getByLabel("6桁のログインコード").fill("999999");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(i < 4 ? `あと${4 - i}回` : "コードでのログインを止めています");
  }
  await page.goto("/login");
  await expect(page.getByLabel("メールアドレス")).toBeVisible();

  await page.getByLabel("メールアドレス").fill(USER.email);
  await page.getByLabel("パスワード").fill(USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/account");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL((u) => u.pathname === "/login");
  await expect(page.getByLabel("6桁のログインコード")).toBeVisible();

  // 解除するとパスワードのログイン画面に戻る
  await page.getByLabel("6桁のログインコード").fill("123456");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/account");
  await page.getByRole("button", { name: "ログインコードを解除" }).click();
  await expect(page.getByRole("button", { name: "コードを設定" })).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL((u) => u.pathname === "/login");
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
});
