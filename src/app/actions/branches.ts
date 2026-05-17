'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { BranchCreateSchema, BranchUpdateSchema } from '@/lib/schemas/branch'

export type BranchFormState =
  | {
      ok: false
      fieldErrors?: Record<string, string[]>
      formError?: string
    }
  | { ok: true }
  | undefined

function parseFormData(formData: FormData) {
  return {
    id: (formData.get('id') as string) || undefined,
    code: (formData.get('code') as string)?.toUpperCase() ?? '',
    name: (formData.get('name') as string) ?? '',
    address: (formData.get('address') as string) ?? '',
    phone: (formData.get('phone') as string) ?? '',
    isWeb: formData.get('isWeb') === 'on' || formData.get('isWeb') === 'true',
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
    sortOrder: (formData.get('sortOrder') as string) ?? '0',
  }
}

export async function createBranch(
  _prev: BranchFormState,
  formData: FormData,
): Promise<BranchFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = BranchCreateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const payload = {
    code: data.code,
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    isWeb: data.isWeb,
    active: data.active,
    sortOrder: data.sortOrder,
  }

  try {
    const created = await prisma.branch.create({ data: payload })
    await writeAudit({
      entityType: 'Branch',
      entityId: created.id,
      action: 'create',
      userId: session.userId,
      changes: payload,
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        ok: false,
        fieldErrors: { code: ['Poslovnica sa ovim kodom već postoji'] },
      }
    }
    return { ok: false, formError: 'Greška prilikom kreiranja poslovnice.' }
  }

  revalidatePath('/poslovnice')
  return { ok: true }
}

export async function updateBranch(
  _prev: BranchFormState,
  formData: FormData,
): Promise<BranchFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = BranchUpdateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...data } = parsed.data
  const payload = {
    code: data.code,
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    isWeb: data.isWeb,
    active: data.active,
    sortOrder: data.sortOrder,
  }

  try {
    const before = await prisma.branch.findUnique({ where: { id } })
    if (!before) return { ok: false, formError: 'Poslovnica nije pronađena.' }

    await prisma.branch.update({ where: { id }, data: payload })
    await writeAudit({
      entityType: 'Branch',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { before, after: payload },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        ok: false,
        fieldErrors: { code: ['Poslovnica sa ovim kodom već postoji'] },
      }
    }
    return { ok: false, formError: 'Greška prilikom ažuriranja poslovnice.' }
  }

  revalidatePath('/poslovnice')
  return { ok: true }
}

export async function toggleBranchActive(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const current = await prisma.branch.findUnique({ where: { id } })
    if (!current) return { ok: false, error: 'Poslovnica nije pronađena.' }

    const next = await prisma.branch.update({
      where: { id },
      data: { active: !current.active },
    })
    await writeAudit({
      entityType: 'Branch',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { active: { from: current.active, to: next.active } },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom promjene statusa.' }
  }

  revalidatePath('/poslovnice')
  return { ok: true }
}

export async function deleteBranch(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { deliveries: true } } },
    })
    if (!branch) return { ok: false, error: 'Poslovnica nije pronađena.' }
    if (branch._count.deliveries > 0) {
      return {
        ok: false,
        error: `Nije moguće obrisati — postoji ${branch._count.deliveries} dostava. Deaktivirajte poslovnicu umjesto brisanja.`,
      }
    }

    await prisma.branch.delete({ where: { id } })
    await writeAudit({
      entityType: 'Branch',
      entityId: id,
      action: 'delete',
      userId: session.userId,
      changes: { deleted: branch },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom brisanja poslovnice.' }
  }

  revalidatePath('/poslovnice')
  return { ok: true }
}
