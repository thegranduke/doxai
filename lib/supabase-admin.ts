/**
 * Server-only Supabase admin client (service role — never expose to browser).
 *
 * Required SQL (run once in your Supabase SQL editor):
 * ─────────────────────────────────────────────────────
 * create table if not exists error_logs (
 *   id         uuid        primary key default gen_random_uuid(),
 *   error_code text        not null,
 *   raw_error  text        not null,
 *   mode       text        not null default 'developer',
 *   created_at timestamptz not null default now()
 * );
 *
 * create table if not exists doc_clicks (
 *   id          uuid        primary key default gen_random_uuid(),
 *   doc_url     text        not null,
 *   doc_title   text        not null,
 *   doc_section text,
 *   error_code  text,
 *   event_type  text        not null default 'visit',
 *   created_at  timestamptz not null default now()
 * );
 *
 * alter table error_logs enable row level security;
 * alter table doc_clicks  enable row level security;
 * ─────────────────────────────────────────────────────
 * Required env vars (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const analyticsEnabled = Boolean(url && key)

export const supabaseAdmin = analyticsEnabled
  ? createClient(url!, key!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function logError(params: {
  errorCode: string
  rawError: string
  mode: string
}) {
  if (!supabaseAdmin) return
  await supabaseAdmin.from('error_logs').insert({
    error_code: params.errorCode,
    raw_error: params.rawError.slice(0, 2000),
    mode: params.mode,
  })
}

export async function logDocClick(params: {
  docUrl: string
  docTitle: string
  docSection?: string
  errorCode?: string
  eventType?: 'expand' | 'visit'
}) {
  if (!supabaseAdmin) return
  await supabaseAdmin.from('doc_clicks').insert({
    doc_url: params.docUrl,
    doc_title: params.docTitle,
    doc_section: params.docSection ?? null,
    error_code: params.errorCode ?? null,
    event_type: params.eventType ?? 'visit',
  })
}
