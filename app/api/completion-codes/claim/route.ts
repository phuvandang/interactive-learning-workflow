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
