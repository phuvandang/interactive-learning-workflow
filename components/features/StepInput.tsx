"use client";

import { useState } from "react";

interface Props {
  onDone: (data: {
    url: string;
    videoId: string;
    title: string;
    transcript: string;
  }) => void;
}

export default function StepInput({ onDone }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");

  async function fetchTranscript(manual?: string) {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setTranscript("");

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, manualTranscript: manual }),
      });
      const data = await res.json();

      if (res.status === 422 && data.error === "NO_TRANSCRIPT") {
        // Show manual input fallback
        setShowManualInput(true);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.error);

      setTranscript(data.transcript);
      setTitle(data.title);
      setVideoId(data.videoId);
      setShowManualInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmitManual() {
    if (!manualTranscript.trim()) return;
    fetchTranscript(manualTranscript);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        Biến YouTube Video Thành Bài Học Tương Tác
      </h1>
      <p className="text-slate-500 mb-8">
        Dán link video → AI tạo bài học → học sâu hơn với Claude làm gia sư
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          YouTube URL
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !showManualInput && fetchTranscript()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {!showManualInput && (
            <button
              onClick={() => fetchTranscript()}
              disabled={loading || !url.trim()}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? "Đang lấy..." : "Lấy Transcript"}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Manual transcript fallback */}
        {showManualInput && !transcript && (
          <div className="mt-5">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
              <strong>Không tự lấy được transcript.</strong> Bạn có thể copy thủ công:
              <ol className="mt-2 space-y-1 list-decimal list-inside text-amber-700">
                <li>Mở video YouTube → nhấn <strong>...</strong> bên dưới video → <strong>Show transcript</strong></li>
                <li>Copy toàn bộ nội dung → paste vào ô bên dưới</li>
              </ol>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Paste transcript vào đây
            </label>
            <textarea
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              placeholder="Paste nội dung transcript từ YouTube vào đây..."
              rows={8}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleSubmitManual}
                disabled={loading || !manualTranscript.trim()}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Đang xử lý..." : "Dùng Transcript Này"}
              </button>
              <button
                onClick={() => { setShowManualInput(false); setManualTranscript(""); }}
                className="px-4 py-2.5 rounded-lg text-sm text-slate-500 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        {/* Success state */}
        {transcript && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-slate-800">{title}</p>
                <p className="text-sm text-green-600 mt-0.5">
                  ✓ Transcript đã sẵn sàng ({transcript.split(" ").length} từ)
                </p>
              </div>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showTranscript ? "Ẩn" : "Xem"} transcript
              </button>
            </div>

            {showTranscript && (
              <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-slate-600 leading-relaxed mb-4">
                {transcript}
              </div>
            )}

            <button
              onClick={() => onDone({ url, videoId, title, transcript })}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Tiếp tục → Generate Bài Học
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
