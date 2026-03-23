"use client";

import { useState } from "react";
import { Language, CourseModule, CourseScenario } from "@/types";

interface Props {
  videoTitle: string;
  transcript: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onDone: (claudeMd: string) => void;
  onDoneCourse: (data: { title: string; scenario: CourseScenario; structure: CourseModule[] }) => void;
  onBack: () => void;
}

const STATUS_MESSAGES = [
  "Đang phân tích transcript...",
  "Đang xác định các khái niệm chính...",
  "Đang tạo cấu trúc bài học...",
  "Đang viết câu hỏi tương tác...",
  "Đang hoàn thiện...",
];

export default function StepGenerate({
  videoTitle,
  transcript,
  language,
  onLanguageChange,
  onDone,
  onDoneCourse,
  onBack,
}: Props) {
  const [mode, setMode] = useState<"single" | "course">("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);
  const [scenarioHint, setScenarioHint] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setStatusIdx(0);

    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 4000);

    try {
      if (mode === "single") {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: videoTitle, transcript, language }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onDone(data.claudeMd);
      } else {
        const res = await fetch("/api/generate-course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: videoTitle, transcript, language, scenarioHint }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onDoneCourse({
          title: data.structure.title,
          scenario: data.structure.scenario,
          structure: data.structure.modules,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Tạo Bài Học</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Video info */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Video</p>
          <p className="font-medium text-slate-800">{videoTitle}</p>
          <p className="text-sm text-slate-500 mt-1">{transcript.split(" ").length} từ transcript</p>
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Hình thức học</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("single")}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                mode === "single"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xl mb-1">📄</div>
              <p className={`text-sm font-medium ${mode === "single" ? "text-blue-700" : "text-slate-700"}`}>
                Bài học đơn lẻ
              </p>
              <p className="text-xs text-slate-400 mt-0.5">1 gia sư cá nhân hóa</p>
            </button>
            <button
              onClick={() => setMode("course")}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                mode === "course"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xl mb-1">📚</div>
              <p className={`text-sm font-medium ${mode === "course" ? "text-blue-700" : "text-slate-700"}`}>
                Khóa học đầy đủ
              </p>
              <p className="text-xs text-slate-400 mt-0.5">6–10 bài có kịch bản</p>
            </button>
          </div>
        </div>

        {/* Scenario hint (only for course mode) */}
        {mode === "course" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Gợi ý kịch bản <span className="text-slate-400 font-normal">(tuỳ chọn)</span>
            </label>
            <input
              type="text"
              value={scenarioHint}
              onChange={(e) => setScenarioHint(e.target.value)}
              placeholder='VD: "Startup fintech, tôi là product manager"'
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">Để trống → Claude tự tạo kịch bản phù hợp</p>
          </div>
        )}

        {/* Language selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Ngôn ngữ bài học</label>
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
            {mode === "single" ? "✨ Generate Bài Học" : "✨ Tạo Cấu Trúc Khóa Học"}
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-3 text-blue-600">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">{STATUS_MESSAGES[statusIdx]}</span>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {mode === "single" ? "Thường mất 15–30 giây" : "Thường mất 20–40 giây"}
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}
      </div>

      <button onClick={onBack} className="mt-4 text-sm text-slate-500 hover:text-slate-700">
        ← Quay lại
      </button>
    </div>
  );
}
