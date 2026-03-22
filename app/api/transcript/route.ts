import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/utils'

export const runtime = 'edge'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind: string
}

async function fetchTranscriptFromYouTube(videoId: string): Promise<string> {
  // Fetch YouTube video page like a real browser
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: BROWSER_HEADERS,
  })

  if (!pageRes.ok) throw new Error('Không thể tải trang YouTube')

  const html = await pageRes.text()

  // Extract ytInitialPlayerResponse from the page
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;[\s\n]*(?:var|const|let|\<\/script)/)
    ?? html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*\n/)

  if (!match) throw new Error('Không thể parse trang video YouTube')

  let playerResponse: {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: CaptionTrack[]
      }
    }
  }

  try {
    playerResponse = JSON.parse(match[1])
  } catch {
    throw new Error('Không thể đọc dữ liệu video')
  }

  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!captionTracks?.length) {
    throw new Error('Video này không có transcript/phụ đề')
  }

  // Prefer: vi > en > any
  const track = captionTracks.find((t) => t.languageCode === 'vi')
    ?? captionTracks.find((t) => t.languageCode === 'en')
    ?? captionTracks[0]

  // Fetch the caption data
  const captionRes = await fetch(`${track.baseUrl}&fmt=json3`, {
    headers: BROWSER_HEADERS,
  })

  if (!captionRes.ok) throw new Error('Không thể tải nội dung transcript')

  const captionData = await captionRes.json()

  const events: { segs?: { utf8: string }[] }[] = captionData.events ?? []
  const text = events
    .filter((e) => e.segs)
    .flatMap((e) => e.segs!.map((s) => s.utf8))
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) throw new Error('Transcript trống')

  return text
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
      fetchTranscriptFromYouTube(videoId),
      getVideoTitle(videoId),
    ])

    return NextResponse.json({ transcript, title, videoId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
