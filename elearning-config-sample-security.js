// =============================================================
//  設定ファイル サンプル — IQA Learning Platform
//  このファイルを elearning-config.js にリネームして使います。
//
//  講座コンテンツは courses/{番号}_{courseId}/index.js に分離されています。
//  新しい講座を追加するには:
//    1. courses/{番号}_{courseId}/ ディレクトリを作成
//    2. course.js / lessons/{番号}_{lessonId}/{lesson,summary,questions}.js を作成
//    3. courses/{番号}_{courseId}/index.js でまとめて export default
//    4. 下記 COURSES 配列に import して追加
// =============================================================

import securityBasic from "./courses/01_security-basic/index.js";
import incidentResponse from "./courses/02_incident-response/index.js";
import accessibility from "./courses/03_accessibility/index.js";

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

export const COURSES = [securityBasic, incidentResponse, accessibility];
