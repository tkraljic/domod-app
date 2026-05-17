'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import {
  DeliveryCreateSchema,
  DeliveryUpdateSchema,
  DELIVERY_STATUSES,
  type DeliveryStatus,
} from '@/lib/schemas/delivery'

export type DeliveryFormState =
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string }
  | { ok: true; date: string }
  | undefined

function parseDateAtUtcMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

function parseFormData(formData: FormData) {
  const getStr = (key: string) => (formData.get(key) as string) ?? ''
  let items: unknown = []
  try {
    items = JSON.parse(getStr('itemsJson') || '[]')
  } catch {
    items = []
  }
  return {
    id: getStr('id') || undefined,
    date: getStr('date'),
    channel: getStr('channel'),
    branchId: getStr('branchId') || '',
    vehicleId: getStr('vehicleId') || '',
    driverId: getStr('driverId') || '',
    customerName: getStr('customerName'),
    customerAddress: getStr('customerAddress'),
    customerHouseNumber: getStr('customerHouseNumber'),
    customerFloor: getStr('customerFloor'),
    customerApartmentNumber: getStr('customerApartmentNumber'),
    customerPhone: getStr('customerPhone'),
    latitude: getStr('latitude'),
    longitude: getStr('longitude'),
    deliveryTime: getStr('deliveryTime'),
    carryInRequired: formData.get('carryInRequired') === 'on',
    crewSizeRequired: getStr('crewSizeRequired') || '1',
    status: getStr('status') || 'planned',
    notes: getStr('notes'),
    items,
  }
}

export async function createDelivery(
  _prev: DeliveryFormState,
  formData: FormData,
): Promise<DeliveryFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = DeliveryCreateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const dateObj = parseDateAtUtcMidnight(data.date)
  const branchId = data.channel === 'branch' ? data.branchId || null : null
  const vehicleId = data.vehicleId || null
  const driverId = data.driverId || null

  try {
    const created = await prisma.$transaction(async (tx) => {
      const max = await tx.delivery.aggregate({
        where: { date: dateObj, channel: data.channel },
        _max: { sequenceNumber: true },
      })
      const nextSeq = (max._max.sequenceNumber ?? 0) + 1

      return tx.delivery.create({
        data: {
          date: dateObj,
          channel: data.channel,
          branchId,
          vehicleId,
          driverId,
          sequenceNumber: nextSeq,
          customerName: data.customerName,
          customerAddress: data.customerAddress || null,
          customerHouseNumber: data.customerHouseNumber || null,
          customerFloor: data.customerFloor || null,
          customerApartmentNumber: data.customerApartmentNumber || null,
          customerPhone: data.customerPhone || null,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          deliveryTime: data.deliveryTime || null,
          carryInRequired: data.carryInRequired,
          crewSizeRequired: data.crewSizeRequired,
          status: data.status,
          notes: data.notes || null,
          createdById: session.userId,
          items: {
            create: data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              notes: it.notes || null,
            })),
          },
        },
      })
    })

    await writeAudit({
      entityType: 'Delivery',
      entityId: created.id,
      action: 'create',
      userId: session.userId,
      changes: { date: data.date, channel: data.channel, sequenceNumber: created.sequenceNumber },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, formError: 'Sekvencijalni broj se preklapa — pokušajte ponovo.' }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { ok: false, formError: 'Referenca na poslovnicu ili artikl nije validna.' }
    }
    return { ok: false, formError: 'Greška prilikom kreiranja dostave.' }
  }

  revalidatePath('/dostave')
  return { ok: true, date: data.date }
}

export async function updateDelivery(
  _prev: DeliveryFormState,
  formData: FormData,
): Promise<DeliveryFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = DeliveryUpdateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...data } = parsed.data
  const dateObj = parseDateAtUtcMidnight(data.date)
  const branchId = data.channel === 'branch' ? data.branchId || null : null
  const vehicleId = data.vehicleId || null
  const driverId = data.driverId || null

  try {
    const before = await prisma.delivery.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!before) return { ok: false, formError: 'Dostava nije pronađena.' }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryItem.deleteMany({ where: { deliveryId: id } })
      await tx.delivery.update({
        where: { id },
        data: {
          date: dateObj,
          channel: data.channel,
          branchId,
          vehicleId,
          driverId,
          customerName: data.customerName,
          customerAddress: data.customerAddress || null,
          customerHouseNumber: data.customerHouseNumber || null,
          customerFloor: data.customerFloor || null,
          customerApartmentNumber: data.customerApartmentNumber || null,
          customerPhone: data.customerPhone || null,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          deliveryTime: data.deliveryTime || null,
          carryInRequired: data.carryInRequired,
          crewSizeRequired: data.crewSizeRequired,
          status: data.status,
          notes: data.notes || null,
          updatedById: session.userId,
          items: {
            create: data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              notes: it.notes || null,
            })),
          },
        },
      })
    })

    await writeAudit({
      entityType: 'Delivery',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: {
        before: { ...before, items: before.items.length },
        after: { ...data, items: data.items.length },
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { ok: false, formError: 'Referenca na poslovnicu ili artikl nije validna.' }
    }
    return { ok: false, formError: 'Greška prilikom ažuriranja dostave.' }
  }

  revalidatePath('/dostave')
  return { ok: true, date: data.date }
}

export async function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus,
): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  if (!DELIVERY_STATUSES.includes(status)) {
    return { ok: false, error: 'Neispravan status.' }
  }

  try {
    const before = await prisma.delivery.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'Dostava nije pronađena.' }
    if (before.status === status) return { ok: true }

    await prisma.delivery.update({
      where: { id },
      data: { status, updatedById: session.userId },
    })
    await writeAudit({
      entityType: 'Delivery',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { status: { from: before.status, to: status } },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom promjene statusa.' }
  }

  revalidatePath('/dostave')
  return { ok: true }
}

export async function deleteDelivery(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const before = await prisma.delivery.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'Dostava nije pronađena.' }

    await prisma.delivery.delete({ where: { id } })
    await writeAudit({
      entityType: 'Delivery',
      entityId: id,
      action: 'delete',
      userId: session.userId,
      changes: {
        date: before.date.toISOString(),
        channel: before.channel,
        sequenceNumber: before.sequenceNumber,
        customerName: before.customerName,
      },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom brisanja dostave.' }
  }

  revalidatePath('/dostave')
  return { ok: true }
}
