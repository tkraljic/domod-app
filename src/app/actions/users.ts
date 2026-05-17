'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import {
  UserCreateSchema,
  UserUpdateSchema,
  PasswordResetSchema,
} from '@/lib/schemas/user'

export type UserFormState =
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string }
  | { ok: true }
  | undefined

async function requireAdmin() {
  const session = await verifySession()
  if (session.role !== 'admin') {
    throw new Error('Forbidden')
  }
  return session
}

function parseBaseFormData(formData: FormData) {
  return {
    id: (formData.get('id') as string) || undefined,
    email: (formData.get('email') as string) ?? '',
    fullName: (formData.get('fullName') as string) ?? '',
    role: (formData.get('role') as string) ?? 'viewer',
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
    password: (formData.get('password') as string) ?? '',
  }
}

export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireAdmin()
  const parsed = UserCreateSchema.safeParse(parseBaseFormData(formData))
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const { password, ...rest } = parsed.data
  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const created = await prisma.user.create({
      data: { ...rest, passwordHash },
    })
    await writeAudit({
      entityType: 'User',
      entityId: created.id,
      action: 'create',
      userId: session.userId,
      changes: { ...rest },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, fieldErrors: { email: ['Korisnik sa ovim emailom već postoji'] } }
    }
    return { ok: false, formError: 'Greška prilikom kreiranja korisnika.' }
  }

  revalidatePath('/korisnici')
  return { ok: true }
}

export async function updateUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireAdmin()
  const raw = parseBaseFormData(formData)
  const parsed = UserUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...data } = parsed.data
  // Prevent admin from demoting/deactivating themselves and locking out
  if (id === session.userId) {
    if (data.role !== 'admin') {
      return { ok: false, formError: 'Ne možete sebi promijeniti rolu admina.' }
    }
    if (!data.active) {
      return { ok: false, formError: 'Ne možete sebe deaktivirati.' }
    }
  }

  try {
    const before = await prisma.user.findUnique({ where: { id } })
    if (!before) return { ok: false, formError: 'Korisnik nije pronađen.' }
    await prisma.user.update({ where: { id }, data })
    await writeAudit({
      entityType: 'User',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: {
        before: { email: before.email, fullName: before.fullName, role: before.role, active: before.active },
        after: data,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, fieldErrors: { email: ['Korisnik sa ovim emailom već postoji'] } }
    }
    return { ok: false, formError: 'Greška prilikom ažuriranja korisnika.' }
  }

  revalidatePath('/korisnici')
  return { ok: true }
}

export async function resetUserPassword(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireAdmin()
  const parsed = PasswordResetSchema.safeParse({
    id: (formData.get('id') as string) ?? '',
    password: (formData.get('password') as string) ?? '',
  })
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  try {
    const before = await prisma.user.findUnique({ where: { id: parsed.data.id } })
    if (!before) return { ok: false, formError: 'Korisnik nije pronađen.' }
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { passwordHash },
    })
    await writeAudit({
      entityType: 'User',
      entityId: parsed.data.id,
      action: 'update',
      userId: session.userId,
      changes: { passwordReset: true, target: before.email },
    })
  } catch {
    return { ok: false, formError: 'Greška prilikom resetovanja lozinke.' }
  }

  revalidatePath('/korisnici')
  return { ok: true }
}

export async function toggleUserActive(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin()
  if (id === session.userId) {
    return { ok: false, error: 'Ne možete sebe deaktivirati.' }
  }
  try {
    const current = await prisma.user.findUnique({ where: { id } })
    if (!current) return { ok: false, error: 'Korisnik nije pronađen.' }
    const next = await prisma.user.update({
      where: { id },
      data: { active: !current.active },
    })
    await writeAudit({
      entityType: 'User',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { active: { from: current.active, to: next.active } },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom promjene statusa.' }
  }
  revalidatePath('/korisnici')
  return { ok: true }
}
