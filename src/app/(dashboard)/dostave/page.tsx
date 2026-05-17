import { prisma } from '@/lib/prisma'
import { DostaveClient } from './_components/dostave-client'
import type { DeliveryRowData } from './_components/delivery-row'
import type { BranchOption, VehicleOption, DriverOption } from './_components/delivery-form-dialog'
import type { ProductOption } from './_components/product-combobox'
import type { DeliveryStatus } from '@/lib/schemas/delivery'
import { detectConflicts } from './_lib/conflicts'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function startOfUtcDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function endOfUtcDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export type VehicleLoad = {
  vehicleId: string
  vehicleName: string
  payloadKg: number
  volumeM3: number
  deliveriesCount: number
  totalWeightKg: number
  totalVolumeM3: number
}

type PageProps = {
  searchParams: Promise<{ date?: string }>
}

export default async function DostavePage({ searchParams }: PageProps) {
  const params = await searchParams
  const dateParam = params.date && DATE_RE.test(params.date) ? params.date : todayIsoDate()
  const dayStart = startOfUtcDay(dateParam)
  const dayEnd = endOfUtcDay(dateParam)

  const [deliveriesRaw, branchesRaw, productsRaw, vehiclesRaw, driversRaw] = await Promise.all([
    prisma.delivery.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: {
        items: {
          include: {
            product: {
              select: {
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
        vehicle: { select: { id: true, name: true } },
        driver: { select: { id: true, fullName: true } },
      },
      orderBy: [{ channel: 'asc' }, { sequenceNumber: 'asc' }],
    }),
    prisma.branch.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, isWeb: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: [{ sku: 'asc' }],
      select: {
        id: true,
        sku: true,
        nameBs: true,
        brand: true,
        carryInDefault: true,
        crewSizeDefault: true,
      },
    }),
    prisma.vehicle.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, payloadKg: true, volumeM3: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: 'driver' },
      orderBy: [{ fullName: 'asc' }],
      select: { id: true, fullName: true },
    }),
  ])

  function deliveryWeightVolume(items: typeof deliveriesRaw[number]['items']): { weight: number; volume: number } {
    let weight = 0
    let volume = 0
    for (const it of items) {
      const w = it.product.weightKg ?? 0
      const l = it.product.lengthCm ?? 0
      const wd = it.product.widthCm ?? 0
      const h = it.product.heightCm ?? 0
      weight += w * it.quantity
      volume += ((l * wd * h) / 1_000_000) * it.quantity
    }
    return { weight, volume }
  }

  const conflictInputs = deliveriesRaw.map((d) => {
    const wv = deliveryWeightVolume(d.items)
    return {
      id: d.id,
      sequenceNumber: d.sequenceNumber,
      vehicleId: d.vehicleId,
      vehicleName: d.vehicle?.name ?? null,
      deliveryTime: d.deliveryTime,
      weightKg: wv.weight,
      volumeM3: wv.volume,
    }
  })
  const conflicts = detectConflicts(
    conflictInputs,
    vehiclesRaw.map((v) => ({
      vehicleId: v.id,
      payloadKg: v.payloadKg,
      volumeM3: v.volumeM3,
    })),
  )

  const deliveries: DeliveryRowData[] = deliveriesRaw.map((d) => ({
    id: d.id,
    date: d.date.toISOString().slice(0, 10),
    channel: d.channel as 'branch' | 'web',
    branchId: d.branchId,
    vehicleId: d.vehicleId,
    driverId: d.driverId,
    sequenceNumber: d.sequenceNumber,
    customerName: d.customerName,
    customerAddress: d.customerAddress,
    customerHouseNumber: d.customerHouseNumber,
    customerFloor: d.customerFloor,
    customerApartmentNumber: d.customerApartmentNumber,
    customerPhone: d.customerPhone,
    latitude: d.latitude,
    longitude: d.longitude,
    deliveryTime: d.deliveryTime,
    carryInRequired: d.carryInRequired,
    crewSizeRequired: d.crewSizeRequired,
    status: d.status as DeliveryStatus,
    notes: d.notes,
    vehicleName: d.vehicle?.name ?? null,
    driverName: d.driver?.fullName ?? null,
    conflicts: conflicts.get(d.id) ?? [],
    items: d.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      notes: it.notes,
    })),
    itemsDetail: d.items.map((it) => ({
      productId: it.productId,
      sku: it.product.sku,
      nameBs: it.product.nameBs,
      quantity: it.quantity,
      notes: it.notes,
    })),
  }))

  const vehicleLoadMap = new Map<string, { weight: number; volume: number; count: number }>()
  for (const d of deliveriesRaw) {
    if (!d.vehicleId) continue
    let agg = vehicleLoadMap.get(d.vehicleId)
    if (!agg) {
      agg = { weight: 0, volume: 0, count: 0 }
      vehicleLoadMap.set(d.vehicleId, agg)
    }
    agg.count++
    const wv = deliveryWeightVolume(d.items)
    agg.weight += wv.weight
    agg.volume += wv.volume
  }

  const vehicleLoads: VehicleLoad[] = vehiclesRaw.map((v) => {
    const agg = vehicleLoadMap.get(v.id) ?? { weight: 0, volume: 0, count: 0 }
    return {
      vehicleId: v.id,
      vehicleName: v.name,
      payloadKg: v.payloadKg,
      volumeM3: v.volumeM3,
      deliveriesCount: agg.count,
      totalWeightKg: round1(agg.weight),
      totalVolumeM3: round2(agg.volume),
    }
  })

  const branches: BranchOption[] = branchesRaw
  const products: ProductOption[] = productsRaw
  const vehicles: VehicleOption[] = vehiclesRaw
  const drivers: DriverOption[] = driversRaw

  const dateLabel = formatDateLabel(dateParam)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Plan dostava</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
      </div>
      <DostaveClient
        date={dateParam}
        deliveries={deliveries}
        branches={branches}
        products={products}
        vehicles={vehicles}
        drivers={drivers}
        vehicleLoads={vehicleLoads}
      />
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const DAY_NAMES = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dayName = DAY_NAMES[d.getUTCDay()]
  const day = d.getUTCDate()
  const month = MONTH_NAMES[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${dayName}, ${day}. ${month} ${year}.`
}
