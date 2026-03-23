import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/sessions?lesson_id=xxx&device_id=xxx
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const lesson_id = req.nextUrl.searchParams.get('lesson_id')
    const device_id = req.nextUrl.searchParams.get('device_id')

    if (!lesson_id || !device_id) {
      return NextResponse.json({ error: 'lesson_id and device_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, lesson_id, device_id, messages, created_at, updated_at')
      .eq('lesson_id', lesson_id)
      .eq('device_id', device_id)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sessions: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/sessions — create new session
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { lesson_id, device_id, messages } = await req.json()

    if (!lesson_id || !device_id || !messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ lesson_id, device_id, messages })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/sessions — update messages in existing session
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { id, messages } = await req.json()

    if (!id || !messages) {
      return NextResponse.json({ error: 'id and messages required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ messages, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/sessions?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('chat_sessions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
