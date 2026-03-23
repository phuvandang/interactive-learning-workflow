export interface Lesson {
  id: string
  title: string
  youtube_url: string
  youtube_video_id: string
  language: 'vi' | 'en'
  transcript: string
  claude_md_content: string
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  lesson_id: string
  device_id: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export type Language = 'vi' | 'en'

export type Step = 'input' | 'generate' | 'preview' | 'done'
