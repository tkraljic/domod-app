import { prisma } from '@/lib/prisma'
import { ProductsClient } from './_components/products-client'
import type { CategoryOption } from './_components/product-form-dialog'

type PrismaCategory = {
  id: string
  nameBs: string
  parentId: string | null
  sortOrder: number
}

export default async function ArtikliPage() {
  const [categoriesRaw, products] = await Promise.all([
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameBs: 'asc' }],
      select: { id: true, nameBs: true, parentId: true, sortOrder: true },
    }),
    prisma.product.findMany({
      orderBy: [{ sku: 'asc' }],
      include: { category: { select: { nameBs: true, parentId: true } } },
    }),
  ])

  const { flat: categoryOptions, rootIds } = flattenCategoryTree(categoriesRaw)
  const labelById = new Map(categoryOptions.map((c) => [c.id, c.label]))
  const parentNameById = new Map(categoriesRaw.map((c) => [c.id, c.nameBs]))

  const productRows = products.map((p) => {
    const parentName =
      p.category.parentId ? parentNameById.get(p.category.parentId) ?? null : null
    const categoryLabel = parentName
      ? `${parentName} › ${p.category.nameBs}`
      : p.category.nameBs
    return {
      id: p.id,
      sku: p.sku,
      nameBs: p.nameBs,
      nameEn: p.nameEn,
      categoryId: p.categoryId,
      categoryLabel: labelById.get(p.categoryId) ?? categoryLabel,
      brand: p.brand,
      supplier: p.supplier,
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      carryInDefault: p.carryInDefault,
      crewSizeDefault: p.crewSizeDefault,
      notes: p.notes,
      deletedAt: p.deletedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }
  })

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Katalog artikala — dimenzije, težina i postavke za planiranje dostava.
        </p>
      </div>
      <ProductsClient
        products={productRows}
        categories={categoryOptions}
        rootCategoryIds={rootIds}
      />
    </div>
  )
}

function flattenCategoryTree(categories: PrismaCategory[]): {
  flat: CategoryOption[]
  rootIds: string[]
} {
  const childrenOf = new Map<string | null, PrismaCategory[]>()
  for (const c of categories) {
    const list = childrenOf.get(c.parentId) ?? []
    list.push(c)
    childrenOf.set(c.parentId, list)
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.nameBs.localeCompare(b.nameBs, 'bs'))
  }

  const flat: CategoryOption[] = []
  const rootIds: string[] = []
  const roots = childrenOf.get(null) ?? []

  function walk(node: PrismaCategory, depth: number) {
    flat.push({ id: node.id, label: node.nameBs, depth, parentId: node.parentId })
    for (const child of childrenOf.get(node.id) ?? []) walk(child, depth + 1)
  }
  for (const r of roots) {
    rootIds.push(r.id)
    walk(r, 0)
  }
  return { flat, rootIds }
}
