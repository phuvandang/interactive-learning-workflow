import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/sessions?device_id=xxx                          → all sessions for device
// GET /api/sessions?lesson_id=xxx&device_id=xxx            → sessions for a lesson
// GET /api/sessions?course_lesson_id=xxx&device_id=xxx     → sessions for a course lesson
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const lesson_id = req.nextUrl.searchParams.get('lesson_id')
    const course_lesson_id = req.nextUrl.searchParams.get('course_lesson_id')
    const device_id = req.nextUrl.searchParams.get('device_id')

    if (!device_id) {
      return NextResponse.json({ error: 'device_id required' }, { status: 400 })
    }

    let query = supabase
      .from('chat_sessions')
      .select('id, lesson_id, course_lesson_id, lesson_title, device_id, messages, created_at, updated_at')
      .eq('device_id', device_id)
      .order('updated_at', { ascending: false })

    if (course_lesson_id) {
      query = query.eq('course_lesson_id', course_lesson_id)
    } else if (lesson_id) {
      query = query.eq('lesson_id', lesson_id)
    }

    const { data, error } = await query

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
    const { lesson_id, course_lesson_id, lesson_title, device_id, messages } = await req.json()

    if ((!lesson_id && !course_lesson_id) || !device_id || !messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ lesson_id: lesson_id || null, course_lesson_id: course_lesson_id || null, lesson_title: lesson_title || null, device_id, messages })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/sessions — update messages or lesson_title in existing session
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { id, messages, lesson_title } = await req.json()

    if (!id || (!messages && lesson_title === undefined)) {
      return NextResponse.json({ error: 'id and messages or lesson_title required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (messages) updates.messages = messages
    if (lesson_title !== undefined) updates.lesson_title = lesson_title

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updates)
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
