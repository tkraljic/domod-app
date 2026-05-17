const TRUTHY = new Set(['1', 'true', 'da', 'yes', 'y', 'x'])

export function asString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

export function asNumber(v: unknown): number | null {
  const s = asString(v).replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export function asBool(v: unknown): boolean {
  return TRUTHY.has(asString(v).toLowerCase())
}

export function asInt(v: unknown, fallback: number): number {
  const s = asString(v)
  if (s === '') return fallback
  const n = Number(s)
  if (!Number.isFinite(n)) return NaN
  return Math.trunc(n)
}
