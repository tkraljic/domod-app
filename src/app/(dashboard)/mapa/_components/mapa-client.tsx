'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, usePathname } from 'next/navigation'
import { CalendarIcon, ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DeliveryStatus } from '@/lib/schemas/delivery'

export type MapDelivery = {
  id: string
  sequenceNumber: number
  channel: 'branch' | 'web'
  branchLabel: string
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  deliveryTime: string | null
  vehicleName: string | null
  status: DeliveryStatus
  latitude: number | null
  longitude: number | null
  itemsCount: number
}

const MapInner = dynamic(
  () => import('./map-inner').then((m) => m.MapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Učitavanje mape...
      </div>
    ),
  },
)

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  planned: '#64748b',
  in_transit: '#3b82f6',
  delivered: '#10b981',
  failed: '#ef4444',
  rescheduled: '#f59e0b',
}

type Props = {
  date: string
  withCoords: MapDelivery[]
  withoutCoords: MapDelivery[]
}

export function MapaClient({ date, withCoords, withoutCoords }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const center = useMemo<[number, number]>(() => {
    if (withCoords.length === 0) return [43.8563, 18.4131] // Sarajevo default
    let lat = 0
    let lng = 0
    for (const d of withCoords) {
      lat += d.latitude!
      lng += d.longitude!
    }
    return [lat / withCoords.length, lng / withCoords.length]
  }, [withCoords])

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
        <div className="ml-auto text-sm text-muted-foreground">
          Na mapi: <span className="font-medium text-foreground">{withCoords.length}</span> ·
          Bez koordinata: <span className="font-medium text-foreground">{withoutCoords.length}</span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="h-[640px] overflow-hidden rounded-lg border bg-card">
          <MapInner
            center={center}
            deliveries={withCoords}
            selectedId={selectedId}
            onSelect={setSelectedId}
            statusColors={STATUS_COLORS}
            statusLabels={STATUS_LABELS}
          />
        </div>

        <aside className="flex h-[640px] flex-col gap-3 overflow-hidden">
          <SidePanel
            title={`Bez koordinata (${withoutCoords.length})`}
            items={withoutCoords}
            empty="Sve dostave imaju koordinate. ✓"
            statusLabels={STATUS_LABELS}
          />
          <SidePanel
            title={`Sa koordinatama (${withCoords.length})`}
            items={withCoords}
            selectedId={selectedId}
            onSelect={setSelectedId}
            empty="Nema dostava sa koordinatama za ovaj dan."
            statusLabels={STATUS_LABELS}
          />
        </aside>
      </div>
    </>
  )
}

function SidePanel({
  title,
  items,
  empty,
  selectedId,
  onSelect,
  statusLabels,
}: {
  title: string
  items: MapDelivery[]
  empty: string
  selectedId?: string | null
  onSelect?: (id: string) => void
  statusLabels: Record<DeliveryStatus, string>
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <div className="border-b px-3 py-2 text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">{empty}</div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {items.map((d) => {
            const active = selectedId === d.id
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(d.id)}
                  className={[
                    'block w-full border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0',
                    active ? 'bg-accent' : 'hover:bg-accent/50',
                    onSelect ? '' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      #{d.sequenceNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {statusLabels[d.status]}
                    </span>
                  </div>
                  <div className="font-medium">{d.customerName}</div>
                  {d.customerAddress ? (
                    <div className="truncate text-xs text-muted-foreground">{d.customerAddress}</div>
                  ) : null}
                  {d.vehicleName ? (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Truck className="size-3" />
                      {d.vehicleName}
                    </div>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
