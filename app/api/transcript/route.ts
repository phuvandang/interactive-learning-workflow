import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/utils'

async function fetchTranscriptSupadata(videoId: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) throw new Error('SUPADATA_API_KEY not configured')

  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`,
    {
      headers: {
        'x-api-key': apiKey,
      },
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `Supadata error: ${res.status}`)
  }

  const data = await res.json()

  // data.content is array of {text, offset, duration} or data is plain text
  if (typeof data === 'string') return data
  if (data.content && Array.isArray(data.content)) {
    return data.content.map((c: { text: string }) => c.text).join(' ').replace(/\s+/g, ' ').trim()
  }
  if (data.transcript) return data.transcript

  throw new Error('Không thể đọc transcript từ Supadata')
}

async function getVideoTitle(videoId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return videoId
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    )
    const data = await res.json()
    return data.items?.[0]?.snippet?.title ?? videoId
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

    const [transcript, title] = await Promise.all([
      fetchTranscriptSupadata(videoId),
      getVideoTitle(videoId),
    ])

    return NextResponse.json({ transcript, title, videoId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
