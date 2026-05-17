'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { ProductCreateSchema, ProductUpdateSchema } from '@/lib/schemas/product'

export type ProductFormState =
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string }
  | { ok: true }
  | undefined

function parseFormData(formData: FormData) {
  const getStr = (key: string) => (formData.get(key) as string) ?? ''
  return {
    id: getStr('id') || undefined,
    sku: getStr('sku').toUpperCase().trim(),
    nameBs: getStr('nameBs'),
    nameEn: getStr('nameEn'),
    categoryId: getStr('categoryId'),
    brand: getStr('brand'),
    supplier: getStr('supplier'),
    lengthCm: getStr('lengthCm'),
    widthCm: getStr('widthCm'),
    heightCm: getStr('heightCm'),
    weightKg: getStr('weightKg'),
    carryInDefault: formData.get('carryInDefault') === 'on',
    crewSizeDefault: getStr('crewSizeDefault') || '1',
    notes: getStr('notes'),
  }
}

function buildPayload(data: Record<string, unknown>) {
  return {
    sku: data.sku as string,
    nameBs: data.nameBs as string,
    nameEn: (data.nameEn as string) || null,
    categoryId: data.categoryId as string,
    brand: (data.brand as string) || null,
    supplier: (data.supplier as string) || null,
    lengthCm: (data.lengthCm as number | undefined) ?? null,
    widthCm: (data.widthCm as number | undefined) ?? null,
    heightCm: (data.heightCm as number | undefined) ?? null,
    weightKg: (data.weightKg as number | undefined) ?? null,
    carryInDefault: data.carryInDefault as boolean,
    crewSizeDefault: data.crewSizeDefault as number,
    notes: (data.notes as string) || null,
  }
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = ProductCreateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const payload = buildPayload(parsed.data as Record<string, unknown>)

  try {
    const created = await prisma.product.create({ data: payload })
    await writeAudit({
      entityType: 'Product',
      entityId: created.id,
      action: 'create',
      userId: session.userId,
      changes: payload,
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, fieldErrors: { sku: ['Artikl sa ovim SKU već postoji'] } }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { ok: false, fieldErrors: { categoryId: ['Odabrana kategorija ne postoji'] } }
    }
    return { ok: false, formError: 'Greška prilikom kreiranja artikla.' }
  }

  revalidatePath('/artikli')
  return { ok: true }
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await verifySession()
  const raw = parseFormData(formData)
  const parsed = ProductUpdateSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...rest } = parsed.data
  const payload = buildPayload(rest as Record<string, unknown>)

  try {
    const before = await prisma.product.findUnique({ where: { id } })
    if (!before) return { ok: false, formError: 'Artikl nije pronađen.' }

    await prisma.product.update({ where: { id }, data: payload })
    await writeAudit({
      entityType: 'Product',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { before, after: payload },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, fieldErrors: { sku: ['Artikl sa ovim SKU već postoji'] } }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { ok: false, fieldErrors: { categoryId: ['Odabrana kategorija ne postoji'] } }
    }
    return { ok: false, formError: 'Greška prilikom ažuriranja artikla.' }
  }

  revalidatePath('/artikli')
  return { ok: true }
}

export async function softDeleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const before = await prisma.product.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'Artikl nije pronađen.' }
    if (before.deletedAt) return { ok: false, error: 'Artikl je već obrisan.' }

    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } })
    await writeAudit({
      entityType: 'Product',
      entityId: id,
      action: 'delete',
      userId: session.userId,
      changes: { softDelete: true, sku: before.sku },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom brisanja artikla.' }
  }
  revalidatePath('/artikli')
  return { ok: true }
}

export async function restoreProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const before = await prisma.product.findUnique({ where: { id } })
    if (!before) return { ok: false, error: 'Artikl nije pronađen.' }
    if (!before.deletedAt) return { ok: false, error: 'Artikl nije obrisan.' }

    await prisma.product.update({ where: { id }, data: { deletedAt: null } })
    await writeAudit({
      entityType: 'Product',
      entityId: id,
      action: 'update',
      userId: session.userId,
      changes: { restore: true, sku: before.sku },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom vraćanja artikla.' }
  }
  revalidatePath('/artikli')
  return { ok: true }
}

export async function hardDeleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifySession()
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { deliveryItems: true } } },
    })
    if (!product) return { ok: false, error: 'Artikl nije pronađen.' }
    if (product._count.deliveryItems > 0) {
      return {
        ok: false,
        error: `Nije moguće trajno obrisati — artikl se koristi u ${product._count.deliveryItems} dostav${
          product._count.deliveryItems === 1 ? 'i' : 'a'
        }.`,
      }
    }

    await prisma.product.delete({ where: { id } })
    await writeAudit({
      entityType: 'Product',
      entityId: id,
      action: 'delete',
      userId: session.userId,
      changes: { hardDelete: true, sku: product.sku },
    })
  } catch {
    return { ok: false, error: 'Greška prilikom trajnog brisanja.' }
  }
  revalidatePath('/artikli')
  return { ok: true }
}
