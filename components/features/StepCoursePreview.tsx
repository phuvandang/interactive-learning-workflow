"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CourseModule, CourseScenario, Language } from "@/types";

interface GeneratedLesson {
  module_id: string;
  lesson_id: string;
  name: string;
  claude_md_content: string;
  order_index: number;
}

type LessonStatus = "pending" | "generating" | "done" | "error";

interface Props {
  courseTitle: string;
  scenario: CourseScenario;
  structure: CourseModule[];
  transcript: string;
  videoUrl: string;
  videoId: string;
  language: Language;
  onBack: () => void;
}

export default function StepCoursePreview({
  courseTitle,
  scenario,
  structure,
  transcript,
  videoUrl,
  videoId,
  language,
  onBack,
}: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lessonStatuses, setLessonStatuses] = useState<Record<string, LessonStatus>>({});
  const [generatedLessons, setGeneratedLessons] = useState<GeneratedLesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState("");
  const [done, setDone] = useState(false);
  const [courseId, setCourseId] = useState("");

  const allLessons = structure.flatMap((mod) =>
    mod.lessons.map((l) => ({ ...l, module_id: mod.id, module_name: mod.name }))
  );

  const totalLessons = allLessons.length;
  const doneLessons = generatedLessons.length;

  async function handleGenerateAll() {
    setGenerating(true);
    setError("");
    const results: GeneratedLesson[] = [];

    for (let i = 0; i < allLessons.length; i++) {
      const lesson = allLessons[i];
      const lessonKey = `${lesson.module_id}-${lesson.id}`;

      setLessonStatuses((prev) => ({ ...prev, [lessonKey]: "generating" }));
      setCurrentLesson(`${lesson.module_id}.${lesson.id} — ${lesson.name}`);

      try {
        const res = await fetch("/api/generate-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lesson.id,
            lessonName: lesson.name,
            description: lesson.description,
            scenario,
            transcript,
            language,
            moduleName: lesson.module_name,
            allLessons: allLessons.map((l) => ({ id: l.id, name: l.name })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        results.push({
          module_id: lesson.module_id,
          lesson_id: lesson.id,
          name: lesson.name,
          claude_md_content: data.claudeMd,
          order_index: i,
        });
        setGeneratedLessons([...results]);
        setLessonStatuses((prev) => ({ ...prev, [lessonKey]: "done" }));
      } catch {
        setLessonStatuses((prev) => ({ ...prev, [lessonKey]: "error" }));
        setError(`Lỗi khi tạo bài ${lesson.id}: ${lesson.name}`);
        setGenerating(false);
        return;
      }
    }

    setGenerating(false);
    await saveCourse(results);
  }

  async function saveCourse(lessons: GeneratedLesson[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: courseTitle,
          youtube_url: videoUrl,
          youtube_video_id: videoId,
          language,
          transcript,
          scenario,
          structure,
          lessons,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourseId(data.course.id);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu khóa học");
    } finally {
      setSaving(false);
    }
  }

  if (done && courseId) {
    const firstLesson = allLessons[0];
    return (
      <div className="max-w-2xl text-center py-12">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Khóa học đã sẵn sàng!</h2>
        <p className="text-slate-500 mb-2">{courseTitle}</p>
        <p className="text-sm text-slate-400 mb-8">
          {totalLessons} bài học • {structure.length} modules
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => router.push(`/course/${courseId}/${firstLesson.module_id}/${firstLesson.id}`)}
            className="w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            🚀 Bắt đầu học ngay
          </button>
          <button
            onClick={() => router.push("/library")}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Xem thư viện →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Cấu Trúc Khóa Học</h2>

      {/* Course info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h3 className="font-semibold text-slate-800 mb-3">{courseTitle}</h3>
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-blue-800 mb-1">📋 Kịch bản</p>
          <p className="text-blue-700"><strong>{scenario.company}</strong> — {scenario.role}</p>
          <p className="text-blue-600 text-xs mt-1">Mục tiêu: {scenario.goal}</p>
        </div>
      </div>

      {/* Structure */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-4">
        {structure.map((mod) => (
          <div key={mod.id}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Module {mod.id}: {mod.name}
            </p>
            <div className="space-y-1.5">
              {mod.lessons.map((lesson) => {
                const key = `${mod.id}-${lesson.id}`;
                const status = lessonStatuses[key];
                return (
                  <div key={lesson.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50">
                    <span className="text-sm w-5 flex-shrink-0">
                      {status === "done" ? "✅" : status === "generating" ? "⟳" : status === "error" ? "❌" : "○"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-500 mr-2">{lesson.id}</span>
                      <span className="text-sm text-slate-700">{lesson.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {generating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Đang tạo bài học...</span>
            <span className="text-sm text-slate-500">{doneLessons}/{totalLessons}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(doneLessons / totalLessons) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 truncate">⟳ {currentLesson}</p>
        </div>
      )}

      {saving && (
        <div className="text-center py-3 text-sm text-slate-500">Đang lưu khóa học...</div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      {!generating && !saving && !done && (
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-lg border border-slate-200"
          >
            ← Quay lại
          </button>
          <button
            onClick={handleGenerateAll}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            ✨ Tạo {totalLessons} bài học ({Math.ceil(totalLessons * 0.4)} phút)
          </button>
        </div>
      )}
    </div>
  );
}
