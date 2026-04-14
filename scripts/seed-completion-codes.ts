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
