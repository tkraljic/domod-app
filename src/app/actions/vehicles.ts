'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { VehicleCreateSchema, VehicleUpdateSchema } from '@/lib/schemas/vehicle'

export type VehicleFormState =
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string }
  | { ok: true }
  | undefined

function parseFormData(formData: FormData) {
  return {
    id: (formData.get('id') as string) || undefined,
    name: (formData.get('name') as string) ?? '',
    payloadKg: (formData.get('payloadKg') as string) ?? '',
    volumeM3: (formData.get('volumeM3') as string) ?? '',
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
  }
}

export async function createVehicle(
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const session = await verifySession()
  const parsed = VehicleCreateSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  try {
    const created = await prisma.vehicle.create({ data })
    await writeAudit({
      entityType: 'Vehicle',
      entityId: created.id,
      action: 'create',
      userId: session.userId,
      changes: data,
    })
  } catch {
    return { ok: false, formError: 'Greška prilikom kreiranja vozila.' }
  }

  revalidatePath('/vozila')
  revalidatePath('/dostave')
  return { ok: true }
}

export async function updateVehicle(
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const session = await verifySession()
  const parsed = VehicleUpdateSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...data } = parsed.data
  try {
    const before = await prisma.vehicle.findUnique({ where: { id } })
    if (!before) return { ok: false, formError: 'Vozilo nije pronađeno.' }
    await prisma.vehicle.update({ where: { id }, data })
    await writeAudit({
      entityType: 'Vehicle',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { before, after: data },
    })
  } catch {
    return { ok: false, formError: 'Greška prilikom ažuriranja vozila.' }
  }

  revalidatePath('/vozila')
  revalidatePath('/dostave')
  return { ok: true }
}

export async function toggleVehicleActive(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const current = await prisma.vehicle.findUnique({ where: { id } })
    if (!current) return { ok: false, error: 'Vozilo nije pronađeno.' }
    const next = await prisma.vehicle.update({
      where: { id },
      data: { active: !current.active },
    })
    await writeAudit({
      entityType: 'Vehicle',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { active: { from: current.active, to: next.active } },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom promjene statusa.' }
  }

  revalidatePath('/vozila')
  revalidatePath('/dostave')
  return { ok: true }
}

export async function deleteVehicle(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { _count: { select: { deliveries: true } } },
    })
    if (!vehicle) return { ok: false, error: 'Vozilo nije pronađeno.' }
    if (vehicle._count.deliveries > 0) {
      return {
        ok: false,
        error: `Nije moguće obrisati — postoji ${vehicle._count.deliveries} dostava. Deaktivirajte vozilo umjesto brisanja.`,
      }
    }

    await prisma.vehicle.delete({ where: { id } })
    await writeAudit({
      entityType: 'Vehicle',
      entityId: id,
      action: 'delete',
      userId: session.userId,
      changes: { deleted: vehicle },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom brisanja vozila.' }
  }

  revalidatePath('/vozila')
  revalidatePath('/dostave')
  return { ok: true }
}
