'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

type Props = {
  json: string
}

export function AuditChanges({ json }: Props) {
  const [open, setOpen] = useState(false)

  let parsed: unknown = json
  let pretty = json
  try {
    parsed = JSON.parse(json)
    pretty = JSON.stringify(parsed, null, 2)
  } catch {
    /* keep raw */
  }

  const summary = summarize(parsed)

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {summary}
      </button>
      {open ? (
        <pre className="mt-1 max-h-64 max-w-[640px] overflow-auto rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
          {pretty}
        </pre>
      ) : null}
    </div>
  )
}

function summarize(parsed: unknown): string {
  if (parsed == null) return '—'
  if (typeof parsed !== 'object') return String(parsed)
  const obj = parsed as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return 'Bez promjena'
  // Common pattern: { before, after }
  if ('before' in obj && 'after' in obj) {
    const before = (obj.before ?? {}) as Record<string, unknown>
    const after = (obj.after ?? {}) as Record<string, unknown>
    const changedKeys: string[] = []
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changedKeys.push(k)
    }
    if (changedKeys.length === 0) return 'Bez promjena'
    return `Polja: ${changedKeys.slice(0, 6).join(', ')}${
      changedKeys.length > 6 ? `, +${changedKeys.length - 6}` : ''
    }`
  }
  return `${keys.slice(0, 4).join(', ')}${keys.length > 4 ? `, +${keys.length - 4}` : ''}`
}
