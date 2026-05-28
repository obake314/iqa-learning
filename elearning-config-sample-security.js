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

export const COURSES = [securityBasic, incidentResponse, accessibility];
