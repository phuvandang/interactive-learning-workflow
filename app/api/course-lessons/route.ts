import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/course-lessons?course_id=xxx
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const course_id = req.nextUrl.searchParams.get('course_id')
    if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('course_lessons')
      .select('*')
      .eq('course_id', course_id)
      .order('order_index', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lessons: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
