# Completion Code Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi AI kết thúc bài học đơn (`/learn/[id]`), hiển thị nút "Nhận mã hoàn thành" — user bấm nhận mã duy nhất từ pool 50 mã để nộp cho quản lý xác minh.

**Architecture:** AI kết thúc bài học bằng câu cố định chứa trigger phrase. Frontend detect phrase đó sau khi stream xong → hiển thị nút claim. User bấm → gọi API claim mã từ DB → hiển thị modal với mã. Mã được lưu localStorage để hiển thị lại lần sau.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL), React 19

---

## File Structure

| File | Action | Mục đích |
|------|--------|---------|
| `app/api/completion-codes/claim/route.ts` | Create | API endpoint claim mã |
| `scripts/seed-completion-codes.ts` | Create | Script seed 50 mã vào DB |
| `app/api/chat/route.ts` | Modify (line 83) | Thêm completion instruction vào system prompt |
| `app/learn/[id]/page.tsx` | Modify | Detect signal, show button + modal, localStorage |

**Completion trigger phrase (bất biến — dùng ở cả server và client):**
```
COMPLETION_SIGNAL = "Bấm nút bên dưới để nhận mã xác nhận"
```

---

## Task 1: Tạo bảng `completion_codes` trong Supabase

**Files:**
- Modify: Supabase dashboard (SQL Editor)

- [ ] **Step 1: Chạy SQL migration trong Supabase Dashboard → SQL Editor**

```sql
CREATE TABLE completion_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  device_id text NULL,
  used_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

-- Index để query nhanh mã chưa dùng theo lesson
CREATE INDEX idx_completion_codes_lesson_unused
  ON completion_codes (lesson_id)
  WHERE device_id IS NULL;
```

- [ ] **Step 2: Xác nhận bảng tồn tại**

Trong Supabase Dashboard → Table Editor → xác nhận bảng `completion_codes` xuất hiện với đúng 5 columns.

---

## Task 2: Tạo seed script

**Files:**
- Create: `scripts/seed-completion-codes.ts`

- [ ] **Step 1: Tạo thư mục scripts**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Tạo file `scripts/seed-completion-codes.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const LESSON_ID = 'c16a6888-09fd-43ce-b129-8e68b2bcaacd'
const CODE_COUNT = 50

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I,O,0,1 to avoid confusion
  const rand = (n: number) => Math.floor(Math.random() * n)
  const part = () => Array.from({ length: 4 }, () => chars[rand(chars.length)]).join('')
  return `${part()}-${part()}`
}

async function seed() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Check existing codes for this lesson
  const { data: existing } = await supabase
    .from('completion_codes')
    .select('code')
    .eq('lesson_id', LESSON_ID)

  const existingCount = existing?.length ?? 0
  const needed = CODE_COUNT - existingCount

  if (needed <= 0) {
    console.log(`Already have ${existingCount} codes for this lesson. Nothing to do.`)
    return
  }

  console.log(`Generating ${needed} new codes (${existingCount} already exist)...`)

  // Generate unique codes
  const existingSet = new Set(existing?.map((r) => r.code) ?? [])
  const newCodes: string[] = []
  while (newCodes.length < needed) {
    const code = generateCode()
    if (!existingSet.has(code) && !newCodes.includes(code)) {
      newCodes.push(code)
    }
  }

  const rows = newCodes.map((code) => ({ code, lesson_id: LESSON_ID }))
  const { error } = await supabase.from('completion_codes').insert(rows)

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`Successfully inserted ${newCodes.length} codes:`)
  newCodes.forEach((c) => console.log(' ', c))
}

seed()
```

- [ ] **Step 3: Thêm script vào `package.json`**

Mở `package.json`, thêm vào `"scripts"`:

```json
"seed-codes": "npx tsx --env-file=.env.local scripts/seed-completion-codes.ts"
```

Kết quả `scripts` block sau khi sửa:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "seed-codes": "npx tsx --env-file=.env.local scripts/seed-completion-codes.ts"
}
```

- [ ] **Step 4: Chạy seed script**

```bash
npm run seed-codes
```

Expected output:
```
Generating 50 new codes (0 already exist)...
Successfully inserted 50 codes:
  ABCD-EF23
  ...
```

- [ ] **Step 5: Verify trong Supabase**

Supabase Dashboard → Table Editor → `completion_codes` → xác nhận có 50 rows, tất cả có `lesson_id = c16a6888-09fd-43ce-b129-8e68b2bcaacd`, `device_id = null`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-completion-codes.ts package.json
git commit -m "feat: add completion codes seed script and table migration"
```

---

## Task 3: Tạo API endpoint `/api/completion-codes/claim`

**Files:**
- Create: `app/api/completion-codes/claim/route.ts`

- [ ] **Step 1: Tạo thư mục và file**

```bash
mkdir -p app/api/completion-codes/claim
```

- [ ] **Step 2: Tạo `app/api/completion-codes/claim/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { lessonId, deviceId } = await req.json()

    if (!lessonId || !deviceId) {
      return NextResponse.json({ error: 'Missing lessonId or deviceId' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Check if this device already has a code for this lesson
    const { data: existing } = await supabase
      .from('completion_codes')
      .select('code')
      .eq('lesson_id', lessonId)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ code: existing.code })
    }

    // Claim an unused code
    const { data: unused, error: fetchError } = await supabase
      .from('completion_codes')
      .select('id, code')
      .eq('lesson_id', lessonId)
      .is('device_id', null)
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('[claim] fetch error:', fetchError.message)
      return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
    }

    if (!unused) {
      return NextResponse.json(
        { error: 'Đã hết mã xác nhận. Vui lòng liên hệ quản lý.' },
        { status: 409 }
      )
    }

    // Mark as used
    const { error: updateError } = await supabase
      .from('completion_codes')
      .update({ device_id: deviceId, used_at: new Date().toISOString() })
      .eq('id', unused.id)
      .is('device_id', null) // guard against race condition

    if (updateError) {
      console.error('[claim] update error:', updateError.message)
      return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
    }

    return NextResponse.json({ code: unused.code })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[claim] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Test endpoint thủ công**

```bash
curl -X POST http://localhost:3000/api/completion-codes/claim \
  -H "Content-Type: application/json" \
  -d '{"lessonId":"c16a6888-09fd-43ce-b129-8e68b2bcaacd","deviceId":"test-device-001"}'
```

Expected: `{"code":"XXXX-XXXX"}` (mã ngẫu nhiên từ pool)

Chạy lại lệnh y chang → phải trả về **cùng mã** (idempotent).

Kiểm tra trong Supabase: row đó phải có `device_id = "test-device-001"` và `used_at != null`.

- [ ] **Step 4: Commit**

```bash
git add app/api/completion-codes/claim/route.ts
git commit -m "feat: add completion code claim API endpoint"
```

---

## Task 4: Cập nhật system prompt trong `/api/chat/route.ts`

**Files:**
- Modify: `app/api/chat/route.ts` (line 83 — cuối system prompt)

- [ ] **Step 1: Mở file và tìm dòng cuối system prompt**

Tìm đoạn (hiện ở line ~83):
```typescript
- Dùng markdown để format. Kiên nhẫn, ấm áp, không phán xét.
${previousContextSection}`
```

- [ ] **Step 2: Thêm completion instruction ngay trước closing backtick**

Thay thế đoạn trên thành:

```typescript
- Dùng markdown để format. Kiên nhẫn, ấm áp, không phán xét.

---

## Kết Thúc Bài Học

Khi bạn đã dạy xong toàn bộ nội dung bài học — đã đi qua tất cả các phần, đã có phần thực hành và tổng kết cá nhân hóa — bạn PHẢI kết thúc bằng đúng câu sau, không thay đổi:

"Chúc mừng bạn đã hoàn thành bài học! Bấm nút bên dưới để nhận mã xác nhận."

Chỉ nói câu này **một lần duy nhất**, **ở cuối toàn bộ bài học**, sau khi đã tổng kết xong. Không nói sớm hơn.
${previousContextSection}`
```

- [ ] **Step 3: Verify file không bị syntax error**

```bash
npx tsc --noEmit
```

Expected: không có lỗi.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add lesson completion signal to chat system prompt"
```

---

## Task 5: Cập nhật frontend `/app/learn/[id]/page.tsx`

**Files:**
- Modify: `app/learn/[id]/page.tsx`

### 5A: Thêm state mới

- [ ] **Step 1: Tìm block khai báo state** (khoảng line 28-41, ngay sau `export default function LearnPage()`)

Tìm đoạn:
```typescript
  const [chatError, setChatError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
```

Thêm 2 state mới ngay sau `chatError`:
```typescript
  const [chatError, setChatError] = useState("");
  const [showCompletionButton, setShowCompletionButton] = useState(false);
  const [completionCode, setCompletionCode] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [claimingCode, setClaimingCode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
```

### 5B: Load mã đã lưu từ localStorage khi mount

- [ ] **Step 2: Tìm useEffect load deviceId** (khoảng line 44-49):

```typescript
  useEffect(() => {
    const did = getOrCreateDeviceId();
    setDeviceId(did);
    const saved = localStorage.getItem("auto_save_sessions");
    if (saved === "false") setAutoSave(false);
  }, []);
```

Thêm dòng load completion code ngay trong effect đó:
```typescript
  useEffect(() => {
    const did = getOrCreateDeviceId();
    setDeviceId(did);
    const saved = localStorage.getItem("auto_save_sessions");
    if (saved === "false") setAutoSave(false);
    // Load previously claimed code if exists
    const savedCode = localStorage.getItem(`completion_code_${id}`);
    if (savedCode) setCompletionCode(savedCode);
  }, [id]);
```

### 5C: Detect completion signal sau khi stream xong

- [ ] **Step 3: Tìm đoạn trong `sendMessage` sau khi stream kết thúc** (khoảng line 174-195):

Tìm trong `finally` block:
```typescript
      if (autoSave) {
        const newId = await saveSession(finalMessages, currentSessionId);
```

Thêm detection **trước** khối `if (autoSave)`:
```typescript
      // Detect lesson completion signal
      const COMPLETION_SIGNAL = "Bấm nút bên dưới để nhận mã xác nhận"
      if (accumulated.includes(COMPLETION_SIGNAL) && !completionCode) {
        setShowCompletionButton(true);
      }

      if (autoSave) {
        const newId = await saveSession(finalMessages, currentSessionId);
```

### 5D: Thêm hàm `claimCode`

- [ ] **Step 4: Thêm function `claimCode` sau function `startNewSession`** (khoảng line 225):

```typescript
  async function claimCode() {
    if (!deviceId || !id || claimingCode) return;
    setClaimingCode(true);
    try {
      const res = await fetch("/api/completion-codes/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: id, deviceId }),
      });
      const data = await res.json();
      if (data.code) {
        setCompletionCode(data.code);
        localStorage.setItem(`completion_code_${id}`, data.code);
        setShowCompletionButton(false);
        setShowCodeModal(true);
      } else {
        alert(data.error || "Lỗi khi nhận mã. Vui lòng thử lại.");
      }
    } catch {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setClaimingCode(false);
    }
  }
```

### 5E: Thêm UI — badge "Đã hoàn thành" trong header

- [ ] **Step 5: Tìm trong header block** — nơi có nút "💾 Đang lưu" và "📋 Lịch sử" (khoảng line 271-295):

Tìm đoạn:
```typescript
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={toggleAutoSave}
```

Thêm badge ngay sau thẻ `<div className="flex items-center gap-1.5 flex-shrink-0">`:
```typescript
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {completionCode && (
            <button
              onClick={() => setShowCodeModal(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              title="Xem mã hoàn thành của bạn"
            >
              ✓ <span className="hidden sm:inline">Đã hoàn thành</span>
            </button>
          )}
          <button
            onClick={toggleAutoSave}
```

### 5F: Thêm UI — nút "Nhận mã hoàn thành" bên dưới chat

- [ ] **Step 6: Tìm `<div ref={bottomRef} />`** trong messages list (khoảng line 418):

```typescript
          <div ref={bottomRef} />
```

Thêm completion button ngay trước `<div ref={bottomRef} />`:
```typescript
          {showCompletionButton && !completionCode && (
            <div className="flex justify-center py-4">
              <button
                onClick={claimCode}
                disabled={claimingCode}
                className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {claimingCode ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang cấp mã...
                  </>
                ) : (
                  "🏆 Nhận mã hoàn thành"
                )}
              </button>
            </div>
          )}
          <div ref={bottomRef} />
```

### 5G: Thêm modal hiển thị mã

- [ ] **Step 7: Tìm closing `</div>` cuối cùng của component** (dòng cuối file, sau `</div>` của `flex flex-col flex-1 min-h-0`):

Thêm modal ngay trước dòng closing `</div>` cuối cùng:
```typescript
      {/* Completion Code Modal */}
      {showCodeModal && completionCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-lg font-bold text-slate-800">Chúc mừng!</h2>
              <p className="text-sm text-slate-500 mt-1">Bạn đã hoàn thành bài học</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">Mã xác nhận của bạn</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-slate-800">
                {completionCode}
              </p>
            </div>
            <p className="text-xs text-slate-500 text-center mb-4">
              Lưu mã này lại và gửi cho quản lý để xác nhận bạn đã hoàn thành bài học.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(completionCode);
                }}
                className="flex-1 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Copy mã
              </button>
              <button
                onClick={() => setShowCodeModal(false)}
                className="flex-1 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

> **Lưu ý:** Xóa dòng `</div>`, `);`, `}` cũ ở cuối file nếu bị duplicate sau khi thêm modal.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: không có lỗi.

- [ ] **Step 9: Commit**

```bash
git add app/learn/[id]/page.tsx
git commit -m "feat: add completion code UI — detect signal, claim button, modal"
```

---

## Task 6: Test end-to-end

- [ ] **Step 1: Chạy dev server**

```bash
npm run dev
```

- [ ] **Step 2: Mở bài học**

Mở `http://localhost:3000/learn/c16a6888-09fd-43ce-b129-8e68b2bcaacd`

- [ ] **Step 3: Test happy path**

1. Bấm "Bắt đầu học" → chat với AI đi qua toàn bộ bài học
2. Sau khi AI kết thúc bài học bằng câu *"Chúc mừng bạn đã hoàn thành bài học! Bấm nút bên dưới để nhận mã xác nhận."* → nút "🏆 Nhận mã hoàn thành" xuất hiện bên dưới
3. Bấm nút → modal hiện ra với mã dạng `XXXX-XXXX`
4. Bấm "Copy mã" → paste vào nơi khác → xác nhận mã đúng
5. Đóng modal → header có badge "✓ Đã hoàn thành"
6. Reload trang → badge vẫn còn (từ localStorage)
7. Bấm badge → modal hiện lại đúng mã cũ

- [ ] **Step 4: Test idempotency**

Reload trang → bấm badge → xác nhận hiện đúng mã cũ (không cấp mã mới).

- [ ] **Step 5: Verify trong Supabase**

Dashboard → `completion_codes` → tìm row có mã vừa nhận → xác nhận `device_id` đã được set, `used_at` != null.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: completion code feature — full implementation"
```
