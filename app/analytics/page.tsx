/**
 * Analytics dashboard — server component, re-renders every 60 seconds.
 *
 * Answers two questions useful for a docs team:
 *   1. Which errors do developers hit most? (→ which docs need better error messaging)
 *   2. Which docs pages do they visit to recover? (→ which pages are "recovery" pages and need to be excellent)
 *
 * Requires Supabase env vars. See lib/supabase-admin.ts for SQL schema.
 */
import Link from 'next/link'
import { supabaseAdmin, analyticsEnabled } from '@/lib/supabase-admin'
import { AutoRefresh } from './auto-refresh'

export const revalidate = 0

// ── Data fetching ─────────────────────────────────────────────────────────────

type ErrorRow = { error_code: string; mode: string }
type DocRow = { doc_url: string; doc_title: string; doc_section: string | null }

async function getStats() {
  if (!supabaseAdmin) return null

  const [errorsRes, docsRes] = await Promise.all([
    supabaseAdmin
      .from('error_logs')
      .select('error_code, mode')
      .order('created_at', { ascending: false })
      .limit(2000),

    supabaseAdmin
      .from('doc_clicks')
      .select('doc_url, doc_title, doc_section')
      .eq('event_type', 'visit')
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const errors = (errorsRes.data ?? []) as ErrorRow[]
  const docs = (docsRes.data ?? []) as DocRow[]

  // Group errors by code (this is the semantic similarity grouping —
  // the LLM normalises every JWT expiry variant into JWT_EXPIRED, etc.)
  const errorCounts = new Map<string, number>()
  for (const row of errors) {
    errorCounts.set(row.error_code, (errorCounts.get(row.error_code) ?? 0) + 1)
  }

  // Group doc visits by URL
  const docCounts = new Map<string, { title: string; section: string | null; count: number }>()
  for (const row of docs) {
    const prev = docCounts.get(row.doc_url)
    docCounts.set(row.doc_url, {
      title: row.doc_title,
      section: row.doc_section,
      count: (prev?.count ?? 0) + 1,
    })
  }

  return {
    topErrors: [...errorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    topDocs: [...docCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25),
    totalErrors: errors.length,
    totalDocVisits: docs.length,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="font-mono text-2xl font-light tabular-nums">{value.toLocaleString()}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const stats = await getStats()

  return (
    <main className="min-h-screen bg-background px-4 py-16 max-w-3xl mx-auto">
      {/* Re-fetches server data every 8 seconds without a full page reload */}
      <AutoRefresh intervalMs={8000} />

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] inline-block" />
          <span className="font-mono text-lg font-light tracking-tight">analytics</span>
          <span className="font-mono text-xs text-muted-foreground">/ error decoder</span>
        </div>
        <Link
          href="/"
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← back to decoder
        </Link>
      </div>

      {/* Not configured state */}
      {!analyticsEnabled && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="font-mono text-[13px] text-foreground mb-2">Analytics not configured</p>
          <p className="font-mono text-[12px] text-muted-foreground leading-relaxed">
            Add <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</code> to{' '}
            <code className="text-foreground">.env.local</code>, then create the tables
            documented in <code className="text-foreground">lib/supabase-admin.ts</code>.
          </p>
        </div>
      )}

      {analyticsEnabled && !stats && (
        <p className="font-mono text-[12px] text-muted-foreground">Failed to load data.</p>
      )}

      {analyticsEnabled && stats && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatCard label="errors analyzed" value={stats.totalErrors} />
            <StatCard label="unique error types" value={stats.topErrors.length} />
            <StatCard label="doc pages visited" value={stats.totalDocVisits} />
            <StatCard label="distinct pages" value={stats.topDocs.length} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ── Top errors ── */}
            <section>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                top errors
              </p>
              <p className="font-mono text-[11px] text-muted-foreground mb-3">
                Grouped by normalized error code — each group = one root cause.
              </p>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {stats.topErrors.length === 0 ? (
                  <p className="font-mono text-[12px] text-muted-foreground p-4">No data yet.</p>
                ) : (
                  <ol>
                    {stats.topErrors.map(([code, count], i) => (
                      <li
                        key={code}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i < stats.topErrors.length - 1 ? 'border-b border-border' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums select-none shrink-0">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <code className="font-mono text-[12px] text-foreground truncate">
                            {code}
                          </code>
                        </div>
                        <span className="font-mono text-[12px] text-muted-foreground tabular-nums shrink-0 ml-3">
                          {count}×
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {/* ── Top docs ── */}
            <section>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                most visited docs
              </p>
              <p className="font-mono text-[11px] text-muted-foreground mb-3">
                Pages users opened after hitting an error — recovery pages.
              </p>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {stats.topDocs.length === 0 ? (
                  <p className="font-mono text-[12px] text-muted-foreground p-4">No data yet.</p>
                ) : (
                  <ol>
                    {stats.topDocs.map(([url, { title, section, count }], i) => (
                      <li
                        key={url}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          i < stats.topDocs.length - 1 ? 'border-b border-border' : ''
                        }`}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums select-none shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[12px] text-foreground hover:text-[#3ECF8E] transition-colors truncate block"
                          >
                            {title}
                          </a>
                          {section && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {section}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[12px] text-muted-foreground tabular-nums shrink-0">
                          {count}×
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

          </div>
        </>
      )}
    </main>
  )
}
