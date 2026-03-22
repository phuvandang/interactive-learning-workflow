"use client";

import { useState } from "react";
import { Language } from "@/types";

interface Props {
  videoTitle: string;
  transcript: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onDone: (claudeMd: string) => void;
  onBack: () => void;
}

const STATUS_MESSAGES = [
  "Đang phân tích transcript...",
  "Đang xác định các khái niệm chính...",
  "Đang tạo cấu trúc bài học...",
  "Đang viết câu hỏi tương tác...",
  "Đang hoàn thiện bài học...",
];

export default function StepGenerate({
  videoTitle,
  transcript,
  language,
  onLanguageChange,
  onDone,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setStatusIdx(0);

    // Cycle through status messages
    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 4000);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: videoTitle, transcript, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone(data.claudeMd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Generate Bài Học</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Video info */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Video</p>
          <p className="font-medium text-slate-800">{videoTitle}</p>
          <p className="text-sm text-slate-500 mt-1">
            {transcript.split(" ").length} từ transcript
          </p>
        </div>

        {/* Language selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Ngôn ngữ bài học
          </label>
          <div className="flex gap-3">
            {(["vi", "en"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  language === lang
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {lang === "vi" ? "🇻🇳 Tiếng Việt" : "🇺🇸 English"}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        {!loading && (
          <button
            onClick={handleGenerate}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            ✨ Generate Bài Học với Claude AI
          </button>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-3 text-blue-600">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">{STATUS_MESSAGES[statusIdx]}</span>
            </div>
            <p className="text-xs text-slate-400 mt-3">Thường mất 15-30 giây</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={onBack}
        className="mt-4 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Quay lại
      </button>
    </div>
  );
}
