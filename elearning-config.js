// =============================================================
//  本番設定ファイル — IQA Learning Platform
//
//  共通仕様は elearning-config-base.js で管理します。
//  ここを直接編集せず、共通設定は base ファイルを変更してください。
//
//  courses/ 配下のディレクトリを自動スキャンして講座を構築します。
//  新しい講座を追加するには:
//    1. courses/{番号}_{courseId}/ ディレクトリを作成
//    2. course.js / lessons/{番号}_{lessonId}/{lesson,summary,questions}.js を作成
//    3. courses/{番号}_{courseId}/index.js でまとめて export default
//    → 開発サーバーをリロードすると自動で認識されます
// =============================================================

import { BASE_SITE_CONFIG } from "./elearning-config-base.js";

const courseModules = import.meta.glob("./courses/*/index.js", { eager: true });

export const SITE_CONFIG = {
  ...BASE_SITE_CONFIG,
  storagePrefix: "iqa_learning",
};

export const COURSES = Object.entries(courseModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => mod.default);

