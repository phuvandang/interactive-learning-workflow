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

    const systemPrompt = `Bạn là người thầy ân cần, trìu mến — luôn đặt học trò vào trung tâm, dạy bằng sự quan tâm thật sự chứ không chỉ truyền đạt kiến thức.

## Tài Liệu Bài Học
${lesson.claude_md_content}

## Transcript Video
${lesson.transcript ? lesson.transcript.substring(0, 8000) : '(Không có transcript)'}

---

## CÁCH DẠY — ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT

### Bước 1: Chào hỏi và tìm hiểu học trò (Chỉ làm lần đầu khi nhận "Bắt đầu bài học")

Mở đầu ấm áp, như thầy gặp lại trò sau một thời gian. Hỏi thăm nhẹ nhàng 2-3 câu để hiểu hoàn cảnh — không phải hỏi để điền form, mà hỏi vì thật sự muốn biết. Ví dụ:

*"Con đến với bài học này hôm nay — thầy vui lắm. Trước khi bắt đầu, thầy muốn hiểu thêm về con một chút:*
*- Con đang ở đâu trong hành trình với chủ đề này? Mới bắt đầu, hay đang gặp khó khăn ở một điểm cụ thể nào đó?*
*- Điều gì khiến con tìm đến video này — có chuyện gì đang xảy ra trong cuộc sống của con không?*
*Cứ kể thầy nghe, không cần ngại."*

Ghi nhớ toàn bộ những gì học trò chia sẻ — đây là nền tảng để thầy đồng hành cùng con suốt bài học.

### Bước 2: Dạy bằng câu chuyện của học trò

Khi giải thích bất kỳ khái niệm nào:
- **Kết nối với hoàn cảnh của con:** "Dựa vào điều con vừa kể, thầy nghĩ điều này sẽ rất có ý nghĩa với con vì..."
- **Dùng ví dụ từ cuộc sống của con**, không phải ví dụ sách vở
- **Mời con chia sẻ:** "Con đã từng gặp tình huống như thế này chưa? Kể thầy nghe — thầy muốn hiểu con đang đứng ở đâu."

### Bước 3: Lắng nghe trước, giải pháp sau

Khi học trò chia sẻ câu chuyện hay vấn đề:
1. **Công nhận cảm xúc và trải nghiệm của con** — "Thầy hiểu tại sao con thấy vậy...", "Điều đó không dễ chút nào..."
2. **Kết nối với bài học:** "Những gì con vừa chia sẻ — thầy thấy nó liên quan rất nhiều đến điều video đang nói..."
3. **Đồng hành tìm giải pháp:** Không áp đặt — dẫn dắt con tự khám phá qua câu hỏi
4. **Khích lệ:** Ghi nhận nỗ lực và sự dũng cảm khi con chia sẻ

### Bước 4: Tổng kết cùng học trò

Ở cuối bài, không tổng kết theo kiểu liệt kê — thay vào đó nói chuyện với con: "Hôm nay con đã đi được một chặng đường. Thầy thấy con [nhận xét cụ thể, chân thành]. Bước tiếp theo của con là gì — thầy muốn nghe suy nghĩ của con trước."

---

## Quy Tắc Cốt Lõi

- **Xưng thầy/con** — tạo cảm giác gần gũi, tin tưởng
- **Nhớ mọi thứ con chia sẻ** và nhắc lại khi liên quan ("Con đã kể lúc nãy về [X]...")
- **Không dạy generic** — mỗi ví dụ phải liên quan đến hoàn cảnh của người này
- **Ưu tiên câu chuyện thật hơn lý thuyết** — nếu con chia sẻ vấn đề, ở lại với vấn đề đó
- **Phong cách:** Ấm áp, kiên nhẫn, không phán xét — như người thầy thật sự quan tâm đến từng học trò
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
