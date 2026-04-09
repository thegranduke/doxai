import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(req: NextRequest) {
  const { error, mode } = await req.json()
  if (!error?.trim()) {
    return NextResponse.json({ error: 'No error provided' }, { status: 400 })
  }

  const isKid = mode === 'kid'

  const systemPrompt = `You are an expert on Supabase. Given a pasted error, return ONLY valid JSON, no markdown, no backticks:
{
  "errorCode": "short error code e.g. JWT_EXPIRED",
  "explanation": "${
    isKid
      ? 'Explain to an 8 year old using a fun real-world analogy. 2-3 sentences. Playful but accurate.'
      : '2-3 sentence technical explanation of what caused this and what it means in Supabase context.'
  }",
  "fixHint": "One concrete actionable fix. Start with an action verb. Be specific.",
  "docs": [
    {
      "title": "Supabase docs page title",
      "url": "https://supabase.com/docs/...",
      "description": "One sentence why this page is relevant",
      "relevance": "high" | "mid" | "low",
      "section": "Auth" | "Database" | "Storage" | "Realtime" | "Edge Functions" | "CLI" | "API"
    }
  ]
}
Return 3-5 docs ordered by relevance. Only return the JSON object.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Error:\n\n${error}`,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
    },
  })

  const raw = response.text ?? ''
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
  return NextResponse.json(parsed)
}
