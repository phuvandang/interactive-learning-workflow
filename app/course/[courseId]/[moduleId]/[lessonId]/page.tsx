"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Course, CourseLessonContent, ChatMessage } from "@/types";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("device_id", id); }
  return id;
}

export default function CourseLessonPage() {
  const { courseId, moduleId, lessonId } = useParams<{ courseId: string; moduleId: string; lessonId: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessonContent, setLessonContent] = useState<CourseLessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

      const lesson = lessonsData.lessons?.find(
        (l: CourseLessonContent) => l.module_id === moduleId && l.lesson_id === lessonId
      );
      if (lesson) setLessonContent(lesson);
      setLoading(false);
    }
    load();
  }, [courseId, moduleId, lessonId]);

  useEffect(() => {
    // Reset chat when lesson changes
    setMessages([]);
    setStarted(false);
  }, [lessonId, moduleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userText: string) => {
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
        body: JSON.stringify({ lessonContent: lessonContent.claude_md_content, messages: newMessages }),
      });
      if (!res.ok) throw new Error("API error");

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
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Có lỗi xảy ra. Vui lòng thử lại." };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, lessonContent]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function navigateToLesson(mId: string, lId: string) {
    setSidebarOpen(false);
    router.push(`/course/${courseId}/${mId}/${lId}`);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Đang tải...</div>;
  if (!course || !lessonContent) return (
    <div className="text-center py-16">
      <p className="text-slate-500 mb-4">Không tìm thấy bài học</p>
      <Link href="/library" className="text-blue-600 hover:underline">← Thư viện</Link>
    </div>
  );

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
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white flex-shrink-0"
        >
          📚 Bài học
        </button>
      </div>

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
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
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
              <p className="text-slate-500 text-sm mb-6 max-w-sm">{course.scenario.goal}</p>
              <button
                onClick={() => { setStarted(true); sendMessage("Bắt đầu bài học"); }}
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

function renderMarkdown(text: string): string {
  return text
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
    .replace(/\n/g, "<br/>")
}
