# MY GROWTH WORKBOOK（成長ワークブック）

営業研修のワークにスマートフォンから取り組めるデジタルワークブックです。
Next.js 16 / TypeScript / Tailwind CSS / Supabase（PostgreSQL・Auth・Storage）/ Vercel / PWA。

## できること

| 社員 | 管理者 |
|---|---|
| ログイン・教材一覧・章の選択 | 全社員の学習進捗（回答本文は見えない） |
| 1問ずつ回答・入力中に自動保存・途中再開 | 社員アカウントの発行・停止・権限変更・パスワード再設定 |
| 「この章を完了する」（未回答があれば確認） | 教材・章・設問の追加・編集・並べ替え・非公開・アーカイブ |
| 回答履歴・再挑戦（履歴は消えない）・過去と最新の比較 | 教材写真のアップロード（非公開）と、写真からの設問読み取り（任意） |

## 回答のプライバシー（重要）

- 回答本文（`answers`）は **本人だけ** が読み書きできます（RLS）。管理者用のポリシーはありません。
- 管理者の進捗画面は `admin_progress()` / `chapter_progress()` という集計関数だけを使い、回答本文テーブルを参照しません。
- 回答セッションの作成・完了は関数経由のみ。完了した回答は後から変更できません。
- 社員は自分の権限を変更できません（トリガーで拒否）。公開サインアップは無効です。
- Service Role Key はサーバー側（社員アカウント管理の Server Action）でのみ使用し、ブラウザには渡しません。
- これらは `tests/security.test.mjs` で自動テストしています。

## データ構造

`courses`（教材）→ `chapters`（章）→ `questions`（設問）／ `attempts`（回答セッション）→ `answers`（回答 JSON）

- 設問形式: `free_text` 自由記述 / `list` 指定個数の複数回答 / `two_category` 2分類 / `multi_field` 複数項目ごとの自由記述 / `commitment` 実行への決意
- 回答欄の定義は `questions.config`（JSON）。回答時に設問のスナップショットを保存するため、後で設問を編集しても過去の履歴は変わりません。
- 設問・章・教材の削除はアーカイブ方式です。
- 進捗率 = 完了した章数（同じ章の複数回完了は1章）÷ 公開中の総章数 × 100（切り捨て）。章を追加すると自動で再計算されます。

---

## 本番公開の手順

### 1. Supabase プロジェクトを作成

1. https://supabase.com でプロジェクトを作成（リージョンは Tokyo 推奨）。
2. **Authentication → Sign In / Providers**：「Allow new users to sign up」を **オフ**（Email プロバイダ自体はオンのまま）。
3. **Authentication → URL Configuration**：Site URL に Vercel の本番 URL を設定。

### 2. スキーマと初期データを投入

Supabase CLI を使う場合：

```bash
supabase link --project-ref <プロジェクトID>
supabase db push            # supabase/migrations/ を適用
psql "<接続文字列>" -f supabase/seed.sql   # 初期教材（1教材・5章・28問）
```

CLI を使わない場合は、SQL Editor で `supabase/migrations/20261008000000_init.sql` → `supabase/seed.sql` の順に実行します。
`seed.sql` は何度実行しても重複しません（管理画面での編集も上書きしません）。

### 3. 初期管理者を登録

```bash
cp .env.example .env.local   # URL・anon key・service role key を記入
npm install
npm run user:create -- --email 代表者@会社 --password '初期パスワード' --name '氏名' --admin
```

または Supabase の Authentication 画面でユーザーを作成し、SQL Editor で
`update public.profiles set role = 'admin', full_name = '氏名' where email = '代表者@会社';` を実行します。
以降の社員アカウントは、アプリの「管理 → 社員」から発行できます。

### 4. Vercel に公開

1. このリポジトリを Vercel にインポート（Framework: Next.js）。
2. Environment Variables に以下を設定：
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（**NEXT_PUBLIC_ を付けない**）
   - 任意：`NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_NAME_JA`（アプリ名の変更）
   - 任意：`ANTHROPIC_API_KEY`（写真からの設問自動読み取り。未設定でも手入力で登録可能）
3. デプロイ後、スマートフォンで開き「ホーム画面に追加」するとアプリのように起動できます。

## 教材の追加（コード修正不要）

管理 → 教材 → 教材を選ぶ（または「教材を追加」）→「章を追加」→ 写真をアップロードして「設問を読み取る」または「設問を追加」で手入力 → 内容を確認 → 「社員に公開する」をオンにして保存。
新しい章・教材は作成直後は非公開なので、確認してから公開できます。

> 著作権のある教材は、社内デジタル化・社員共有の許諾を確認したうえで登録してください。教材写真は非公開バケットに保存され、ログインした社内利用者のみ閲覧できます（管理画面では期限付き URL で表示）。

---

## ローカル開発・テスト

前提: Docker と Supabase CLI。

```bash
supabase start                 # ローカル Supabase（.env.local に表示された URL/キーを記入）
npm run db:reset:local         # DB リセット + シード + テストユーザー作成
npm run dev                    # http://localhost:3000
```

テストユーザー（ローカル専用）: `admin@example.com / admin-pass-123`、`staff@example.com / staff-pass-123`

```bash
npm run build && npm start &   # E2E は起動中のアプリに対して実行
npm test                       # DB リセット → 権限テスト → スマホ表示の E2E テスト
```

初期教材の設問を変更する場合は `scripts/seed-data.json` を編集し `npm run seed:build` で `supabase/seed.sql` を再生成します。
