import { prisma } from '@/lib/prisma'
import { KalendarClient, type DayCell } from './_components/kalendar-client'
import type { DeliveryStatus } from '@/lib/schemas/delivery'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

// Monday-first: returns 0..6 where Mon=0, Sun=6
function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7
}

function buildGrid(monthStr: string): { cells: { date: string; inMonth: boolean }[]; gridStart: Date; gridEnd: Date } {
  const [yStr, mStr] = monthStr.split('-')
  const year = Number(yStr)
  const month = Number(mStr) - 1 // 0-based
  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const offset = mondayIndex(firstOfMonth.getUTCDay())
  const gridStart = new Date(firstOfMonth)
  gridStart.setUTCDate(gridStart.getUTCDate() - offset)

  const cells: { date: string; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setUTCDate(d.getUTCDate() + i)
    cells.push({ date: isoDate(d), inMonth: d.getUTCMonth() === month })
  }
  const gridEnd = new Date(gridStart)
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 42)
  return { cells, gridStart, gridEnd }
}

type PageProps = {
  searchParams: Promise<{ month?: string }>
}

export default async function KalendarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const monthParam = params.month && MONTH_RE.test(params.month) ? params.month : currentMonth()
  const { cells, gridStart, gridEnd } = buildGrid(monthParam)

  const deliveries = await prisma.delivery.findMany({
    where: { date: { gte: gridStart, lt: gridEnd } },
    select: { date: true, status: true },
  })

  const counts = new Map<string, { total: number; byStatus: Record<DeliveryStatus, number> }>()
  for (const d of deliveries) {
    const key = isoDate(d.date)
    let entry = counts.get(key)
    if (!entry) {
      entry = {
        total: 0,
        byStatus: { planned: 0, in_transit: 0, delivered: 0, failed: 0, rescheduled: 0 },
      }
      counts.set(key, entry)
    }
    entry.total++
    entry.byStatus[d.status as DeliveryStatus]++
  }

  const dayCells: DayCell[] = cells.map((c) => {
    const entry = counts.get(c.date)
    return {
      date: c.date,
      inMonth: c.inMonth,
      total: entry?.total ?? 0,
      planned: entry?.byStatus.planned ?? 0,
      inTransit: entry?.byStatus.in_transit ?? 0,
      delivered: entry?.byStatus.delivered ?? 0,
      failed: entry?.byStatus.failed ?? 0,
      rescheduled: entry?.byStatus.rescheduled ?? 0,
    }
  })

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Kalendar dostava</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatMonthLabel(monthParam)}</p>
      </div>
      <KalendarClient month={monthParam} today={todayIso()} cells={dayCells} />
    </div>
  )
}

const MONTH_NAMES = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
]

function formatMonthLabel(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-')
  const month = Number(mStr) - 1
  return `${capitalize(MONTH_NAMES[month])} ${yStr}.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}