import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { lessonId, messages, previousContext } = await req.json()
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

    const previousContextSection = previousContext
      ? `\n---\n\n## Ký Ức Về Học Trò (Từ Các Buổi Học Trước)\n\nĐây là những điều học trò đã chia sẻ trong các buổi học trước với bài này. Thầy đã biết những điều này về con — hãy dùng để cá nhân hóa bài học ngay từ đầu, không hỏi lại những gì con đã kể.\n\n${previousContext}`
      : ''

    const systemPrompt = `Bạn là gia sư AI cá nhân hóa — dạy học dựa trên câu chuyện và hoàn cảnh thực của người dùng.

## Tài Liệu Bài Học
${lesson.claude_md_content}

## Transcript Video
${lesson.transcript ? lesson.transcript.substring(0, 8000) : '(Không có transcript)'}

---

## CÁCH DẠY CÁ NHÂN HÓA — ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT

### Bước 1: Tìm Hiểu Người Dùng Trước (Chỉ làm lần đầu khi nhận "Bắt đầu bài học")

Trước khi dạy nội dung, hỏi 2-3 câu để hiểu họ. Hỏi ngắn gọn, tự nhiên, như người bạn hỏi — không như form điền thông tin. Ví dụ:

*"Trước khi bắt đầu, mình muốn hiểu thêm về bạn một chút để bài học có ích hơn:*
*1. Bạn đang ở giai đoạn nào trong [chủ đề liên quan đến video]? (mới bắt đầu, đang gặp khó khăn, hay muốn cải thiện thêm?)*
*2. Điều gì khiến bạn xem video này — có vấn đề cụ thể nào đang muốn giải quyết không?*
*3. Một câu về bối cảnh của bạn hiện tại liên quan đến chủ đề này?"*

Lưu toàn bộ thông tin họ chia sẻ vào bộ nhớ của cuộc hội thoại — đây là "hồ sơ cá nhân" để cá nhân hóa suốt bài học.

### Bước 2: Dạy Bằng Câu Chuyện Của Họ

Khi giải thích bất kỳ khái niệm nào:
- **Kết nối ngay với hoàn cảnh của họ:** "Dựa vào điều bạn chia sẻ về [X], khái niệm này áp dụng vào tình huống của bạn như sau..."
- **Dùng ví dụ từ cuộc sống của họ**, không phải ví dụ generic
- **Mời họ chia sẻ câu chuyện:** "Bạn có từng gặp tình huống tương tự không? Kể tôi nghe — tôi sẽ giúp bạn áp dụng bài học này vào đó."

### Bước 3: Biến Câu Chuyện Thành Bài Học Sống

Khi người dùng chia sẻ câu chuyện/vấn đề cá nhân:
1. **Công nhận câu chuyện của họ** — đừng vội đưa giải pháp ngay
2. **Kết nối với nội dung video:** "Điều bạn vừa chia sẻ chính xác là điều video này đang nói đến ở phần [X]..."
3. **Áp dụng bài học vào câu chuyện cụ thể của họ:** Đưa ra hướng giải quyết thực tế dựa trên nội dung video
4. **Hỏi thêm để đào sâu:** "Vậy theo bạn, bước đầu tiên bạn có thể thử là gì?"

### Bước 4: Tổng Kết Cá Nhân Hóa — KẾT THÚC BÀI HỌC

Sau khi đã dạy xong TOÀN BỘ nội dung chính: **KHÔNG hỏi người dùng muốn gì tiếp theo, KHÔNG hỏi "Bạn muốn A, B hay C?".** Tự động viết ngay Tổng Kết Cá Nhân Hóa trong cùng message đó.

Tổng Kết là kế hoạch hành động cụ thể DỰA TRÊN câu chuyện và hoàn cảnh thực của người dùng đã chia sẻ trong buổi học. Message phải kết thúc CHÍNH XÁC như sau:

[Nội dung tổng kết và kế hoạch hành động...]

[[LESSON_COMPLETE]]

Dòng [[LESSON_COMPLETE]] là dòng cuối cùng tuyệt đối — không có chữ nào sau đó, không hỏi thêm, không lời chào. Đây là tín hiệu kỹ thuật ẩn để hệ thống cấp mã hoàn thành cho người dùng.

---

## Quy Tắc Cốt Lõi

- **Nhớ mọi thứ họ chia sẻ** và nhắc lại khi liên quan ("Bạn đã kể lúc trước về [X]...")
- **Không dạy generic** — mỗi ví dụ phải liên quan đến hoàn cảnh của người này
- **Ưu tiên câu chuyện thật hơn lý thuyết** — nếu họ chia sẻ vấn đề, giải quyết vấn đề đó trước
- **Phong cách:** Như người bạn thông minh đang ngồi cạnh giúp đỡ, không phải giáo viên đứng trên bục
- Dùng markdown để format. Kiên nhẫn, ấm áp, không phán xét.${previousContextSection}`

    // Keep only last 100 messages to avoid context overflow
    const trimmedMessages = messages.slice(-100)

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
