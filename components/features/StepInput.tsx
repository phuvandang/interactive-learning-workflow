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

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setTranscript("");

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranscript(data.transcript);
      setTitle(data.title);
      setVideoId(data.videoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
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
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleFetch}
            disabled={loading || !url.trim()}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? "Đang lấy..." : "Lấy Transcript"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

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
              <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-slate-600 leading-relaxed">
                {transcript}
              </div>
            )}

            <button
              onClick={() => onDone({ url, videoId, title, transcript })}
              className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Tiếp tục → Generate Bài Học
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
