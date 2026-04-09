"use client";

import { useEffect, useRef, useState } from "react";
import { Source, SourceMeta, SourceType } from "@/types";

interface AddSourceMode {
  type: "lesson" | "course";
  id: string;
  existingTranscript: string;
  existingSources: SourceMeta[];
  primaryTitle: string;
  primaryVideoId: string;
  primaryVideoUrl: string;
}

interface Props {
  onDone: (data: {
    sources: Source[];
    combinedContent: string;
    primaryTitle: string;
    primaryVideoId: string;
    primaryVideoUrl: string;
    updateMode?: { type: "lesson" | "course"; id: string };
  }) => void;
}

export default function StepInput({ onDone }: Props) {
  const [newSources, setNewSources] = useState<Source[]>([]);
  const [addMode, setAddMode] = useState<SourceType | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if navigated here from "Tạo mới từ nguồn" or "Thêm nguồn mới"
  useEffect(() => {
    const reuseRaw = localStorage.getItem("reuse_sources");
    if (reuseRaw) {
      localStorage.removeItem("reuse_sources");
      try { onDone(JSON.parse(reuseRaw)); } catch { /* ignore */ }
      return;
    }
    const addRaw = localStorage.getItem("add_source_mode");
    if (addRaw) {
      try { setAddSourceMode(JSON.parse(addRaw)); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSource(id: string, patch: Partial<Source>) {
    setNewSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSource(id: string) {
    setNewSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function addYouTube() {
    if (!ytUrl.trim()) return;
    const id = crypto.randomUUID();
    setNewSources((prev) => [...prev, { id, type: "youtube", label: ytUrl, content: "", wordCount: 0, status: "loading", videoUrl: ytUrl }]);
    setYtUrl("");
    setAddMode(null);
    try {
      const res = await fetch("/api/transcript", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: ytUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateSource(id, { label: data.title, content: data.transcript, wordCount: data.transcript.split(/\s+/).filter(Boolean).length, status: "done", videoId: data.videoId, videoUrl: ytUrl });
    } catch (err) {
      updateSource(id, { status: "error", error: err instanceof Error ? err.message : "Lỗi không xác định" });
    }
  }

  async function addPDF(file: File) {
    const id = crypto.randomUUID();
    setNewSources((prev) => [...prev, { id, type: "pdf", label: file.name, content: "", wordCount: 0, status: "loading" }]);
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
    setNewSources((prev) => [...prev, { id, type: "text", label: "Văn bản dán", content: pasteText.trim(), wordCount, status: "done" }]);
    setPasteText("");
    setAddMode(null);
  }

  function handleContinue() {
    const doneNewSources = newSources.filter((s) => s.status === "done");

    if (addSourceMode) {
      // Update mode: existing transcript + new sources appended
      const newContent = doneNewSources
        .map((s, i) => {
          const typeLabel = s.type === "youtube" ? `YouTube - "${s.label}"` : s.type === "pdf" ? `PDF - "${s.label}"` : "Văn bản dán";
          return `[Nguồn mới ${i + 1}: ${typeLabel}]\n${s.content}`;
        })
        .join("\n\n");
      const combinedContent = newContent
        ? `${addSourceMode.existingTranscript}\n\n${newContent}`
        : addSourceMode.existingTranscript;

      // All sources = existing meta converted to fake Source objects + new real sources
      const existingAsSources: Source[] = addSourceMode.existingSources.map((s) => ({
        id: crypto.randomUUID(), type: s.type, label: s.label, content: "", wordCount: s.wordCount, status: "done" as const,
        videoUrl: s.type === "youtube" ? addSourceMode.primaryVideoUrl : undefined,
        videoId: s.type === "youtube" ? addSourceMode.primaryVideoId : undefined,
      }));
      const allSources = [...existingAsSources, ...doneNewSources];

      localStorage.removeItem("add_source_mode");
      onDone({
        sources: allSources,
        combinedContent,
        primaryTitle: addSourceMode.primaryTitle,
        primaryVideoId: addSourceMode.primaryVideoId,
        primaryVideoUrl: addSourceMode.primaryVideoUrl,
        updateMode: { type: addSourceMode.type, id: addSourceMode.id },
      });
    } else {
      // Normal mode
      const combinedContent = doneNewSources
        .map((s, i) => {
          const typeLabel = s.type === "youtube" ? `YouTube - "${s.label}"` : s.type === "pdf" ? `PDF - "${s.label}"` : "Văn bản dán";
          return `[Nguồn ${i + 1}: ${typeLabel}]\n${s.content}`;
        })
        .join("\n\n");
      const firstYT = doneNewSources.find((s) => s.type === "youtube");
      onDone({
        sources: doneNewSources,
        combinedContent,
        primaryTitle: firstYT?.label || `Tổng hợp ${doneNewSources.length} nguồn`,
        primaryVideoId: firstYT?.videoId || "",
        primaryVideoUrl: firstYT?.videoUrl || "",
      });
    }
  }

  const doneNewCount = newSources.filter((s) => s.status === "done").length;
  const newWords = newSources.filter((s) => s.status === "done").reduce((sum, s) => sum + s.wordCount, 0);
  const existingWords = addSourceMode?.existingSources.reduce((sum, s) => sum + s.wordCount, 0) || 0;
  const canContinue = addSourceMode ? doneNewCount > 0 : doneNewCount > 0;

  return (
    <div className="max-w-2xl">
      {addSourceMode ? (
        <>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Thêm Nguồn Mới</h1>
          <p className="text-slate-500 mb-2 text-sm">
            Thêm nguồn tài liệu mới vào <strong>{addSourceMode.primaryTitle}</strong>
          </p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
            ⚠️ Nội dung {addSourceMode.type === "lesson" ? "bài học" : "khóa học"} sẽ được tạo lại hoàn toàn từ tất cả nguồn (cũ + mới).
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Biến Tài Liệu Thành Bài Học Tương Tác</h1>
          <p className="text-slate-500 mb-8">Thêm nhiều nguồn → AI tổng hợp → học sâu hơn với Claude làm gia sư</p>
        </>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Existing sources (read-only) */}
        {addSourceMode && addSourceMode.existingSources.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Nguồn hiện tại · {existingWords.toLocaleString()} từ
            </p>
            <div className="space-y-2">
              {addSourceMode.existingSources.map((src, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 opacity-70">
                  <span className="text-lg flex-shrink-0">
                    {src.type === "youtube" ? "🎬" : src.type === "pdf" ? "📄" : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-600 truncate">{src.label}</p>
                    <p className="text-xs text-slate-400">✓ {src.wordCount.toLocaleString()} từ</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">đã có</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Nguồn mới cần thêm
                {doneNewCount > 0 && <span className="ml-2 text-slate-400 font-normal normal-case">+{doneNewCount} nguồn · +{newWords.toLocaleString()} từ</span>}
              </p>
            </div>
          </div>
        )}

        {/* Header (normal mode) */}
        {!addSourceMode && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Nguồn tài liệu
              {doneNewCount > 0 && (
                <span className="ml-2 text-slate-400 font-normal">
                  {doneNewCount} nguồn · {newWords.toLocaleString()} từ
                </span>
              )}
            </h2>
          </div>
        )}

        {/* New source cards */}
        {newSources.length > 0 && (
          <div className="space-y-2 mb-4">
            {newSources.map((src) => (
              <div key={src.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                src.status === "error" ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50"
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
              <input type="text" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addYouTube(); if (e.key === "Escape") setAddMode(null); }}
                placeholder="https://www.youtube.com/watch?v=..." autoFocus
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
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder="Dán nội dung văn bản vào đây..." autoFocus rows={5}
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
            <p className="text-xs text-slate-500 mb-2">Thêm nguồn{addSourceMode ? " mới" : ""}:</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setAddMode("youtube")} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors">
                🔗 YouTube
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors">
                📁 PDF
              </button>
              <button onClick={() => setAddMode("text")} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors">
                📋 Paste text
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) addPDF(f); e.target.value = ""; }}
            />
          </div>
        )}

        {/* Continue button */}
        {canContinue && addMode === null && (
          <button onClick={handleContinue} className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            {addSourceMode
              ? `Tiếp tục → Tạo lại ${addSourceMode.type === "lesson" ? "bài học" : "khóa học"} (+${doneNewCount} nguồn mới)`
              : `Tiếp tục → Generate Bài Học (${doneNewCount} nguồn · ${newWords.toLocaleString()} từ)`
            }
          </button>
        )}

        {/* Cancel update mode */}
        {addSourceMode && (
          <button onClick={() => { localStorage.removeItem("add_source_mode"); setAddSourceMode(null); setNewSources([]); }}
            className="mt-2 w-full text-sm text-slate-500 hover:text-slate-700 py-2">
            Hủy
          </button>
        )}
      </div>
    </div>
  );
}
