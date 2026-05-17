import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DeliveryStatus } from '@/lib/schemas/delivery'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

const STATUS_TONES: Record<DeliveryStatus, string> = {
  planned: 'bg-slate-400',
  in_transit: 'bg-blue-500',
  delivered: 'bg-emerald-500',
  failed: 'bg-red-500',
  rescheduled: 'bg-amber-500',
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

function defaultRange(): { from: string; to: string } {
  const today = new Date()
  const to = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from: isoDate(from), to: isoDate(to) }
}

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function IzvjestajiPage({ searchParams }: PageProps) {
  const params = await searchParams
  const def = defaultRange()
  const fromStr = params.from && DATE_RE.test(params.from) ? params.from : def.from
  const toStr = params.to && DATE_RE.test(params.to) ? params.to : def.to
  const rangeStart = new Date(`${fromStr}T00:00:00.000Z`)
  const rangeEnd = new Date(`${toStr}T00:00:00.000Z`)
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

  const dayCount = Math.max(
    1,
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000),
  )

  const deliveries = await prisma.delivery.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
    include: {
      branch: { select: { id: true, code: true, name: true, isWeb: true } },
      vehicle: { select: { id: true, name: true, payloadKg: true, volumeM3: true } },
      items: {
        select: {
          quantity: true,
          product: {
            select: {
              id: true,
              sku: true,
              nameBs: true,
              weightKg: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
            },
          },
        },
      },
    },
  })

  const total = deliveries.length

  const byStatus: Record<DeliveryStatus, number> = {
    planned: 0,
    in_transit: 0,
    delivered: 0,
    failed: 0,
    rescheduled: 0,
  }
  for (const d of deliveries) byStatus[d.status as DeliveryStatus]++
  const completed = byStatus.delivered
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const branchAgg = new Map<string, { code: string; name: string; isWeb: boolean; count: number }>()
  for (const d of deliveries) {
    if (d.channel === 'web') {
      const key = '__web__'
      const e = branchAgg.get(key) ?? {
        code: 'WEB',
        name: 'Web narudžbe',
        isWeb: true,
        count: 0,
      }
      e.count++
      branchAgg.set(key, e)
    } else if (d.branch) {
      const key = d.branch.id
      const e = branchAgg.get(key) ?? {
        code: d.branch.code,
        name: d.branch.name,
        isWeb: false,
        count: 0,
      }
      e.count++
      branchAgg.set(key, e)
    }
  }
  const branchRows = [...branchAgg.values()].sort((a, b) => b.count - a.count)

  type VehicleAgg = {
    name: string
    payloadKg: number
    volumeM3: number
    count: number
    weightKg: number
    volumeUsedM3: number
  }
  const vehicleAgg = new Map<string, VehicleAgg>()
  let unassignedCount = 0
  for (const d of deliveries) {
    if (!d.vehicle) {
      unassignedCount++
      continue
    }
    const key = d.vehicle.id
    let agg = vehicleAgg.get(key)
    if (!agg) {
      agg = {
        name: d.vehicle.name,
        payloadKg: d.vehicle.payloadKg,
        volumeM3: d.vehicle.volumeM3,
        count: 0,
        weightKg: 0,
        volumeUsedM3: 0,
      }
      vehicleAgg.set(key, agg)
    }
    agg.count++
    for (const it of d.items) {
      const w = it.product.weightKg ?? 0
      const l = it.product.lengthCm ?? 0
      const wd = it.product.widthCm ?? 0
      const h = it.product.heightCm ?? 0
      agg.weightKg += w * it.quantity
      agg.volumeUsedM3 += ((l * wd * h) / 1_000_000) * it.quantity
    }
  }
  const vehicleRows = [...vehicleAgg.values()].sort((a, b) => b.count - a.count)

  const productAgg = new Map<string, { sku: string; nameBs: string; quantity: number }>()
  for (const d of deliveries) {
    for (const it of d.items) {
      const key = it.product.id
      const e = productAgg.get(key) ?? {
        sku: it.product.sku,
        nameBs: it.product.nameBs,
        quantity: 0,
      }
      e.quantity += it.quantity
      productAgg.set(key, e)
    }
  }
  const topProducts = [...productAgg.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)

  const dailyMap = new Map<string, number>()
  for (const d of deliveries) {
    const key = isoDate(d.date)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }
  const dailyTrend: { date: string; count: number }[] = []
  for (let i = 0; i < dayCount; i++) {
    const dt = new Date(rangeStart)
    dt.setUTCDate(dt.getUTCDate() + i)
    const key = isoDate(dt)
    dailyTrend.push({ date: key, count: dailyMap.get(key) ?? 0 })
  }
  const peakDay = dailyTrend.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { date: '', count: 0 },
  )

  const totalStatusMax = Math.max(...Object.values(byStatus), 1)
  const branchMax = Math.max(...branchRows.map((b) => b.count), 1)
  const productMax = Math.max(...topProducts.map((p) => p.quantity), 1)
  const dailyMax = Math.max(...dailyTrend.map((d) => d.count), 1)
  const avgPerDay = total / dayCount

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Statistike</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pregled za period od {fromStr} do {toStr} ({dayCount} dana).
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/izvjestaji">
        <div className="space-y-1.5">
          <Label htmlFor="from">Od</Label>
          <Input id="from" type="date" name="from" defaultValue={fromStr} className="w-[160px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Do</Label>
          <Input id="to" type="date" name="to" defaultValue={toStr} className="w-[160px]" />
        </div>
        <Button type="submit" variant="outline">
          Primijeni
        </Button>
        <RangePresetLink label="7 dana" days={7} />
        <RangePresetLink label="30 dana" days={30} />
        <RangePresetLink label="90 dana" days={90} />
      </form>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard label="Ukupno dostava" value={total} />
        <KpiCard label="Stopa isporuke" value={`${completionRate}%`} tone="emerald" />
        <KpiCard label="Prosjek po danu" value={avgPerDay.toFixed(1)} />
        <KpiCard
          label="Vršni dan"
          value={peakDay.count > 0 ? `${peakDay.count}` : '—'}
          subtitle={peakDay.count > 0 ? peakDay.date : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Po statusu">
          <div className="space-y-2">
            {(Object.keys(byStatus) as DeliveryStatus[]).map((s) => (
              <BarRow
                key={s}
                label={STATUS_LABELS[s]}
                value={byStatus[s]}
                max={totalStatusMax}
                barClass={STATUS_TONES[s]}
              />
            ))}
          </div>
        </Card>

        <Card title="Po poslovnici">
          {branchRows.length === 0 ? (
            <EmptyText />
          ) : (
            <div className="space-y-2">
              {branchRows.map((b, idx) => (
                <BarRow
                  key={`${b.code}-${idx}`}
                  label={`${b.code} — ${b.name}`}
                  value={b.count}
                  max={branchMax}
                  barClass={b.isWeb ? 'bg-purple-500' : 'bg-slate-700'}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Po vozilu">
          {vehicleRows.length === 0 && unassignedCount === 0 ? (
            <EmptyText />
          ) : (
            <div className="space-y-2">
              {vehicleRows.map((v, idx) => {
                const wPct = v.payloadKg > 0 ? Math.round((v.weightKg / (v.payloadKg * v.count)) * 100) : 0
                const volPct = v.volumeM3 > 0 ? Math.round((v.volumeUsedM3 / (v.volumeM3 * v.count)) * 100) : 0
                return (
                  <div key={`${v.name}-${idx}`} className="rounded-md border bg-card px-3 py-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {v.count} {v.count === 1 ? 'dostava' : 'dostava'}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        Težina: <span className="text-foreground tabular-nums">{Math.round(v.weightKg)} kg</span>
                        <span className="ml-1">(prosj. {wPct}% kapaciteta)</span>
                      </div>
                      <div>
                        Volumen: <span className="text-foreground tabular-nums">{v.volumeUsedM3.toFixed(2)} m³</span>
                        <span className="ml-1">(prosj. {volPct}% kapaciteta)</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {unassignedCount > 0 ? (
                <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  Bez dodijeljenog vozila: <span className="text-foreground tabular-nums">{unassignedCount}</span>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card title="Top 10 artikala">
          {topProducts.length === 0 ? (
            <EmptyText />
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <BarRow
                  key={p.sku}
                  label={
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                      <span className="truncate">{p.nameBs}</span>
                    </span>
                  }
                  value={p.quantity}
                  max={productMax}
                  barClass="bg-slate-600"
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Dnevni trend">
          {total === 0 ? (
            <EmptyText />
          ) : (
            <div className="flex h-32 items-end gap-0.5">
              {dailyTrend.map((d) => {
                const h = (d.count / dailyMax) * 100
                return (
                  <div
                    key={d.date}
                    className="group relative flex-1 rounded-sm bg-slate-200 transition-colors hover:bg-slate-300"
                    style={{ height: `${Math.max(h, 2)}%`, minHeight: '2px' }}
                    title={`${d.date}: ${d.count}`}
                  >
                    {d.count > 0 ? (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-sm bg-slate-700"
                        style={{ height: '100%' }}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
          {total > 0 ? (
            <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{dailyTrend[0]?.date}</span>
              <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  tone = 'default',
}: {
  label: string
  value: string | number
  subtitle?: string
  tone?: 'default' | 'emerald'
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={[
          'text-2xl font-semibold tabular-nums',
          tone === 'emerald' ? 'text-emerald-700' : 'text-foreground',
        ].join(' ')}
      >
        {value}
      </div>
      {subtitle ? (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  )
}

function BarRow({
  label,
  value,
  max,
  barClass,
}: {
  label: React.ReactNode
  value: number
  max: number
  barClass: string
}) {
  const pct = (value / max) * 100
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  )
}

function EmptyText() {
  return <p className="text-sm text-muted-foreground">Nema podataka za odabrani period.</p>
}

function RangePresetLink({ label, days }: { label: string; days: number }) {
  const today = new Date()
  const to = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  const href = `/izvjestaji?from=${isoDate(from)}&to=${isoDate(to)}`
  return (
    <a
      href={href}
      className="rounded-md border border-input bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {label}
    </a>
  )
}
