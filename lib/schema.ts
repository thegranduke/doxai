import { z } from 'zod'

export const DocSchema = z.object({
  title: z.string(),
  url: z.string(),
  whyRelevant: z.string(),
  tldr: z.string(),
  excerpt: z.string(),
  relevance: z.enum(['high', 'mid', 'low']),
  section: z.enum(['Auth', 'Database', 'Storage', 'Realtime', 'Edge Functions', 'CLI', 'API']),
})

export const AnalysisSchema = z.object({
  errorCode: z.string(),
  likelyCause: z.string(),
  fixSteps: z.array(z.string()),
  docs: z.array(DocSchema),
})

export type Analysis = z.infer<typeof AnalysisSchema>
export type DocLink = z.infer<typeof DocSchema>
export type Relevance = 'high' | 'mid' | 'low'
