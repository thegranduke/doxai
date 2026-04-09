import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { fetchRelevantDocs } from '@/lib/fetch-docs'
import { logError } from '@/lib/supabase-admin'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(req: NextRequest) {
  const { error, mode } = await req.json()
  if (!error?.trim()) {
    return NextResponse.json({ error: 'No error provided' }, { status: 400 })
  }

  const isKid = mode === 'kid'

  // Fetch relevant Supabase docs in parallel while we build the prompt.
  // Content is cached for 1 hour — zero latency on repeated error types.
  const docsContext = await fetchRelevantDocs(error).catch(() => '')

  const docsBlock = docsContext
    ? `\n\nThe following is the ACTUAL content of the relevant Supabase documentation pages. Ground your entire response — especially fixSteps and doc excerpts — in this content. Do not invent information not present here:\n\n${docsContext}\n`
    : ''

  const systemPrompt = `You are a Supabase documentation expert. Analyze the error and return ONLY valid JSON — no markdown, no backticks, no commentary outside the JSON.${docsBlock}

Return this exact shape:
{
  "errorCode": "SCREAMING_SNAKE_CASE short code e.g. JWT_EXPIRED",
  "likelyCause": "${
    isKid
      ? 'Explain to an 8-year-old using a fun real-world analogy. 2-3 playful but accurate sentences.'
      : 'Precise 2-3 sentences: what exactly caused this error, which Supabase layer failed, and why.'
  }",
  "fixSteps": [
    "Step directly from Supabase docs. Use exact function names, config keys, or SQL. Start with an action verb.",
    "..."
  ],
  "docs": [
    {
      "title": "Exact title of the Supabase docs page",
      "url": "https://supabase.com/docs/...",
      "whyRelevant": "One sentence: why this specific page helps fix THIS error.",
      "tldr": "Plain English, zero jargon. What a non-developer takes away from this page — one sentence.",
      "excerpt": "2-4 sentences: the most relevant content from this actual page. Quote or closely paraphrase the documentation above.",
      "relevance": "high",
      "section": "Auth"
    }
  ]
}

Rules:
- fixSteps: 2-5 steps. Every step must come directly from the Supabase documentation provided above. Use exact function signatures and parameter names as they appear in the docs.
- docs: 3-5 pages ordered by relevance. Only reference pages that appear in the documentation context above, or well-known pages you are certain exist at supabase.com/docs.
- excerpt: paraphrase actual content from the docs above — do not invent content.
- relevance: exactly "high" | "mid" | "low"
- section: exactly "Auth" | "Database" | "Storage" | "Realtime" | "Edge Functions" | "CLI" | "API"
- Return only the JSON object.`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Error:\n\n${error}`,
      config: {
        systemInstruction: systemPrompt,
        // JSON mode guarantees structurally valid output — no backtick fences to strip.
        // Larger token budget needed because injected docs context makes responses longer.
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
      },
    })

    const raw = response.text ?? ''
    const parsed = JSON.parse(raw)

    // Fire-and-forget analytics log — don't block the response
    logError({
      errorCode: parsed.errorCode ?? 'UNKNOWN',
      rawError: error,
      mode,
    }).catch(() => {})

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    if (message.includes('API_KEY') || message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Add your GEMINI_API_KEY to .env.local.' },
        { status: 401 }
      )
    }

    console.error('[analyze]', err)
    return NextResponse.json(
      { error: 'Failed to analyze the error. Please try again.' },
      { status: 500 }
    )
  }
}
