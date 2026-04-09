/**
 * Fetches live Supabase documentation content from their open-source GitHub repo.
 * Content is cached server-side for 1 hour to avoid hammering GitHub on every request.
 *
 * Supabase docs are MDX files at:
 * https://github.com/supabase/supabase/tree/master/apps/docs/content
 *
 * URL path → MDX path example:
 *   supabase.com/docs/guides/auth/sessions
 *   → apps/docs/content/guides/auth/sessions.mdx
 */

const GITHUB_RAW =
  'https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content'

// ── Keyword → doc path mapping ────────────────────────────────────────────────
// Maps common Supabase error patterns to the most relevant documentation pages.
// These paths mirror the supabase.com/docs URL structure exactly.

const ERROR_DOC_MAP: Array<{ keywords: string[]; paths: string[] }> = [
  {
    keywords: ['jwt', 'token_expired', 'token expired', 'auth', '401'],
    paths: ['guides/auth/sessions', 'guides/auth/jwts'],
  },
  {
    keywords: ['42501', 'row-level-security', 'rls', 'policy', 'violates row'],
    paths: ['guides/database/postgres-policies', 'guides/auth/row-level-security'],
  },
  {
    keywords: ['storageapierror', 'storage', 'bucket', 'object'],
    paths: ['guides/storage/uploads', 'guides/storage/access-control'],
  },
  {
    keywords: ['realtimechannel', 'heartbeat_timeout', 'realtime', 'subscribe'],
    paths: ['guides/realtime/concepts', 'guides/realtime/postgres-changes'],
  },
  {
    keywords: ['econnrefused', 'connect refused', '5432', 'database connection'],
    paths: ['guides/database/connecting-to-postgres'],
  },
  {
    keywords: ['authapierror', 'supabaseclient', 'createclient'],
    paths: ['guides/auth/quickstarts/nextjs', 'guides/auth/sessions'],
  },
]

export function getRelevantDocPaths(errorText: string): string[] {
  const lower = errorText.toLowerCase()
  const seen = new Set<string>()

  for (const { keywords, paths } of ERROR_DOC_MAP) {
    if (keywords.some(k => lower.includes(k))) {
      paths.forEach(p => seen.add(p))
    }
  }

  return [...seen].slice(0, 3) // cap at 3 pages to keep prompt size reasonable
}

// ── MDX → plain text ──────────────────────────────────────────────────────────

function cleanMdx(raw: string): string {
  return (
    raw
      // Remove YAML frontmatter
      .replace(/^---[\s\S]*?---\s*/m, '')
      // Remove all import statements
      .replace(/^import\s[\s\S]*?from\s['"][^'"]+['"]\s*\n/gm, '')
      // Remove JSX component blocks (e.g. <Admonition>…</Admonition>)
      .replace(/<[A-Z][A-Za-z]*[^>]*>[\s\S]*?<\/[A-Z][A-Za-z]*>/g, '')
      // Remove self-closing JSX tags
      .replace(/<[A-Z][A-Za-z]*[^/]*/g, '')
      // Trim each code block to 200 chars (preserve structure, not full snippets)
      .replace(/```[\s\S]*?```/g, match =>
        match.length > 250 ? match.slice(0, 250) + '\n```' : match
      )
      // Collapse excess blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      // Cap total length — Gemini context budget is generous, but 3000 chars per page is plenty
      .slice(0, 3000)
  )
}

// ── Fetch a single doc page ───────────────────────────────────────────────────

export async function fetchSupabaseDoc(docPath: string): Promise<string> {
  const clean = docPath.replace(/^\/?(docs\/)?/, '').replace(/\/$/, '')

  const candidates = [
    `${GITHUB_RAW}/${clean}.mdx`,
    `${GITHUB_RAW}/${clean}/index.mdx`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        // Cache aggressively — Supabase docs change infrequently
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue

      const text = await res.text()

      // Sanity-check: GitHub raw returns 200 for missing files with a "404" HTML page
      if (!text.includes('---') && !text.startsWith('#') && !text.includes('\n#')) {
        continue
      }

      return cleanMdx(text)
    } catch {
      // Network error — try next candidate
    }
  }

  return ''
}

// ── Fetch all relevant docs for an error ─────────────────────────────────────

export async function fetchRelevantDocs(errorText: string): Promise<string> {
  const paths = getRelevantDocPaths(errorText)
  if (paths.length === 0) return ''

  const results = await Promise.all(
    paths.map(async p => {
      const content = await fetchSupabaseDoc(p)
      return content ? `=== supabase.com/docs/${p} ===\n${content}` : ''
    })
  )

  const fetched = results.filter(Boolean)
  return fetched.join('\n\n')
}
