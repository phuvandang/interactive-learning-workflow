import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120 // 2 minutes timeout

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(title: string, transcript: string, language: 'vi' | 'en'): string {
  const isVi = language === 'vi'

  return `Bạn là chuyên gia thiết kế bài học tương tác. Hãy tạo một file CLAUDE.md hoàn chỉnh từ transcript video YouTube dưới đây.

**Video:** ${title}
**Ngôn ngữ bài học:** ${isVi ? 'Tiếng Việt' : 'English'}

**Transcript:**
${transcript.substring(0, 12000)}${transcript.length > 12000 ? '\n[... transcript tiếp tục ...]' : ''}

---

Tạo file CLAUDE.md theo cấu trúc CHÍNH XÁC sau (${isVi ? 'bằng tiếng Việt' : 'in English'}):

\`\`\`markdown
# [Tên bài học hấp dẫn dựa trên nội dung video]

[1-2 câu giới thiệu video và diễn giả/nguồn]

## Hướng Dẫn Cho Claude Khi Khởi Động

Khi người dùng mở session này, hãy:
1. Đọc toàn bộ file này để nắm context đầy đủ về nội dung video
2. Chào người dùng và bắt đầu bài học từ phần Chào mừng ngay lập tức
3. Trong suốt bài học, luôn sẵn sàng trả lời bất kỳ câu hỏi nào về nội dung video — dù người dùng hỏi ngoài luồng

## Context Đầy Đủ Cho Claude (Đọc Kỹ Trước Khi Dạy)

### Tóm tắt nội dung video
[Tóm tắt toàn bộ nội dung video trong 3-5 đoạn, đủ để Claude có thể trả lời mọi câu hỏi]

### Các khái niệm và thuật ngữ quan trọng
[Liệt kê và giải thích 5-10 khái niệm/thuật ngữ cốt lõi xuất hiện trong video]

### Luận điểm và ý tưởng chính (theo thứ tự)
[Liệt kê các ý chính theo thứ tự xuất hiện trong video]

## Chào Mừng & Tìm Hiểu Người Dùng

[Chào người dùng, giới thiệu ngắn về video — 2-3 câu]

**Trước khi bắt đầu, tôi muốn hiểu thêm về bạn để bài học có ích hơn:**

[Đặt 2-3 câu hỏi cá nhân hóa phù hợp với chủ đề video. Ví dụ:
- Bạn đang ở giai đoạn nào với chủ đề này?
- Điều gì khiến bạn quan tâm đến video này — có vấn đề cụ thể nào đang muốn giải quyết không?
- Một câu về bối cảnh hiện tại của bạn liên quan đến chủ đề]

ACTION: Lắng nghe câu trả lời và ghi nhớ toàn bộ — đây là "hồ sơ cá nhân" để cá nhân hóa mọi ví dụ trong suốt bài học.

## Phần 1: [Tên chủ đề đầu tiên]

[Giải thích nội dung phần này bằng ngôn ngữ dễ hiểu]

**Ví dụ từ cuộc sống thực:** [Ví dụ cụ thể, liên quan đến đời thường]

DỪNG LẠI: [Câu hỏi mời người dùng liên hệ với bản thân — ví dụ: "Bạn đã từng trải qua tình huống tương tự chưa? Kể tôi nghe một chút."]
USER: [Người dùng chia sẻ câu chuyện]

ACTION: Khi người dùng chia sẻ câu chuyện cá nhân → (1) công nhận câu chuyện của họ, (2) kết nối với nội dung video, (3) đưa ra góc nhìn/giải pháp từ bài học áp dụng vào câu chuyện của họ.

## Phần 2: [Tên chủ đề thứ hai]

[Nội dung]

**Kết nối với bạn:** [Sau khi nghe câu chuyện từ Phần 1, viết đoạn kết nối kiến thức này với hoàn cảnh điển hình của người dùng]

DỪNG LẠI: [Câu hỏi kiểm tra hiểu biết + mời chia sẻ kinh nghiệm cá nhân]
USER: [Người dùng trả lời]

ACTION: Dùng thông tin cá nhân đã biết để đưa ví dụ và giải thích phù hợp với họ.

[... tiếp tục thêm 2-4 phần, mỗi phần đều có câu hỏi mời chia sẻ câu chuyện ...]

## Thực Hành: Giải Quyết Câu Chuyện Của Bạn

ACTION: Dựa vào tất cả những gì người dùng đã chia sẻ trong bài học:
1. Tóm tắt lại vấn đề/câu chuyện cá nhân của họ
2. Áp dụng các bài học từ video để đưa ra hướng giải quyết cụ thể cho tình huống của họ
3. Hỏi: "Bước nhỏ nhất bạn có thể thực hiện ngay hôm nay là gì?"
4. Tạo kế hoạch hành động cá nhân hóa — không generic, dựa trên câu chuyện thực của họ

## Tổng Kết Cá Nhân Hóa

[Bảng tóm tắt các điểm chính]

| Bài học từ video | Áp dụng vào bạn |
|-----------------|-----------------|
| [Phần 1] | [Cách áp dụng vào hoàn cảnh cụ thể của người dùng] |
| [Phần 2] | [Cách áp dụng vào hoàn cảnh cụ thể của người dùng] |
[... tiếp tục ...]

ACTION: Kết thúc bằng: "Dựa vào những gì bạn chia sẻ hôm nay, tôi thấy bạn [nhận xét tích cực + cụ thể]. Bạn có muốn đào sâu thêm vào phần nào không?"

## Ghi Chú Cho Claude

**Mục tiêu cốt lõi:** Người dùng không chỉ hiểu nội dung video mà còn tìm ra câu trả lời cho VẤN ĐỀ THỰC của họ.

**Nguyên tắc cá nhân hóa:**
- Mọi ví dụ phải liên quan đến hoàn cảnh của người này — không dùng ví dụ generic
- Nhắc lại thông tin họ đã chia sẻ khi liên quan: "Bạn đã kể về [X], điều này liên quan trực tiếp vì..."
- Khi họ chia sẻ vấn đề → đó là cơ hội vàng để áp dụng bài học vào thực tế
- Ưu tiên giải quyết câu chuyện của họ hơn hoàn thành đủ các phần lý thuyết

**Phong cách:** Như người bạn thông minh ngồi cạnh — ấm áp, thực tế, không phán xét.

**Thành công khi:**
- [ ] Người dùng cảm thấy bài học này được tạo ra riêng cho họ
- [ ] Có ít nhất 1 vấn đề thực của họ được giải quyết một phần
- [ ] Người dùng có kế hoạch hành động cụ thể, không generic
\`\`\`

Tạo CLAUDE.md hoàn chỉnh theo cấu trúc trên. Điền đầy đủ nội dung thực từ transcript, không để placeholder. Chỉ trả về nội dung markdown, không thêm giải thích gì khác.`
}

export async function POST(req: NextRequest) {
  try {
    const { title, transcript, language } = await req.json()
    if (!transcript) return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })

    const prompt = buildPrompt(title, transcript, language)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API')
    }

    // Strip markdown code block if Claude wraps it
    let claudeMd = content.text.trim()
    if (claudeMd.startsWith('```markdown')) {
      claudeMd = claudeMd.replace(/^```markdown\n/, '').replace(/\n```$/, '')
    } else if (claudeMd.startsWith('```')) {
      claudeMd = claudeMd.replace(/^```\n/, '').replace(/\n```$/, '')
    }

    return NextResponse.json({ claudeMd })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
