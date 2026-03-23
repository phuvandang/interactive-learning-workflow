"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lesson } from "@/types";
import { formatDate } from "@/lib/utils";

export default function LibraryPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchLessons() {
    const res = await fetch("/api/lessons");
    const data = await res.json();
    setLessons(data.lessons || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLessons();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Xóa bài học này?")) return;
    setDeletingId(id);
    await fetch(`/api/lessons?id=${id}`, { method: "DELETE" });
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Thư Viện Bài Học</h1>
          <p className="text-slate-500 mt-1">{lessons.length} bài học đã tạo</p>
        </div>
        <Link
          href="/"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Tạo bài học mới
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">Đang tải...</div>
      )}

      {!loading && lessons.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-slate-500 mb-4">Chưa có bài học nào</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">
            Tạo bài học đầu tiên →
          </Link>
        </div>
      )}

      {!loading && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-800 truncate">{lesson.title}</h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <span className="text-xs text-slate-400">{formatDate(lesson.created_at)}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {lesson.language === "vi" ? "🇻🇳 Tiếng Việt" : "🇺🇸 English"}
                  </span>
                  <a
                    href={lesson.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    YouTube →
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-4">
                <Link
                  href={`/learn/${lesson.id}`}
                  className="flex-1 sm:flex-none text-center bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Học ngay
                </Link>
                <button
                  onClick={() => handleDelete(lesson.id)}
                  disabled={deletingId === lesson.id}
                  className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg border border-red-100 hover:border-red-200 transition-colors disabled:opacity-50"
                >
                  {deletingId === lesson.id ? "..." : "Xóa"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
