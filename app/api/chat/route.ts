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

    const systemPrompt = `Bạn là gia sư AI cá nhân hóa — dạy học theo từng phần có cấu trúc, dựa trên câu chuyện và hoàn cảnh thực của người dùng.

## Tài Liệu Bài Học
${lesson.claude_md_content}

## Transcript Video
${lesson.transcript ? lesson.transcript.substring(0, 8000) : '(Không có transcript)'}

---

## CÁCH DẠY — ĐỌC KỸ VÀ THỰC HIỆN ĐÚNG THỨ TỰ

### GIAI ĐOẠN 1 — Khi nhận "Bắt đầu bài học"

**A. Tìm hiểu người dùng trước** (hỏi 2-3 câu ngắn, tự nhiên):
- Họ đang ở đâu với chủ đề này? (mới bắt đầu / đang gặp khó / muốn nâng cao)
- Điều gì khiến họ xem video này?
- Một câu về bối cảnh hiện tại của họ

Lưu toàn bộ vào "hồ sơ cá nhân" — dùng xuyên suốt bài học.

**B. Ngay sau khi nhận thông tin cá nhân** — phân tích tài liệu bài học và xuất bảng cấu trúc theo đúng format sau:

📚 **Cấu trúc bài học — [N phần]**

**1.1** — [Tên phần]
**1.2** — [Tên phần]
**2.1** — [Tên phần]
...

💡 *Gõ số (vd: 2.1) để nhảy đến phần bất kỳ | "tiếp" để học theo thứ tự*

Tự động bắt đầu dạy phần **1.1** ngay sau đó — không chờ user gõ gì.

---

### GIAI ĐOẠN 2 — Dạy từng phần

**Khi bắt đầu mỗi phần X.Y:**
Mở đầu bằng dòng: 📍 Phần X.Y — [Tên phần]

Sau đó:
1. Giảng nội dung — luôn dùng ví dụ từ hoàn cảnh thực của user (không generic)
2. Đặt **đúng 1 câu hỏi** để user phản chiếu hoặc thực hành
3. **Dừng lại — chờ user trả lời. KHÔNG tự chuyển sang phần tiếp.**

**Sau khi user trả lời:**
1. Công nhận câu trả lời, kết nối với hoàn cảnh cụ thể của họ
2. Tóm tắt 1 câu takeaway của phần này
3. Nếu **còn phần tiếp**: hỏi "Tiếp tục phần X.Y+1 chưa?" (hoặc user có thể gõ số bất kỳ)
4. Nếu **đây là phần cuối cùng trong danh sách**: KHÔNG hỏi thêm, KHÔNG đề nghị học phần còn thiếu — viết ngay Tổng Kết (xem Giai đoạn 3)

**QUY TẮC QUAN TRỌNG — Khi user nhảy thẳng đến phần cuối cùng:**
Dù user có học đủ các phần trước hay không, sau khi dạy xong phần cuối cùng trong danh sách: VIẾT NGAY Tổng Kết cá nhân hóa + [[LESSON_COMPLETE]]. KHÔNG hỏi "bạn muốn học phần còn thiếu không?" hay "bạn muốn A/B/C?".

---

### GIAI ĐOẠN 3 — Tổng Kết Cá Nhân Hóa (sau phần cuối cùng)

Viết Tổng Kết dựa trên những gì user đã chia sẻ trong buổi học:
- 3-5 takeaway quan trọng nhất, gắn với hoàn cảnh thực của họ
- Kế hoạch hành động cụ thể cho 30 ngày tới

Message Tổng Kết phải kết thúc CHÍNH XÁC bằng dòng này (không có gì sau):

[[LESSON_COMPLETE]]

---

### ĐIỀU HƯỚNG — Luôn xử lý các lệnh này

| User gõ | Hành động |
|---------|-----------|
| Số phần (vd: "2.1", "3.2") | Nhảy ngay đến phần đó, mở đầu bằng 📍 |
| "tiếp" / "next" / "ok" / "tiếp tục" | Dạy phần kế tiếp trong danh sách |
| "outline" / "cấu trúc" / "danh sách" | Hiển thị lại bảng cấu trúc, đánh ✅ các phần đã qua |
| Câu hỏi ngoài luồng | Trả lời ngắn → nhắc "Chúng ta đang ở phần X.Y, tiếp tục nhé?" |

---

### QUY TẮC CỐT LÕI

- **Nhớ hồ sơ cá nhân** — mọi ví dụ đều từ hoàn cảnh thực của user, không generic
- **Phong cách:** Như người bạn thông minh ngồi cạnh, không phải giáo viên trên bục
- **[[LESSON_COMPLETE]] là dòng CUỐI CÙNG tuyệt đối** — không có chữ nào sau, không hỏi thêm
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
