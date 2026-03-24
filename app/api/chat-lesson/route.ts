import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { lessonContent, messages, previousContext } = await req.json()
    if (!lessonContent || !messages) {
      return NextResponse.json({ error: 'Missing lessonContent or messages' }, { status: 400 })
    }

    const previousContextSection = previousContext
      ? `\n---\n\n## Kiến Thức & Kinh Nghiệm Người Học Từ Bài Trước\n${previousContext}\n\nSử dụng thông tin này để:\n- Cá nhân hóa ví dụ và giải thích\n- Tham chiếu đến trải nghiệm thực tế họ đã chia sẻ\n- Xây dựng liên kết giữa kiến thức mới và bài cũ`
      : ''

    const systemPrompt = `Bạn là gia sư AI đang dạy bài học này. Đọc kỹ nội dung bài học và dạy theo đúng cấu trúc.

## Nội Dung Bài Học
${lessonContent}
${previousContextSection}

---

## Hướng Dẫn Dạy

- Khi nhận "Bắt đầu bài học": bắt đầu từ phần giới thiệu trong CLAUDE.md, hỏi câu hỏi STOP đầu tiên
- Khi người dùng trả lời STOP: công nhận câu trả lời, kết nối với nội dung, tiếp tục bài
- Khi người dùng hỏi ngoài luồng: trả lời rồi dẫn họ quay lại bài học
- Luôn giữ bối cảnh kịch bản của bài học
- Phong cách: đồng nghiệp thân thiện, không phải giáo viên
- Dùng markdown để format câu trả lời`

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
