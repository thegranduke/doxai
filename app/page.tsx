'use client'

import { useState } from 'react'

const EXAMPLES = {
  jwt: `AuthApiError: JWT expired\n    at SupabaseClient._handleResponse\n    status: 401, code: "token_expired"`,
  rls: `ERROR: 42501: new row violates row-level security policy for table "profiles"\n    code: "42501", details: null`,
  storage: `StorageApiError: The resource already exists\n    status: 400, error: "Duplicate"`,
  realtime: `RealtimeChannel: subscribe error - channel left abnormally\n    reason: "heartbeat_timeout", code: 4004`,
  pgconn: `Error: connect ECONNREFUSED 127.0.0.1:5432\n    code: "ECONNREFUSED"`,
}

type Mode = 'developer' | 'kid'
type Relevance = 'high' | 'mid' | 'low'

interface DocLink {
  title: string
  url: string
  description: string
  relevance: Relevance
  section: string
}

interface Result {
  errorCode: string
  explanation: string
  fixHint: string
  docs: DocLink[]
}

const relevanceBar: Record<Relevance, string> = {
  high: 'bg-[#3ECF8E]',
  mid: 'bg-zinc-400',
  low: 'bg-zinc-600',
}

export default function Home() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('developer')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function analyze() {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: input, mode }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-16 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-10">
        <span className="w-2 h-2 rounded-full bg-[#3ECF8E] inline-block" />
        <span className="font-mono text-lg font-light tracking-tight">error decoder</span>
        <span className="font-mono text-xs text-zinc-500">/ supabase docs</span>
      </div>

      {/* Examples */}
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">try an example</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(EXAMPLES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setInput(val)}
            className="font-mono text-[11px] px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-[#3ECF8E] hover:text-foreground transition-colors"
          >
            {key === 'pgconn' ? 'pg conn' : key}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') analyze()
        }}
        placeholder={`paste your error here...\n\nAuthApiError: JWT expired\n  at SupabaseClient.getSession\n  status: 401`}
        className="w-full font-mono text-xs min-h-[120px] mb-4 resize-y rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent p-3 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]"
      />

      {/* Mode + Button */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex gap-1">
          {(['developer', 'kid'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`font-mono text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                mode === m
                  ? 'bg-[#3ECF8E] text-black border-[#3ECF8E] font-medium'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-[#3ECF8E]'
              }`}
            >
              {m === 'kid' ? "explain like i'm 8" : m}
            </button>
          ))}
        </div>
        <button
          onClick={analyze}
          disabled={loading || !input.trim()}
          className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono text-xs font-medium px-4 py-2 rounded-lg transition-opacity"
        >
          {loading ? 'analyzing...' : 'analyze error →'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Error code pill */}
          {result.errorCode && (
            <code className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-mono mb-4 inline-block">
              {result.errorCode}
            </code>
          )}

          {/* Explanation card */}
          <div
            className={`rounded-xl border p-5 mb-6 bg-zinc-50 dark:bg-zinc-900 ${
              mode === 'kid' ? 'border-[#3ECF8E]' : 'border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
              {mode === 'kid' ? 'the simple version' : "what's happening"}
            </p>
            <p
              className={`leading-relaxed text-foreground ${
                mode === 'kid' ? 'font-serif text-base italic' : 'font-mono text-[13px]'
              }`}
            >
              {result.explanation}
            </p>
            {result.fixHint && (
              <>
                <hr className="my-3 border-zinc-200 dark:border-zinc-700" />
                <p className="font-mono text-[12px] text-zinc-500">
                  <span className="text-foreground font-medium">Try first: </span>
                  {result.fixHint}
                </p>
              </>
            )}
          </div>

          {/* Doc links */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">relevant docs</p>
          <div className="flex flex-col gap-2">
            {result.docs.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-[#3ECF8E] bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all group"
              >
                <div
                  className={`w-0.5 self-stretch rounded-full shrink-0 mt-0.5 ${relevanceBar[doc.relevance] ?? 'bg-zinc-400'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] font-medium text-foreground group-hover:text-[#3ECF8E] transition-colors">
                    {doc.title}
                  </p>
                  <p className="font-mono text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{doc.description}</p>
                </div>
                {doc.section && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 shrink-0 self-start mt-0.5">
                    {doc.section}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
