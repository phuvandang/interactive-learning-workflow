"use client";

import { useState, useRef, useEffect } from "react";

export default function ScriptsPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [videoId, setVideoId] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  async function handleExtract() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setTitle("");
    setTranscript("");
    setVideoId("");
    setEditing(false);

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lấy transcript");
      setTitle(data.title || "Không có tiêu đề");
      setTranscript(data.transcript || "");
      setVideoId(data.videoId || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload(format: "txt" | "md") {
    const slug = title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const filename = `${slug || "script"}.${format}`;
    const content = format === "md" ? `# ${title}\n\n${transcript}` : transcript;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleExtract();
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setShowDownload(false);
      }
    }
    if (showDownload) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDownload]);

  const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="py-8 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">YouTube Script</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dán link YouTube để lấy phụ đề / transcript của video
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          onClick={handleExtract}
          disabled={loading || !url.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Đang lấy..." : "Lấy script"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {transcript && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-800 truncate">{title}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{wordCount.toLocaleString()} từ</span>
                {videoId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Xem video
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setEditing(!editing);
                  if (!editing) setTimeout(() => textareaRef.current?.focus(), 50);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {editing ? "Xong" : "Chỉnh sửa"}
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {copied ? "Đã copy!" : "Copy"}
              </button>
              <div className="relative" ref={downloadRef}>
                <button
                  onClick={() => setShowDownload(!showDownload)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Tải về
                </button>
                {showDownload && (
                  <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    <button
                      onClick={() => handleDownload("txt")}
                      className="block w-full px-4 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Text (.txt)
                    </button>
                    <button
                      onClick={() => handleDownload("md")}
                      className="block w-full px-4 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Markdown (.md)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {editing ? (
            <textarea
              ref={textareaRef}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full min-h-[60vh] p-4 rounded-lg border border-slate-300 text-sm leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono"
            />
          ) : (
            <div className="p-4 rounded-lg border border-slate-200 bg-white text-sm leading-relaxed text-slate-700 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
