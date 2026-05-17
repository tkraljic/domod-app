import { prisma } from '@/lib/prisma'
import { VehiclesClient } from './_components/vehicles-client'

export default async function VozilaPage() {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { deliveries: true } } },
  })

  const data = vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    payloadKg: v.payloadKg,
    volumeM3: v.volumeM3,
    active: v.active,
    deliveriesCount: v._count.deliveries,
    createdAt: v.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Vozila</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upravljanje voznim parkom — kapacitet (težina/volumen) i status.
        </p>
      </div>
      <VehiclesClient vehicles={data} />
    </div>
  )
}
