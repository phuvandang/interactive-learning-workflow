"use client";

import { useState } from "react";
import StepInput from "@/components/features/StepInput";
import StepGenerate from "@/components/features/StepGenerate";
import StepPreview from "@/components/features/StepPreview";
import StepDone from "@/components/features/StepDone";
import { Step, Language } from "@/types";

const STEPS: { id: Step; label: string }[] = [
  { id: "input", label: "1. Nhập URL" },
  { id: "generate", label: "2. Generate" },
  { id: "preview", label: "3. Preview & Lưu" },
  { id: "done", label: "4. Hoàn thành" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState<Language>("vi");
  const [claudeMd, setClaudeMd] = useState("");
  const [savedLessonId, setSavedLessonId] = useState("");

  return (
    <div>
      {/* Progress stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                step === s.id
                  ? "bg-blue-600 text-white"
                  : STEPS.findIndex((x) => x.id === step) > i
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-slate-300">→</span>
            )}
          </div>
        ))}
      </div>

      {step === "input" && (
        <StepInput
          onDone={({ url, videoId, title, transcript }) => {
            setVideoUrl(url);
            setVideoId(videoId);
            setVideoTitle(title);
            setTranscript(transcript);
            setStep("generate");
          }}
        />
      )}

      {step === "generate" && (
        <StepGenerate
          videoTitle={videoTitle}
          transcript={transcript}
          language={language}
          onLanguageChange={setLanguage}
          onDone={(md) => {
            setClaudeMd(md);
            setStep("preview");
          }}
          onBack={() => setStep("input")}
        />
      )}

      {step === "preview" && (
        <StepPreview
          claudeMd={claudeMd}
          videoTitle={videoTitle}
          videoUrl={videoUrl}
          videoId={videoId}
          language={language}
          transcript={transcript}
          onChange={setClaudeMd}
          onDone={(lessonId) => {
            setSavedLessonId(lessonId || "");
            setStep("done");
          }}
          onBack={() => setStep("generate")}
        />
      )}

      {step === "done" && (
        <StepDone
          videoTitle={videoTitle}
          lessonId={savedLessonId}
          onNew={() => {
            setStep("input");
            setVideoUrl("");
            setVideoId("");
            setVideoTitle("");
            setTranscript("");
            setClaudeMd("");
            setSavedLessonId("");
          }}
        />
      )}
    </div>
  );
}
