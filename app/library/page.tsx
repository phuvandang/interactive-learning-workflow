"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lesson, Course, ChatSession, SourceMeta, Source } from "@/types";
import { formatDate } from "@/lib/utils";

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("device_id", id); }
  return id;
}

function sourceIcon(type: string) {
  if (type === "youtube") return "🎬";
  if (type === "pdf") return "📄";
  return "📋";
}

function getEffectiveSources(lesson: Lesson): SourceMeta[] {
  if (lesson.sources && lesson.sources.length > 0) return lesson.sources;
  // Old lessons without sources — synthesize from youtube_url
  if (lesson.youtube_url) {
    return [{ type: "youtube", label: lesson.title, wordCount: lesson.transcript?.split(/\s+/).filter(Boolean).length || 0 }];
  }
  return [];
}

function getCourseSources(course: Course): SourceMeta[] {
  if (course.sources && course.sources.length > 0) return course.sources;
  if (course.youtube_url) {
    return [{ type: "youtube", label: course.title, wordCount: (course as Course & { transcript?: string }).transcript?.split(/\s+/).filter(Boolean).length || 0 }];
  }
  return [];
}

export default function LibraryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"lessons" | "courses" | "chats">("lessons");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    async function fetchAll() {
      const [lessonsRes, coursesRes] = await Promise.all([
        fetch("/api/lessons"),
        fetch("/api/courses"),
      ]);
      const lessonsData = await lessonsRes.json();
      const coursesData = await coursesRes.json();
      setLessons(lessonsData.lessons || []);
      setCourses(coursesData.courses || []);
      setLoading(false);
    }
    fetchAll();
  }, []);

  useEffect(() => {
    if (tab !== "chats") return;
    if (sessions.length > 0) return;
    setChatsLoading(true);
    const deviceId = getDeviceId();
    fetch(`/api/sessions?device_id=${deviceId}`)
      .then((r) => r.json())
      .then((data) => { setSessions(data.sessions || []); setChatsLoading(false); });
  }, [tab, sessions.length]);

  function reuseFromLesson(lesson: Lesson) {
    const srcs = getEffectiveSources(lesson);
    const fakeSources: Source[] = srcs.map((s) => ({
      id: crypto.randomUUID(),
      type: s.type,
      label: s.label,
      content: "",
      wordCount: s.wordCount,
      status: "done" as const,
      videoUrl: s.type === "youtube" ? lesson.youtube_url : undefined,
      videoId: s.type === "youtube" ? lesson.youtube_video_id : undefined,
    }));
    const data = {
      sources: fakeSources,
      combinedContent: lesson.transcript || "",
      primaryTitle: lesson.title,
      primaryVideoId: lesson.youtube_video_id || "",
      primaryVideoUrl: lesson.youtube_url || "",
    };
    localStorage.setItem("reuse_sources", JSON.stringify(data));
    router.push("/");
  }

  function addSourceToLesson(lesson: Lesson) {
    const srcs = getEffectiveSources(lesson);
    const data = {
      type: "lesson",
      id: lesson.id,
      existingTranscript: lesson.transcript || "",
      existingSources: srcs,
      primaryTitle: lesson.title,
      primaryVideoId: lesson.youtube_video_id || "",
      primaryVideoUrl: lesson.youtube_url || "",
    };
    localStorage.setItem("add_source_mode", JSON.stringify(data));
    router.push("/");
  }

  function addSourceToCourse(course: Course) {
    const srcs = getCourseSources(course);
    const transcript = (course as Course & { transcript?: string }).transcript || "";
    const data = {
      type: "course",
      id: course.id,
      existingTranscript: transcript,
      existingSources: srcs,
      primaryTitle: course.title,
      primaryVideoId: course.youtube_video_id || "",
      primaryVideoUrl: course.youtube_url || "",
    };
    localStorage.setItem("add_source_mode", JSON.stringify(data));
    router.push("/");
  }

  function reuseFromCourse(course: Course) {
    const srcs = getCourseSources(course);
    const transcript = (course as Course & { transcript?: string }).transcript || "";
    const fakeSources: Source[] = srcs.map((s) => ({
      id: crypto.randomUUID(),
      type: s.type,
      label: s.label,
      content: "",
      wordCount: s.wordCount,
      status: "done" as const,
      videoUrl: s.type === "youtube" ? course.youtube_url : undefined,
      videoId: s.type === "youtube" ? course.youtube_video_id : undefined,
    }));
    const data = {
      sources: fakeSources,
      combinedContent: transcript,
      primaryTitle: course.title,
      primaryVideoId: course.youtube_video_id || "",
      primaryVideoUrl: course.youtube_url || "",
    };
    localStorage.setItem("reuse_sources", JSON.stringify(data));
    router.push("/");
  }

  async function handleDeleteLesson(id: string) {
    if (!confirm("Xóa bài học này?")) return;
    setDeletingId(id);
    await fetch(`/api/lessons?id=${id}`, { method: "DELETE" });
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  async function handleDeleteCourse(id: string) {
    if (!confirm("Xóa khóa học này? Tất cả bài học trong khóa cũng sẽ bị xóa.")) return;
    setDeletingId(id);
    await fetch(`/api/courses?id=${id}`, { method: "DELETE" });
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  }

  function startRenaming(session: ChatSession) {
    setRenamingId(session.id);
    setRenameValue(session.lesson_title || "Bài học");
  }

  async function handleRenameSession(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await fetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, lesson_title: trimmed }),
    });
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, lesson_title: trimmed } : s))
    );
    setRenamingId(null);
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Xóa hội thoại này?")) return;
    setDeletingId(id);
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  const totalLessonsInCourse = (course: Course) =>
    course.structure.reduce((sum, mod) => sum + mod.lessons.length, 0);

  function getSessionLink(session: ChatSession): string {
    if (session.lesson_id) return `/learn/${session.lesson_id}`;
    return "/library";
  }

  function getSessionPreview(session: ChatSession): string {
    const first = session.messages.find((m) => m.role === "assistant");
    return first?.content.replace(/[#*`]/g, "").slice(0, 80) ?? "...";
  }

  const tabs = [
    { id: "lessons" as const, label: "Bài học đơn lẻ", count: lessons.length },
    { id: "courses" as const, label: "Khóa học", count: courses.length },
    { id: "chats" as const, label: "Hội thoại", count: sessions.length },
  ];

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Thư Viện</h1>
        <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Tạo mới
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && tab !== "chats" && <div className="text-center py-12 text-slate-500">Đang tải...</div>}

      {/* Lessons tab */}
      {!loading && tab === "lessons" && (
        <>
          {lessons.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <p className="text-4xl mb-4">📄</p>
              <p className="text-slate-500 mb-4">Chưa có bài học nào</p>
              <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">Tạo bài học đầu tiên →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => {
                const srcs = getEffectiveSources(lesson);
                const isExpanded = expandedSources === lesson.id;
                return (
                  <div key={lesson.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800 truncate">{lesson.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                          <span className="text-xs text-slate-400">{formatDate(lesson.created_at)}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {lesson.language === "vi" ? "🇻🇳 Tiếng Việt" : "🇺🇸 English"}
                          </span>
                          {srcs.length > 0 && (
                            <button
                              onClick={() => setExpandedSources(isExpanded ? null : lesson.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {srcs.length} nguồn {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:ml-4">
                        <Link href={`/learn/${lesson.id}`} className="text-center bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Học ngay
                        </Link>
                        <button
                          onClick={() => addSourceToLesson(lesson)}
                          className="text-sm text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                          title="Thêm nguồn mới vào bài học này"
                        >
                          ➕ Thêm nguồn
                        </button>
                        <button
                          onClick={() => reuseFromLesson(lesson)}
                          className="text-sm text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Tạo bài học/khóa học mới từ cùng nguồn tài liệu"
                        >
                          ♻️ Tạo mới
                        </button>
                        <button onClick={() => handleDeleteLesson(lesson.id)} disabled={deletingId === lesson.id}
                          className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg border border-red-100 hover:border-red-200 transition-colors disabled:opacity-50">
                          {deletingId === lesson.id ? "..." : "Xóa"}
                        </button>
                      </div>
                    </div>
                    {/* Sources panel */}
                    {isExpanded && srcs.length > 0 && (
                      <div className="border-t border-slate-100 px-4 sm:px-5 py-3 bg-slate-50 rounded-b-xl">
                        <p className="text-xs font-medium text-slate-500 mb-2">Nguồn tài liệu</p>
                        <div className="space-y-1.5">
                          {srcs.map((src, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span>{sourceIcon(src.type)}</span>
                              <span className="text-slate-700 flex-1 truncate">{src.label}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">{src.wordCount.toLocaleString()} từ</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => addSourceToLesson(lesson)}
                            className="flex-1 text-sm text-green-600 font-medium py-2 rounded-lg border border-green-200 hover:bg-green-50 transition-colors"
                          >
                            ➕ Thêm nguồn mới vào bài học này
                          </button>
                          <button
                            onClick={() => reuseFromLesson(lesson)}
                            className="flex-1 text-sm text-blue-600 font-medium py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            ✨ Tạo mới từ nguồn này →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Courses tab */}
      {!loading && tab === "courses" && (
        <>
          {courses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <p className="text-4xl mb-4">📚</p>
              <p className="text-slate-500 mb-4">Chưa có khóa học nào</p>
              <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">Tạo khóa học đầu tiên →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => {
                const firstModule = course.structure?.[0];
                const firstLesson = firstModule?.lessons?.[0];
                const lessonCount = totalLessonsInCourse(course);
                const srcs = getCourseSources(course);
                const isExpanded = expandedSources === course.id;
                return (
                  <div key={course.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">📚 Khóa học</span>
                        </div>
                        <h3 className="font-medium text-slate-800 truncate">{course.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {course.scenario?.company} — {course.scenario?.role}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-xs text-slate-400">{formatDate(course.created_at)}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{course.structure?.length} modules • {lessonCount} bài</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {course.language === "vi" ? "🇻🇳 Tiếng Việt" : "🇺🇸 English"}
                          </span>
                          {srcs.length > 0 && (
                            <button
                              onClick={() => setExpandedSources(isExpanded ? null : course.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {srcs.length} nguồn {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:ml-4">
                        {firstModule && firstLesson && (
                          <Link
                            href={`/course/${course.id}/${firstModule.id}/${firstLesson.id}`}
                            className="text-center bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Học ngay
                          </Link>
                        )}
                        <button
                          onClick={() => addSourceToCourse(course)}
                          className="text-sm text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                          title="Thêm nguồn mới vào khóa học này"
                        >
                          ➕ Thêm nguồn
                        </button>
                        <button
                          onClick={() => reuseFromCourse(course)}
                          className="text-sm text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Tạo bài học/khóa học mới từ cùng nguồn tài liệu"
                        >
                          ♻️ Tạo mới
                        </button>
                        <button onClick={() => handleDeleteCourse(course.id)} disabled={deletingId === course.id}
                          className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg border border-red-100 hover:border-red-200 transition-colors disabled:opacity-50">
                          {deletingId === course.id ? "..." : "Xóa"}
                        </button>
                      </div>
                    </div>
                    {/* Sources panel */}
                    {isExpanded && srcs.length > 0 && (
                      <div className="border-t border-slate-100 px-4 sm:px-5 py-3 bg-slate-50 rounded-b-xl">
                        <p className="text-xs font-medium text-slate-500 mb-2">Nguồn tài liệu</p>
                        <div className="space-y-1.5">
                          {srcs.map((src, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span>{sourceIcon(src.type)}</span>
                              <span className="text-slate-700 flex-1 truncate">{src.label}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">{src.wordCount.toLocaleString()} từ</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => addSourceToCourse(course)}
                            className="flex-1 text-sm text-green-600 font-medium py-2 rounded-lg border border-green-200 hover:bg-green-50 transition-colors"
                          >
                            ➕ Thêm nguồn mới vào khóa học này
                          </button>
                          <button
                            onClick={() => reuseFromCourse(course)}
                            className="flex-1 text-sm text-blue-600 font-medium py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            ✨ Tạo mới từ nguồn này →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Chats tab */}
      {tab === "chats" && (
        <>
          {chatsLoading && <div className="text-center py-12 text-slate-500">Đang tải...</div>}
          {!chatsLoading && sessions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-slate-500 mb-2">Chưa có hội thoại nào được lưu</p>
              <p className="text-xs text-slate-400 mb-4">Hội thoại sẽ được lưu tự động khi bạn học bài</p>
              <button onClick={() => setTab("lessons")} className="text-blue-600 hover:underline text-sm font-medium">Xem bài học →</button>
            </div>
          )}
          {!chatsLoading && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((session) => {
                const userCount = session.messages.filter((m) => m.role === "user").length;
                const preview = getSessionPreview(session);
                const link = getSessionLink(session);
                return (
                  <div key={session.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-slate-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">💬 Hội thoại</span>
                      </div>
                      {renamingId === session.id ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameSession(session.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="flex-1 text-sm font-medium border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button onClick={() => handleRenameSession(session.id)} className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-md font-medium">Lưu</button>
                          <button onClick={() => setRenamingId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md border border-slate-200">Hủy</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <h3 className="font-medium text-slate-800 truncate">
                            {session.lesson_title || "Bài học"}
                          </h3>
                          <button
                            onClick={() => startRenaming(session)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity flex-shrink-0"
                            title="Đổi tên"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{preview}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-xs text-slate-400">{formatDate(session.updated_at)}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{userCount} câu hỏi · {session.messages.length} tin nhắn</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-4">
                      {session.lesson_id && (
                        <Link href={link} className="flex-1 sm:flex-none text-center bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Xem lại
                        </Link>
                      )}
                      <button onClick={() => handleDeleteSession(session.id)} disabled={deletingId === session.id}
                        className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg border border-red-100 hover:border-red-200 transition-colors disabled:opacity-50">
                        {deletingId === session.id ? "..." : "Xóa"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
