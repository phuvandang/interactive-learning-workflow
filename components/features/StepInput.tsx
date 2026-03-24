"use client";

import { useRef, useState } from "react";
import { Source, SourceType } from "@/types";

interface Props {
  onDone: (data: {
    sources: Source[];
    combinedContent: string;
    primaryTitle: string;
    primaryVideoId: string;
    primaryVideoUrl: string;
  }) => void;
}

export default function StepInput({ onDone }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [addMode, setAddMode] = useState<SourceType | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateSource(id: string, patch: Partial<Source>) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function addYouTube() {
    if (!ytUrl.trim()) return;
    const id = crypto.randomUUID();
    const newSource: Source = { id, type: "youtube", label: ytUrl, content: "", wordCount: 0, status: "loading", videoUrl: ytUrl };
    setSources((prev) => [...prev, newSource]);
    setYtUrl("");
    setAddMode(null);

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateSource(id, {
        label: data.title,
        content: data.transcript,
        wordCount: data.transcript.split(/\s+/).filter(Boolean).length,
        status: "done",
        videoId: data.videoId,
        videoUrl: ytUrl,
      });
    } catch (err) {
      updateSource(id, { status: "error", error: err instanceof Error ? err.message : "Lỗi không xác định" });
    }
  }

  async function addPDF(file: File) {
    const id = crypto.randomUUID();
    const newSource: Source = { id, type: "pdf", label: file.name, content: "", wordCount: 0, status: "loading" };
    setSources((prev) => [...prev, newSource]);
    setAddMode(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateSource(id, { label: data.filename, content: data.text, wordCount: data.wordCount, status: "done" });
    } catch (err) {
      updateSource(id, { status: "error", error: err instanceof Error ? err.message : "Lỗi không xác định" });
    }
  }

  function addPastedText() {
    if (!pasteText.trim()) return;
    const wordCount = pasteText.trim().split(/\s+/).filter(Boolean).length;
    const id = crypto.randomUUID();
    setSources((prev) => [...prev, { id, type: "text", label: "Văn bản dán", content: pasteText.trim(), wordCount, status: "done" }]);
    setPasteText("");
    setAddMode(null);
  }

  function buildCombinedContent(srcs: Source[]): string {
    return srcs
      .filter((s) => s.status === "done")
      .map((s, i) => {
        const typeLabel = s.type === "youtube" ? `YouTube - "${s.label}"` : s.type === "pdf" ? `PDF - "${s.label}"` : "Văn bản dán";
        return `[Nguồn ${i + 1}: ${typeLabel}]\n${s.content}`;
      })
      .join("\n\n");
  }

  function handleContinue() {
    const doneSources = sources.filter((s) => s.status === "done");
    const firstYT = doneSources.find((s) => s.type === "youtube");
    onDone({
      sources: doneSources,
      combinedContent: buildCombinedContent(doneSources),
      primaryTitle: firstYT?.label || `Tổng hợp ${doneSources.length} nguồn`,
      primaryVideoId: firstYT?.videoId || "",
      primaryVideoUrl: firstYT?.videoUrl || "",
    });
  }

  const totalWords = sources.filter((s) => s.status === "done").reduce((sum, s) => sum + s.wordCount, 0);
  const doneCount = sources.filter((s) => s.status === "done").length;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Biến Tài Liệu Thành Bài Học Tương Tác</h1>
      <p className="text-slate-500 mb-8">Thêm nhiều nguồn → AI tổng hợp → học sâu hơn với Claude làm gia sư</p>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Nguồn tài liệu
            {sources.length > 0 && (
              <span className="ml-2 text-slate-400 font-normal">
                {doneCount} nguồn · {totalWords.toLocaleString()} từ
              </span>
            )}
          </h2>
        </div>

        {/* Source cards */}
        {sources.length > 0 && (
          <div className="space-y-2 mb-4">
            {sources.map((src) => (
              <div key={src.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                src.status === "error" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
              }`}>
                <span className="text-lg flex-shrink-0">
                  {src.type === "youtube" ? "🎬" : src.type === "pdf" ? "📄" : "📋"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{src.label}</p>
                  {src.status === "loading" && <p className="text-xs text-slate-400">Đang xử lý...</p>}
                  {src.status === "done" && <p className="text-xs text-green-600">✓ {src.wordCount.toLocaleString()} từ</p>}
                  {src.status === "error" && <p className="text-xs text-red-600">{src.error}</p>}
                </div>
                {src.status === "loading" && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <button onClick={() => removeSource(src.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add YouTube inline form */}
        {addMode === "youtube" && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-700 mb-2">🔗 YouTube URL</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addYouTube(); if (e.key === "Escape") setAddMode(null); }}
                placeholder="https://www.youtube.com/watch?v=..."
                autoFocus
                className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button onClick={addYouTube} disabled={!ytUrl.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Thêm</button>
              <button onClick={() => setAddMode(null)} className="text-slate-400 hover:text-slate-600 px-2">✕</button>
            </div>
          </div>
        )}

        {/* Paste text inline form */}
        {addMode === "text" && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-700 mb-2">📋 Dán văn bản</p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Dán nội dung văn bản vào đây..."
              autoFocus
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => setAddMode(null)} className="text-sm text-slate-500 px-3 py-1.5 hover:text-slate-700">Hủy</button>
              <button onClick={addPastedText} disabled={!pasteText.trim()} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Thêm</button>
            </div>
          </div>
        )}

        {/* Add source buttons */}
        {addMode !== "youtube" && addMode !== "text" && (
          <div>
            <p className="text-xs text-slate-500 mb-2">Thêm nguồn:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAddMode("youtube")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
              >
                🔗 YouTube
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
              >
                📁 PDF
              </button>
              <button
                onClick={() => setAddMode("text")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors"
              >
                📋 Paste text
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) addPDF(f); e.target.value = ""; }}
            />
          </div>
        )}

        {/* Continue button */}
        {doneCount > 0 && addMode === null && (
          <button
            onClick={handleContinue}
            className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Tiếp tục → Generate Bài Học ({doneCount} nguồn · {totalWords.toLocaleString()} từ)
          </button>
        )}
      </div>
    </div>
  );
}
