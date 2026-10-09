// 社員がメールアドレスなしで、6桁のログインコードだけでログインする。前提は workbook.spec.ts と同じ。
import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@example.com", password: "admin-pass-123" };

async function loginWithCode(page: Page, code: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("6桁のログインコード").fill(code);
  await page.getByRole("button", { name: "ログイン" }).click();
}

test.describe.configure({ mode: "serial" });

test("管理者がメールアドレスなしで社員を追加し、社員はコードだけでログインできる", async ({ page }) => {
  await page.goto("/login?mode=password");
  await page.getByLabel("メールアドレス").fill(ADMIN.email);
  await page.getByLabel("パスワード").fill(ADMIN.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  await page.goto("/admin/users");
  const form = page.locator("section", { hasText: "社員アカウントを追加" });
  await form.getByLabel("氏名", { exact: true }).fill("コード 四郎");
  await form.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByText("コード 四郎 さんのアカウントを作成しました")).toBeVisible();
  const code = (await page.getByTestId("login-code").textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);

  // 間違ったコードでは入れない
  const wrong = code === "000000" ? "000001" : "000000";
  await loginWithCode(page, wrong);
  await expect(page.getByText("コードが正しくありません")).toBeVisible();

  await loginWithCode(page, code);
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("コード 四郎 さん").first()).toBeVisible();

  // 社員は自分で新しいコードを発行でき、古いコードは使えなくなる
  await page.goto("/account");
  await expect(page.getByText("パスワード変更")).toHaveCount(0);
  await page.getByRole("button", { name: "新しいコードを発行" }).click();
  const newCode = (await page.getByTestId("login-code").textContent())!.trim();
  expect(newCode).toMatch(/^\d{6}$/);
  expect(newCode).not.toBe(code);

  await loginWithCode(page, code);
  await expect(page.getByText("コードが正しくありません")).toBeVisible();
  await loginWithCode(page, newCode);
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText("コード 四郎 さん").first()).toBeVisible();
});

test("コードを何度も間違えると、正しいコードでもしばらく入れない", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  for (let i = 0; i < 10; i++) {
    await page.getByLabel("6桁のログインコード").fill(String(900000 + i));
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.getByRole("button", { name: "ログイン" }).click(),
    ]);
  }
  await page.getByLabel("6桁のログインコード").fill("123456");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("しばらくコードでのログインを止めています")).toBeVisible();
});
