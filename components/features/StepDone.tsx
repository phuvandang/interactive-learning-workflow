"use client";

import Link from "next/link";

interface Props {
  videoTitle: string;
  lessonId?: string;
  onNew: () => void;
}

export default function StepDone({ videoTitle, lessonId, onNew }: Props) {
  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Bài học đã sẵn sàng!</h2>
      <p className="text-slate-500 mb-8">
        <span className="font-medium text-slate-700">{videoTitle}</span>
        <br />
        đã được lưu vào thư viện.
      </p>

      <div className="flex flex-col gap-3 items-center">
        {lessonId && (
          <Link
            href={`/learn/${lessonId}`}
            className="w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors text-center"
          >
            🚀 Bắt đầu học ngay
          </Link>
        )}
        <button
          onClick={onNew}
          className="w-full max-w-xs border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
        >
          + Tạo bài học mới
        </button>
        <Link
          href="/library"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Xem thư viện
        </Link>
      </div>
    </div>
  );
}
