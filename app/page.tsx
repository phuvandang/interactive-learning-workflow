"use client";

import { useState } from "react";
import StepInput from "@/components/features/StepInput";
import StepGenerate from "@/components/features/StepGenerate";
import StepPreview from "@/components/features/StepPreview";
import StepDone from "@/components/features/StepDone";
import StepCoursePreview from "@/components/features/StepCoursePreview";
import { Step, Language, CourseModule, CourseScenario, Source } from "@/types";

const STEPS: { id: Step; label: string }[] = [
  { id: "input", label: "1. Nhập nguồn" },
  { id: "generate", label: "2. Generate" },
  { id: "preview", label: "3. Preview & Lưu" },
  { id: "done", label: "4. Hoàn thành" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [language, setLanguage] = useState<Language>("vi");

  // Multi-source state
  const [sources, setSources] = useState<Source[]>([]);
  const [combinedContent, setCombinedContent] = useState("");
  const [primaryTitle, setPrimaryTitle] = useState("");
  const [primaryVideoId, setPrimaryVideoId] = useState("");
  const [primaryVideoUrl, setPrimaryVideoUrl] = useState("");

  // Logic 1 state
  const [claudeMd, setClaudeMd] = useState("");
  const [savedLessonId, setSavedLessonId] = useState("");

  // Logic 2 state
  const [courseTitle, setCourseTitle] = useState("");
  const [courseScenario, setCourseScenario] = useState<CourseScenario | null>(null);
  const [courseStructure, setCourseStructure] = useState<CourseModule[]>([]);
  const [isCourseMode, setIsCourseMode] = useState(false);

  function reset() {
    setStep("input");
    setSources([]); setCombinedContent(""); setPrimaryTitle(""); setPrimaryVideoId(""); setPrimaryVideoUrl("");
    setClaudeMd(""); setSavedLessonId("");
    setCourseTitle(""); setCourseScenario(null); setCourseStructure([]);
    setIsCourseMode(false);
  }

  return (
    <div className="py-8">
      {/* Progress stepper */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span
              className={`text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap ${
                step === s.id
                  ? "bg-blue-600 text-white"
                  : STEPS.findIndex((x) => x.id === step) > i
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>

      {step === "input" && (
        <StepInput
          onDone={({ sources: srcs, combinedContent: content, primaryTitle: title, primaryVideoId: vidId, primaryVideoUrl: vidUrl }) => {
            setSources(srcs);
            setCombinedContent(content);
            setPrimaryTitle(title);
            setPrimaryVideoId(vidId);
            setPrimaryVideoUrl(vidUrl);
            setStep("generate");
          }}
        />
      )}

      {step === "generate" && (
        <StepGenerate
          videoTitle={primaryTitle}
          transcript={combinedContent}
          sourcesCount={sources.length}
          totalWords={sources.reduce((sum, s) => sum + s.wordCount, 0)}
          language={language}
          onLanguageChange={setLanguage}
          onDone={(md) => {
            setIsCourseMode(false);
            setClaudeMd(md);
            setStep("preview");
          }}
          onDoneCourse={({ title, scenario, structure }) => {
            setIsCourseMode(true);
            setCourseTitle(title);
            setCourseScenario(scenario);
            setCourseStructure(structure);
            setStep("preview");
          }}
          onBack={() => setStep("input")}
        />
      )}

      {step === "preview" && !isCourseMode && (
        <StepPreview
          claudeMd={claudeMd}
          videoTitle={primaryTitle}
          videoUrl={primaryVideoUrl}
          videoId={primaryVideoId}
          language={language}
          transcript={combinedContent}
          sources={sources.map((s) => ({ type: s.type, label: s.label, wordCount: s.wordCount }))}
          onChange={setClaudeMd}
          onDone={(lessonId) => {
            setSavedLessonId(lessonId || "");
            setStep("done");
          }}
          onBack={() => setStep("generate")}
        />
      )}

      {step === "preview" && isCourseMode && courseScenario && (
        <StepCoursePreview
          courseTitle={courseTitle}
          scenario={courseScenario}
          structure={courseStructure}
          transcript={combinedContent}
          videoUrl={primaryVideoUrl}
          videoId={primaryVideoId}
          language={language}
          sources={sources.map((s) => ({ type: s.type, label: s.label, wordCount: s.wordCount }))}
          onBack={() => setStep("generate")}
        />
      )}

      {step === "done" && !isCourseMode && (
        <StepDone
          videoTitle={primaryTitle}
          lessonId={savedLessonId}
          onNew={reset}
        />
      )}
    </div>
  );
}
