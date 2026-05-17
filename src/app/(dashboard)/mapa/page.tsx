import { prisma } from '@/lib/prisma'
import { MapaClient, type MapDelivery } from './_components/mapa-client'
import type { DeliveryStatus } from '@/lib/schemas/delivery'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function startOfUtcDay(s: string) {
  return new Date(`${s}T00:00:00.000Z`)
}
function endOfUtcDay(s: string) {
  const d = new Date(`${s}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

type PageProps = {
  searchParams: Promise<{ date?: string }>
}

export default async function MapaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const dateParam = params.date && DATE_RE.test(params.date) ? params.date : todayIsoDate()

  const deliveries = await prisma.delivery.findMany({
    where: { date: { gte: startOfUtcDay(dateParam), lt: endOfUtcDay(dateParam) } },
    include: {
      branch: { select: { code: true, name: true } },
      vehicle: { select: { name: true } },
      items: { select: { quantity: true } },
    },
    orderBy: [{ channel: 'asc' }, { sequenceNumber: 'asc' }],
  })

  const mapped: MapDelivery[] = deliveries.map((d) => ({
    id: d.id,
    sequenceNumber: d.sequenceNumber,
    channel: d.channel as 'branch' | 'web',
    branchLabel: d.branch ? `${d.branch.code} — ${d.branch.name}` : 'Web',
    customerName: d.customerName,
    customerAddress: d.customerAddress,
    customerPhone: d.customerPhone,
    deliveryTime: d.deliveryTime,
    vehicleName: d.vehicle?.name ?? null,
    status: d.status as DeliveryStatus,
    latitude: d.latitude,
    longitude: d.longitude,
    itemsCount: d.items.reduce((sum, it) => sum + it.quantity, 0),
  }))

  const withCoords = mapped.filter(
    (d) => typeof d.latitude === 'number' && typeof d.longitude === 'number',
  )
  const withoutCoords = mapped.filter(
    (d) => typeof d.latitude !== 'number' || typeof d.longitude !== 'number',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Mapa dostava</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pin po dostavi za odabrani dan. Dostave bez koordinata su prikazane u listi pored.
        </p>
      </div>
      <MapaClient
        date={dateParam}
        withCoords={withCoords}
        withoutCoords={withoutCoords}
      />
    </div>
  )
}
