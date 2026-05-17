'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  Plus,
  Search,
  Store,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DeliveryFormDialog,
  type BranchOption,
  type DeliveryDraft,
  type VehicleOption,
  type DriverOption,
} from './delivery-form-dialog'
import { DeliveryRow, type DeliveryRowData } from './delivery-row'
import type { ProductOption } from './product-combobox'
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/lib/schemas/delivery'
import type { VehicleLoad } from '../page'

type StatusFilter = 'all' | DeliveryStatus

type Props = {
  date: string
  deliveries: DeliveryRowData[]
  branches: BranchOption[]
  products: ProductOption[]
  vehicles: VehicleOption[]
  drivers: DriverOption[]
  vehicleLoads: VehicleLoad[]
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

export function DostaveClient({ date, deliveries, branches, products, vehicles, drivers, vehicleLoads }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeliveryDraft | null>(null)
  const [openCount, setOpenCount] = useState(0)

  function setDate(next: string) {
    router.push(`${pathname}?date=${next}`)
  }

  function shift(days: number) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  function goToday() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
    setDate(today)
  }

  function openCreate() {
    setEditing(null)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  function openEdit(d: DeliveryDraft) {
    setEditing(d)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deliveries.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (!q) return true
      return (
        d.customerName.toLowerCase().includes(q) ||
        (d.customerAddress ?? '').toLowerCase().includes(q) ||
        (d.customerPhone ?? '').toLowerCase().includes(q) ||
        d.itemsDetail.some(
          (it) =>
            it.sku.toLowerCase().includes(q) || it.nameBs.toLowerCase().includes(q),
        )
      )
    })
  }, [deliveries, search, statusFilter])

  const byBranchId = new Map<string, DeliveryRowData[]>()
  const webDeliveries: DeliveryRowData[] = []
  for (const d of filtered) {
    if (d.channel === 'web') webDeliveries.push(d)
    else if (d.branchId) {
      const arr = byBranchId.get(d.branchId) ?? []
      arr.push(d)
      byBranchId.set(d.branchId, arr)
    }
  }
  for (const arr of byBranchId.values()) {
    arr.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }
  webDeliveries.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  const physicalBranches = branches.filter((b) => !b.isWeb)
  const stats = computeStats(deliveries)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(-1)}
            aria-label="Prethodni dan"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="relative">
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-8 w-[170px] border-0 px-2 focus-visible:ring-0"
            />
            <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(1)}
            aria-label="Sljedeći dan"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Danas
        </Button>

        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kupac, adresa, SKU, artikl..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter((v ?? 'all') as StatusFilter)}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue placeholder="Status">
              {(v: string | null) =>
                !v || v === 'all'
                  ? 'Svi statusi'
                  : STATUS_LABELS[v as DeliveryStatus] ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            {DELIVERY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            render={<a href={`/api/export/dostave?date=${date}`} download />}
          >
            <Download className="mr-1 size-4" />
            Izvoz (Excel)
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Nova dostava
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Ukupno" value={deliveries.length} />
        <StatCard label="Planirano" value={stats.planned} tone="slate" />
        <StatCard label="U prevozu" value={stats.in_transit} tone="blue" />
        <StatCard label="Isporučeno" value={stats.delivered} tone="emerald" />
        <StatCard label="Neuspjelo/Prerasp." value={stats.failed + stats.rescheduled} tone="red" />
      </div>

      <VehicleLoadPanel loads={vehicleLoads} />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {deliveries.length === 0
              ? 'Nema dostava za odabrani datum.'
              : 'Nema rezultata za trenutne filtere.'}
          </p>
          {deliveries.length === 0 && (
            <Button className="mt-3" onClick={openCreate}>
              <Plus className="mr-1 size-4" />
              Kreiraj prvu
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {physicalBranches.map((branch) => {
            const rows = byBranchId.get(branch.id) ?? []
            if (rows.length === 0) return null
            return (
              <section key={branch.id}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Store className="size-4 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{branch.code}</span>
                  {branch.name}
                  <span className="text-muted-foreground">· {rows.length}</span>
                </h2>
                <div className="space-y-2">
                  {rows.map((d) => (
                    <DeliveryRow key={d.id} delivery={d} onEdit={openEdit} />
                  ))}
                </div>
              </section>
            )
          })}

          {webDeliveries.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Globe className="size-4 text-muted-foreground" />
                Web narudžbe
                <span className="text-muted-foreground">· {webDeliveries.length}</span>
              </h2>
              <div className="space-y-2">
                {webDeliveries.map((d) => (
                  <DeliveryRow key={d.id} delivery={d} onEdit={openEdit} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <DeliveryFormDialog
        key={openCount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        delivery={editing}
        defaultDate={date}
        branches={branches}
        products={products}
        vehicles={vehicles}
        drivers={drivers}
      />
    </>
  )
}

function VehicleLoadPanel({ loads }: { loads: VehicleLoad[] }) {
  if (loads.length === 0) return null
  const anyAssigned = loads.some((l) => l.deliveriesCount > 0)
  if (!anyAssigned) return null
  return (
    <div className="mb-4 rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Truck className="size-4 text-muted-foreground" />
        Iskorištenost vozila
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {loads.map((l) => (
          <VehicleLoadCard key={l.vehicleId} load={l} />
        ))}
      </div>
    </div>
  )
}

function VehicleLoadCard({ load }: { load: VehicleLoad }) {
  const weightPct = load.payloadKg > 0 ? load.totalWeightKg / load.payloadKg : 0
  const volumePct = load.volumeM3 > 0 ? load.totalVolumeM3 / load.volumeM3 : 0
  const peakPct = Math.max(weightPct, volumePct)
  const tone =
    peakPct > 1 ? 'red' : peakPct >= 0.8 ? 'amber' : peakPct > 0 ? 'emerald' : 'slate'
  return (
    <div
      className={[
        'rounded-md border px-3 py-2',
        tone === 'red'
          ? 'border-red-300 bg-red-50'
          : tone === 'amber'
          ? 'border-amber-300 bg-amber-50'
          : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-input bg-muted/20',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{load.vehicleName}</div>
        <div className="text-xs text-muted-foreground">{load.deliveriesCount} dostava</div>
      </div>
      <LoadBar
        label="Težina"
        value={load.totalWeightKg}
        max={load.payloadKg}
        unit="kg"
        pct={weightPct}
      />
      <LoadBar
        label="Volumen"
        value={load.totalVolumeM3}
        max={load.volumeM3}
        unit="m³"
        pct={volumePct}
      />
      {peakPct > 1 ? (
        <div className="mt-1 text-xs font-medium text-red-700">
          ⚠ Premašen kapacitet vozila
        </div>
      ) : null}
    </div>
  )
}

function LoadBar({
  label,
  value,
  max,
  unit,
  pct,
}: {
  label: string
  value: number
  max: number
  unit: string
  pct: number
}) {
  const clamped = Math.min(pct, 1)
  const over = pct > 1
  const barColor = pct > 1 ? 'bg-red-500' : pct >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums ${over ? 'font-medium text-red-700' : 'text-foreground'}`}>
          {value} / {max} {unit}
          <span className="ml-1 text-muted-foreground">({Math.round(pct * 100)}%)</span>
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  )
}

function computeStats(deliveries: DeliveryRowData[]) {
  const result: Record<DeliveryStatus, number> = {
    planned: 0,
    in_transit: 0,
    delivered: 0,
    failed: 0,
    rescheduled: 0,
  }
  for (const d of deliveries) result[d.status]++
  return result
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'slate' | 'blue' | 'emerald' | 'red'
}) {
  const toneClass =
    tone === 'blue'
      ? 'text-blue-700'
      : tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'red'
      ? 'text-red-700'
      : tone === 'slate'
      ? 'text-slate-700'
      : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}
