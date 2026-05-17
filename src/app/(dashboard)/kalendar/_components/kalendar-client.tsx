'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type DayCell = {
  date: string // YYYY-MM-DD
  inMonth: boolean
  total: number
  planned: number
  inTransit: number
  delivered: number
  failed: number
  rescheduled: number
}

type Props = {
  month: string // YYYY-MM
  today: string // YYYY-MM-DD
  cells: DayCell[]
}

const WEEKDAY_LABELS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

export function KalendarClient({ month, today, cells }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function setMonth(next: string) {
    router.push(`${pathname}?month=${next}`)
  }

  function shiftMonth(delta: number) {
    const [yStr, mStr] = month.split('-')
    const y = Number(yStr)
    const m = Number(mStr) - 1
    const d = new Date(Date.UTC(y, m + delta, 1))
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    setMonth(next)
  }

  function goCurrentMonth() {
    setMonth(today.slice(0, 7))
  }

  function goToDay(date: string) {
    router.push(`/dostave?date=${date}`)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(-1)}
            aria-label="Prethodni mjesec"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(1)}
            aria-label="Sljedeći mjesec"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goCurrentMonth}>
          Tekući mjesec
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="px-2 py-1.5 text-center">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isToday = cell.date === today
            const isWeekend = i % 7 >= 5
            const dayNum = Number(cell.date.slice(8, 10))
            const muted = !cell.inMonth
            return (
              <button
                key={cell.date + '-' + i}
                type="button"
                onClick={() => goToDay(cell.date)}
                className={[
                  'group relative flex min-h-[96px] flex-col items-stretch border-b border-r px-2 py-1.5 text-left transition-colors',
                  '[&:nth-child(7n)]:border-r-0',
                  i >= 35 ? 'border-b-0' : '',
                  muted ? 'bg-muted/10 text-muted-foreground' : 'bg-card hover:bg-accent/50',
                  isWeekend && !muted ? 'bg-muted/20' : '',
                ].join(' ')}
                aria-label={`Dostave za ${cell.date}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : muted
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                    ].join(' ')}
                  >
                    {dayNum}
                  </span>
                  {cell.total > 0 ? (
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {cell.total}
                    </span>
                  ) : null}
                </div>

                {cell.total > 0 ? (
                  <div className="mt-2 space-y-0.5 text-[11px] leading-tight">
                    {cell.planned > 0 ? (
                      <CountLine tone="slate" label="Planirano" value={cell.planned} />
                    ) : null}
                    {cell.inTransit > 0 ? (
                      <CountLine tone="blue" label="U prevozu" value={cell.inTransit} />
                    ) : null}
                    {cell.delivered > 0 ? (
                      <CountLine tone="emerald" label="Isporuč." value={cell.delivered} />
                    ) : null}
                    {cell.failed > 0 ? (
                      <CountLine tone="red" label="Neuspjelo" value={cell.failed} />
                    ) : null}
                    {cell.rescheduled > 0 ? (
                      <CountLine tone="amber" label="Prerasp." value={cell.rescheduled} />
                    ) : null}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function CountLine({
  tone,
  label,
  value,
}: {
  tone: 'slate' | 'blue' | 'emerald' | 'red' | 'amber'
  label: string
  value: number
}) {
  const dotClass =
    tone === 'blue'
      ? 'bg-blue-500'
      : tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'red'
      ? 'bg-red-500'
      : tone === 'amber'
      ? 'bg-amber-500'
      : 'bg-slate-400'
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="flex-1 truncate">{label}</span>
      <span className="tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}