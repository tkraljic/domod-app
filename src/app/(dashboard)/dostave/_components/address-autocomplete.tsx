'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { GeocodeResult } from '@/app/api/geocode/route'

type Props = {
  value: string
  latitude: number | null
  longitude: number | null
  onChange: (next: { address: string; latitude: number | null; longitude: number | null }) => void
  placeholder?: string
}

export function AddressAutocomplete({
  value,
  latitude,
  longitude,
  onChange,
  placeholder,
}: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipNextSearch = useRef(false)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error('Geocode failed')
        const data = (await res.json()) as GeocodeResult[]
        setResults(data)
        setActiveIdx(data.length > 0 ? 0 : -1)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
        }
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  function pick(r: GeocodeResult) {
    skipNextSearch.current = true
    setQuery(r.displayName)
    setResults([])
    setOpen(false)
    onChange({ address: r.displayName, latitude: r.lat, longitude: r.lng })
  }

  function clearAll() {
    skipNextSearch.current = true
    setQuery('')
    setResults([])
    setOpen(false)
    onChange({ address: '', latitude: null, longitude: null })
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < results.length) {
        e.preventDefault()
        pick(results[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number'

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Typing invalidates any saved coords for this address
            if (hasCoords && e.target.value !== value) {
              onChange({ address: e.target.value, latitude: null, longitude: null })
            } else {
              onChange({ address: e.target.value, latitude, longitude })
            }
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onKeyDown={handleKey}
          placeholder={placeholder ?? 'Počnite kucati adresu...'}
          autoComplete="off"
          className="pr-16"
        />
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
          {hasCoords ? (
            <MapPin className="size-3.5 text-emerald-600" />
          ) : null}
        </div>
        {query ? (
          <button
            type="button"
            onClick={clearAll}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Očisti"
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {results.map((r, idx) => (
            <li key={`${r.lat}-${r.lng}-${idx}`}>
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => pick(r)}
                className={[
                  'flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm',
                  idx === activeIdx ? 'bg-accent' : 'hover:bg-accent/60',
                ].join(' ')}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.shortLabel}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.displayName}</div>
                </div>
                <div className="shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {r.lat.toFixed(4)}
                  <br />
                  {r.lng.toFixed(4)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasCoords ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
          <MapPin className="size-3" />
          Lokacija sačuvana — {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </p>
      ) : query.trim().length >= 3 && !loading && results.length === 0 && open ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Nema rezultata. Možete unijeti adresu i bez koordinata.
        </p>
      ) : null}
    </div>
  )
}
