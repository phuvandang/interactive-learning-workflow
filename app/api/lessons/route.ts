import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/lessons — list all lessons
export async function GET() {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, youtube_url, youtube_video_id, language, claude_md_content, transcript, sources, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lessons: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/lessons — save a lesson
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { title, youtube_url, youtube_video_id, language, transcript, claude_md_content, sources } = body

    if (!title || !claude_md_content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('lessons')
      .insert({ title, youtube_url: youtube_url || '', youtube_video_id: youtube_video_id || '', language, transcript, claude_md_content, sources: sources || [] })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lesson: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/lessons — update title, transcript, sources, claude_md_content
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { id, title, transcript, sources, claude_md_content } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (transcript !== undefined) updates.transcript = transcript
    if (sources !== undefined) updates.sources = sources
    if (claude_md_content !== undefined) updates.claude_md_content = claude_md_content

    const { data, error } = await supabase
      .from('lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lesson: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/lessons?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
