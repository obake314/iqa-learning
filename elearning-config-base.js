// =============================================================
//  共通設定 — 本番・デモ共有
//
//  このファイルを編集すると本番・デモ両方に即時反映されます。
//  storagePrefix はそれぞれの設定ファイルで個別に設定します。
// =============================================================

export const BASE_SITE_CONFIG = {
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

  demoAccounts: [
    { label: "開発者", role: "developer", email: "dev@iqa-learning.example", password: "dev12345" },
    { label: "メンター", role: "admin", email: "mentor@iqa-learning.example", password: "mentor123" },
    { label: "受講者", role: "user", email: "learner@iqa-learning.example", password: "learner1" },
  ],
};
