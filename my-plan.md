# YouTube to Interactive Learning with Claude - PRD

## Mục Tiêu Cốt Lõi

Biến bất kỳ YouTube video nào thành **bài học tương tác với Claude làm gia sư** — người dùng không chỉ xem video mà còn có thể hỏi Claude bất kỳ khía cạnh nào trong video chưa hiểu, thực hành, và hiểu sâu hơn thông qua đối thoại.

**Vấn đề giải quyết:** Video YouTube là nội dung thụ động — người xem không hiểu vẫn phải tua đi tua lại, không có ai giải thích. App này biến video thành trải nghiệm học chủ động với Claude làm người hướng dẫn.

---

## Feature 1: Nhập YouTube URL & Lấy Transcript

- User dán YouTube URL vào input field
- App gọi YouTube Data API v3 để lấy captions/transcript tự động
- Hiển thị transcript preview để user xác nhận
- Xử lý lỗi: video không có transcript, URL không hợp lệ, API quota hết
- **Test:** Paste URL → transcript xuất hiện trong vòng 10 giây

---

## Feature 2: Chọn Ngôn Ngữ & Generate Bài Học Tương Tác

- User chọn ngôn ngữ: Tiếng Việt hoặc English
- Nhấn "Generate Lesson" → app gọi Claude API generate **CLAUDE.md** — bộ chỉ thị để Claude làm gia sư cho bài học đó

### Cấu trúc CLAUDE.md được generate phải bao gồm:

**A. Context cho Claude (phần đầu — Claude đọc để hiểu nội dung)**
- Tóm tắt toàn bộ nội dung video (từ transcript)
- Các khái niệm chính, thuật ngữ quan trọng
- Các luận điểm / ý tưởng cốt lõi theo thứ tự

**B. Luồng học có cấu trúc**
- Chào mừng + giới thiệu video và những gì sẽ học
- 4-6 phần nội dung, mỗi phần:
  - Giải thích nội dung theo ngôn ngữ dễ hiểu
  - Câu hỏi kiểm tra hiểu biết (DỪNG LẠI)
  - Ví dụ thực tế / liên hệ cuộc sống
- Phần thực hành / áp dụng cá nhân
- Tổng kết

**C. Hướng dẫn Claude xử lý câu hỏi tự do**
- Khi user hỏi bất kỳ điều gì về video → Claude trả lời dựa trên transcript đã có trong context
- Giải thích lại các khái niệm theo nhiều góc độ khác nhau nếu user chưa hiểu
- Đưa ra ví dụ mới, analogies, so sánh để làm rõ
- Kết nối câu hỏi của user với nội dung liên quan trong video
- Khuyến khích user tiếp tục đặt câu hỏi

**D. Ghi chú phong cách dạy cho Claude**
- Tone: kiên nhẫn, khuyến khích, không phán xét
- Không bao giờ nói "tôi không biết" nếu thông tin có trong transcript
- Luôn hỏi lại "Bạn có muốn tôi giải thích thêm phần nào không?"

- **Test:** Generate từ transcript → CLAUDE.md có đủ 4 phần A/B/C/D, có ít nhất 3 DỪNG LẠI, Claude có thể trả lời câu hỏi về nội dung video khi dùng file này

---

## Feature 3: Preview & Edit Bài Học

- Hiển thị CLAUDE.md đã generate trong editor có thể chỉnh sửa
- Toggle giữa Raw (markdown) và Preview (rendered)
- Nút "Regenerate" nếu kết quả không ưng
- Nút "Save & Download" để tiến hành lưu
- **Test:** Chỉnh sửa text → Save lưu đúng nội dung đã chỉnh

---

## Feature 4: Lưu vào Supabase & Download

- Khi nhấn "Save & Download":
  - Lưu vào Supabase: tên bài học, YouTube URL, ngôn ngữ, transcript, nội dung CLAUDE.md, ngày tạo
  - Download ZIP chứa:
    - `CLAUDE.md` (bài học + chỉ thị cho Claude làm gia sư)
    - `.claude/commands/start-lesson.md` (lệnh `/start-lesson` để khởi động)
- **Test:** Save → record trong Supabase → ZIP download → giải nén có đúng 2 files → mở thư mục trong Claude Code → `/start-lesson` → Claude bắt đầu dạy đúng

---

## Feature 5: Thư Viện Bài Học (Library)

- Trang danh sách tất cả bài học đã tạo (shared, không cần login)
- Hiển thị: tên bài học, YouTube URL, ngôn ngữ, ngày tạo
- Download lại bài học cũ
- Xóa bài học
- **Test:** Sau save → bài học xuất hiện trong library → Download → ZIP đúng

---

## UI Decisions

- **3 bước rõ ràng với progress stepper:** Input URL → Generate & Preview → Save & Download
- Trang Library riêng để xem lịch sử
- Màu sắc: chuyên nghiệp, tối giản (slate/blue)
- Ưu tiên desktop, mobile-friendly
- Không cần login (shared access cho team)

---

## Technical Decisions

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Auth:** Không có — v1 shared access
- **External APIs:**
  - YouTube Data API v3 — lấy transcript/captions
  - Anthropic Claude API (claude-sonnet-4-6) — generate CLAUDE.md
- **Download:** JSZip — tạo ZIP trong browser
- **Deploy:** Vercel

---

## Database Schema (Supabase)

```sql
Table: lessons
- id: uuid (primary key)
- title: text (tiêu đề video YouTube)
- youtube_url: text
- youtube_video_id: text
- language: text ('vi' | 'en')
- transcript: text (toàn bộ transcript gốc)
- claude_md_content: text (CLAUDE.md đã generate)
- created_at: timestamp
```

---

## Out of Scope (v1)

- Đăng nhập cá nhân / phân quyền theo user
- Chat trực tiếp với Claude trong app (người dùng dùng Claude Code với file tải về)
- Hỗ trợ video không có transcript (auto-transcribe bằng Whisper)
- Chỉnh sửa bài học sau khi đã lưu vào Supabase
- Chia sẻ bài học qua link public
- Template khác nhau theo loại video (lecture, tutorial, interview...)
- Export sang Notion / Google Drive
