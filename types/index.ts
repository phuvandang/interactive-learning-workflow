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

export type Language = 'vi' | 'en'

export type Step = 'input' | 'generate' | 'preview' | 'done'
