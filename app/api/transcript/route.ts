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
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const videoId = extractVideoId(url)
    if (!videoId) return NextResponse.json({ error: 'URL YouTube không hợp lệ' }, { status: 400 })

    // Fetch transcript and title in parallel
    const [transcriptItems, title] = await Promise.all([
      YoutubeTranscript.fetchTranscript(videoId),
      getVideoTitle(videoId),
    ])

    if (!transcriptItems?.length) {
      return NextResponse.json(
        { error: 'Video này không có transcript. Hãy thử video khác có phụ đề.' },
        { status: 422 }
      )
    }

    const transcript = transcriptItems
      .map((item) => item.text.replace(/\n/g, ' ').trim())
      .join(' ')

    return NextResponse.json({ transcript, title, videoId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'

    // User-friendly error messages
    if (message.includes('Could not get') || message.includes('Transcript is disabled')) {
      return NextResponse.json(
        { error: 'Video này đã tắt transcript/phụ đề. Hãy thử video khác.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
