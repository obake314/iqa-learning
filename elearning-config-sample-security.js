// =============================================================
//  デモ設定ファイル — IQA Learning Platform
//
//  共通仕様は elearning-config-base.js で管理します（本番と常時同期）。
//  storagePrefix のみデモ専用の値にし、本番データと完全に分離します。
//
//  講座コンテンツは courses/{番号}_{courseId}/index.js に分離されています。
//  新しい講座を追加するには:
//    1. courses/{番号}_{courseId}/ ディレクトリを作成
//    2. course.js / lessons/{番号}_{lessonId}/{lesson,summary,questions}.js を作成
//    3. courses/{番号}_{courseId}/index.js でまとめて export default
//    4. 下記 COURSES 配列に import して追加
// =============================================================

import { BASE_SITE_CONFIG } from "./elearning-config-base.js";
import securityBasic from "./courses/01_security-basic/index.js";
import incidentResponse from "./courses/02_incident-response/index.js";
import accessibility from "./courses/03_accessibility/index.js";

export const SITE_CONFIG = {
  ...BASE_SITE_CONFIG,
  storagePrefix: "iqa_demo",
};

export const COURSES = [securityBasic, incidentResponse, accessibility];
