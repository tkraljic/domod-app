/**
 * Real-life shipping/fulfillment scenarios:
 *  - Planner creates a delivery → it gets sequence #1, items persist, audit row written
 *  - Two deliveries on the same day+channel → sequence numbers increment
 *  - Web channel deliveries number independently from branch channel
 *  - Delete delivery cascades to items
 *  - Vehicle that has deliveries cannot be deleted (planner must deactivate)
 *  - Branch that has deliveries cannot be deleted
 *  - Vehicle daily load = sum of items' weight × qty / volume × qty
 *  - Conflict detection picks up overlapping vehicle assignments
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { detectConflicts } from '@/app/(dashboard)/dostave/_lib/conflicts'

let userId: string
let branchSrjId: string
let branchWebId: string
let vehicleKombiId: string
let vehicleKamionId: string
let categoryId: string
let productHeavyId: string // 70kg, 0.31 m³ each
let productLightId: string // 5kg, 0.05 m³ each

function dayUtc(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

beforeAll(async () => {
  // Seed reference data once for the suite.
  const passwordHash = await bcrypt.hash('test-pw', 4)
  const user = await prisma.user.create({
    data: {
      email: 'planer@test.local',
      passwordHash,
      fullName: 'Test Planer',
      role: 'planner',
    },
  })
  userId = user.id

  const [srj, web] = await Promise.all([
    prisma.branch.create({ data: { code: 'SRJ', name: 'Sarajevo', sortOrder: 1 } }),
    prisma.branch.create({
      data: { code: 'WEB', name: 'Web narudžbe', isWeb: true, sortOrder: 99 },
    }),
  ])
  branchSrjId = srj.id
  branchWebId = web.id

  const [kombi, kamion] = await Promise.all([
    prisma.vehicle.create({ data: { name: 'Kombi 1', payloadKg: 1000, volumeM3: 8 } }),
    prisma.vehicle.create({ data: { name: 'Kamion 1', payloadKg: 3500, volumeM3: 20 } }),
  ])
  vehicleKombiId = kombi.id
  vehicleKamionId = kamion.id

  const cat = await prisma.productCategory.create({
    data: { nameBs: 'Bijela tehnika' },
  })
  categoryId = cat.id

  const [heavy, light] = await Promise.all([
    prisma.product.create({
      data: {
        sku: 'TEST-FRIDGE',
        nameBs: 'Test frižider',
        categoryId,
        weightKg: 70,
        lengthCm: 60,
        widthCm: 66,
        heightCm: 185,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'TEST-MICROWAVE',
        nameBs: 'Test mikrovalna',
        categoryId,
        weightKg: 5,
        lengthCm: 50,
        widthCm: 40,
        heightCm: 30,
      },
    }),
  ])
  productHeavyId = heavy.id
  productLightId = light.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Wipe between tests so each scenario starts clean — but keep reference data.
  await prisma.deliveryItem.deleteMany()
  await prisma.delivery.deleteMany()
  await prisma.auditLog.deleteMany()
})

async function nextSequenceNumber(date: Date, channel: 'branch' | 'web'): Promise<number> {
  const max = await prisma.delivery.aggregate({
    where: { date, channel },
    _max: { sequenceNumber: true },
  })
  return (max._max.sequenceNumber ?? 0) + 1
}

describe('order fulfillment — sequence numbering', () => {
  it('first branch delivery on a day gets sequence 1', async () => {
    const date = dayUtc('2026-05-01')
    const seq = await nextSequenceNumber(date, 'branch')
    const delivery = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: seq,
        customerName: 'Mehmed Mehmedović',
        customerAddress: 'Titova 12, Sarajevo',
        createdById: userId,
      },
    })
    expect(delivery.sequenceNumber).toBe(1)
  })

  it('second branch delivery on the same day gets sequence 2', async () => {
    const date = dayUtc('2026-05-01')
    for (const i of [1, 2]) {
      const seq = await nextSequenceNumber(date, 'branch')
      const created = await prisma.delivery.create({
        data: {
          date,
          channel: 'branch',
          branchId: branchSrjId,
          sequenceNumber: seq,
          customerName: `Customer ${i}`,
          createdById: userId,
        },
      })
      expect(created.sequenceNumber).toBe(i)
    }
  })

  it('web channel sequence is independent from branch channel', async () => {
    const date = dayUtc('2026-05-01')
    const branchSeq = await nextSequenceNumber(date, 'branch')
    await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: branchSeq,
        customerName: 'A',
        createdById: userId,
      },
    })
    const webSeq = await nextSequenceNumber(date, 'web')
    expect(webSeq).toBe(1) // first web delivery still starts at 1
    await prisma.delivery.create({
      data: {
        date,
        channel: 'web',
        branchId: branchWebId,
        sequenceNumber: webSeq,
        customerName: 'B',
        createdById: userId,
      },
    })
    const nextWeb = await nextSequenceNumber(date, 'web')
    expect(nextWeb).toBe(2)
  })

  it('rejects duplicate (date, channel, sequenceNumber) at the DB level', async () => {
    const date = dayUtc('2026-05-01')
    await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: 1,
        customerName: 'A',
        createdById: userId,
      },
    })
    await expect(
      prisma.delivery.create({
        data: {
          date,
          channel: 'branch',
          branchId: branchSrjId,
          sequenceNumber: 1,
          customerName: 'B',
          createdById: userId,
        },
      }),
    ).rejects.toThrow()
  })
})

describe('order fulfillment — items + cascade delete', () => {
  it('persists multiple items on a delivery and reads them back', async () => {
    const date = dayUtc('2026-05-02')
    const created = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: 1,
        customerName: 'Test Kupac',
        createdById: userId,
        items: {
          create: [
            { productId: productHeavyId, quantity: 1 },
            { productId: productLightId, quantity: 3 },
          ],
        },
      },
      include: { items: true },
    })
    expect(created.items).toHaveLength(2)
    const heavyItem = created.items.find((i) => i.productId === productHeavyId)
    const lightItem = created.items.find((i) => i.productId === productLightId)
    expect(heavyItem?.quantity).toBe(1)
    expect(lightItem?.quantity).toBe(3)
  })

  it('deleting a delivery cascades to its items', async () => {
    const date = dayUtc('2026-05-02')
    const d = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: 1,
        customerName: 'X',
        createdById: userId,
        items: { create: [{ productId: productHeavyId, quantity: 1 }] },
      },
    })
    await prisma.delivery.delete({ where: { id: d.id } })
    const orphans = await prisma.deliveryItem.findMany({ where: { deliveryId: d.id } })
    expect(orphans).toHaveLength(0)
  })
})

describe('master-data referential safety', () => {
  it('vehicle with deliveries cannot be hard-deleted', async () => {
    await prisma.delivery.create({
      data: {
        date: dayUtc('2026-05-03'),
        channel: 'branch',
        branchId: branchSrjId,
        vehicleId: vehicleKombiId,
        sequenceNumber: 1,
        customerName: 'A',
        createdById: userId,
      },
    })
    // FK from Delivery.vehicleId blocks vehicle deletion
    await expect(prisma.vehicle.delete({ where: { id: vehicleKombiId } })).rejects.toThrow()
  })

  it('branch with deliveries cannot be hard-deleted', async () => {
    await prisma.delivery.create({
      data: {
        date: dayUtc('2026-05-03'),
        channel: 'branch',
        branchId: branchSrjId,
        sequenceNumber: 1,
        customerName: 'A',
        createdById: userId,
      },
    })
    await expect(prisma.branch.delete({ where: { id: branchSrjId } })).rejects.toThrow()
  })
})

describe('vehicle capacity computation', () => {
  it('aggregates weight and volume across all deliveries on a vehicle for the day', async () => {
    const date = dayUtc('2026-05-04')
    // Two deliveries on Kombi 1 — each with one heavy fridge (70kg, 0.7326 m³)
    for (const i of [1, 2]) {
      await prisma.delivery.create({
        data: {
          date,
          channel: 'branch',
          branchId: branchSrjId,
          vehicleId: vehicleKombiId,
          sequenceNumber: i,
          customerName: `C${i}`,
          createdById: userId,
          items: { create: [{ productId: productHeavyId, quantity: 1 }] },
        },
      })
    }

    const dayStart = date
    const dayEnd = new Date(date)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    const all = await prisma.delivery.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, vehicleId: vehicleKombiId },
      include: { items: { include: { product: true } } },
    })
    let weight = 0
    let volume = 0
    for (const d of all) {
      for (const it of d.items) {
        weight += (it.product.weightKg ?? 0) * it.quantity
        const l = it.product.lengthCm ?? 0
        const w = it.product.widthCm ?? 0
        const h = it.product.heightCm ?? 0
        volume += ((l * w * h) / 1_000_000) * it.quantity
      }
    }
    expect(weight).toBe(140) // 70kg × 2
    // 60×66×185 = 732,600 cm³ = 0.7326 m³, ×2 = 1.4652 m³
    expect(volume).toBeCloseTo(1.4652, 4)
  })
})

describe('conflict detection on real fixtures', () => {
  it('flags overlapping time windows on the same vehicle', async () => {
    const date = dayUtc('2026-05-05')
    const a = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        vehicleId: vehicleKombiId,
        sequenceNumber: 1,
        customerName: 'A',
        deliveryTime: '08:00–10:00',
        createdById: userId,
      },
    })
    const b = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        vehicleId: vehicleKombiId,
        sequenceNumber: 2,
        customerName: 'B',
        deliveryTime: '09:00–11:00',
        createdById: userId,
      },
    })

    const conflicts = detectConflicts(
      [
        {
          id: a.id,
          sequenceNumber: 1,
          vehicleId: vehicleKombiId,
          vehicleName: 'Kombi 1',
          deliveryTime: '08:00–10:00',
          weightKg: 0,
          volumeM3: 0,
        },
        {
          id: b.id,
          sequenceNumber: 2,
          vehicleId: vehicleKombiId,
          vehicleName: 'Kombi 1',
          deliveryTime: '09:00–11:00',
          weightKg: 0,
          volumeM3: 0,
        },
      ],
      [{ vehicleId: vehicleKombiId, payloadKg: 1000, volumeM3: 8 }],
    )

    expect((conflicts.get(a.id) ?? []).some((c) => c.type === 'vehicle_time_overlap')).toBe(true)
    expect((conflicts.get(b.id) ?? []).some((c) => c.type === 'vehicle_time_overlap')).toBe(true)
  })

  it('flags capacity overload when 16 fridges (1120kg) are loaded onto Kombi 1 (1000kg)', async () => {
    const date = dayUtc('2026-05-06')
    const d = await prisma.delivery.create({
      data: {
        date,
        channel: 'branch',
        branchId: branchSrjId,
        vehicleId: vehicleKombiId,
        sequenceNumber: 1,
        customerName: 'Bulk',
        createdById: userId,
        items: { create: [{ productId: productHeavyId, quantity: 16 }] },
      },
    })
    const conflicts = detectConflicts(
      [
        {
          id: d.id,
          sequenceNumber: 1,
          vehicleId: vehicleKombiId,
          vehicleName: 'Kombi 1',
          deliveryTime: null,
          weightKg: 70 * 16, // 1120
          volumeM3: 0.7326 * 16, // ~11.7 m³ also exceeds 8m³
        },
      ],
      [{ vehicleId: vehicleKombiId, payloadKg: 1000, volumeM3: 8 }],
    )
    const overload = (conflicts.get(d.id) ?? []).find((c) => c.type === 'vehicle_overload')
    expect(overload).toBeDefined()
    if (overload && overload.type === 'vehicle_overload') {
      expect(overload.weightPct).toBe(112) // 1120 / 1000
      expect(overload.volumePct).toBeGreaterThanOrEqual(146) // ~146%
    }
  })
})

describe('audit log shape', () => {
  it('round-trips JSON changes payload', async () => {
    const log = await prisma.auditLog.create({
      data: {
        entityType: 'Delivery',
        entityId: 'fake-id',
        action: 'create',
        userId,
        changes: JSON.stringify({ customerName: 'A', sequenceNumber: 1 }),
      },
    })
    const fetched = await prisma.auditLog.findUnique({ where: { id: log.id } })
    expect(fetched).not.toBeNull()
    const parsed = JSON.parse(fetched!.changes)
    expect(parsed.customerName).toBe('A')
    expect(parsed.sequenceNumber).toBe(1)
  })
})
