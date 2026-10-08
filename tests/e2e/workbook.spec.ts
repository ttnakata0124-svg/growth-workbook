// 完了条件の動作テスト（スマホ表示）。前提: ローカル Supabase をリセットし、テストユーザー作成済み、アプリ起動済み。
import { expect, test, type Page } from "@playwright/test";
import seed from "../../scripts/seed-data.json" with { type: "json" };

const STAFF = { email: "staff@example.com", password: "staff-pass-123" };
const ADMIN = { email: "admin@example.com", password: "admin-pass-123" };
const SECRET = "テスト回答_本人だけが見られる内容";
const ch = (n: number) => `00000000-0000-4000-8001-${String(n).padStart(12, "0")}`;

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(user.email);
  await page.getByLabel("パスワード").fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

// 表示中の設問の入力欄をすべて埋める
async function fillCurrent(page: Page, text: string) {
  const fields = page.locator("main textarea, main input.field");
  const n = await fields.count();
  for (let i = 0; i < n; i++) await fields.nth(i).fill(`${text}-${i + 1}`);
}

test.describe.configure({ mode: "serial" });

test("1. 管理者がログインできる", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "学習進捗" })).toBeVisible();
});

test("2-3. 一般社員がログインでき、教材一覧が表示される", async ({ page }) => {
  await login(page, STAFF);
  await expect(page.getByText("MY GROWTH WORKBOOK").first()).toBeVisible();
  await expect(page.getByText("営業 花子 さん").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: seed.course.title })).toBeVisible();
  await expect(page.getByText("進捗：0章 / 5章 完了")).toBeVisible();
  await expect(page.getByRole("link", { name: "ワークを始める" })).toBeVisible();
  // 社員は管理画面に入れない
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
});

test("4. 第1章〜第5章の全28問が正しく表示される", async ({ page }) => {
  await login(page, STAFF);
  let total = 0;
  for (const chapter of seed.chapters) {
    await page.goto(`/work/${ch(chapter.number)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`第${chapter.number}章：${chapter.title}`);
    const prompts = [...chapter.questions.map((q) => q.prompt), seed.commitment_prompt];
    const first = page.getByText(/質問 \d+ \/ \d+/);
    await expect(first).toHaveText(`質問 1 / ${prompts.length}`);
    for (let i = 0; i < prompts.length; i++) {
      await expect(page.getByText(`質問 ${i + 1} / ${prompts.length}`)).toBeVisible();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(prompts[i]);
      await page.getByRole("button", { name: i === prompts.length - 1 ? "確認へ" : "次へ" }).click();
    }
    await expect(page.getByRole("heading", { name: "回答の確認" })).toBeVisible();
    total += prompts.length;
  }
  expect(total).toBe(28);
});

test("5-7. 回答でき、自動保存され、閉じても途中から再開できる", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(`/work/${ch(3)}`);
  await page.getByRole("button", { name: "前へ" }).isDisabled();
  // 確認画面にいる場合は先頭へ
  if (await page.getByRole("heading", { name: "回答の確認" }).isVisible()) await page.getByRole("button", { name: /未回答/ }).first().click();
  await expect(page.getByText("質問 1 / 4")).toBeVisible();
  // 第3章 Q1: 4つの自信（4つの入力欄）
  await expect(page.locator("main textarea")).toHaveCount(4);
  await page.getByLabel("① 会社に対する自信").fill(SECRET);
  await expect(page.getByText(/保存済み/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "次へ" }).click();
  await page.locator("main textarea").first().fill("途中まで入力したアファメーション");
  await expect(page.getByText(/保存済み/)).toBeVisible({ timeout: 10_000 });

  // ページを閉じて開き直す
  await page.close();
  const page2 = await page.context().newPage();
  await page2.goto(`/work/${ch(3)}`);
  await expect(page2.getByText("質問 2 / 4")).toBeVisible();
  await expect(page2.locator("main textarea").first()).toHaveValue("途中まで入力したアファメーション");
  await page2.getByRole("button", { name: "前へ" }).click();
  await expect(page2.getByLabel("① 会社に対する自信")).toHaveValue(SECRET);

  // 別の端末（ローカルの控えなし）でもサーバーから復元される
  await page2.evaluate(() => localStorage.clear());
  await page2.reload();
  await expect(page2.getByLabel("① 会社に対する自信")).toHaveValue(SECRET);
});

test("8. 未回答があれば確認を出し、章を完了できる", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(`/work/${ch(1)}`);
  // Q1 だけ入力して確認画面へ
  await fillCurrent(page, "売れている人の特徴");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /次へ|確認へ/ }).click();
  await page.getByRole("button", { name: "この章を完了する" }).click();
  await expect(page.getByRole("dialog")).toContainText("未回答（または一部未入力）の設問が 4問");
  await page.getByRole("button", { name: "戻って入力する" }).click();

  // 残りを入力
  for (let i = 1; i < 5; i++) {
    await page.getByRole("button", { name: /未回答/ }).first().click();
    await fillCurrent(page, `第1章Q${i + 1}`);
    await page.getByRole("button", { name: /次へ|確認へ/ }).click();
    if (!(await page.getByRole("heading", { name: "回答の確認" }).isVisible())) {
      for (let k = 0; k < 5 && !(await page.getByRole("heading", { name: "回答の確認" }).isVisible()); k++)
        await page.getByRole("button", { name: /次へ|確認へ/ }).click();
    }
  }
  await expect(page.getByText("未回答")).toHaveCount(0);
  await page.getByRole("button", { name: "この章を完了する" }).click();
  await expect(page.getByText("第1章を完了しました")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("第1章Q5-1")).toBeVisible(); // 実行への決意の回答が履歴に出る
});

test("9. 進捗率が正しく計算される（1/5章 = 20%）", async ({ page }) => {
  await login(page, STAFF);
  await expect(page.getByText("進捗：1章 / 5章 完了")).toBeVisible();
  await expect(page.getByText("20%").first()).toBeVisible();
  await page.goto(`/courses/${seed.course.id}`);
  await expect(page.getByRole("link", { name: "過去の回答を見る" })).toBeVisible();
});

test("再挑戦すると新しい履歴になり、過去の回答と比較できる", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(`/courses/${seed.course.id}`);
  await page.getByRole("link", { name: "もう一度ワークを行う" }).click();
  await expect(page.getByText("2回目の取り組み")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await fillCurrent(page, `2回目Q${i + 1}`);
    await page.getByRole("button", { name: /次へ|確認へ/ }).click();
  }
  await page.getByRole("button", { name: "この章を完了する" }).click();
  await expect(page.getByText("第1章を完了しました")).toBeVisible({ timeout: 15_000 });
  await page.goto("/history");
  const ch1 = page.locator("li.card", { hasText: "第1章：トップセールスの条件" });
  await expect(ch1.getByRole("link", { name: /^1回目・.*完了/ })).toBeVisible();
  await expect(ch1.getByRole("link", { name: /^2回目・.*完了/ })).toBeVisible();
  await ch1.getByRole("link", { name: "過去の回答と最新の回答を比較する" }).click();
  await expect(page.getByText("第1章Q2-1").first()).toBeVisible();
  await expect(page.getByText("2回目Q2-1").first()).toBeVisible();
  // 再挑戦しても完了章数は1のまま
  await page.goto("/");
  await expect(page.getByText("進捗：1章 / 5章 完了")).toBeVisible();
});

test("管理者は進捗だけを見られ、回答本文は表示されない", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin");
  const row = page.locator("li", { hasText: "営業 花子" });
  await expect(row).toContainText("1/5章");
  await expect(row).toContainText("20%");
  await row.getByRole("link").click();
  await expect(page.getByText("回答内容はプライバシー保護のため表示されません。")).toBeVisible();
  await expect(page.locator("li", { hasText: "第1章" })).toContainText("完了");
  await expect(page.locator("li", { hasText: "第3章" })).toContainText("途中");
  const html = await page.content();
  expect(html).not.toContain(SECRET);
  expect(html).not.toContain("第1章Q2");
});

test("管理者が章と設問を追加し、公開すると進捗率が再計算される", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/admin/courses/${seed.course.id}`);
  await page.getByLabel("章タイトル").fill("目標設定");
  await page.getByRole("button", { name: "章を追加" }).click();
  await page.waitForURL(/\/admin\/chapters\//);
  await expect(page.getByLabel("章番号")).toHaveValue("6");

  // 写真アップロード
  await page.locator('input[name="files"]').setInputFiles("public/icons/icon-512.png");
  await page.getByRole("button", { name: "アップロード" }).click();
  await expect(page.getByAltText("教材写真")).toBeVisible();

  // 設問を手入力（指定個数の複数回答）
  const add = page.locator("section", { hasText: "設問を追加" }).last();
  await add.getByLabel("回答形式").selectOption("list");
  await add.getByLabel("設問本文").fill("あなたの今年の目標を3つ挙げて下さい。");
  await add.getByRole("button", { name: "設問を追加" }).click();
  await expect(page.locator("ol li", { hasText: "あなたの今年の目標を3つ挙げて下さい。" })).toBeVisible();
  await expect(add.getByLabel("設問本文")).toHaveValue("");

  await page.getByLabel("社員に公開する").check();
  await page.getByRole("button", { name: "保存" }).first().click();
  await expect(page.getByText("公開中")).toBeVisible();

  await login(page, STAFF);
  await expect(page.getByText("進捗：1章 / 6章 完了")).toBeVisible();
  await expect(page.getByText("16%").first()).toBeVisible();
  await page.goto(`/courses/${seed.course.id}`);
  await expect(page.getByText("目標設定")).toBeVisible();
});

test("管理者が社員アカウントを発行し、その社員がログインできる", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/users");
  const email = `new-${Date.now()}@example.com`;
  const form = page.locator("section", { hasText: "社員アカウントを追加" });
  await form.getByLabel("氏名", { exact: true }).fill("新人 三郎");
  await form.getByLabel("メールアドレス").fill(email);
  await form.getByLabel("初期パスワード（8文字以上）").fill("new-user-pass-1");
  await form.getByRole("button", { name: "アカウントを作成" }).click();
  await expect(page.getByText("新人 三郎 さんのアカウントを作成しました")).toBeVisible();
  await login(page, { email, password: "new-user-pass-1" });
  await expect(page.getByText("新人 三郎 さん").first()).toBeVisible();
});

test("PWA マニフェストとアイコンが配信される", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect((await request.get(m.icons[0].src)).ok()).toBeTruthy();
});
