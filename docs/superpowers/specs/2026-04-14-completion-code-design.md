# Completion Code Feature — Design Spec

**Date:** 2026-04-14  
**Scope:** Trang học bài học đơn (`/learn/[id]`)

---

## Tổng Quan

Khi user hoàn thành một bài học đơn, AI sẽ kết thúc bài học bằng câu nhắc cố định. Frontend detect câu đó và hiển thị nút "Nhận mã hoàn thành". User bấm nút → nhận mã duy nhất → lưu mã → nộp cho quản lý xác minh.

Mục đích: xác minh nhân viên trong công ty đã hoàn thành khóa học.

---

## Database

### Bảng mới: `completion_codes`

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
code         text NOT NULL UNIQUE
lesson_id    uuid REFERENCES lessons(id)
device_id    text NULL         -- NULL = chưa dùng
used_at      timestamptz NULL
created_at   timestamptz DEFAULT now()
```

- 50 mã được sinh ngẫu nhiên dạng `XXXX-XXXX` (8 ký tự alphanumeric in hoa)
- Mỗi mã gắn với 1 `lesson_id` cụ thể
- Mỗi mã chỉ dùng được 1 lần (một `device_id`)
- Không có expiry

---

## Flow Chi Tiết

### 1. AI Kết Thúc Bài Học
- Thêm instruction vào system prompt của `/api/chat`: khi AI đã dạy xong toàn bộ nội dung và tổng kết xong, phải kết thúc bằng đúng câu: `"Chúc mừng bạn đã hoàn thành bài học! Bấm nút bên dưới để nhận mã xác nhận."`
- Câu này cố định, không thay đổi — dùng làm signal để frontend detect.

### 2. Frontend Detect
- Sau khi stream xong, kiểm tra message cuối của assistant có chứa chuỗi `"Bấm nút bên dưới để nhận mã xác nhận"` không.
- Nếu có → set state `showCompletionButton = true` → hiển thị nút **"Nhận mã hoàn thành"** bên dưới chat.

### 3. User Bấm Nút
- Gọi `POST /api/completion-codes/claim` với `{ lessonId, deviceId }`
- Server:
  1. Kiểm tra `device_id` đã có mã cho `lesson_id` này chưa — nếu có, trả về mã cũ
  2. Nếu chưa: tìm 1 mã `WHERE lesson_id = ? AND device_id IS NULL LIMIT 1`
  3. Update `device_id = ?` và `used_at = now()`
  4. Trả về `{ code }`
  5. Nếu hết mã: trả về lỗi `{ error: "Đã hết mã, vui lòng liên hệ quản lý." }`

### 4. Hiển Thị Modal
- Modal hiển thị mã lớn, rõ, font monospace
- Nút "Copy mã"
- Thông báo: *"Lưu mã này lại và gửi cho quản lý để xác nhận bạn đã hoàn thành bài học."*
- Mã được lưu vào `localStorage` key `completion_code_{lessonId}` để hiển thị lại nếu user quay lại trang.

### 5. Lần Sau Quay Lại
- Khi load trang `/learn/[id]`, kiểm tra `localStorage` có `completion_code_{lessonId}` không.
- Nếu có → hiển thị badge nhỏ "Đã hoàn thành" + nút "Xem mã" trên header.

---

## API Endpoint Mới

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| POST | `/api/completion-codes/claim` | `{ lessonId, deviceId }` | `{ code }` hoặc `{ error }` |

---

## Script Seed Codes

Tạo script `scripts/seed-completion-codes.ts` để:
1. Sinh 50 mã ngẫu nhiên dạng `XXXX-XXXX`
2. Insert vào bảng `completion_codes` với `lesson_id` chỉ định
3. Chạy một lần khi setup

---

## Files Cần Thay Đổi

| File | Thay đổi |
|------|----------|
| `app/api/chat/route.ts` | Thêm instruction vào system prompt |
| `app/learn/[id]/page.tsx` | Detect completion signal, show button + modal |
| `app/api/completion-codes/claim/route.ts` | Endpoint mới |
| `lib/supabase.ts` | Không đổi |
| `scripts/seed-completion-codes.ts` | Script seed mới |

---

## Out of Scope

- Trang admin xác minh (dùng Supabase dashboard trực tiếp)
- Expiry cho mã
- Feature này không áp dụng cho course nhiều module (`/course/...`)
