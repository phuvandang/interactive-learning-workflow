import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'
import { extractVideoId } from '@/lib/utils'

async function getVideoTitle(videoId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return videoId
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    )
    const data = await res.json()
    return data.items?.[0]?.snippet?.title || videoId
  } catch {
    return videoId
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, manualTranscript } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const videoId = extractVideoId(url)
    if (!videoId) return NextResponse.json({ error: 'URL YouTube không hợp lệ' }, { status: 400 })

    const title = await getVideoTitle(videoId)

    // If user manually pasted transcript, use it directly
    if (manualTranscript?.trim()) {
      return NextResponse.json({ transcript: manualTranscript.trim(), title, videoId })
    }

    // Auto-fetch transcript
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'vi',
      }).catch(() => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }))
        .catch(() => YoutubeTranscript.fetchTranscript(videoId))

      if (!transcriptItems?.length) {
        return NextResponse.json({ error: 'NO_TRANSCRIPT' }, { status: 422 })
      }

      const transcript = transcriptItems
        .map((item) => item.text.replace(/\n/g, ' ').trim())
        .join(' ')

      return NextResponse.json({ transcript, title, videoId })
    } catch {
      // Auto-fetch failed — tell client to show manual input
      return NextResponse.json({ error: 'NO_TRANSCRIPT' }, { status: 422 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
