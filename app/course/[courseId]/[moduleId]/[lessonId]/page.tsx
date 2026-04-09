"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Course, CourseLessonContent, ChatMessage, ChatSession } from "@/types";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("device_id", id); }
  return id;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Save user answers from current lesson to localStorage for context passing
function saveContextToStorage(courseId: string, moduleId: string, lessonId: string, messages: ChatMessage[]) {
  const userAnswers = messages
    .filter((m) => m.role === "user" && m.content !== "Bắt đầu bài học")
    .map((m) => m.content)
    .join("\n---\n");
  if (userAnswers) {
    localStorage.setItem(`ctx-${courseId}-${moduleId}-${lessonId}`, userAnswers);
  }
}

// Load context from previous lesson in localStorage
function loadPreviousContext(courseId: string, course: Course, moduleId: string, lessonId: string): string | null {
  const allLessons = course.structure.flatMap((mod) =>
    mod.lessons.map((l) => ({ moduleId: mod.id, lessonId: l.id }))
  );
  const currentIdx = allLessons.findIndex((l) => l.moduleId === moduleId && l.lessonId === lessonId);
  if (currentIdx <= 0) return null;
  const prev = allLessons[currentIdx - 1];
  return localStorage.getItem(`ctx-${courseId}-${prev.moduleId}-${prev.lessonId}`);
}

export default function CourseLessonPage() {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessonContent, setLessonContent] = useState<CourseLessonContent | null>(null);
  const [allCourseLessons, setAllCourseLessons] = useState<CourseLessonContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [previousContext, setPreviousContext] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    const saved = localStorage.getItem("auto_save_sessions");
    if (saved === "false") setAutoSave(false);
  }, []);

  useEffect(() => {
    async function load() {
      const [coursesRes, lessonsRes] = await Promise.all([
        fetch("/api/courses"),
        fetch(`/api/course-lessons?course_id=${courseId}`),
      ]);
      const coursesData = await coursesRes.json();
      const lessonsData = await lessonsRes.json();

      const found = coursesData.courses?.find((c: Course) => c.id === courseId);
      if (found) setCourse(found);

      const allLessons: CourseLessonContent[] = lessonsData.lessons || [];
      setAllCourseLessons(allLessons);

      const lesson = allLessons.find(
        (l) => l.module_id === moduleId && l.lesson_id === lessonId
      );
      if (lesson) setLessonContent(lesson);
      setLoading(false);
    }
    load();
  }, [courseId, moduleId, lessonId]);

  // Load previous context from localStorage when course/lesson is ready
  useEffect(() => {
    if (course && moduleId && lessonId) {
      setPreviousContext(loadPreviousContext(courseId, course, moduleId, lessonId));
    }
  }, [courseId, course, moduleId, lessonId]);

  // Load sessions for this course lesson
  useEffect(() => {
    if (!deviceId || !lessonContent) return;
    async function loadSessions() {
      const res = await fetch(`/api/sessions?course_lesson_id=${lessonContent!.id}&device_id=${deviceId}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    }
    loadSessions();
  }, [deviceId, lessonContent]);

  // Reset chat when lesson changes
  useEffect(() => {
    setMessages([]);
    setStarted(false);
    setCurrentSessionId(null);
    setShowHistory(false);
  }, [lessonId, moduleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveSession = useCallback(
    async (msgs: ChatMessage[], sessionId: string | null) => {
      if (!deviceId || !lessonContent || msgs.length === 0) return sessionId;
      if (sessionId) {
        await fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionId, messages: msgs }),
        });
        return sessionId;
      } else {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_lesson_id: lessonContent.id,
            lesson_title: `${lessonContent.name} — ${course?.title || ''}`,
            device_id: deviceId,
            messages: msgs,
          }),
        });
        const data = await res.json();
        if (data.session) {
          setCurrentSessionId(data.session.id);
          setSessions((prev) => [data.session, ...prev]);
          return data.session.id;
        }
      }
      return sessionId;
    },
    [deviceId, lessonContent]
  );

  const sendMessage = useCallback(async (userText: string, ctxOverride?: string | null) => {
    if (!userText.trim() || streaming || !lessonContent) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let accumulated = "";
    try {
      const res = await fetch("/api/chat-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonContent: lessonContent.claude_md_content,
          messages: newMessages,
          previousContext: ctxOverride !== undefined ? ctxOverride : previousContext,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      // Remove the empty assistant placeholder + user message on error so retry is clean
      setMessages(messages);
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      alert(`Lỗi: ${msg}`);
    } finally {
      setStreaming(false);
      if (!accumulated) return;
      const finalMessages: ChatMessage[] = [...newMessages, { role: "assistant", content: accumulated }];
      if (autoSave) {
        const newId = await saveSession(finalMessages, currentSessionId);
        if (newId && !currentSessionId) setCurrentSessionId(newId as string);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === (newId || currentSessionId)
              ? { ...s, messages: finalMessages, updated_at: new Date().toISOString() }
              : s
          )
        );
      }
    }
  }, [messages, streaming, lessonContent, previousContext, currentSessionId, saveSession]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function toggleAutoSave() {
    const next = !autoSave;
    setAutoSave(next);
    localStorage.setItem("auto_save_sessions", String(next));
  }

  function getNextLesson(): { moduleId: string; lessonId: string } | null {
    if (!course) return null;
    const allLessons = course.structure.flatMap((mod) =>
      mod.lessons.map((l) => ({ moduleId: mod.id, lessonId: l.id }))
    );
    const currentIdx = allLessons.findIndex((l) => l.moduleId === moduleId && l.lessonId === lessonId);
    if (currentIdx >= 0 && currentIdx < allLessons.length - 1) return allLessons[currentIdx + 1];
    return null;
  }

  function handleNextLesson() {
    // Save current context before leaving
    if (course && messages.length > 0) {
      saveContextToStorage(courseId, moduleId, lessonId, messages);
    }
    const next = getNextLesson();
    if (next) {
      router.push(`/course/${courseId}/${next.moduleId}/${next.lessonId}`);
    }
  }

  function navigateToLesson(mId: string, lId: string) {
    if (messages.length > 0) {
      saveContextToStorage(courseId, moduleId, lessonId, messages);
    }
    setSidebarOpen(false);
    router.push(`/course/${courseId}/${mId}/${lId}`);
  }

  function loadSession(session: ChatSession) {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setStarted(true);
    setShowHistory(false);
  }

  async function deleteSession(sessionId: string) {
    await fetch(`/api/sessions?id=${sessionId}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      setStarted(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Đang tải...</div>;
  if (!course || !lessonContent) return (
    <div className="text-center py-16">
      <p className="text-slate-500 mb-4">Không tìm thấy bài học</p>
      <Link href="/library" className="text-blue-600 hover:underline">← Thư viện</Link>
    </div>
  );

  const nextLesson = getNextLesson();
  const currentLessonName = lessonContent.name;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 flex-shrink-0 border-b border-slate-200 bg-slate-50 -mx-4 px-4">
        <Link href="/library" className="text-slate-500 hover:text-slate-700 text-sm flex-shrink-0">←</Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 truncate">{course.title}</p>
          <h1 className="font-semibold text-slate-800 text-sm truncate">
            {moduleId}.{lessonId} — {currentLessonName}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={toggleAutoSave}
            title={autoSave ? "Đang tự động lưu — bấm để tắt" : "Không lưu — bấm để bật"}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              autoSave
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100"
            }`}
          >
            💾 <span className="hidden sm:inline">{autoSave ? "Đang lưu" : "Không lưu"}</span>
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setSidebarOpen(false); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <span>📋</span>
            {sessions.length > 0 && (
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
                {sessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setShowHistory(false); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            📚 Bài học
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 -mx-4 px-4 py-3 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600">Lịch sử hội thoại</p>
            <button
              onClick={() => { setMessages([]); setCurrentSessionId(null); setStarted(false); setShowHistory(false); }}
              className="text-xs text-blue-600 hover:underline"
            >
              + Hội thoại mới
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Chưa có hội thoại nào được lưu.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    s.id === currentSessionId ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => loadSession(s)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">{formatDate(s.updated_at)}</p>
                    <p className="text-xs text-slate-700 truncate mt-0.5">
                      {s.messages.filter((m) => m.role === "user").length} câu hỏi •{" "}
                      {s.messages.find((m) => m.role === "assistant")?.content.slice(0, 50) ?? "..."}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sidebar (lesson list) */}
      {sidebarOpen && (
        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 -mx-4 px-4 py-3 max-h-72 overflow-y-auto">
          {course.structure.map((mod) => (
            <div key={mod.id} className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Module {mod.id}: {mod.name}
              </p>
              <div className="space-y-1">
                {mod.lessons.map((lesson) => {
                  const isActive = mod.id === moduleId && lesson.id === lessonId;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => navigateToLesson(mod.id, lesson.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span className="text-xs opacity-70 mr-1.5">{lesson.id}</span>
                      {lesson.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0 bg-white flex flex-col -mx-4">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!started && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">📖</div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">{currentLessonName}</h2>
              <p className="text-xs text-slate-400 mb-1">
                {course.scenario.company} — {course.scenario.role}
              </p>
              <p className="text-slate-500 text-sm mb-4 max-w-sm">{course.scenario.goal}</p>
              {previousContext && (
                <p className="text-xs text-green-600 mb-4 max-w-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  ✓ Đã tải context từ bài trước — Claude sẽ cá nhân hóa bài dạy
                </p>
              )}
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="mb-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-5 py-2.5"
                >
                  📋 Xem lại {sessions.length} hội thoại cũ
                </button>
              )}
              <button
                onClick={() => {
                  setStarted(true);
                  sendMessage("Bắt đầu bài học");
                }}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Bắt đầu bài {moduleId}.{lessonId} →
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0">🤖</div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : msg.content}
                {msg.role === "assistant" && streaming && i === messages.length - 1 && msg.content === "" && (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs flex-shrink-0 text-white">👤</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {started && (
          <div className="border-t border-slate-200 px-4 py-3 bg-white flex-shrink-0">
            {/* Next lesson button */}
            {nextLesson && !streaming && messages.length >= 2 && (
              <button
                onClick={handleNextLesson}
                className="w-full mb-2 flex items-center justify-between px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium hover:bg-green-100 transition-colors"
              >
                <span>Chuyển sang bài tiếp theo</span>
                <span>→</span>
              </button>
            )}
            {!nextLesson && !streaming && messages.length >= 2 && (
              <div className="w-full mb-2 flex items-center justify-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
                🎉 Bạn đã hoàn thành khóa học!
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Trả lời hoặc đặt câu hỏi..."
                rows={1}
                className="flex-1 border border-slate-300 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-28"
                style={{ minHeight: "42px" }}
                disabled={streaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderTable(block: string): string {
  const lines = block.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 3) return block;
  const headerCells = lines[0].split("|").slice(1, -1).map((c) => c.trim());
  const bodyLines = lines.slice(2);
  const thead = `<thead><tr>${headerCells
    .map((c) => `<th class="border border-slate-300 bg-slate-100 px-3 py-1.5 text-left text-xs font-semibold">${c}</th>`)
    .join("")}</tr></thead>`;
  const tbody = bodyLines
    .map((row) => {
      const cells = row.split("|").slice(1, -1).map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td class="border border-slate-300 px-3 py-1.5 text-xs">${c}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table class="border-collapse border border-slate-300 my-3 w-full text-sm overflow-x-auto">${thead}<tbody>${tbody}</tbody></table>`;
}

function renderMarkdown(text: string): string {
  // Extract table blocks → replace with placeholders to avoid HTML escaping
  const tables: string[] = [];
  text = text.replace(/^(\|.+\|[ \t]*\n)([ \t]*\|[-: |]+\|[ \t]*\n)((?:[ \t]*\|.+\|[ \t]*\n?)+)/gm, (match) => {
    const idx = tables.length;
    tables.push(renderTable(match));
    return `%%TABLE_${idx}%%`;
  });

  let result = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-slate-200 px-1 rounded text-xs'>$1</code>")
    .replace(/^### (.+)$/gm, "<h3 class='font-semibold text-base mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='font-semibold text-lg mt-4 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='font-bold text-xl mt-4 mb-2'>$1</h1>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4 list-decimal'>$2</li>")
    .replace(/\n\n/g, "</p><p class='mt-2'>")
    .replace(/\n/g, "<br/>");

  // Re-insert rendered tables
  tables.forEach((html, idx) => {
    result = result.replace(`%%TABLE_${idx}%%`, html);
  });

  return result;
}
