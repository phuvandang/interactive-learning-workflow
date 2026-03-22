"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Lesson } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadLesson() {
      const res = await fetch("/api/lessons");
      const data = await res.json();
      const found = data.lessons?.find((l: Lesson) => l.id === id);
      if (found) setLesson(found);
      setLoading(false);
    }
    loadLesson();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(userText: string) {
    if (!userText.trim() || streaming) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: id,
          messages: newMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("API error");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulated,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Có lỗi xảy ra. Vui lòng thử lại.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function startLesson() {
    setStarted(true);
    await sendMessage("Bắt đầu bài học");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Đang tải bài học...
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">Không tìm thấy bài học</p>
        <Link href="/library" className="text-blue-600 hover:underline">
          ← Quay lại thư viện
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="font-semibold text-slate-800 text-lg line-clamp-1">
            {lesson.title}
          </h1>
          <a
            href={lesson.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Xem video gốc →
          </a>
        </div>
        <Link
          href="/library"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Thư viện
        </Link>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!started && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">🎓</div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Sẵn sàng học chưa?
              </h2>
              <p className="text-slate-500 mb-6 max-w-sm">
                Claude sẽ dạy bạn nội dung video theo từng phần và sẵn sàng
                trả lời mọi câu hỏi.
              </p>
              <button
                onClick={startLesson}
                disabled={streaming}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Bắt đầu học →
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm flex-shrink-0 mr-3 mt-1">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-50 text-slate-800 border border-slate-200"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                  />
                ) : (
                  msg.content
                )}
                {msg.role === "assistant" &&
                  streaming &&
                  i === messages.length - 1 &&
                  msg.content === "" && (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm flex-shrink-0 ml-3 mt-1 text-white">
                  👤
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {started && (
          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi bất kỳ điều gì về video... (Enter để gửi)"
                rows={1}
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
                style={{ minHeight: "44px" }}
                disabled={streaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Shift+Enter để xuống dòng
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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
