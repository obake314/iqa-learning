// =============================================================
//  E-LEARNING PLATFORM ENGINE
//  講座 / レッスン / 提出 / 添削 / 教材編集 / 講座開設を扱うデモ実装です。
//  本番化する場合は認証・権限・動画配信・提出データをサーバー側へ移してください。
// =============================================================
import React, { useEffect, useRef, useState } from "react";
import { SITE_CONFIG, COURSES } from "./elearning-config.js";

const prefix = SITE_CONFIG.storagePrefix || "elearning";
const SK = {
  users: `${prefix}_users`,
  current: `${prefix}_current`,
  progress: `${prefix}_progress`,
  submissions: `${prefix}_submissions`,
  mentors: `${prefix}_mentors`,
  mentorAssignments: `${prefix}_mentor_assignments`,
  mentorMessages: `${prefix}_mentor_messages`,
  catalog: `${prefix}_catalog`,
  catalogVersion: `${prefix}_catalog_version`,
};

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};
const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const getUsers = () => readJSON(SK.users, []);
const saveUsers = (users) => writeJSON(SK.users, users);
const getCurrentUser = () => readJSON(SK.current, null);
const setCurrentUser = (user) => writeJSON(SK.current, user);
const getProgress = () => readJSON(SK.progress, {});
const saveProgress = (progress) => writeJSON(SK.progress, progress);
const getSubmissions = () => readJSON(SK.submissions, []);
const saveSubmissions = (submissions) => writeJSON(SK.submissions, submissions);
const getMentors = () => readJSON(SK.mentors, []);
const saveMentors = (mentors) => writeJSON(SK.mentors, mentors);
const getMentorAssignments = () => readJSON(SK.mentorAssignments, {});
const saveMentorAssignments = (assignments) => writeJSON(SK.mentorAssignments, assignments);
const getMentorMessages = () => readJSON(SK.mentorMessages, []);
const saveMentorMessages = (messages) => writeJSON(SK.mentorMessages, messages);

const DEFAULT_MENTOR = {
  id: "default-mentor",
  name: "IQA メンター",
  icon: "IQA",
  intro: "学習の進め方やワークの考え方で迷ったら、いつでも相談してください。最初の一歩を一緒に整理します。",
  isDefault: true,
};

const canAdmin = (user) => user?.role === "admin";
const canDevelop = (user) => user?.role === "developer";
const canManageAccess = (user) => canAdmin(user) || canDevelop(user);
const canTakeCourse = (user, course) => {
  if (!user || !course) return false;
  if (canManageAccess(user)) return true;
  const allowed = Array.isArray(course.allowedUserIds) ? course.allowedUserIds : [];
  return allowed.length === 0 || allowed.includes(user.id);
};
const initialsFor = (name = "") => name.trim().slice(0, 2).toUpperCase() || "IQA";
const mentorProfileFromUser = (user) => ({
  id: `mentor_${user.id}`,
  userId: user.id,
  name: user.name,
  icon: initialsFor(user.name),
  intro: "担当メンターです。学習で迷ったところや、ワークの考え方を一緒に整理します。",
});

const normalizeCatalog = (items) => {
  const source = Array.isArray(items) ? items : [];
  const first = source[0];
  if (first?.lessons) return source;

  return [{
    id: "default-course",
    title: SITE_CONFIG.subtitle || SITE_CONFIG.name || "E-learning",
    desc: "設定ファイルのレッスン一覧から自動生成された講座です。",
    category: "共通",
    owner: "メンター",
    lessons: source.map((lesson, index) => ({
      ...lesson,
      id: String(lesson.id ?? `lesson-${index + 1}`),
      workPrompt: lesson.workPrompt || "このレッスンで学んだことと、実務で活用できそうな点を書いてください。",
    })),
  }];
};

const seedCatalog = normalizeCatalog(COURSES);
const currentCatalogVersion = SITE_CONFIG.catalogVersion || "default";

const getCatalog = () => {
  const stored = readJSON(SK.catalog, null);
  const storedVersion = localStorage.getItem(SK.catalogVersion);
  return Array.isArray(stored) && storedVersion === currentCatalogVersion ? stored : seedCatalog;
};
const saveCatalog = (catalog) => {
  writeJSON(SK.catalog, catalog);
  localStorage.setItem(SK.catalogVersion, currentCatalogVersion);
};

const mentorAssignmentKey = (userId, courseId) => `${userId}::${courseId}`;
const ensureMentors = () => {
  const stored = getMentors();
  const mentorUsers = getUsers().filter((user) => user.role === "admin");
  const mentors = mentorUsers.map((user) => {
    const existing = stored.find((mentor) => mentor.userId === user.id);
    return existing || mentorProfileFromUser(user);
  });
  const normalized = mentors.length ? mentors : [DEFAULT_MENTOR];
  saveMentors(normalized);
  return normalized;
};
const selectMentor = () => {
  const mentors = ensureMentors();
  const assignments = getMentorAssignments();
  const counts = mentors.reduce((acc, mentor) => ({ ...acc, [mentor.id]: 0 }), {});
  Object.values(assignments).forEach((assignment) => {
    if (counts[assignment.mentorId] !== undefined) counts[assignment.mentorId] += 1;
  });
  return mentors
    .slice()
    .sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))[0] || DEFAULT_MENTOR;
};
const isCoursePrimaryAdmin = (user, course) => canAdmin(user) && !!course?.assignedAdminId && course.assignedAdminId === user.id;

const ensureCourseMentor = (userId, courseId) => {
  const key = mentorAssignmentKey(userId, courseId);
  const assignments = getMentorAssignments();
  if (assignments[key]) return assignments[key];
  // デフォルト: 講座の assignedAdminId のメンタープロファイル、なければラウンドロビン
  const catalog = getCatalog();
  const course = catalog.find((c) => c.id === courseId);
  const mentors = ensureMentors();
  let defaultMentor = course?.assignedAdminId
    ? mentors.find((m) => m.userId === course.assignedAdminId)
    : null;
  if (!defaultMentor) defaultMentor = selectMentor();
  const assignment = { mentorId: defaultMentor?.id || DEFAULT_MENTOR.id, assignedAt: new Date().toISOString() };
  saveMentorAssignments({ ...assignments, [key]: assignment });
  return assignment;
};
const getAssignedMentor = (userId, courseId) => {
  const assignment = ensureCourseMentor(userId, courseId);
  const mentor = ensureMentors().find((mentor) => mentor.id === assignment.mentorId);
  if (mentor) return mentor;
  const key = mentorAssignmentKey(userId, courseId);
  const assignments = getMentorAssignments();
  delete assignments[key];
  saveMentorAssignments(assignments);
  const nextAssignment = ensureCourseMentor(userId, courseId);
  return ensureMentors().find((nextMentor) => nextMentor.id === nextAssignment.mentorId) || DEFAULT_MENTOR;
};

const initAccounts = () => {
  let users = getUsers();
  for (const demo of SITE_CONFIG.demoAccounts || []) {
    if (!users.find((u) => u.email === demo.email)) {
      users = [...users, {
        id: `demo_${demo.email}`,
        name: demo.label,
        email: demo.email,
        password: demo.password,
        role: demo.role,
        createdAt: new Date().toISOString(),
      }];
    }
  }
  saveUsers(users);
  if (!readJSON(SK.catalog, null) || localStorage.getItem(SK.catalogVersion) !== currentCatalogVersion) {
    saveCatalog(seedCatalog);
  }
  ensureMentors();
};

const lessonKey = (courseId, lessonId) => `${courseId}::${lessonId}`;
const getLessonProgress = (progress, userId, courseId, lessonId) =>
  progress[userId]?.[lessonKey(courseId, lessonId)] || {};
const isLessonCompleted = (lessonProgress = {}) =>
  !!lessonProgress.completedAt &&
  (lessonProgress.quizPct === undefined || lessonProgress.quizPct >= SITE_CONFIG.passingScore);
const hasLessonActivity = (lessonProgress = {}, submission) =>
  !!lessonProgress.videoWatched ||
  lessonProgress.quizPct !== undefined ||
  !!lessonProgress.completedAt ||
  !!lessonProgress.watchedAt ||
  !!lessonProgress.lastAttemptAt ||
  !!submission;
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : "-";
const lessonStatus = (lessonProgress = {}) => {
  if (isLessonCompleted(lessonProgress)) return "完了";
  if (lessonProgress.quizPct !== undefined) return "不合格";
  if (lessonProgress.videoWatched) return "動画視聴済み";
  return "未開始";
};
const upsertLessonProgress = (userId, courseId, lessonId, patch) => {
  const progress = getProgress();
  const key = lessonKey(courseId, lessonId);
  progress[userId] = progress[userId] || {};
  progress[userId][key] = { ...(progress[userId][key] || {}), ...patch };
  saveProgress(progress);
  return progress[userId][key];
};

const flattenLessons = (catalog) =>
  catalog.flatMap((course) => course.lessons.map((lesson) => ({ course, lesson })));

// カタログ操作ヘルパー
const normalizeQs = (qs = []) => qs.map((q) => ({
  q: q.q || "", opts: [...(q.opts || []), "", "", "", ""].slice(0, 4),
  ans: Number.isInteger(q.ans) ? q.ans : 0, exp: q.exp || "",
}));
const catalogUpdateLesson = (catalog, courseId, lessonId, patch) =>
  catalog.map((c) => c.id !== courseId ? c : {
    ...c, lessons: c.lessons.map((l) => l.id !== lessonId ? l : { ...l, ...patch }),
  });
const catalogAddLesson = (catalog, courseId, lesson) =>
  catalog.map((c) => c.id !== courseId ? c : { ...c, lessons: [...c.lessons, lesson] });
const catalogRemoveLesson = (catalog, courseId, lessonId) =>
  catalog.map((c) => c.id !== courseId ? c : { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) });
const catalogUpdateCourse = (catalog, courseId, patch) =>
  catalog.map((c) => c.id !== courseId ? c : { ...c, ...patch });
const catalogRemoveCourse = (catalog, courseId) =>
  catalog.filter((c) => c.id !== courseId);

const fileOpAndReload = async (url, method, body, setCatalog, patch) => {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("API error");
  if (patch) { const next = patch(); saveCatalog(next); }
  else { localStorage.removeItem(SK.catalog); localStorage.removeItem(SK.catalogVersion); }
  setTimeout(() => window.location.reload(), 600);
  return res.json();
};

const calcStats = (catalog, progress, userId) => {
  const lessons = flattenLessons(catalog);
  const total = lessons.length || 1;
  const done = lessons.filter(({ course, lesson }) =>
    isLessonCompleted(getLessonProgress(progress, userId, course.id, lesson.id))
  ).length;
  const watching = lessons.filter(({ course, lesson }) => {
    const p = getLessonProgress(progress, userId, course.id, lesson.id);
    return p.videoWatched && !isLessonCompleted(p);
  }).length;
  return { total, done, watching, pct: Math.round((done / total) * 100) };
};

const renderMarkdownLite = (text = "") => {
  const lines = text.split("\n").filter((line) => line.trim());
  const parse = (raw, key) => raw.replace(/^- /, "").split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : part
  );
  const paragraphs = lines.filter((line) => !line.startsWith("- "));
  const items = lines.filter((line) => line.startsWith("- "));
  return (
    <div className="rich-text">
      {paragraphs.map((line, i) => <p key={`p-${i}`}>{parse(line, i)}</p>)}
      {items.length > 0 && <ul>{items.map((line, i) => <li key={`li-${i}`}>{parse(line, i)}</li>)}</ul>}
    </div>
  );
};

const thumbnailTone = (seed = "") =>
  `tone-${Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6}`;

function ThumbnailArt({ src, title, label, variant = "course" }) {
  return (
    <div className={`thumbnail-art ${variant} ${thumbnailTone(title)}`}>
      {src ? (
        <img src={src} alt="" />
      ) : (
        <>
          <span className="thumbnail-kicker">{label}</span>
          <span className="thumbnail-title">{title}</span>
        </>
      )}
    </div>
  );
}

function Alert({ type, children }) {
  return <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>{children}</div>;
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span style={{ background: "#ef4444", color: "white", borderRadius: "999px", padding: "1px 7px", fontSize: "11px", fontWeight: 700, marginLeft: 5 }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function LoginView({ onLogin, onGoto }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tryLogin = (event, overrideEmail, overridePassword) => {
    event?.preventDefault();
    setError("");
    const found = getUsers().find((user) =>
      user.email === (overrideEmail || email) && user.password === (overridePassword || password)
    );
    if (!found) {
      setError("メールアドレスまたはパスワードが正しくありません");
      return;
    }
    setCurrentUser(found);
    onLogin(found);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">{SITE_CONFIG.name}</h1>
        <p className="auth-sub">{SITE_CONFIG.subtitle}</p>
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={tryLogin} noValidate>
          <Field id="login-email" label="メールアドレス" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field id="login-password" label="パスワード" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          <button className="btn-primary" type="submit">ログイン</button>
        </form>
        <div className="auth-link">
          <button className="link-btn" onClick={() => onGoto("register")}>アカウント登録</button>
          {" · "}
          <button className="link-btn" onClick={() => onGoto("remind")}>パスワードを忘れた方</button>
        </div>
        {(SITE_CONFIG.demoAccounts || []).length > 0 && (
          <div className="demo-section">
            <p className="demo-label">Demo accounts</p>
            <div className="demo-btns">
              {SITE_CONFIG.demoAccounts.map((account) => (
                <button key={account.email} className="demo-btn" onClick={() => tryLogin(null, account.email, account.password)}>
                  <strong>{account.label}</strong>
                  <span>{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterView({ onGoto }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "名前を入力してください";
    if (!form.email.includes("@")) nextErrors.email = "有効なメールアドレスを入力してください";
    if (form.password.length < 8) nextErrors.password = "8文字以上のパスワードが必要です";
    if (form.password !== form.confirm) nextErrors.confirm = "パスワードが一致しません";
    if (getUsers().some((user) => user.email === form.email)) nextErrors.email = "このメールアドレスは既に登録されています";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveUsers([...getUsers(), {
      id: Date.now().toString(),
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: "user",
      createdAt: new Date().toISOString(),
    }]);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-title">登録完了</h1>
          <Alert type="success">アカウントを作成しました。ログインしてください。</Alert>
          <button className="btn-primary" onClick={() => onGoto("login")}>ログイン画面へ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">アカウント登録</h1>
        <p className="auth-sub">受講者アカウントを作成します</p>
        <form onSubmit={submit} noValidate>
          <Field id="reg-name" label="お名前" value={form.name} onChange={(v) => update("name", v)} error={errors.name} autoComplete="name" />
          <Field id="reg-email" label="メールアドレス" type="email" value={form.email} onChange={(v) => update("email", v)} error={errors.email} autoComplete="email" />
          <Field id="reg-password" label="パスワード（8文字以上）" type="password" value={form.password} onChange={(v) => update("password", v)} error={errors.password} autoComplete="new-password" />
          <Field id="reg-confirm" label="パスワード（確認）" type="password" value={form.confirm} onChange={(v) => update("confirm", v)} error={errors.confirm} autoComplete="new-password" />
          <button className="btn-primary" type="submit">登録する</button>
        </form>
        <div className="auth-link"><button className="link-btn" onClick={() => onGoto("login")}>ログイン画面に戻る</button></div>
      </div>
    </div>
  );
}

function RemindView({ onGoto }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const submit = (event) => {
    event.preventDefault();
    const found = getUsers().find((user) => user.email === email);
    setResult(found
      ? { type: "success", message: `${email} のパスワード: ${found.password}（デモのため平文表示）` }
      : { type: "error", message: "このメールアドレスは登録されていません" }
    );
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">パスワードリマインダー</h1>
        <p className="auth-sub">登録済みのメールアドレスを入力してください</p>
        {result && <Alert type={result.type}>{result.message}</Alert>}
        <form onSubmit={submit} noValidate>
          <Field id="remind-email" label="メールアドレス" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <button className="btn-primary" type="submit">送信する</button>
        </form>
        <div className="auth-link"><button className="link-btn" onClick={() => onGoto("login")}>ログイン画面に戻る</button></div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", error, required = true, autoComplete }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span className="req" aria-label="必須">*</span>}
      </label>
      <input
        id={id}
        className="form-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete={autoComplete}
      />
      {error && <p className="form-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

function ThumbnailField({ id, value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>サムネイル画像</label>
      <input id={id} type="file" accept="image/*" className="form-input" style={{ padding: "8px 12px" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = (ev) => onChange(ev.target.result);
          r.readAsDataURL(f);
        }}
      />
      {value && <img src={value} alt="" className="thumbnail-preview" />}
    </div>
  );
}

function QuestionEditorSection({ questions, setQuestions }) {
  const update = (qi, patch) => setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, ...patch } : q));
  const updateOpt = (qi, oi, val) => setQuestions((prev) => prev.map((q, i) => {
    if (i !== qi) return q;
    return { ...q, opts: q.opts.map((o, j) => j === oi ? val : o) };
  }));
  return (
    <section className="stack" aria-label="練習問題編集">
      <div className="toolbar">
        <h3 className="section-heading" style={{ margin: 0 }}>練習問題</h3>
        <button type="button" className="btn-secondary" onClick={() => setQuestions((p) => [...p, { q: "", opts: ["", "", "", ""], ans: 0, exp: "" }])}>
          ＋ 問題を追加
        </button>
      </div>
      {questions.map((q, qi) => (
        <div className="question-editor" key={qi}>
          <div className="toolbar">
            <h4 style={{ margin: 0 }}>問題 {qi + 1}</h4>
            <button type="button" className="btn-danger" onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))}>削除</button>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`q-${qi}`}>問題文</label>
            <textarea id={`q-${qi}`} className="form-input" value={q.q} onChange={(e) => update(qi, { q: e.target.value })} />
          </div>
          <div className="two-col">
            {q.opts.map((o, oi) => (
              <div className="form-group" key={oi}>
                <label className="form-label" htmlFor={`q-${qi}-o-${oi}`}>選択肢 {oi + 1}</label>
                <input id={`q-${qi}-o-${oi}`} className="form-input" value={o} onChange={(e) => updateOpt(qi, oi, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`q-${qi}-ans`}>正解</label>
            <select id={`q-${qi}-ans`} className="form-input" value={q.ans} onChange={(e) => update(qi, { ans: Number(e.target.value) })}>
              {q.opts.map((_, oi) => <option key={oi} value={oi}>選択肢 {oi + 1}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`q-${qi}-exp`}>解説</label>
            <textarea id={`q-${qi}-exp`} className="form-input" value={q.exp} onChange={(e) => update(qi, { exp: e.target.value })} />
          </div>
        </div>
      ))}
    </section>
  );
}

function LessonEditorPanel({ lesson, courseId, catalog, setCatalog, onDone, isNew = false }) {
  const [draft, setDraft] = useState({
    title: lesson?.title || "", desc: lesson?.desc || "", duration: lesson?.duration || "",
    videoUrl: lesson?.videoUrl || lesson?.youtubeId || "", thumbnail: lesson?.thumbnail || "",
    summary: lesson?.summary || "", workPrompt: lesson?.workPrompt || "",
  });
  const [questions, setQuestions] = useState(normalizeQs(lesson?.questions || []));
  const [error, setError] = useState("");
  const d = (k) => (v) => setDraft((p) => ({ ...p, [k]: v }));

  const save = () => {
    const cleanedQs = questions.map((q) => ({
      q: q.q.trim(), opts: q.opts.map((o) => o.trim()), ans: Number(q.ans), exp: q.exp.trim(),
    }));
    if (cleanedQs.length > 0 && cleanedQs.some((q) => !q.q || q.opts.some((o) => !o) || !q.exp)) {
      setError("練習問題は問題文・選択肢・解説すべて入力してください"); return;
    }
    const lessonData = { ...draft, questions: cleanedQs };
    let next;
    if (isNew) {
      const newLesson = { id: `lesson-${Date.now()}`, ...lessonData };
      next = catalogAddLesson(catalog, courseId, newLesson);
    } else {
      next = catalogUpdateLesson(catalog, courseId, lesson.id, lessonData);
    }
    saveCatalog(next); setCatalog(next); setError(""); onDone();
  };

  return (
    <div className="stack">
      {error && <Alert type="error">{error}</Alert>}
      <Field id="le-title" label="レッスン名" value={draft.title} onChange={d("title")} />
      <Field id="le-desc" label="説明" value={draft.desc} onChange={d("desc")} required={false} />
      <div className="two-col">
        <Field id="le-dur" label="動画時間" value={draft.duration} onChange={d("duration")} required={false} />
        <Field id="le-video" label="動画URL" value={draft.videoUrl} onChange={d("videoUrl")} required={false} />
      </div>
      <ThumbnailField id="le-thumb" value={draft.thumbnail} onChange={d("thumbnail")} />
      <div className="form-group">
        <label className="form-label">サマリー資料</label>
        <textarea className="form-input" value={draft.summary} onChange={(e) => setDraft((p) => ({ ...p, summary: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">ワーク設問</label>
        <textarea className="form-input" value={draft.workPrompt} onChange={(e) => setDraft((p) => ({ ...p, workPrompt: e.target.value }))} />
      </div>
      <QuestionEditorSection questions={questions} setQuestions={setQuestions} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-small" type="button" onClick={save}>{isNew ? "レッスンを追加" : "保存する"}</button>
        <button className="btn-secondary" type="button" onClick={onDone}>キャンセル</button>
      </div>
    </div>
  );
}

function CourseEditorPanel({ course, catalog, setCatalog, onDone, isNew = false }) {
  const adminUsers = getUsers().filter((u) => u.role === "admin");
  const [draft, setDraft] = useState({
    title: course?.title || "", desc: course?.desc || "",
    category: course?.category || "", owner: course?.owner || "",
    thumbnail: course?.thumbnail || "", assignedAdminId: course?.assignedAdminId || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const d = (k) => (v) => setDraft((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!draft.title.trim()) { setError("講座名を入力してください"); return; }
    if (isNew) {
      setLoading(true);
      try {
        const res = await fetch("/api/courses", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, lessonTitle: "最初のレッスン" }),
        });
        if (!res.ok) throw new Error();
        localStorage.removeItem(SK.catalog); localStorage.removeItem(SK.catalogVersion);
        setTimeout(() => window.location.reload(), 600);
      } catch { setError("作成に失敗しました。開発サーバーが起動しているか確認してください。"); setLoading(false); }
    } else {
      const next = catalogUpdateCourse(catalog, course.id, draft);
      saveCatalog(next); setCatalog(next); onDone();
    }
  };

  return (
    <div className="stack">
      {error && <Alert type="error">{error}</Alert>}
      <Field id="ce-title" label="講座名" value={draft.title} onChange={d("title")} />
      <Field id="ce-desc" label="説明" value={draft.desc} onChange={d("desc")} required={false} />
      <div className="two-col">
        <Field id="ce-cat" label="カテゴリ" value={draft.category} onChange={d("category")} required={false} />
        <Field id="ce-owner" label="オーナー" value={draft.owner} onChange={d("owner")} required={false} />
      </div>
      <ThumbnailField id="ce-thumb" value={draft.thumbnail} onChange={d("thumbnail")} />
      <div className="form-group">
        <label className="form-label" htmlFor="ce-admin">担当管理者</label>
        <select id="ce-admin" className="form-input" value={draft.assignedAdminId} onChange={(e) => setDraft((p) => ({ ...p, assignedAdminId: e.target.value }))}>
          <option value="">未設定</option>
          {adminUsers.map((u) => <option key={u.id} value={u.id}>{u.name}（{u.email}）</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-small" type="button" disabled={loading} onClick={save}>
          {loading ? "作成中…" : isNew ? "講座を作成" : "保存する"}
        </button>
        {!isNew && <button className="btn-secondary" type="button" onClick={onDone}>キャンセル</button>}
      </div>
    </div>
  );
}

function Dashboard({ user, catalog, submissions, onSelect }) {
  const progress = getProgress();
  const stats = calcStats(catalog, progress, user.id);
  const pendingWork = submissions.filter((item) => item.userId === user.id && item.status === "submitted").length;

  return (
    <div className="page">
      <h1 className="page-title">こんにちは、{user.name}さん</h1>
      <p className="page-sub">受講したい講座を選び、動画・サマリー・練習問題・ワークを進めましょう</p>
      <div className="stats-row" aria-label="学習状況">
        <Stat accent value={`${stats.pct}%`} label="全体の進捗" />
        <Stat value={stats.done} label="完了レッスン" />
        <Stat value={stats.watching} label="学習中" />
        <Stat value={pendingWork} label="添削待ちワーク" />
      </div>
      <ul className="course-grid">
        {catalog.map((course) => {
          const courseLessons = course.lessons || [];
          const done = courseLessons.filter((lesson) => isLessonCompleted(getLessonProgress(progress, user.id, course.id, lesson.id))).length;
          const pct = Math.round((done / Math.max(courseLessons.length, 1)) * 100);
          return (
            <li className="course-card" key={course.id}>
              <ThumbnailArt src={course.thumbnail} title={course.title} label={course.category || "Course"} />
              <div className="course-head">
                <div className="course-meta">
                  <span className="pill">{course.category || "講座"}</span>
                  <span className="pill">{courseLessons.length}レッスン</span>
                </div>
                <h2 className="course-title">{course.title}</h2>
                <p className="course-desc">{course.desc}</p>
              </div>
              <div className="course-body">
                <div>
                  <div className="progress-wrap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="course-desc">{done}/{courseLessons.length} レッスン完了</p>
                </div>
                <button className="btn-secondary" onClick={() => onSelect(course)}>講座を開く</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ value, label, accent = false }) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function MentorIcon({ mentor }) {
  const icon = mentor?.icon || DEFAULT_MENTOR.icon;
  const isImage = /^(https?:\/\/|data:image\/)/.test(icon);
  return (
    <div className="mentor-avatar" aria-hidden="true">
      {isImage ? <img src={icon} alt="" /> : icon.slice(0, 3)}
    </div>
  );
}

function MentorCard({ user, course, mentor }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setStatus("相談内容を入力してください");
      return;
    }
    saveMentorMessages([{
      id: Date.now().toString(),
      userId: user.id,
      courseId: course.id,
      mentorId: mentor.id,
      body: message.trim(),
      createdAt: new Date().toISOString(),
      status: "open",
    }, ...getMentorMessages()]);
    setMessage("");
    setStatus("相談内容をメンターに送信しました");
  };

  return (
    <aside className="panel mentor-card" aria-labelledby="mentor-heading">
      <div>
        <p className="work-status">担当メンター</p>
        <div className="mentor-profile">
          <MentorIcon mentor={mentor} />
          <div>
            <h2 id="mentor-heading" className="mentor-name">{mentor.name}</h2>
            <p className="mentor-intro">{mentor.intro}</p>
          </div>
        </div>
      </div>
      <form onSubmit={submit}>
        <label className="form-label" htmlFor={`mentor-message-${course.id}`}>
          相談・質問する
        </label>
        <textarea
          id={`mentor-message-${course.id}`}
          className="form-input mentor-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="例: Lesson 2の見出し階層の考え方で迷っています"
        />
        {status && <p className="work-status" role="status">{status}</p>}
        <button className="btn-small" type="submit">メンターに相談する</button>
      </form>
    </aside>
  );
}

function CourseOutline({ user, course, submissions, onBack, onLesson, onDashboard }) {
  const progress = getProgress();
  const mentor = getAssignedMentor(user.id, course.id);
  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <button className="link-btn" onClick={onBack}>講座一覧</button>
        <span>/</span>
        <span>{course.title}</span>
      </nav>
      <div className="toolbar">
        <div>
          <h1 className="page-title">{course.title}</h1>
          <p className="page-sub">{course.desc}</p>
        </div>
        <button className="btn-secondary" onClick={onDashboard}>ダッシュボードに戻る</button>
      </div>
      <div className="outline-layout">
        <div className="lesson-list">
          {course.lessons.map((lesson, index) => {
            const lp = getLessonProgress(progress, user.id, course.id, lesson.id);
            const previousLesson = index > 0 ? course.lessons[index - 1] : null;
            const previousProgress = previousLesson
              ? getLessonProgress(progress, user.id, course.id, previousLesson.id)
              : null;
            const isLocked = !!previousLesson && !isLessonCompleted(previousProgress);
            const work = submissions.find((item) => item.userId === user.id && item.lessonId === lesson.id && item.courseId === course.id);
            const isDone = isLessonCompleted(lp);
            const status = isDone ? "完了" : lp.videoWatched ? "学習中" : "未開始";
            return (
              <article className="lesson-card" key={lesson.id}>
                <div className="lesson-content">
                  <div className="course-meta">
                    <span className="pill">Lesson {index + 1}</span>
                    <span className={`pill ${isLocked ? "" : isDone ? "done" : lp.videoWatched ? "progress" : ""}`}>
                      {isLocked ? "ロック中" : status}
                    </span>
                    {work && <span className={`pill ${work.status === "reviewed" ? "done" : "pending"}`}>{work.status === "reviewed" ? "添削済み" : "添削待ち"}</span>}
                  </div>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.desc}</p>
                  <div className="lesson-actions">
                    <span className="pill">{lesson.duration}</span>
                    <button className="btn-small" disabled={isLocked} onClick={() => onLesson(lesson)}>
                      {isLocked ? "前のレッスン完了後に受講可能" : lp.videoWatched ? "続きを学ぶ" : "受講する"}
                    </button>
                  </div>
                </div>
                <ThumbnailArt src={lesson.thumbnail} title={lesson.title} label={`Lesson ${index + 1}`} variant="lesson" />
              </article>
            );
          })}
        </div>
        <MentorCard user={user} course={course} mentor={mentor} />
      </div>
    </div>
  );
}

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

const youtubeEmbedFromUrl = (value = "") => {
  const raw = value.trim();
  if (!raw) return "";
  const idOnly = /^[\w-]{11}$/.test(raw) ? raw : "";
  if (idOnly) return `https://www.youtube-nocookie.com/embed/${idOnly}?rel=0&modestbranding=1`;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}?rel=0&modestbranding=1`;
    if (host.endsWith("youtube.com")) {
      const videoId = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1` : "";
    }
  } catch {
    return "";
  }
  return "";
};

const getLessonVideo = (lesson) => {
  const raw = (lesson.videoUrl || lesson.youtubeId || "").trim();
  if (!raw) return { type: "empty" };
  const youtubeSrc = youtubeEmbedFromUrl(raw);
  if (youtubeSrc) return { type: "iframe", src: youtubeSrc };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(raw)) return { type: "video", src: raw };
  return { type: "iframe", src: raw };
};

function LessonView({ user, course, lesson, submissions, refreshSubmissions, onBack, onDashboard }) {
  const [videoWatched, setVideoWatched] = useState(
    !!getLessonProgress(getProgress(), user.id, course.id, lesson.id).videoWatched
  );
  const [workText, setWorkText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);
  const existing = submissions.find((item) => item.userId === user.id && item.courseId === course.id && item.lessonId === lesson.id);
  const lessonVideo = getLessonVideo(lesson);

  const markWatched = () => {
    upsertLessonProgress(user.id, course.id, lesson.id, { videoWatched: true, watchedAt: new Date().toISOString() });
    setVideoWatched(true);
  };

  const submitWork = async (event) => {
    event.preventDefault();
    if (!workText.trim() && !attachmentFile && !attachmentUrl.trim()) {
      setMessage("テキスト・ファイル・URLのいずれかを入力してください");
      return;
    }

    let fileData = null;
    if (attachmentFile) {
      if (attachmentFile.size > FILE_SIZE_LIMIT) {
        setMessage("ファイルサイズは5MB以下にしてください（大きいファイルはストレージURLをご利用ください）");
        return;
      }
      fileData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ name: attachmentFile.name, type: attachmentFile.type, data: e.target.result });
        reader.readAsDataURL(attachmentFile);
      });
    }

    const next = getSubmissions().filter((item) =>
      !(item.userId === user.id && item.courseId === course.id && item.lessonId === lesson.id)
    );
    next.unshift({
      id: Date.now().toString(),
      userId: user.id,
      courseId: course.id,
      lessonId: lesson.id,
      answer: workText.trim(),
      attachmentFile: fileData,
      attachmentUrl: attachmentUrl.trim(),
      status: "submitted",
      submittedAt: new Date().toISOString(),
      feedback: "",
      grade: "",
      reviewedAt: "",
      reviewerId: "",
    });
    saveSubmissions(next);
    refreshSubmissions();
    setWorkText("");
    setAttachmentUrl("");
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("ワークを提出しました");
  };

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="パンくずリスト">
        <button className="link-btn" onClick={onBack}>{course.title}</button>
        <span>/</span>
        <span>{lesson.title}</span>
      </nav>
      <div className="toolbar">
        <div>
          <h1 className="page-title">{lesson.title}</h1>
          <p className="page-sub">{lesson.desc}</p>
        </div>
        <button className="btn-secondary" onClick={onDashboard}>ダッシュボードに戻る</button>
      </div>
      <div className="course-layout">
        <main>
          <section aria-labelledby="video-heading">
            <h2 id="video-heading" className="page-sub" style={{ marginBottom: 10 }}>動画解説</h2>
            <div className="video-frame">
              {lessonVideo.type === "iframe" ? (
                <iframe
                  title={`${lesson.title}の動画`}
                  src={lessonVideo.src}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : lessonVideo.type === "video" ? (
                <video src={lessonVideo.src} controls />
              ) : (
                <div className="video-empty">動画URLが未設定です</div>
              )}
            </div>
            {videoWatched ? (
              <p className="work-status">視聴済み</p>
            ) : (
              <button className="btn-secondary" onClick={markWatched}>動画を視聴済みにする</button>
            )}
          </section>
          <section className="panel" aria-labelledby="summary-heading" style={{ marginTop: 18 }}>
            <h2 id="summary-heading">サマリー資料</h2>
            {renderMarkdownLite(lesson.summary)}
          </section>
          <section className="panel" aria-labelledby="work-heading" style={{ marginTop: 18 }}>
            <h2 id="work-heading">ワーク提出</h2>
            <p className="work-status">{lesson.workPrompt}</p>
            {existing && (
              <Alert type={existing.status === "reviewed" ? "success" : "success"}>
                最新提出: {existing.status === "reviewed" ? `添削済み（評価: ${existing.grade || "未設定"}）` : "添削待ち"}
                {existing.feedback ? ` / フィードバック: ${existing.feedback}` : ""}
              </Alert>
            )}
            {message && <Alert type={message.includes("入力") || message.includes("5MB") ? "error" : "success"}>{message}</Alert>}
            <form onSubmit={submitWork}>
              <div className="form-group">
                <label className="form-label" htmlFor="work-text">テキスト回答</label>
                <textarea id="work-text" className="form-input" value={workText} onChange={(e) => setWorkText(e.target.value)} placeholder="ここにワークの回答を入力" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="work-file">ファイル添付（5MB以下）</label>
                <input
                  id="work-file"
                  ref={fileInputRef}
                  type="file"
                  className="form-input"
                  style={{ padding: "8px 12px" }}
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                />
                {attachmentFile && <p className="work-status">{attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(1)} KB)</p>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="work-url">ストレージURL（Google Drive・S3など）</label>
                <input id="work-url" className="form-input" type="url" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-small" type="submit">提出する</button>
              </div>
            </form>
          </section>
        </main>
        <aside className="sidebar">
          <QuizPanel user={user} course={course} lesson={lesson} videoWatched={videoWatched} onDashboard={onDashboard} />
        </aside>
      </div>
    </div>
  );
}

function QuizPanel({ user, course, lesson, videoWatched, onDashboard }) {
  const questions = lesson.questions || [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[index];

  if (!videoWatched) {
    return (
      <div className="quiz-card">
        <h2>練習問題</h2>
        <p className="work-status" style={{ textAlign: "center", padding: "24px 0" }}>
          動画を視聴完了後に解放されます
        </p>
      </div>
    );
  }

  if (!questions.length) {
    return <div className="quiz-card"><h2>練習問題</h2><p className="work-status">問題が未設定です。</p></div>;
  }

  const confirm = () => {
    if (selected === null) return;
    setConfirmed(true);
  };

  const next = () => {
    const nextScore = score + (selected === q.ans ? 1 : 0);
    if (index + 1 < questions.length) {
      setScore(nextScore);
      setIndex(index + 1);
      setSelected(null);
      setConfirmed(false);
      return;
    }
    const pct = Math.round((nextScore / questions.length) * 100);
    const passed = pct >= SITE_CONFIG.passingScore;
    upsertLessonProgress(user.id, course.id, lesson.id, {
      quizScore: nextScore,
      quizPct: pct,
      lastAttemptAt: new Date().toISOString(),
      ...(passed ? { completedAt: new Date().toISOString() } : {}),
    });
    setScore(nextScore);
    setDone(true);
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="quiz-card">
        <h2>練習問題 結果</h2>
        <div className="stat-num">{score}/{questions.length}</div>
        <p className="work-status">正答率 {pct}% / 合格ライン {SITE_CONFIG.passingScore}%</p>
        <span className={`pill ${pct >= SITE_CONFIG.passingScore ? "done" : "progress"}`}>
          {pct >= SITE_CONFIG.passingScore ? "レッスン完了" : "復習しましょう"}
        </span>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={onDashboard}>
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-card">
      <h2>練習問題</h2>
      <p className="work-status">問題 {index + 1} / {questions.length}</p>
      <p><strong>{q.q}</strong></p>
      <div className="quiz-options">
        {q.opts.map((opt, i) => {
          let cls = "quiz-option";
          if (confirmed && i === q.ans) cls += " correct";
          if (confirmed && i === selected && i !== q.ans) cls += " wrong";
          if (!confirmed && i === selected) cls += " selected";
          return (
            <button key={`${opt}-${i}`} className={cls} disabled={confirmed} onClick={() => setSelected(i)}>
              {opt}
            </button>
          );
        })}
      </div>
      {!confirmed ? (
        <button className="btn-primary" style={{ marginTop: 12 }} disabled={selected === null} onClick={confirm}>確認する</button>
      ) : (
        <>
          <div className="feedback">
            <strong>{selected === q.ans ? "正解" : `不正解: 正解は「${q.opts[q.ans]}」`}</strong>
            <p style={{ margin: "6px 0 0" }}>{q.exp}</p>
          </div>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={next}>
            {index + 1 < questions.length ? "次の問題へ" : "結果を見る"}
          </button>
        </>
      )}
    </div>
  );
}

function AdminView({ currentUser, catalog, setCatalog, submissions, refreshSubmissions }) {
  const [tab, setTab] = useState("progress");
  const myMentorId = ensureMentors().find((m) => m.userId === currentUser.id)?.id;
  const pendingSubs = submissions.filter((s) => s.status === "submitted").length;
  const newMessages = getMentorMessages().filter((m) => m.mentorId === myMentorId && m.status === "open").length;

  const tabDefs = [
    { id: "progress", label: "進捗確認" },
    { id: "submissions", label: "ワーク添削", badge: pendingSubs },
    { id: "mentor_assign", label: "メンター管理" },
    { id: "access", label: "受講設定" },
    { id: "mentors", label: "プロフィール", badge: newMessages },
    { id: "materials", label: "レッスン管理" },
  ];

  return (
    <div className="page">
      <h1 className="page-title">メンターダッシュボード</h1>
      <p className="page-sub">進捗確認・ワーク添削・メンター管理・レッスン管理</p>
      <div className="tabs" role="tablist">
        {tabDefs.map(({ id, label, badge }) => (
          <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}<Badge count={badge} />
          </button>
        ))}
      </div>
      {tab === "progress" && <ProgressAdmin catalog={catalog} submissions={submissions} />}
      {tab === "submissions" && <SubmissionAdmin currentUser={currentUser} catalog={catalog} submissions={submissions} refreshSubmissions={refreshSubmissions} />}
      {tab === "mentor_assign" && <MentorAssignAdmin currentUser={currentUser} catalog={catalog} />}
      {tab === "access" && <CourseAccessAdmin catalog={catalog} setCatalog={setCatalog} />}
      {tab === "mentors" && <MentorAdmin currentUser={currentUser} catalog={catalog} myMentorId={myMentorId} />}
      {tab === "materials" && <MaterialAdmin catalog={catalog} setCatalog={setCatalog} />}
    </div>
  );
}

function ProgressAdmin({ catalog, submissions }) {
  const users = getUsers().filter((user) => user.role === "user");
  const progress = getProgress();
  const courseRows = users.flatMap((user) =>
    catalog.filter((course) => canTakeCourse(user, course)).flatMap((course) => {
      const lessonStates = (course.lessons || []).map((lesson, index) => {
        const lessonProgress = getLessonProgress(progress, user.id, course.id, lesson.id);
        const submission = submissions.find((item) =>
          item.userId === user.id && item.courseId === course.id && item.lessonId === lesson.id
        );
        return { user, course, lesson, index, lessonProgress, submission };
      });
      if (!lessonStates.length || !hasLessonActivity(lessonStates[0].lessonProgress, lessonStates[0].submission)) return [];
      const lastActiveIndex = lessonStates.reduce((lastIndex, state) =>
        hasLessonActivity(state.lessonProgress, state.submission) ? state.index : lastIndex, -1);
      return [{ user, course, visibleLessons: lessonStates.slice(0, Math.min(lessonStates.length, lastActiveIndex + 2)) }];
    })
  );

  return (
    <div className="stack">
      <section>
        <h2 className="section-heading">受講者別サマリー</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>受講者</th><th>進捗</th><th>完了</th><th>提出</th><th>添削済み</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const userCatalog = catalog.filter((course) => canTakeCourse(user, course));
                const stats = calcStats(userCatalog, progress, user.id);
                const userSubs = submissions.filter((item) => item.userId === user.id);
                return (
                  <tr key={user.id}>
                    <td>{user.name}<br /><span className="work-status">{user.email}</span></td>
                    <td>
                      <div className="progress-wrap" aria-label={`${user.name}の進捗 ${stats.pct}%`}>
                        <div className="progress-fill" style={{ width: `${stats.pct}%` }} />
                      </div>
                      {stats.pct}%
                    </td>
                    <td>{stats.done}/{stats.total}</td>
                    <td>{userSubs.length}</td>
                    <td>{userSubs.filter((item) => item.status === "reviewed").length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-heading">レッスン別進捗</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>受講者</th>
                <th>講座</th>
                <th>レッスン</th>
                <th>状態</th>
                <th>動画視聴</th>
                <th>練習問題</th>
                <th>完了日時</th>
                <th>ワーク</th>
              </tr>
            </thead>
            <tbody>
              {lessonRows.map(({ user, course, lesson, index, lessonProgress, submission }) => (
                <tr key={`${user.id}-${course.id}-${lesson.id}`}>
                  <td>{user.name}</td>
                  <td>{course.title}</td>
                  <td>Lesson {index + 1}<br />{lesson.title}</td>
                  <td>
                    <span className={`pill ${isLessonCompleted(lessonProgress) ? "done" : lessonProgress.quizPct !== undefined ? "progress" : ""}`}>
                      {lessonStatus(lessonProgress)}
                    </span>
                  </td>
                  <td>{lessonProgress.videoWatched ? "済" : "-"}<br /><span className="work-status">{formatDateTime(lessonProgress.watchedAt)}</span></td>
                  <td>
                    {lessonProgress.quizPct !== undefined ? `${lessonProgress.quizScore}/${(lesson.questions || []).length} (${lessonProgress.quizPct}%)` : "-"}
                    <br /><span className="work-status">{formatDateTime(lessonProgress.lastAttemptAt)}</span>
                  </td>
                  <td>{formatDateTime(lessonProgress.completedAt)}</td>
                  <td>
                    {submission ? (submission.status === "reviewed" ? "添削済み" : "添削待ち") : "-"}
                    <br /><span className="work-status">{formatDateTime(submission?.submittedAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SubmissionAdmin({ currentUser, catalog, submissions, refreshSubmissions }) {
  const users = getUsers();
  const labelFor = (submission) => {
    const course = catalog.find((item) => item.id === submission.courseId);
    const lesson = course?.lessons.find((item) => item.id === submission.lessonId);
    return { course, lesson, user: users.find((item) => item.id === submission.userId) };
  };
  const review = (submission, grade, feedback) => {
    const next = getSubmissions().map((item) => item.id === submission.id ? {
      ...item,
      status: "reviewed",
      grade,
      feedback,
      reviewedAt: new Date().toISOString(),
      reviewerId: currentUser.id,
    } : item);
    saveSubmissions(next);
    refreshSubmissions();
  };
  if (!submissions.length) return <p className="empty">提出されたワークはまだありません</p>;
  return (
    <div className="stack">
      {submissions.map((submission) => {
        const labels = labelFor(submission);
        return (
          <ReviewCard key={submission.id} submission={submission} labels={labels} onReview={review} />
        );
      })}
    </div>
  );
}

function SubmissionAttachment({ submission }) {
  if (!submission.attachmentFile && !submission.attachmentUrl) return null;
  const isImage = submission.attachmentFile?.type?.startsWith("image/");
  return (
    <div className="attachment-box">
      {submission.attachmentFile && (
        isImage ? (
          <img src={submission.attachmentFile.data} alt={submission.attachmentFile.name} style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 6 }} />
        ) : (
          <a className="attachment-link" href={submission.attachmentFile.data} download={submission.attachmentFile.name}>
            📎 {submission.attachmentFile.name}
          </a>
        )
      )}
      {submission.attachmentUrl && (
        <a className="attachment-link" href={submission.attachmentUrl} target="_blank" rel="noopener noreferrer">
          🔗 {submission.attachmentUrl}
        </a>
      )}
    </div>
  );
}

function ReviewCard({ submission, labels, onReview }) {
  const [grade, setGrade] = useState(submission.grade || "A");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  return (
    <article className="panel">
      <div className="course-meta">
        <span className={`pill ${submission.status === "reviewed" ? "done" : "pending"}`}>{submission.status === "reviewed" ? "添削済み" : "添削待ち"}</span>
        <span className="pill">{labels.course?.title || submission.courseId}</span>
        <span className="pill">{labels.lesson?.title || submission.lessonId}</span>
      </div>
      <h2>{labels.user?.name || "不明なユーザー"}</h2>
      <p className="work-status">提出日時: {new Date(submission.submittedAt).toLocaleString("ja-JP")}</p>
      {submission.answer && <p>{submission.answer}</p>}
      <SubmissionAttachment submission={submission} />
      <div className="two-col">
        <div className="form-group">
          <label className="form-label">評価</label>
          <select className="form-input" value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="再提出">再提出</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">フィードバック</label>
          <textarea className="form-input" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
        </div>
      </div>
      <button className="btn-small" onClick={() => onReview(submission, grade, feedback)}>添削を保存</button>
    </article>
  );
}

function MentorAssignAdmin({ currentUser, catalog }) {
  const [assignments, setAssignments] = useState(getMentorAssignments);
  const [status, setStatus] = useState("");
  const mentors = ensureMentors();
  const adminUsers = getUsers().filter((u) => u.role === "admin");
  const learners = getUsers().filter((u) => u.role === "user");

  const save = (userId, courseId, mentorId) => {
    const key = mentorAssignmentKey(userId, courseId);
    const next = { ...assignments, [key]: { mentorId, assignedAt: new Date().toISOString() } };
    saveMentorAssignments(next);
    setAssignments(next);
    setStatus("保存しました");
    setTimeout(() => setStatus(""), 2000);
  };

  const selfAssign = (userId, courseId) => {
    const myMentor = mentors.find((m) => m.userId === currentUser.id);
    if (!myMentor) { setStatus("先にプロフィールを設定してください"); return; }
    save(userId, courseId, myMentor.id);
  };

  const getMentorName = (userId, courseId) => {
    const key = mentorAssignmentKey(userId, courseId);
    const a = assignments[key];
    if (!a) {
      const course = catalog.find((c) => c.id === courseId);
      const defaultM = course?.assignedAdminId ? mentors.find((m) => m.userId === course.assignedAdminId) : null;
      return defaultM ? `${defaultM.name}（デフォルト）` : "未割り当て";
    }
    return mentors.find((m) => m.id === a.mentorId)?.name || "不明";
  };

  return (
    <div className="stack">
      {status && <Alert type="success">{status}</Alert>}

      {/* 自分が担当管理者の講座 → 全ユーザーのメンターを任意のadminに割り当て可能 */}
      {catalog.filter((c) => isCoursePrimaryAdmin(currentUser, c)).map((course) => (
        <section className="panel" key={course.id}>
          <h2>{course.title} <span className="pill admin" style={{ fontSize: 11 }}>担当管理者</span></h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>受講者</th><th>現在のメンター</th><th>変更</th></tr></thead>
              <tbody>
                {learners.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{getMentorName(u.id, course.id)}</td>
                    <td>
                      <select className="form-input" style={{ padding: "4px 8px", fontSize: 13 }}
                        value={assignments[mentorAssignmentKey(u.id, course.id)]?.mentorId || ""}
                        onChange={(e) => e.target.value && save(u.id, course.id, e.target.value)}>
                        <option value="">（デフォルト）</option>
                        {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* 全講座 → 自分をメンターとして自主設定 */}
      <section className="panel">
        <h2>自分をメンターとして設定</h2>
        <p className="work-status">担当管理者でない講座でも、特定ユーザーのメンターを自分が引き受けられます。</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>講座</th><th>受講者</th><th>現在のメンター</th><th>操作</th></tr></thead>
            <tbody>
              {catalog.flatMap((course) =>
                learners.map((u) => {
                  const key = mentorAssignmentKey(u.id, course.id);
                  const myMentor = mentors.find((m) => m.userId === currentUser.id);
                  const isMine = myMentor && assignments[key]?.mentorId === myMentor.id;
                  return (
                    <tr key={`${course.id}-${u.id}`}>
                      <td>{course.title}</td>
                      <td>{u.name}</td>
                      <td>{getMentorName(u.id, course.id)}</td>
                      <td>
                        {isMine
                          ? <span className="pill done">担当中</span>
                          : <button className="btn-small" style={{ fontSize: 11 }} onClick={() => selfAssign(u.id, course.id)}>担当する</button>
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MentorAdmin({ currentUser, catalog, myMentorId }) {
  const [mentors, setMentors] = useState(ensureMentors);
  const existing = mentors.find((mentor) => mentor.userId === currentUser.id);
  const profile = existing || mentorProfileFromUser(currentUser);
  const [draft, setDraft] = useState(profile);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState(() => getMentorMessages().filter((m) => m.mentorId === profile.id));

  const markRead = (msgId) => {
    const updated = getMentorMessages().map((m) => m.id === msgId ? { ...m, status: "read" } : m);
    saveMentorMessages(updated);
    setMessages(updated.filter((m) => m.mentorId === profile.id));
  };

  useEffect(() => {
    setDraft(profile);
    setStatus("");
  }, [profile.id]);

  const saveProfile = (event) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.intro.trim()) {
      setStatus("名前とプロフィールを入力してください");
      return;
    }
    const nextProfile = {
      ...profile,
      name: draft.name.trim(),
      icon: draft.icon.trim() || initialsFor(draft.name),
      intro: draft.intro.trim(),
    };
    const nextMentors = mentors.some((mentor) => mentor.userId === currentUser.id)
      ? mentors.map((mentor) => mentor.userId === currentUser.id ? nextProfile : mentor)
      : [nextProfile, ...mentors];
    saveMentors(nextMentors);
    setMentors(nextMentors);
    setDraft(nextProfile);
    setStatus("プロフィールを保存しました");
  };

  return (
    <div className="stack">
      <section className="panel">
        <h2>自分のメンタープロフィール</h2>
        <div className="mentor-profile" style={{ marginBottom: 18 }}>
          <MentorIcon mentor={draft} />
          <div>
            <h3 className="mentor-name">{draft.name}</h3>
            <p className="mentor-intro">{draft.intro}</p>
          </div>
        </div>
        <form onSubmit={saveProfile}>
          <div className="two-col">
            <Field
              id="my-mentor-name"
              label="表示名"
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="my-mentor-icon">アイコン画像</label>
              <input
                id="my-mentor-icon"
                type="file"
                accept="image/*"
                className="form-input"
                style={{ padding: "8px 12px" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setDraft((prev) => ({ ...prev, icon: ev.target.result }));
                  reader.readAsDataURL(file);
                }}
              />
              <p className="work-status" style={{ marginTop: 4 }}>JPG・PNG・GIF・WebP（推奨: 正方形）</p>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="my-mentor-intro">プロフィール</label>
            <textarea
              id="my-mentor-intro"
              className="form-input"
              value={draft.intro}
              onChange={(event) => setDraft({ ...draft, intro: event.target.value })}
            />
          </div>
          {status && <p className="work-status" role="status">{status}</p>}
          <button className="btn-small" type="submit">プロフィールを保存</button>
        </form>
      </section>

      <section>
        <h2 className="section-heading">
          自分への相談
          <Badge count={messages.filter((m) => m.status === "open").length} />
        </h2>
        {messages.length === 0 ? (
          <p className="empty">まだ相談は届いていません</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日時</th><th>受講者</th><th>講座</th><th>相談内容</th><th>状態</th></tr></thead>
              <tbody>
                {messages.map((message) => {
                  const sender = getUsers().find((user) => user.id === message.userId);
                  const course = catalog.find((item) => item.id === message.courseId);
                  return (
                    <tr key={message.id} style={{ background: message.status === "open" ? "#fefce8" : "" }}>
                      <td>{formatDateTime(message.createdAt)}</td>
                      <td>{sender?.name || "不明"}</td>
                      <td>{course?.title || message.courseId}</td>
                      <td>{message.body}</td>
                      <td>
                        {message.status === "open"
                          ? <button className="btn-small" style={{ fontSize: 11 }} onClick={() => markRead(message.id)}>既読にする</button>
                          : <span className="pill done">既読</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MaterialAdmin({ catalog, setCatalog }) {
  // mode: "edit-lesson" | "new-lesson"
  const [mode, setMode] = useState("edit-lesson");
  const [selected, setSelected] = useState(() => catalog[0] ? { courseId: catalog[0].id, lessonId: catalog[0].lessons[0]?.id } : null);
  const course = catalog.find((item) => item.id === selected?.courseId);
  const lesson = course?.lessons.find((item) => item.id === selected?.lessonId);

  const selectLesson = (courseId, lessonId) => { setSelected({ courseId, lessonId }); setMode("edit-lesson"); };
  const startNewLesson = (courseId) => { setSelected((p) => ({ ...p, courseId, lessonId: null })); setMode("new-lesson"); };

  const rightTitle = mode === "new-lesson" ? "レッスンを追加" : "レッスンを編集";

  return (
    <div className="two-col">
      <section className="panel">
        <h2>講座 / レッスン選択</h2>
        <div className="lesson-list">
          {catalog.map((c) => (
            <div key={c.id}>
              <div className="toolbar" style={{ marginBottom: 4 }}>
                <strong>{c.title}</strong>
                <button className="btn-small" style={{ fontSize: 11 }} onClick={() => startNewLesson(c.id)}>＋ レッスン追加</button>
              </div>
              {c.lessons.map((l) => (
                <button key={l.id} className="btn-secondary"
                  style={{ width: "100%", marginTop: 6, textAlign: "left", background: selected?.lessonId === l.id && mode === "edit-lesson" ? "#e8f0fe" : "" }}
                  onClick={() => selectLesson(c.id, l.id)}>{l.title}</button>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>{rightTitle}</h2>
        {mode === "edit-lesson" && lesson && course && (
          <LessonEditorPanel key={lesson.id} lesson={lesson} courseId={course.id} catalog={catalog} setCatalog={setCatalog} onDone={() => {}} />
        )}
        {mode === "new-lesson" && selected?.courseId && (
          <LessonEditorPanel key={`new-${selected.courseId}`} lesson={null} courseId={selected.courseId} catalog={catalog} setCatalog={setCatalog} isNew onDone={() => setMode("edit-lesson")} />
        )}
        {mode === "edit-lesson" && !lesson && <p className="empty">左のリストからレッスンを選択してください</p>}
      </section>
    </div>
  );
}

function AccountAdmin() {
  const [users, setUsers] = useState(getUsers);
  const [editing, setEditing] = useState(null); // null | userId | "new"
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [delTarget, setDelTarget] = useState(null);

  const startEdit = (user) => { setEditing(user.id); setForm({ name: user.name, email: user.email, password: user.password, role: user.role }); setError(""); };
  const startNew = () => { setEditing("new"); setForm({ name: "", email: "", password: "", role: "user" }); setError(""); };
  const cancel = () => { setEditing(null); setError(""); };

  const save = () => {
    if (!form.name.trim() || !form.email.includes("@") || (editing === "new" && form.password.length < 8)) {
      setError("名前・メール・パスワード（8文字以上）を入力してください"); return;
    }
    let next;
    if (editing === "new") {
      if (getUsers().some((u) => u.email === form.email)) { setError("このメールは既に登録されています"); return; }
      next = [...getUsers(), { id: `dev_${Date.now()}`, ...form, createdAt: new Date().toISOString() }];
    } else {
      next = getUsers().map((u) => u.id === editing ? { ...u, name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role } : u);
    }
    saveUsers(next); setUsers(next); setEditing(null); setError("");
  };

  const del = (userId) => {
    const next = getUsers().filter((u) => u.id !== userId);
    saveUsers(next); setUsers(next); setDelTarget(null);
  };

  const roleLabel = { user: "受講者", admin: "管理者", developer: "開発者" };

  return (
    <div className="stack">
      {error && <Alert type="error">{error}</Alert>}
      {delTarget && (
        <div className="panel" style={{ background: "#fef2f2", borderColor: "#fca5a5" }}>
          <p style={{ margin: "0 0 12px", fontWeight: 700 }}>「{users.find((u) => u.id === delTarget)?.name}」を削除しますか？</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-danger" onClick={() => del(delTarget)}>削除する</button>
            <button className="btn-secondary" onClick={() => setDelTarget(null)}>キャンセル</button>
          </div>
        </div>
      )}
      <div className="toolbar">
        <h2 className="section-heading" style={{ margin: 0 }}>ユーザー管理</h2>
        <button className="btn-small" onClick={startNew}>＋ 新規アカウント</button>
      </div>
      {editing === "new" && (
        <div className="panel">
          <h3 style={{ margin: "0 0 14px" }}>新規アカウント作成</h3>
          <div className="two-col">
            <Field id="acc-name" label="名前" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            <Field id="acc-email" label="メールアドレス" type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
            <Field id="acc-pw" label="パスワード（8文字以上）" type="password" value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} />
            <div className="form-group">
              <label className="form-label" htmlFor="acc-role">ロール</label>
              <select id="acc-role" className="form-input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                <option value="user">受講者</option>
                <option value="admin">管理者</option>
                <option value="developer">開発者</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-small" onClick={save}>作成する</button>
            <button className="btn-secondary" onClick={cancel}>キャンセル</button>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>名前</th><th>メール</th><th>ロール</th><th>登録日</th><th>操作</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                {editing === u.id ? (
                  <>
                    <td><input className="form-input" style={{ padding: "4px 8px" }} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></td>
                    <td><input className="form-input" style={{ padding: "4px 8px" }} type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></td>
                    <td>
                      <select className="form-input" style={{ padding: "4px 8px" }} value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                        <option value="user">受講者</option>
                        <option value="admin">管理者</option>
                        <option value="developer">開発者</option>
                      </select>
                    </td>
                    <td>{formatDateTime(u.createdAt)}</td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn-small" onClick={save}>保存</button>
                      <button className="btn-secondary" onClick={cancel}>取消</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`pill ${u.role === "admin" ? "admin" : u.role === "developer" ? "developer" : ""}`}>{roleLabel[u.role] || u.role}</span></td>
                    <td>{formatDateTime(u.createdAt)}</td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn-small" onClick={() => startEdit(u)}>編集</button>
                      <button className="btn-danger" onClick={() => setDelTarget(u.id)}>削除</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeveloperView({ catalog, setCatalog }) {
  const [devTab, setDevTab] = useState("courses");
  // mode: null | "new-course" | "edit-course" | "new-lesson" | "edit-lesson"
  const [mode, setMode] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null); // { type: "course"|"lesson", courseId, lessonId? }
  const [apiMsg, setApiMsg] = useState("");

  const course = catalog.find((c) => c.id === activeCourseId);
  const lesson = course?.lessons.find((l) => l.id === activeLessonId);

  const clearApi = () => setApiMsg("");

  const deleteCourse = async (courseId) => {
    setApiMsg("削除中…");
    try {
      await fetch(`/api/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" });
      const next = catalogRemoveCourse(catalog, courseId);
      saveCatalog(next); setCatalog(next);
      localStorage.removeItem(SK.catalog); localStorage.removeItem(SK.catalogVersion);
      setApiMsg("削除しました。再読み込み中…");
      setTimeout(() => window.location.reload(), 600);
    } catch { setApiMsg("削除に失敗しました"); }
    setDelConfirm(null);
  };

  const deleteLesson = async (courseId, lessonId) => {
    setApiMsg("削除中…");
    try {
      await fetch(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, { method: "DELETE" });
      const next = catalogRemoveLesson(catalog, courseId, lessonId);
      saveCatalog(next); setCatalog(next);
      localStorage.removeItem(SK.catalog); localStorage.removeItem(SK.catalogVersion);
      setApiMsg("削除しました。再読み込み中…");
      setTimeout(() => window.location.reload(), 600);
    } catch { setApiMsg("削除に失敗しました"); }
    setDelConfirm(null);
  };

  const handleNewLesson = async (lessonData) => {
    setApiMsg("レッスンを追加中…");
    try {
      await fetch(`/api/courses/${encodeURIComponent(activeCourseId)}/lessons`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lessonData),
      });
      const newLesson = { id: `lesson-${Date.now()}`, ...lessonData };
      const next = catalogAddLesson(catalog, activeCourseId, newLesson);
      saveCatalog(next); setCatalog(next);
      localStorage.removeItem(SK.catalog); localStorage.removeItem(SK.catalogVersion);
      setApiMsg("追加しました。再読み込み中…");
      setTimeout(() => window.location.reload(), 600);
    } catch { setApiMsg("追加に失敗しました"); }
  };

  return (
    <div className="page">
      <h1 className="page-title">開発者コンソール</h1>
      <div className="tabs" role="tablist" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${devTab === "courses" ? "active" : ""}`} onClick={() => setDevTab("courses")}>講座管理</button>
        <button className={`tab-btn ${devTab === "accounts" ? "active" : ""}`} onClick={() => setDevTab("accounts")}>アカウント管理</button>
      </div>

      {devTab === "accounts" && <AccountAdmin />}

      {devTab === "courses" && (
        <>
          <div className="toolbar">
            <p className="page-sub" style={{ margin: 0 }}>講座・レッスンの作成・編集・削除</p>
            <button className="btn-small" onClick={() => { setMode("new-course"); setActiveCourseId(null); setActiveLessonId(null); }}>
              ＋ 新規講座
            </button>
          </div>
          {apiMsg && <Alert type={apiMsg.includes("失敗") ? "error" : "success"}>{apiMsg}</Alert>}
          {delConfirm && (
            <div className="panel" style={{ background: "#fef2f2", borderColor: "#fca5a5", marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontWeight: 700 }}>
                {delConfirm.type === "course"
                  ? `講座「${catalog.find((c) => c.id === delConfirm.courseId)?.title}」を削除しますか？`
                  : `レッスン「${catalog.find((c) => c.id === delConfirm.courseId)?.lessons.find((l) => l.id === delConfirm.lessonId)?.title}」を削除しますか？`}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-danger" onClick={() => delConfirm.type === "course" ? deleteCourse(delConfirm.courseId) : deleteLesson(delConfirm.courseId, delConfirm.lessonId)}>削除する</button>
                <button className="btn-secondary" onClick={() => setDelConfirm(null)}>キャンセル</button>
              </div>
            </div>
          )}
          <div className="course-layout">
            <div className="stack">
              {catalog.map((c) => (
                <div className="panel" key={c.id}>
                  <div className="toolbar">
                    <strong style={{ fontSize: 16 }}>{c.title}</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-small" style={{ fontSize: 11 }} onClick={() => { setActiveCourseId(c.id); setActiveLessonId(null); setMode("edit-course"); clearApi(); }}>講座編集</button>
                      <button className="btn-small" style={{ fontSize: 11, background: "#1d6b3a" }} onClick={() => { setActiveCourseId(c.id); setActiveLessonId(null); setMode("new-lesson"); clearApi(); }}>＋ レッスン</button>
                      <button className="btn-danger" onClick={() => setDelConfirm({ type: "course", courseId: c.id })}>削除</button>
                    </div>
                  </div>
                  <div className="lesson-list" style={{ marginTop: 10 }}>
                    {c.lessons.map((l, i) => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button className="btn-secondary" style={{ flex: 1, textAlign: "left", fontSize: 13 }}
                          onClick={() => { setActiveCourseId(c.id); setActiveLessonId(l.id); setMode("edit-lesson"); clearApi(); }}>
                          {i + 1}. {l.title}
                        </button>
                        <button className="btn-danger" onClick={() => setDelConfirm({ type: "lesson", courseId: c.id, lessonId: l.id })}>削除</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="panel">
              {mode === "new-course" && (
                <>
                  <h2>新規講座を作成</h2>
                  <CourseEditorPanel key="new-course" course={null} catalog={catalog} setCatalog={setCatalog} isNew onDone={() => setMode(null)} />
                </>
              )}
              {mode === "edit-course" && course && (
                <>
                  <h2>講座を編集</h2>
                  <CourseEditorPanel key={course.id} course={course} catalog={catalog} setCatalog={setCatalog} onDone={() => setMode(null)} />
                </>
              )}
              {mode === "new-lesson" && activeCourseId && (
                <>
                  <h2>レッスンを追加</h2>
                  <LessonEditorPanel key={`new-lesson-${activeCourseId}`} lesson={null} courseId={activeCourseId} catalog={catalog} setCatalog={setCatalog} isNew onDone={() => setMode(null)} />
                </>
              )}
              {mode === "edit-lesson" && lesson && (
                <>
                  <h2>レッスンを編集</h2>
                  <LessonEditorPanel key={lesson.id} lesson={lesson} courseId={activeCourseId} catalog={catalog} setCatalog={setCatalog} onDone={() => setMode(null)} />
                </>
              )}
              {!mode && <p className="empty">左の講座・レッスンを選択するか、「＋ 新規講座」を押してください</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const go = (path) => { window.location.hash = path; };

export default function App() {
  useEffect(() => { initAccounts(); }, []);
  const [user, setUser] = useState(() => getCurrentUser());
  const [catalog, setCatalog] = useState(getCatalog);
  const [submissions, setSubmissions] = useState(getSubmissions);
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  const mainRef = useRef(null);

  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash || "#/");
      setTimeout(() => mainRef.current?.focus(), 30);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const refreshSubmissions = () => setSubmissions(getSubmissions());

  const handleLogin = (nextUser) => { setUser(nextUser); go("#/"); };
  const handleLogout = () => { setCurrentUser(null); setUser(null); go("#/login"); };

  // ハッシュからルートを導出
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  let page, view, selectedCourse, selectedLesson;

  if (!user) {
    page = segments[0] === "register" ? "register" : segments[0] === "remind" ? "remind" : "login";
  } else {
    page = "app";
    if (segments[0] === "admin" && canAdmin(user)) {
      view = "admin";
    } else if (segments[0] === "developer" && canDevelop(user)) {
      view = "developer";
    } else if (segments[0] === "course" && segments[1]) {
      selectedCourse = catalog.find((c) => c.id === decodeURIComponent(segments[1]));
      if (selectedCourse && segments[2] === "lesson" && segments[3]) {
        selectedLesson = selectedCourse.lessons.find((l) => l.id === decodeURIComponent(segments[3]));
        view = selectedLesson ? "lesson" : "course";
      } else {
        view = selectedCourse ? "course" : "dashboard";
      }
    } else {
      view = "dashboard";
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">メインコンテンツへスキップ</a>
      <div className="app-shell">
        <header className="header">
          <button className="header-logo" style={{ background:"none", border:0, color:"white", cursor:"pointer" }} onClick={() => go("#/")}>
            {SITE_CONFIG.name}<span>.</span>
          </button>
          {page === "app" && (
            <nav className="header-nav" aria-label="メインナビゲーション">
              <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => go("#/")}>講座一覧</button>
              {canAdmin(user) && <button className={`nav-btn ${view === "admin" ? "active" : ""}`} onClick={() => go("#/admin")}>メンター</button>}
              {canDevelop(user) && <button className={`nav-btn ${view === "developer" ? "active" : ""}`} onClick={() => go("#/developer")}>講座管理</button>}
              <button className="nav-btn subtle" onClick={handleLogout}>ログアウト</button>
            </nav>
          )}
        </header>
        <main id="main-content" className="main-content" tabIndex={-1} ref={mainRef}>
          {page === "login"    && <LoginView onLogin={handleLogin} onGoto={(p) => go(`#/${p}`)} />}
          {page === "register" && <RegisterView onGoto={(p) => go(`#/${p}`)} />}
          {page === "remind"   && <RemindView onGoto={(p) => go(`#/${p}`)} />}
          {page === "app" && view === "dashboard" && (
            <Dashboard
              user={user} catalog={catalog} submissions={submissions}
              onSelect={(course) => go(`#/course/${encodeURIComponent(course.id)}`)}
            />
          )}
          {page === "app" && view === "course" && selectedCourse && (
            <CourseOutline
              user={user} course={selectedCourse} submissions={submissions}
              onBack={() => go("#/")}
              onDashboard={() => go("#/")}
              onLesson={(lesson) => go(`#/course/${encodeURIComponent(selectedCourse.id)}/lesson/${encodeURIComponent(lesson.id)}`)}
            />
          )}
          {page === "app" && view === "lesson" && selectedCourse && selectedLesson && (
            <LessonView
              user={user} course={selectedCourse} lesson={selectedLesson}
              submissions={submissions} refreshSubmissions={refreshSubmissions}
              onBack={() => go(`#/course/${encodeURIComponent(selectedCourse.id)}`)}
              onDashboard={() => go("#/")}
            />
          )}
          {page === "app" && view === "admin" && canAdmin(user) && (
            <AdminView currentUser={user} catalog={catalog} setCatalog={setCatalog} submissions={submissions} refreshSubmissions={refreshSubmissions} />
          )}
          {page === "app" && view === "developer" && canDevelop(user) && (
            <DeveloperView catalog={catalog} setCatalog={setCatalog} />
          )}
        </main>
      </div>
    </>
  );
}
