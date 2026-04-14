"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Lesson, ChatSession, ChatMessage } from "@/types";

function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [autoSave, setAutoSave] = useState(true);
  const [chatError, setChatError] = useState("");
  const [completionCode, setCompletionCode] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [claimingCode, setClaimingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const completionCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const did = getOrCreateDeviceId();
    setDeviceId(did);
    const saved = localStorage.getItem("auto_save_sessions");
    if (saved === "false") setAutoSave(false);
    // Load previously claimed code if exists
    const savedCode = localStorage.getItem(`completion_code_${id}`);
    if (savedCode) setCompletionCode(savedCode);
  }, [id]);

  useEffect(() => {
    completionCodeRef.current = completionCode;
  }, [completionCode]);

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
    if (!deviceId || !id) return;
    async function loadSessions() {
      const res = await fetch(`/api/sessions?lesson_id=${id}&device_id=${deviceId}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    }
    loadSessions();
  }, [deviceId, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function toggleAutoSave() {
    const next = !autoSave;
    setAutoSave(next);
    localStorage.setItem("auto_save_sessions", String(next));
  }

  const saveSession = useCallback(
    async (msgs: ChatMessage[], sessionId: string | null) => {
      if (!deviceId || msgs.length === 0) return;
      if (sessionId) {
        await fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionId, messages: msgs }),
        });
      } else {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lesson_id: id, lesson_title: lesson?.title, device_id: deviceId, messages: msgs }),
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
    [deviceId, id, lesson]
  );

  async function sendMessage(userText: string) {
    if (!userText.trim() || streaming) return;

    if (userText.trim() === "/clear") {
      setMessages([]);
      setCurrentSessionId(null);
      setStarted(false);
      setInput("");
      return;
    }

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let accumulated = "";

    try {
      // Build previous context from past sessions (only on first message of new session)
      let previousContext: string | null = null;
      if (messages.length === 0 && sessions.length > 0) {
        const pastUserMessages = sessions
          .filter((s) => s.id !== currentSessionId)
          .flatMap((s) => (s.messages || []).filter((m) => m.role === "user" && m.content !== "Bắt đầu bài học"))
          .map((m) => m.content)
          .join("\n---\n");
        if (pastUserMessages.trim()) previousContext = pastUserMessages;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: id, messages: newMessages, previousContext }),
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
      setChatError(msg);
    } finally {
      setStreaming(false);
      if (!accumulated) {
        // Remove empty assistant bubble if no response came through
        setMessages((prev) => prev.filter((m) => m.content !== ""));
        return;
      }
      // Auto-save after assistant responds
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        { role: "assistant", content: accumulated },
      ];
      if (autoSave) {
        const newId = await saveSession(finalMessages, currentSessionId);
        if (newId && !currentSessionId) setCurrentSessionId(newId);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === (newId || currentSessionId)
              ? { ...s, messages: finalMessages, updated_at: new Date().toISOString() }
              : s
          )
        );
      }
    }
  }

  async function startLesson() {
    setStarted(true);
    await sendMessage("Bắt đầu bài học");
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

  function startNewSession() {
    setMessages([]);
    setCurrentSessionId(null);
    setStarted(false);
    setShowHistory(false);
  }

  async function claimCode() {
    if (!deviceId || !id || claimingCode) return;
    setClaimingCode(true);
    try {
      const res = await fetch("/api/completion-codes/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: id, deviceId }),
      });
      const data = await res.json();
      if (data.code) {
        setCompletionCode(data.code);
        localStorage.setItem(`completion_code_${id}`, data.code);
        setShowCodeModal(true);
      } else {
        setChatError(data.error || "Lỗi khi nhận mã. Vui lòng thử lại.");
      }
    } catch {
      setChatError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setClaimingCode(false);
    }
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact header */}
      <div className="flex items-center gap-3 py-3 flex-shrink-0 border-b border-slate-200 bg-slate-50 -mx-4 px-4">
        <Link href="/library" className="text-slate-500 hover:text-slate-700 flex-shrink-0 text-sm">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-slate-800 text-sm truncate">{lesson.title}</h1>
          <a
            href={lesson.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Xem video gốc →
          </a>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {completionCode && (
            <button
              onClick={() => setShowCodeModal(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              title="Xem mã hoàn thành của bạn"
            >
              ✓ <span className="hidden sm:inline">Đã hoàn thành</span>
            </button>
          )}
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
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <span>📋</span>
            <span className="hidden sm:inline">Lịch sử</span>
            {sessions.length > 0 && (
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
                {sessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 -mx-4 px-4 py-3 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600">Lịch sử hội thoại</p>
            <button
              onClick={startNewSession}
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
                    s.id === currentSessionId
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
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

      {/* Chat area */}
      <div className="flex-1 min-h-0 bg-white flex flex-col -mx-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!started && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">🎓</div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Sẵn sàng học chưa?
              </h2>
              <p className="text-slate-500 mb-6 max-w-sm text-sm">
                Claude sẽ dạy bạn nội dung video theo từng phần và sẵn sàng trả lời mọi câu hỏi.
              </p>
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="mb-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-5 py-2.5"
                >
                  📋 Xem lại {sessions.length} hội thoại cũ
                </button>
              )}
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
              className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
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
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs flex-shrink-0 text-white">
                  👤
                </div>
              )}
            </div>
          ))}
          {started && messages.length >= 2 && !completionCode && (
            <div className="flex justify-center py-4">
              <button
                onClick={claimCode}
                disabled={claimingCode}
                className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {claimingCode ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang cấp mã...
                  </>
                ) : (
                  "🏆 Nhận mã hoàn thành"
                )}
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {started && (
          <div className="border-t border-slate-200 px-4 py-3 bg-white flex-shrink-0">
            {chatError && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <span>Lỗi: {chatError}</span>
                <button onClick={() => setChatError("")} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
              </div>
            )}
            {streaming && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <span>Đang chờ phản hồi...</span>
                <button onClick={() => { setStreaming(false); setMessages((prev) => prev.filter((m) => m.content !== "")); }} className="text-amber-600 hover:text-amber-800 flex-shrink-0 font-medium">Huỷ</button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi bất kỳ điều gì về video..."
                rows={1}
                className="flex-1 border border-slate-300 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-28"
                style={{ minHeight: "42px" }}
                disabled={streaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Completion Code Modal */}
      {showCodeModal && completionCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-lg font-bold text-slate-800">Chúc mừng!</h2>
              <p className="text-sm text-slate-500 mt-1">Bạn đã hoàn thành bài học</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">Mã xác nhận của bạn</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-slate-800">
                {completionCode}
              </p>
            </div>
            <p className="text-xs text-slate-500 text-center mb-4">
              Lưu mã này lại và gửi cho quản lý để xác nhận bạn đã hoàn thành bài học.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(completionCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  } catch {
                    setChatError("Không thể copy — hãy copy thủ công.");
                  }
                }}
                className="flex-1 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {codeCopied ? "Đã copy! ✓" : "Copy mã"}
              </button>
              <button
                onClick={() => setShowCodeModal(false)}
                className="flex-1 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
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
    .replace(/\n/g, "<br/>");

  // Re-insert rendered tables
  tables.forEach((html, idx) => {
    result = result.replace(`%%TABLE_${idx}%%`, html);
  });

  return result;
}
