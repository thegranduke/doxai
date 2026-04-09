'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Invisible component that calls router.refresh() on an interval,
 * causing the parent server component to re-fetch its data without
 * a full page reload. Keeps the analytics dashboard live.
 */
export function AutoRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}
