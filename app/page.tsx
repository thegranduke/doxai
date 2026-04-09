'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function trackDocClick(params: {
  docUrl: string
  docTitle: string
  docSection?: string
  errorCode?: string
  eventType: 'expand' | 'visit'
}) {
  // Fire-and-forget — don't await, don't block UX
  fetch('/api/track-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {})
}

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
  whyRelevant: string
  tldr: string
  excerpt: string
  relevance: Relevance
  section: string
}

interface Result {
  errorCode: string
  likelyCause: string
  fixSteps: string[]
  docs: DocLink[]
}

const relevanceBar: Record<Relevance, string> = {
  high: 'bg-[#3ECF8E]',
  mid: 'bg-zinc-400',
  low: 'bg-zinc-600',
}

// ── Chevron icon ─────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`text-muted-foreground transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Expandable doc card ───────────────────────────────────────────────────────
function DocCard({ doc, errorCode }: { doc: DocLink; errorCode?: string }) {
  const [open, setOpen] = useState(false)

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      trackDocClick({
        docUrl: doc.url,
        docTitle: doc.title,
        docSection: doc.section,
        errorCode,
        eventType: 'expand',
      })
    }
  }

  return (
    <div className={`rounded-lg border bg-card transition-colors ${open ? 'border-[#3ECF8E]/60' : 'border-border'}`}>
      {/* Header row — click to expand.
          Must be a div, not a button, because TooltipTrigger renders a <button>
          and HTML disallows button-inside-button. */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle() } }}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left cursor-pointer group"
      >
        {/* Relevance bar */}
        <div className={`w-0.5 self-stretch rounded-full shrink-0 mt-0.5 ${relevanceBar[doc.relevance] ?? 'bg-zinc-400'}`} />

        <div className="flex-1 min-w-0">
          {/* Title with tooltip */}
          <Tooltip>
            <TooltipTrigger>
              <span className="font-mono text-[13px] font-medium text-foreground group-hover:text-[#3ECF8E] transition-colors">
                {doc.title}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] font-mono text-[11px] leading-relaxed">
              {doc.tldr}
            </TooltipContent>
          </Tooltip>

          {/* Why relevant */}
          <p className="font-mono text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {doc.whyRelevant}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start mt-0.5">
          {doc.section && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {doc.section}
            </Badge>
          )}
          <Chevron open={open} />
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="ml-3.5 border-t border-border pt-3">
            <p className={`leading-relaxed text-foreground/80 ${doc.tldr ? 'font-mono text-[12px]' : ''}`}>
              {doc.excerpt}
            </p>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => {
                e.stopPropagation()
                trackDocClick({
                  docUrl: doc.url,
                  docTitle: doc.title,
                  docSection: doc.section,
                  errorCode,
                  eventType: 'visit',
                })
              }}
              className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] text-[#3ECF8E] hover:underline underline-offset-2"
            >
              Open in Supabase docs
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('developer')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function analyze() {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult(null)
    setApiError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: input, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setResult(data)
      }
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    }
    setLoading(false)
  }

  async function copySteps() {
    if (!result?.fixSteps?.length) return
    await navigator.clipboard.writeText(
      result.fixSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] inline-block" />
          <span className="font-mono text-lg font-light tracking-tight">error decoder</span>
          <span className="font-mono text-xs text-muted-foreground">/ supabase docs</span>
        </div>
        <Link
          href="/analytics"
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          analytics →
        </Link>
      </div>

      {/* ── Examples ── */}
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">try an example</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(EXAMPLES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => { setInput(val); setResult(null); setApiError(null) }}
            className="font-mono text-[11px] px-3 py-1 rounded-md border border-border text-muted-foreground hover:border-[#3ECF8E] hover:text-foreground transition-colors"
          >
            {key === 'pgconn' ? 'pg conn' : key}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <Textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') analyze() }}
        placeholder={`paste your error here...\n\nAuthApiError: JWT expired\n  at SupabaseClient.getSession\n  status: 401`}
        className="font-mono text-xs min-h-[120px] mb-4 resize-y focus-visible:ring-[#3ECF8E] focus-visible:ring-1"
      />

      {/* ── Mode + Analyze button ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex gap-1">
          {(['developer', 'kid'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`font-mono text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                mode === m
                  ? 'bg-[#3ECF8E] text-black border-[#3ECF8E] font-medium'
                  : 'border-border text-muted-foreground hover:border-[#3ECF8E]'
              }`}
            >
              {m === 'kid' ? "explain like i'm 8" : m}
            </button>
          ))}
        </div>
        <Button
          onClick={analyze}
          disabled={loading || !input.trim()}
          className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-black font-mono text-xs font-medium"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              analyzing...
            </span>
          ) : (
            'analyze error →'
          )}
        </Button>
      </div>

      {/* ── API error state ── */}
      {apiError && (
        <div className="animate-in fade-in duration-200 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 mb-6">
          <p className="font-mono text-[12px] text-destructive">{apiError}</p>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">

          {/* Error code badge */}
          {result.errorCode && (
            <code className="text-[11px] px-2 py-0.5 rounded bg-destructive/10 text-destructive font-mono inline-block">
              {result.errorCode}
            </code>
          )}

          {/* ── Section 1: What happened ── */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              {mode === 'kid' ? 'the simple version' : 'what happened'}
            </p>
            <div className={`rounded-lg border p-4 bg-card ${mode === 'kid' ? 'border-[#3ECF8E]/60' : 'border-border'}`}>
              <p className={`leading-relaxed text-foreground ${mode === 'kid' ? 'font-serif text-base italic' : 'font-mono text-[13px]'}`}>
                {result.likelyCause}
              </p>
            </div>
          </section>

          <Separator />

          {/* ── Section 2: Relevant documentation ── */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              relevant documentation
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mb-3">
              Hover a title to preview — click to expand the relevant content.
            </p>
            <div className="flex flex-col gap-2">
              {result.docs.map((doc, i) => (
                <DocCard key={i} doc={doc} errorCode={result.errorCode} />
              ))}
            </div>
          </section>

          <Separator />

          {/* ── Section 3: How to fix ── */}
          {result.fixSteps?.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#3ECF8E]">
                  how to fix
                </p>
                <button
                  onClick={copySteps}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#3ECF8E]">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-[#3ECF8E]">copied</span>
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      copy steps
                    </>
                  )}
                </button>
              </div>

              {/* Clean numbered list — Supabase guide style */}
              <ol className="rounded-lg border border-border bg-card overflow-hidden">
                {result.fixSteps.map((step, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-4 px-5 py-4 ${
                      i < result.fixSteps.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0 mt-0.5 select-none tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className={`leading-relaxed text-foreground flex-1 ${
                      mode === 'kid' ? 'font-serif text-sm italic' : 'font-mono text-[13px]'
                    }`}>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

        </div>
      )}
    </main>
  )
}
