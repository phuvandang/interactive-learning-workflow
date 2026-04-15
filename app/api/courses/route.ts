import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/courses
export async function GET() {
  try {
    const supabase = getSupabase()
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, youtube_url, youtube_video_id, language, scenario, structure, transcript, sources, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ courses })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/courses — save course + all lessons
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { title, youtube_url, youtube_video_id, language, transcript, scenario, structure, lessons, sources } = await req.json()

    if (!title || !scenario || !structure) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Save course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({ title, youtube_url: youtube_url || '', youtube_video_id: youtube_video_id || '', language, transcript, scenario, structure, sources: sources || [] })
      .select()
      .single()

    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 })

    // Save all lessons
    if (lessons && lessons.length > 0) {
      const lessonRows = lessons.map((l: {
        module_id: string
        lesson_id: string
        name: string
        claude_md_content: string
        order_index: number
      }) => ({
        course_id: course.id,
        module_id: l.module_id,
        lesson_id: l.lesson_id,
        name: l.name,
        claude_md_content: l.claude_md_content,
        order_index: l.order_index,
      }))

      const { error: lessonError } = await supabase.from('course_lessons').insert(lessonRows)
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
    }

    return NextResponse.json({ course })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/courses — update title, transcript, sources, structure + replace all lessons
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { id, title, transcript, sources, structure, lessons } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (transcript !== undefined) updates.transcript = transcript
    if (sources !== undefined) updates.sources = sources
    if (structure !== undefined) updates.structure = structure

    // Update course record
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 })

    // Replace all lessons
    if (lessons && lessons.length > 0) {
      const { error: delError } = await supabase.from('course_lessons').delete().eq('course_id', id)
      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

      const lessonRows = lessons.map((l: {
        module_id: string; lesson_id: string; name: string; claude_md_content: string; order_index: number
      }) => ({ course_id: id, module_id: l.module_id, lesson_id: l.lesson_id, name: l.name, claude_md_content: l.claude_md_content, order_index: l.order_index }))

      const { error: lessonError } = await supabase.from('course_lessons').insert(lessonRows)
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
    }

    return NextResponse.json({ course })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/courses?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
