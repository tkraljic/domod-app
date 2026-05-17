'use server'

import Papa from 'papaparse'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { asString, asNumber, asBool, asInt } from '@/lib/csv-coerce'

export type ImportRowError = { row: number; sku: string | null; message: string }

export type ImportSummary = {
  ok: true
  totalRows: number
  created: number
  updated: number
  errors: ImportRowError[]
}

export type ImportFormState =
  | { ok: false; formError: string }
  | ImportSummary
  | undefined

export async function importProducts(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const session = await verifySession()
  const csv = (formData.get('csv') as string | null) ?? ''
  if (!csv.trim()) return { ok: false, formError: 'Sadržaj CSV-a je prazan.' }

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]
    return {
      ok: false,
      formError: `Greška pri čitanju CSV-a (red ${first.row ?? '?'}): ${first.message}`,
    }
  }

  const rows = parsed.data
  if (rows.length === 0) {
    return { ok: false, formError: 'CSV nema redova s podacima.' }
  }

  const categories = await prisma.productCategory.findMany({
    select: { id: true, nameBs: true, parentId: true },
  })
  const parentNameById = new Map(
    categories.filter((c) => c.parentId == null).map((c) => [c.id, c.nameBs.toLowerCase()]),
  )
  const catByLeaf = new Map<string, string>()
  const catByPath = new Map<string, string>()
  for (const c of categories) {
    catByLeaf.set(c.nameBs.toLowerCase(), c.id)
    if (c.parentId) {
      const parent = parentNameById.get(c.parentId)
      if (parent) {
        const path = `${parent} > ${c.nameBs.toLowerCase()}`
        catByPath.set(path, c.id)
        catByPath.set(path.replace('>', '›'), c.id)
      }
    }
  }

  const errors: ImportRowError[] = []
  let created = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2 // +1 for header, +1 for 1-based
    const sku = asString(r.sku).toUpperCase()
    const nameBs = asString(r.nameBs)
    const categoryRaw = asString(r.categoryNameBs)

    if (!sku) {
      errors.push({ row: rowNum, sku: null, message: 'Nedostaje SKU.' })
      continue
    }
    if (!nameBs) {
      errors.push({ row: rowNum, sku, message: 'Nedostaje nameBs.' })
      continue
    }
    if (!categoryRaw) {
      errors.push({ row: rowNum, sku, message: 'Nedostaje categoryNameBs.' })
      continue
    }

    const catKey = categoryRaw.toLowerCase()
    const catId =
      catByPath.get(catKey) ?? catByLeaf.get(catKey) ?? null
    if (!catId) {
      errors.push({
        row: rowNum,
        sku,
        message: `Kategorija "${categoryRaw}" nije pronađena.`,
      })
      continue
    }

    const lengthCm = asNumber(r.lengthCm)
    const widthCm = asNumber(r.widthCm)
    const heightCm = asNumber(r.heightCm)
    const weightKg = asNumber(r.weightKg)
    const crewSize = asInt(r.crewSizeDefault, 1)

    if (
      Number.isNaN(lengthCm) ||
      Number.isNaN(widthCm) ||
      Number.isNaN(heightCm) ||
      Number.isNaN(weightKg) ||
      Number.isNaN(crewSize)
    ) {
      errors.push({ row: rowNum, sku, message: 'Neispravna numerička vrijednost.' })
      continue
    }

    const payload = {
      sku,
      nameBs,
      nameEn: asString(r.nameEn) || null,
      categoryId: catId,
      brand: asString(r.brand) || null,
      supplier: asString(r.supplier) || null,
      lengthCm,
      widthCm,
      heightCm,
      weightKg,
      carryInDefault: asBool(r.carryInDefault),
      crewSizeDefault: Math.max(1, Math.min(10, crewSize || 1)),
      notes: asString(r.notes) || null,
    }

    try {
      const existing = await prisma.product.findUnique({ where: { sku } })
      if (existing) {
        await prisma.product.update({ where: { sku }, data: payload })
        updated++
      } else {
        await prisma.product.create({ data: payload })
        created++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nepoznata greška.'
      errors.push({ row: rowNum, sku, message: msg })
    }
  }

  await writeAudit({
    entityType: 'Product',
    entityId: 'bulk-import',
    action: 'create',
    userId: session.userId,
    changes: { totalRows: rows.length, created, updated, errorCount: errors.length },
  })

  revalidatePath('/artikli')
  return { ok: true, totalRows: rows.length, created, updated, errors }
}
