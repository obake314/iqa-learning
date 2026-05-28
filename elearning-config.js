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
  catalogVersion: "v3",

  theme: {
    accent: "#1e40af",
    accent2: "#b91c1c",
    accent3: "#0369a1",
    headerLogoHighlight: "#38bdf8",
  },

  storagePrefix: "seclearn_platform",

  demoAccounts: [
    { label: "開発者", role: "developer", email: "dev@sec.example", password: "dev12345" },
    { label: "管理者", role: "admin", email: "admin@sec.example", password: "admin123" },
    { label: "受講者デモ", role: "user", email: "learner@sec.example", password: "learner1" },
  ],
};

export const COURSES = Object.entries(courseModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);
