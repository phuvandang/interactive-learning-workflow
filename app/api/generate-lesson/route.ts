import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { lessonId, lessonName, description, scenario, transcript, language, moduleName, allLessons } = await req.json()
    if (!lessonId || !transcript) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const isVi = language === 'vi'

    const prompt = `Bạn là chuyên gia thiết kế bài học tương tác. Tạo file CLAUDE.md cho 1 bài học trong khóa học.

**Khóa học:** ${scenario?.company ? `${scenario.company} — vai trò: ${scenario.role}, mục tiêu: ${scenario.goal}` : ''}
**Module:** ${moduleName}
**Bài học này:** ${lessonId} — ${lessonName}
**Mô tả:** ${description || ''}
**Ngôn ngữ:** ${isVi ? 'Tiếng Việt' : 'English'}

**Tất cả bài trong khóa (để biết context):**
${allLessons ? allLessons.map((l: {id: string, name: string}) => `- ${l.id}: ${l.name}`).join('\n') : ''}

**Transcript video (nguồn kiến thức):**
${transcript.substring(0, 8000)}

---

Tạo file CLAUDE.md ${isVi ? 'bằng tiếng Việt' : 'in English'} theo cấu trúc sau. Chỉ trả về nội dung markdown:

# Lesson ${lessonId}: ${lessonName}

[1-2 câu giới thiệu bài — gắn với kịch bản ${scenario?.company || ''}, hào hứng, thực tế]

STOP: [Câu hỏi check-in: "Trong vai trò ${scenario?.role || 'của bạn'}, bạn đã từng gặp tình huống liên quan đến [chủ đề bài này] chưa?"]
USER: [Người học chia sẻ]

ACTION: Lắng nghe và kết nối câu chuyện của họ với nội dung bài học ngay bên dưới.

---

## [Phần nội dung chính 1 — lấy từ transcript]

[Giải thích kiến thức/kỹ năng — gắn với kịch bản thực tế của ${scenario?.company || 'công ty'}]

**Ví dụ thực tế:** [Ví dụ cụ thể trong bối cảnh kịch bản]

STOP: [Câu hỏi thực hành hoặc kiểm tra hiểu: yêu cầu người học áp dụng vào tình huống kịch bản]
USER: [Người học thực hành/trả lời]

ACTION: [Hướng dẫn Claude phản hồi: đánh giá câu trả lời, đưa gợi ý, kết nối với bước tiếp theo]

---

## [Phần nội dung chính 2 — nếu có]

[Tiếp tục...]

STOP: [Câu hỏi/thực hành]
USER: [...]

ACTION: [...]

---

## Tổng Kết Bài ${lessonId}

[Tóm tắt 3-4 điểm chính đã học]

**Nhiệm vụ tiếp theo trong kịch bản:** [1 hành động cụ thể người học cần làm trong vai ${scenario?.role || 'của mình'} để chuẩn bị cho bài tiếp theo]

---

## Important Notes for Claude

- Luôn giữ bối cảnh kịch bản: người học đang ở ${scenario?.company || 'công ty'} với vai trò ${scenario?.role || ''}
- Khi người học chia sẻ câu chuyện → kết nối trực tiếp với kiến thức trong bài
- Ví dụ phải cụ thể, liên quan đến ${scenario?.company || 'bối cảnh'} — không generic
- Phong cách: đồng nghiệp giàu kinh nghiệm hướng dẫn, không phải giáo viên

## Success Criteria
- [ ] Người học hiểu và có thể giải thích ${lessonName}
- [ ] Người học biết áp dụng vào tình huống của ${scenario?.company || 'công ty'}
- [ ] Người học sẵn sàng cho bài tiếp theo`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    let claudeMd = content.text.trim()
    if (claudeMd.startsWith('```')) {
      claudeMd = claudeMd.replace(/^```(?:markdown)?\n/, '').replace(/\n```$/, '')
    }

    return NextResponse.json({ claudeMd })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
