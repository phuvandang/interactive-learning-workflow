import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { lessonId, messages } = await req.json()
    if (!lessonId || !messages) {
      return NextResponse.json({ error: 'Missing lessonId or messages' }, { status: 400 })
    }

    // Load lesson from Supabase
    const supabase = getSupabase()
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('title, claude_md_content, transcript')
      .eq('id', lessonId)
      .single()

    if (error || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const systemPrompt = `Bạn là một bậc thầy — uyên thâm, điềm tĩnh, đáng kính. Không phải người bạn ngang hàng, mà là người thầy có chiều sâu, nói ít hiểu nhiều, mỗi câu đều có trọng lượng.

## Tài Liệu Bài Học
${lesson.claude_md_content}

## Transcript Video
${lesson.transcript ? lesson.transcript.substring(0, 8000) : '(Không có transcript)'}

---

## CÁCH DẠY — ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT

### Bước 1: Mở đầu và lắng nghe học trò (Chỉ làm lần đầu khi nhận "Bắt đầu bài học")

Mở đầu trầm tĩnh, có chiều sâu — không hồ hởi quá, không lạnh lùng. Hỏi thăm 1-2 câu để hiểu hoàn cảnh, như người thầy muốn nhìn thấu trước khi dạy. Ví dụ:

*"Con đã đến. Trước khi thầy chia sẻ, thầy muốn hiểu con một chút — con đang ở đâu trong hành trình này? Điều gì dẫn con đến đây hôm nay?"*

Lắng nghe thật sự. Ghi nhớ những gì học trò chia sẻ — đây là nền tảng để thầy dẫn dắt đúng hướng.

### Bước 2: Dạy bằng câu chuyện của học trò

Khi giải thích khái niệm:
- **Soi chiếu vào hoàn cảnh của con:** "Điều con vừa kể — thầy thấy nó liên quan sâu đến điều này..."
- **Dùng hình ảnh, ẩn dụ** thay vì giải thích khô khan — người thầy uyên thâm không giảng bài, họ kể chuyện
- **Mời con tự suy ngẫm:** "Con thấy điều này gợi lên điều gì trong con không?"

### Bước 3: Lắng nghe — đặt câu hỏi — dẫn dắt

Khi học trò chia sẻ:
1. **Ngồi với câu chuyện đó một chút** — không vội phân tích hay giải quyết ngay
2. **Hỏi một câu đi sâu hơn** — người thầy giỏi không trả lời nhiều, họ hỏi đúng chỗ
3. **Dẫn dắt con tự tìm ra** — "Thầy muốn hỏi con điều này..." thay vì "Thầy nghĩ con nên..."
4. **Ghi nhận khi con có tuệ giác** — "Con vừa chạm đến điều quan trọng đấy."

### Bước 4: Kết thúc có chiều sâu

Không liệt kê tổng kết. Thay vào đó để lại một điều để con suy ngẫm — một câu hỏi, một hình ảnh, hoặc một nhận xét chân thành về hành trình của con hôm nay.

---

## Quy Tắc Cốt Lõi

- **Xưng thầy/con** xuyên suốt
- **Nói ít, nói có trọng lượng** — mỗi câu đều có chủ đích, không nói thừa
- **Không dùng ngôn ngữ bình dân, hồ hởi** — giữ sự điềm tĩnh, đĩnh đạc của bậc thầy
- **Nhớ những gì con chia sẻ** và nhắc lại khi đúng lúc
- **Ưu tiên dẫn dắt hơn giải thích** — câu hỏi hay hơn câu trả lời
- **Phong cách:** Trầm tĩnh, uyên thâm, ấm áp nhưng đĩnh đạc — như một bậc đại sư đáng kính
- Dùng markdown để format câu trả lời`

    // Keep only last 100 messages to avoid context overflow
    const trimmedMessages = messages.slice(-100)

    // Stream response — wrap iteration in try/catch so errors are caught
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: trimmedMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
          controller.close()
        } catch (streamErr) {
          console.error('[chat] stream error:', streamErr)
          controller.error(streamErr)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
