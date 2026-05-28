import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const COURSES_DIR = path.join(process.cwd(), "courses");

const slugify = (text) =>
  text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-") || "item";

const nextNum = (dir) => {
  if (!fs.existsSync(dir)) return "01";
  const nums = fs.readdirSync(dir).map((d) => parseInt(d)).filter((n) => !isNaN(n));
  return String(Math.max(0, ...nums) + 1).padStart(2, "0");
};

const readBody = (req) =>
  new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => { try { resolve(JSON.parse(buf)); } catch { resolve({}); } });
  });

const writeFile = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
};

const jsStr = (v) => JSON.stringify(v ?? "");

// コースIDからディレクトリ名を検索
const findCourseDir = (courseId) => {
  if (!fs.existsSync(COURSES_DIR)) return null;
  for (const dir of fs.readdirSync(COURSES_DIR)) {
    const courseFile = path.join(COURSES_DIR, dir, "course.js");
    if (!fs.existsSync(courseFile)) continue;
    if (fs.readFileSync(courseFile, "utf8").includes(`id: ${jsStr(courseId)}`)) return dir;
  }
  return null;
};

// レッスンIDからディレクトリ名を検索
const findLessonDir = (courseDir, lessonId) => {
  const lessonsDir = path.join(COURSES_DIR, courseDir, "lessons");
  if (!fs.existsSync(lessonsDir)) return null;
  for (const dir of fs.readdirSync(lessonsDir)) {
    const lessonFile = path.join(lessonsDir, dir, "lesson.js");
    if (!fs.existsSync(lessonFile)) continue;
    if (fs.readFileSync(lessonFile, "utf8").includes(`id: ${jsStr(lessonId)}`)) return dir;
  }
  return null;
};

// index.js をレッスンディレクトリから自動再生成
const regenerateIndexJs = (courseDir) => {
  const lessonsDir = path.join(COURSES_DIR, courseDir, "lessons");
  const lessonDirs = fs.existsSync(lessonsDir)
    ? fs.readdirSync(lessonsDir)
        .filter((d) => fs.existsSync(path.join(lessonsDir, d, "lesson.js")))
        .sort()
    : [];

  const imports = lessonDirs.flatMap((dir, i) => [
    `import { lesson as lesson${i + 1} } from "./lessons/${dir}/lesson.js";`,
    `import { summary as summary${i + 1} } from "./lessons/${dir}/summary.js";`,
    `import { questions as questions${i + 1} } from "./lessons/${dir}/questions.js";`,
  ]).join("\n");

  const items = lessonDirs
    .map((_, i) => `    { ...lesson${i + 1}, summary: summary${i + 1}, questions: questions${i + 1} },`)
    .join("\n");

  writeFile(
    path.join(COURSES_DIR, courseDir, "index.js"),
    `import { course } from "./course.js";\n${imports}\n\nexport default {\n  ...course,\n  lessons: [\n${items}\n  ],\n};\n`
  );
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "course-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/courses")) return next();
          res.setHeader("Content-Type", "application/json");

          // POST /api/courses — 講座を新規作成（最初のレッスンも同時生成）
          if (req.method === "POST" && req.url === "/api/courses") {
            const body = await readBody(req);
            const { title = "新しい講座", desc = "", category = "未分類", owner = "",
                    thumbnail = "", assignedAdminId = "", allowedUserIds = [], accessMode = "open",
                    lessonTitle = "最初のレッスン", lessonDesc = "", duration = "未設定",
                    youtubeId = "", videoUrl = "", summary = "", workPrompt = "このレッスンで学んだことを提出してください。" } = body;

            const courseNum = nextNum(COURSES_DIR);
            const courseSlug = slugify(title);
            const courseId = `${courseSlug}-${Date.now()}`;
            const courseDirName = `${courseNum}_${courseSlug}`;
            const courseDir = path.join(COURSES_DIR, courseDirName);
            const lessonSlug = slugify(lessonTitle);
            const lessonId = `${lessonSlug}-${Date.now()}`;
            const lessonDirName = `01_${lessonSlug}`;
            const lessonDir = path.join(courseDir, "lessons", lessonDirName);

            writeFile(path.join(courseDir, "course.js"),
              `export const course = {\n  id: ${jsStr(courseId)},\n  title: ${jsStr(title)},\n  desc: ${jsStr(desc)},\n  category: ${jsStr(category)},\n  owner: ${jsStr(owner)},\n  thumbnail: ${jsStr(thumbnail)},\n  assignedAdminId: ${jsStr(assignedAdminId)},\n  accessMode: ${jsStr(accessMode)},\n  allowedUserIds: ${JSON.stringify(Array.isArray(allowedUserIds) ? allowedUserIds : [])},\n};\n`);
            writeFile(path.join(lessonDir, "lesson.js"),
              `export const lesson = {\n  id: ${jsStr(lessonId)},\n  title: ${jsStr(lessonTitle)},\n  desc: ${jsStr(lessonDesc)},\n  duration: ${jsStr(duration)},\n  videoUrl: ${jsStr(videoUrl || youtubeId)},\n  workPrompt: ${jsStr(workPrompt)},\n};\n`);
            writeFile(path.join(lessonDir, "summary.js"),
              `export const summary = ${jsStr(summary || "サマリーをここに記述してください。")};\n`);
            writeFile(path.join(lessonDir, "questions.js"), `export const questions = [];\n`);

            regenerateIndexJs(courseDirName);
            server.watcher.emit("change", path.join(courseDir, "index.js"));
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, courseId, lessonId, dir: courseDirName }));
            return;
          }

          // POST /api/courses/:courseId/lessons — 既存講座にレッスンを追加
          const addLessonMatch = req.url.match(/^\/api\/courses\/([^/]+)\/lessons$/);
          if (req.method === "POST" && addLessonMatch) {
            const courseId = decodeURIComponent(addLessonMatch[1]);
            const body = await readBody(req);
            const { title = "新しいレッスン", desc = "", duration = "未設定",
                    youtubeId = "", videoUrl = "", thumbnail = "", summary = "", workPrompt = "このレッスンで学んだことを提出してください。" } = body;

            const courseDirName = findCourseDir(courseId);
            if (!courseDirName) { res.writeHead(404); res.end(JSON.stringify({ error: "course not found" })); return; }

            const courseDir = path.join(COURSES_DIR, courseDirName);
            const lessonsDir = path.join(courseDir, "lessons");
            const lessonNum = nextNum(lessonsDir);
            const lessonSlug = slugify(title);
            const lessonId = `${lessonSlug}-${Date.now()}`;
            const lessonDirName = `${lessonNum}_${lessonSlug}`;
            const lessonDir = path.join(lessonsDir, lessonDirName);

            writeFile(path.join(lessonDir, "lesson.js"),
              `export const lesson = {\n  id: ${jsStr(lessonId)},\n  title: ${jsStr(title)},\n  desc: ${jsStr(desc)},\n  duration: ${jsStr(duration)},\n  videoUrl: ${jsStr(videoUrl || youtubeId)},\n  thumbnail: ${jsStr(thumbnail)},\n  workPrompt: ${jsStr(workPrompt)},\n};\n`);
            writeFile(path.join(lessonDir, "summary.js"),
              `export const summary = ${jsStr(summary || "サマリーをここに記述してください。")};\n`);
            writeFile(path.join(lessonDir, "questions.js"), `export const questions = [];\n`);

            regenerateIndexJs(courseDirName);
            server.watcher.emit("change", path.join(courseDir, "index.js"));
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, lessonId, dir: lessonDirName }));
            return;
          }

          // DELETE /api/courses/:courseId/lessons/:lessonId — レッスン削除
          const delLessonMatch = req.url.match(/^\/api\/courses\/([^/]+)\/lessons\/([^/]+)$/);
          if (req.method === "DELETE" && delLessonMatch) {
            const courseId = decodeURIComponent(delLessonMatch[1]);
            const lessonId = decodeURIComponent(delLessonMatch[2]);
            const courseDirName = findCourseDir(courseId);
            if (courseDirName) {
              const lessonDirName = findLessonDir(courseDirName, lessonId);
              if (lessonDirName) {
                fs.rmSync(path.join(COURSES_DIR, courseDirName, "lessons", lessonDirName), { recursive: true, force: true });
                regenerateIndexJs(courseDirName);
                server.watcher.emit("change", path.join(COURSES_DIR, courseDirName, "index.js"));
              }
            }
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // DELETE /api/courses/:courseId — 講座ディレクトリを削除
          const delCourseMatch = req.url.match(/^\/api\/courses\/([^/]+)$/);
          if (req.method === "DELETE" && delCourseMatch) {
            const courseId = decodeURIComponent(delCourseMatch[1]);
            const dirName = findCourseDir(courseId);
            if (dirName) {
              const targetDir = path.join(COURSES_DIR, dirName);
              fs.rmSync(targetDir, { recursive: true, force: true });
              server.watcher.emit("unlink", path.join(targetDir, "index.js"));
            }
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          res.writeHead(404);
          res.end(JSON.stringify({ error: "not found" }));
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5174 },
});
