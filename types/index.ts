export type SourceType = 'youtube' | 'pdf' | 'text'
export type SourceStatus = 'idle' | 'loading' | 'done' | 'error'

export interface Source {
  id: string
  type: SourceType
  label: string
  content: string
  wordCount: number
  status: SourceStatus
  error?: string
  videoId?: string
  videoUrl?: string
}

export interface SourceMeta {
  type: SourceType
  label: string
  wordCount: number
}

export interface Lesson {
  id: string
  title: string
  youtube_url: string
  youtube_video_id: string
  language: 'vi' | 'en'
  transcript: string
  claude_md_content: string
  created_at: string
  sources?: SourceMeta[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  lesson_id?: string | null
  course_lesson_id?: string | null
  lesson_title?: string | null
  device_id: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface CourseLesson {
  id: string
  name: string
  description?: string
}

export interface CourseModule {
  id: string
  name: string
  lessons: CourseLesson[]
}

export interface CourseScenario {
  company: string
  role: string
  goal: string
}

export interface Course {
  id: string
  title: string
  youtube_url: string
  youtube_video_id: string
  language: 'vi' | 'en'
  transcript?: string
  scenario: CourseScenario
  structure: CourseModule[]
  created_at: string
  sources?: SourceMeta[]
}

export interface CourseLessonContent {
  id: string
  course_id: string
  module_id: string
  lesson_id: string
  name: string
  claude_md_content: string
  order_index: number
  created_at: string
}

export type Language = 'vi' | 'en'

export type Step = 'input' | 'generate' | 'preview' | 'done'
