// =============================================================
//  設定ファイル — IQA Learning Platform
//
//  courses/ 配下のディレクトリを自動スキャンして講座を構築します。
//  新しい講座を追加するには:
//    1. courses/{番号}_{courseId}/ ディレクトリを作成
//    2. course.js / lessons/{番号}_{lessonId}/{lesson,summary,questions}.js を作成
//    3. courses/{番号}_{courseId}/index.js でまとめて export default
//    → 開発サーバーをリロードすると自動で認識されます
// =============================================================

const courseModules = import.meta.glob("./courses/*/index.js", { eager: true });

export const SITE_CONFIG = {
  name: "IQA Learning",
  subtitle: "IQA Learning Platform",
  passingScore: 70,
  catalogVersion: "v5",

  theme: {
    accent: "#3777ff",
    accent2: "#dd2280",
    accent3: "#111d4a",
    headerLogoHighlight: "#ffb5c2",
  },

  storagePrefix: "iqa_learning",

  demoAccounts: [
    { label: "開発者", role: "developer", email: "dev@iqa-learning.example", password: "dev12345" },
    { label: "メンター", role: "admin", email: "mentor@iqa-learning.example", password: "mentor123" },
    { label: "受講者", role: "user", email: "learner@iqa-learning.example", password: "learner1" },
  ],
};

export const COURSES = Object.entries(courseModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);
