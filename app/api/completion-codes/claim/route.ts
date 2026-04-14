import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { lessonId, deviceId } = await req.json()

    if (
      typeof lessonId !== 'string' || typeof deviceId !== 'string' ||
      lessonId.length > 100 || deviceId.length > 200
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Check if this device already has a code for this lesson
    const { data: existing, error: existingError } = await supabase
      .from('completion_codes')
      .select('code')
      .eq('lesson_id', lessonId)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (existingError) {
      console.error('[claim] idempotency check error:', existingError.message)
      return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
    }

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
    const { data: updated, error: updateError } = await supabase
      .from('completion_codes')
      .update({ device_id: deviceId, used_at: new Date().toISOString() })
      .eq('id', unused.id)
      .is('device_id', null) // guard against race condition
      .select('code')
      .maybeSingle()

    if (updateError) {
      console.error('[claim] update error:', updateError.message)
      return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Mã vừa được cấp cho thiết bị khác. Vui lòng thử lại.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ code: updated.code })
  } catch (err) {
    console.error('[claim] unexpected error:', err)
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
  }
}
