"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Language, SourceMeta } from "@/types";

interface Props {
  claudeMd: string;
  videoTitle: string;
  videoUrl: string;
  videoId: string;
  language: Language;
  transcript: string;
  sources?: SourceMeta[];
  onChange: (md: string) => void;
  onDone: (lessonId?: string) => void;
  onBack: () => void;
}

export default function StepPreview({
  claudeMd,
  videoTitle,
  videoUrl,
  videoId,
  language,
  transcript,
  sources,
  onChange,
  onDone,
  onBack,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(redirect: boolean) {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          youtube_url: videoUrl,
          youtube_video_id: videoId,
          language,
          transcript,
          claude_md_content: claudeMd,
          sources: sources || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (redirect) {
        router.push(`/learn/${data.lesson.id}`);
      } else {
        onDone(data.lesson.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Preview & Chỉnh Sửa</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
          >
            ← Regenerate
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu vào thư viện"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Đang lưu..." : "🚀 Lưu & Học ngay"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">CLAUDE.md</span>
          <span className="text-xs text-slate-400">— có thể chỉnh sửa trước khi lưu</span>
        </div>
        <textarea
          value={claudeMd}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[300px] sm:h-[500px] p-4 sm:p-6 font-mono text-sm text-slate-700 resize-none focus:outline-none leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
