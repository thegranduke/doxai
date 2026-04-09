import { logDocClick } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { docUrl, docTitle, docSection, errorCode, eventType } = await req.json()

  if (!docUrl || !docTitle) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
  }

  // Fire-and-forget — client doesn't need to wait for this
  await logDocClick({
    docUrl,
    docTitle,
    docSection,
    errorCode,
    eventType: eventType === 'expand' ? 'expand' : 'visit',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
