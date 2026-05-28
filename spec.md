# E-Learning Platform Engine — 詳細仕様書

> 最終更新: 2026-05-28（初版作成・PLAN実装完了）

---

## 1. プロジェクト概要

React + Vite で構築した**フロントエンド完結型** e-Learning プラットフォームのエンジン。
バックエンド・DBは持たず、`localStorage` で全データを永続化するプロトタイプ実装。
本番化する際は認証・権限チェック・動画配信・提出データをサーバー側へ移す前提。

### 1.1 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React 19 |
| ビルドツール | Vite 7 |
| 言語 | JSX (ESModules) |
| スタイル | CSS-in-JS (テンプレートリテラル内に定義) |
| フォント | Noto Sans JP / Roboto Condensed (Google Fonts) |
| 永続化 | localStorage |

### 1.2 ファイル構成（実装後）

```
e-learning/
├── index.html                       # Vite エントリ HTML
├── main.jsx                         # React マウント
├── elearning-engine.jsx             # アプリエンジン本体
├── elearning-config.js              # アクティブな設定ファイル（gitignore 推奨）
├── elearning-config-sample-security.js  # サンプル設定（情報セキュリティ講座）
├── courses/                         # 講座コンテンツディレクトリ
│   ├── {courseId}/
│   │   ├── course.js                # 講座メタデータ
│   │   └── lessons/
│   │       └── {lessonId}/
│   │           ├── lesson.js        # レッスンメタデータ
│   │           ├── summary.js       # サマリー資料（Markdown Lite テキスト）
│   │           └── questions.js     # 練習問題配列
├── spec.md                          # 本仕様書
├── plan/                            # 開発計画メモ
├── package.json
└── dist/                            # ビルド成果物
```

---

## 2. 設定ファイル仕様

### 2.1 SITE_CONFIG

```js
export const SITE_CONFIG = {
  name: string,            // サイト名（ヘッダーロゴ）
  subtitle: string,        // サブタイトル（ログイン画面）
  passingScore: number,    // 練習問題の合格ライン（%）例: 70
  catalogVersion: string,  // カタログバージョン（変更で localStorage リセット）
  storagePrefix: string,   // localStorage キープレフィックス

  theme: {
    accent: string,              // メインアクセント色
    accent2: string,             // エラー系アクセント色
    accent3: string,             // フォーカス・リンク色
    headerLogoHighlight: string, // ヘッダーロゴ強調色
  },

  demoAccounts: [
    { label: string, role: "developer" | "admin" | "user", email: string, password: string }
  ],
};
```

### 2.2 COURSES 配列

```js
export const COURSES = [
  {
    id: string,       // 一意なコース ID
    title: string,    // 講座名
    desc: string,     // 講座説明
    category: string, // カテゴリラベル
    owner: string,    // 講座オーナー名
    lessons: [Lesson],
  }
];
```

#### Lesson オブジェクト

```js
{
  id: string,          // 一意なレッスン ID
  title: string,       // レッスン名
  desc: string,        // 説明文
  duration: string,    // 動画時間（表示用文字列）例: "10分"
  youtubeId: string,   // YouTube 動画 ID（未設定時はプレースホルダー表示）
  summary: string,     // サマリー資料テキスト（Markdown Lite 形式）
  workPrompt: string,  // ワーク設問文
  questions: [Question],
}
```

#### Question オブジェクト

```js
{
  q: string,       // 問題文
  opts: string[],  // 選択肢（4択）
  ans: number,     // 正解インデックス（0-3）
  exp: string,     // 解説文
}
```

---

## 3. データモデル（localStorage）

| キー（prefix付き） | 型 | 説明 |
|---|---|---|
| `{prefix}_users` | User[] | 全ユーザー一覧 |
| `{prefix}_current` | User \| null | ログイン中ユーザー |
| `{prefix}_progress` | ProgressMap | 学習進捗（userId → lessonKey → LessonProgress） |
| `{prefix}_submissions` | Submission[] | ワーク提出一覧 |
| `{prefix}_mentors` | Mentor[] | メンタープロフィール一覧 |
| `{prefix}_mentor_assignments` | AssignmentMap | ユーザー×講座 → メンター割り当て |
| `{prefix}_mentor_messages` | MentorMessage[] | メンターへの相談メッセージ |
| `{prefix}_catalog` | Course[] | 講座カタログ（動的編集後を保存） |
| `{prefix}_catalog_version` | string | カタログバージョン |

### 3.1 User

```ts
{
  id: string,
  name: string,
  email: string,
  password: string,         // デモ用平文（本番では使用不可）
  role: "user" | "admin" | "developer",
  createdAt: ISO8601,
}
```

### 3.2 LessonProgress

```ts
{
  videoWatched?: boolean,
  watchedAt?: ISO8601,
  quizScore?: number,
  quizPct?: number,
  lastAttemptAt?: ISO8601,
  completedAt?: ISO8601,    // 合格時のみ設定
}
```

lessonKey は `{courseId}::{lessonId}` 形式。

### 3.3 Submission（ワーク提出）

```ts
{
  id: string,
  userId: string,
  courseId: string,
  lessonId: string,
  answer: string,
  status: "submitted" | "reviewed",
  submittedAt: ISO8601,
  feedback: string,
  grade: "A" | "B" | "C" | "再提出" | "",
  reviewedAt: ISO8601 | "",
  reviewerId: string,
}
```

---

## 4. ロール・権限

| ロール | 権限 |
|---|---|
| `user` | 講座受講、ワーク提出、メンターへの相談 |
| `admin` | userの全権限 + メンターダッシュボード（進捗確認・添削・プロフィール編集・教材編集） |
| `developer` | userの全権限 + 講座開設 |

---

## 5. 画面・コンポーネント構成

### 5.1 認証フロー

```
未ログイン
├── LoginView      ← メール/パスワード、デモアカウント一括ログイン
├── RegisterView   ← 受講者アカウント作成（role: "user" 固定）
└── RemindView     ← パスワードリマインダー（デモ用平文表示）
```

### 5.2 ログイン後（App コンポーネント）

```
App (view state で切り替え)
├── dashboard  → Dashboard（講座一覧・統計カード）
├── course     → CourseOutline（レッスン一覧・ロック制御）
├── lesson     → LessonView（動画・サマリー・ワーク・練習問題）
├── admin      → AdminView（admin のみ）
│   ├── tab: progress     → ProgressAdmin
│   ├── tab: submissions  → SubmissionAdmin
│   ├── tab: mentors      → MentorAdmin
│   └── tab: materials    → MaterialAdmin
└── developer  → DeveloperView（developer のみ）
```

### 5.3 主要コンポーネント詳細

#### Dashboard
- 全体進捗 %・完了レッスン数・学習中数・添削待ち件数を stat カードで表示
- 講座一覧をグリッドで表示、各カードに進捗バー・受講ボタン

#### CourseOutline
- レッスン一覧をカード形式で表示
- **シーケンシャルロック**: 前のレッスンが未完了の場合、次のレッスンはロック状態（ボタン無効化・「ロック中」ラベル）
- 担当メンターカードを右サイドバーに表示

#### LessonView
- 動画（YouTube iframe）+ 「動画を視聴済みにする」ボタン
- サマリー資料（Markdown Lite レンダリング）
- ワーク提出フォーム
- **練習問題パネル（QuizPanel）を右サイドバーに配置**
  - **【実装予定】動画視聴済みになるまで練習問題は非表示**

#### QuizPanel
- 1問ずつ表示、選択→確認→解説→次問のステップ
- 全問終了後に正答率を計算し `LessonProgress` に保存
- `passingScore` 以上で `completedAt` が記録されレッスン完了

#### MaterialAdmin（admin）
- 講座・レッスン選択
- レッスン基本情報・YouTube ID・サマリー・ワーク設問・練習問題を編集
- `localStorage` の catalog を上書き保存

---

## 6. ビジネスロジック

### 6.1 レッスン完了条件

```
completedAt が存在する
  かつ
quizPct が undefined（練習問題なし）
  または
quizPct >= SITE_CONFIG.passingScore
```

### 6.2 シーケンシャルロック

- `CourseOutline` にてインデックス順にチェック
- `lessons[i-1]` が `isLessonCompleted` でなければ `lessons[i]` はロック

### 6.3 メンター割り当て

- 講座初回アクセス時に `ensureCourseMentor` が呼ばれ自動割り当て
- `admin` ロールユーザーが自動的にメンタープールに追加される
- メンターが複数の場合、担当数が少ない順にラウンドロビン割り当て

### 6.4 カタログバージョン管理

- `SITE_CONFIG.catalogVersion` が変わると `localStorage` の catalog を破棄しシードを再適用
- 教材編集後の変更は `localStorage` に保存されるため、バージョン変更時は上書きされる

---

## 7. Markdown Lite 仕様

`renderMarkdownLite(text)` 関数が処理する記法：

| 記法 | 出力 |
|---|---|
| `**テキスト**` | `<strong>テキスト</strong>` |
| `- テキスト` | `<li>テキスト</li>`（`<ul>` でまとめる） |
| その他の行 | `<p>テキスト</p>` |

改行で分割し、先頭が `- ` の行を箇条書き、それ以外を段落として扱う。

---

## 8. 実装済み変更（PLANファイルより）

### 8.1 動画視聴後のみ練習問題を表示 ✅

**変更ファイル**: `elearning-engine.jsx`

- `LessonView` から `QuizPanel` へ `videoWatched` prop を渡すよう変更（[elearning-engine.jsx:790](elearning-engine.jsx#L790)）
- `QuizPanel` は `videoWatched === false` の場合、練習問題の代わりに「動画を視聴完了後に解放されます」メッセージを表示（[elearning-engine.jsx:809-817](elearning-engine.jsx#L809-L817)）

**動作フロー**:
1. LessonView 初期表示 → QuizPanel に `videoWatched=false` が渡る → ロックメッセージ表示
2. 「動画を視聴済みにする」ボタン押下 → `videoWatched=true` に更新 → 練習問題が解放される

### 8.2 ディレクトリ構造による講座量産 ✅

**目的**: 講座コンテンツを個別ファイルで管理し、量産しやすくする

**実装済みディレクトリ構造**:
```
courses/
  security-basic/
    course.js
    index.js             ← lessons を組み立てて export default
    lessons/
      security-cia/
        lesson.js        ← id, title, desc, duration, youtubeId, workPrompt
        summary.js       ← サマリー文字列
        questions.js     ← 練習問題配列（5問・高難易度）
      security-password/
        lesson.js
        summary.js
        questions.js     ← 練習問題配列（5問・高難易度）
  incident-response/
    course.js
    index.js
    lessons/
      incident-first-action/
        lesson.js
        summary.js
        questions.js     ← 練習問題配列（5問・高難易度）
```

**設定ファイルの変更**: `elearning-config-sample-security.js` が各コースの `index.js` を import して COURSES 配列に渡す。

**新規講座追加手順**:
1. `courses/{courseId}/` ディレクトリを作成
2. `course.js` に講座メタデータを記述
3. `lessons/{lessonId}/` 以下に `lesson.js` / `summary.js` / `questions.js` を作成
4. `courses/{courseId}/index.js` でまとめて export
5. `elearning-config.js` に import して `COURSES` 配列へ追加

### 8.3 練習問題の難易度向上 ✅

各レッスンの `questions.js` を新規作成し、以下の方針で問題を設計:
- **問題数**: 5問/レッスン（元のサンプル: 1〜2問）
- **難易度**: 単純な用語の選択ではなく、**応用・判断力**を問う問題に統一
  - 例: 「なぜその行動が危険か」「どの手段が有効か」「複数の似た選択肢からの判別」
- **解説**: 誤答の理由も含めた詳細解説を全問に付与

---

## 9. 開発手順

```bash
# 依存インストール（初回のみ）
npm install

# 開発サーバー起動（http://127.0.0.1:5174）
npm run dev

# プロダクションビルド
npm run build
```

### 設定ファイルのセットアップ

```bash
cp elearning-config-sample-security.js elearning-config.js
# elearning-config.js を編集してカスタマイズ
```
