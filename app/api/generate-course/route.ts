import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { title, transcript, language, scenarioHint } = await req.json()
    if (!transcript) return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })

    const isVi = language === 'vi'

    const prompt = `Bạn là chuyên gia thiết kế khóa học. Phân tích transcript video YouTube và tạo cấu trúc khóa học hoàn chỉnh.

**Video:** ${title}
**Ngôn ngữ:** ${isVi ? 'Tiếng Việt' : 'English'}
${scenarioHint ? `**Gợi ý kịch bản từ user:** ${scenarioHint}` : ''}

**Transcript:**
${transcript.substring(0, 10000)}${transcript.length > 10000 ? '\n[... tiếp tục ...]' : ''}

---

Tạo cấu trúc khóa học theo JSON sau. Trả về JSON THUẦN TÚY, không markdown, không giải thích:

{
  "title": "Tên khóa học hấp dẫn",
  "scenario": {
    "company": "Tên công ty/tổ chức hư cấu phù hợp với chủ đề",
    "role": "Vai trò người học đóng trong kịch bản",
    "goal": "Mục tiêu cụ thể cần đạt được cuối khóa"
  },
  "modules": [
    {
      "id": "1",
      "name": "Tên module 1",
      "lessons": [
        {
          "id": "1.1",
          "name": "Tên bài học",
          "description": "Mô tả ngắn 1-2 câu về nội dung bài này"
        }
      ]
    }
  ]
}

**Yêu cầu:**
- 2-4 modules, mỗi module 2-4 lessons → tổng 6-10 lessons
- Scenario phải thực tế, liên quan trực tiếp đến chủ đề video
- Lessons phải theo trình tự logic từ cơ bản đến nâng cao
- Tên bài học ngắn gọn, hành động (VD: "Phân tích dữ liệu đầu tiên")
- ${isVi ? 'Viết bằng tiếng Việt' : 'Write in English'}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    let json = content.text.trim()
    // Strip markdown code blocks if present
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    const structure = JSON.parse(json)
    return NextResponse.json({ structure })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
