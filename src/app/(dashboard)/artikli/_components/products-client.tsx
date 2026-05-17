'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  PackageCheck,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ProductFormDialog,
  type ProductDraft,
  type CategoryOption,
} from './product-form-dialog'
import { ProductRowActions } from './product-row-actions'
import { ImportCsvDialog } from './import-csv-dialog'

type ProductRow = ProductDraft & {
  categoryLabel: string
  deletedAt: string | null
  createdAt: string
}

type SortKey = 'sku' | 'nameBs' | 'brand' | 'createdAt'
type SortDir = 'asc' | 'desc'
type CategoryFilter = 'all' | string
type DeletedFilter = 'active' | 'deleted' | 'all'

type Props = {
  products: ProductRow[]
  categories: CategoryOption[]
  rootCategoryIds: string[]
}

export function ProductsClient({ products, categories, rootCategoryIds }: Props) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>('active')
  const [sortKey, setSortKey] = useState<SortKey>('sku')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductDraft | null>(null)
  const [openCount, setOpenCount] = useState(0)
  const [importOpen, setImportOpen] = useState(false)

  const categoryDescendants = useMemo(() => {
    const childrenOf = new Map<string, string[]>()
    for (const c of categories) {
      if (c.parentId) {
        const arr = childrenOf.get(c.parentId) ?? []
        arr.push(c.id)
        childrenOf.set(c.parentId, arr)
      }
    }
    const descendants = new Map<string, Set<string>>()
    function collect(id: string): Set<string> {
      const set = new Set<string>([id])
      for (const child of childrenOf.get(id) ?? []) {
        for (const d of collect(child)) set.add(d)
      }
      descendants.set(id, set)
      return set
    }
    for (const c of categories) if (!descendants.has(c.id)) collect(c.id)
    return descendants
  }, [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const allowedCategoryIds =
      categoryFilter === 'all'
        ? null
        : categoryDescendants.get(categoryFilter) ?? new Set([categoryFilter])

    return products
      .filter((p) => {
        if (deletedFilter === 'active' && p.deletedAt) return false
        if (deletedFilter === 'deleted' && !p.deletedAt) return false
        if (allowedCategoryIds && !allowedCategoryIds.has(p.categoryId)) return false
        if (!q) return true
        return (
          p.sku.toLowerCase().includes(q) ||
          p.nameBs.toLowerCase().includes(q) ||
          (p.nameEn ?? '').toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        const av = (a[sortKey] ?? '') as string
        const bv = (b[sortKey] ?? '') as string
        return String(av).localeCompare(String(bv), 'bs') * dir
      })
  }, [products, search, categoryFilter, deletedFilter, sortKey, sortDir, categoryDescendants])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openCreate() {
    setEditing(null)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  function openEdit(p: ProductDraft) {
    setEditing(p)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  const rootCategories = categories.filter((c) => rootCategoryIds.includes(c.id))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži po SKU, nazivu ili brandu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
        >
          <SelectTrigger className="min-w-[180px]">
            <SelectValue placeholder="Kategorija">
              {(v: string | null) => {
                if (!v || v === 'all') return 'Sve kategorije'
                return rootCategories.find((c) => c.id === v)?.label ?? 'Kategorija'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sve kategorije</SelectItem>
            {rootCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={deletedFilter}
          onValueChange={(v) => setDeletedFilter(v as DeletedFilter)}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue placeholder="Status">
              {(v: string | null) =>
                v === 'deleted' ? 'Obrisani' : v === 'all' ? 'Svi' : 'Aktivni'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktivni</SelectItem>
            <SelectItem value="deleted">Obrisani</SelectItem>
            <SelectItem value="all">Svi</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 size-4" />
            Uvoz CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Novi artikl
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="SKU" sortKey="sku" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHead label="Naziv" sortKey="nameBs" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <TableHead>Kategorija</TableHead>
              <SortableHead label="Brand" sortKey="brand" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <TableHead>Dobavljač</TableHead>
              <TableHead className="text-right">Dim (L×Š×V)</TableHead>
              <TableHead className="text-right">Težina</TableHead>
              <TableHead>Unos</TableHead>
              <TableHead className="text-right">Posada</TableHead>
              <TableHead className="w-[60px]" aria-label="Akcije" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  {products.length === 0
                    ? 'Nema artikala. Kreirajte prvi.'
                    : 'Nema rezultata za trenutne filtere.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className={p.deletedAt ? 'opacity-50' : ''}>
                  <TableCell className="font-mono font-medium">{p.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.nameBs}</div>
                    {p.nameEn ? (
                      <div className="text-xs text-muted-foreground">{p.nameEn}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.categoryLabel}</TableCell>
                  <TableCell>{p.brand || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{p.supplier || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDims(p)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWeight(p.weightKg)}</TableCell>
                  <TableCell>
                    {p.carryInDefault ? (
                      <Badge variant="secondary">
                        <PackageCheck className="mr-1 size-3" />
                        Da
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.crewSizeDefault}</TableCell>
                  <TableCell>
                    <ProductRowActions product={p} onEdit={openEdit} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Prikazano {filtered.length} od {products.length} artikala
      </p>

      <ProductFormDialog
        key={openCount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories}
      />

      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}

function formatDims(p: { lengthCm: number | null; widthCm: number | null; heightCm: number | null }) {
  const { lengthCm, widthCm, heightCm } = p
  if (lengthCm == null && widthCm == null && heightCm == null) return '—'
  return [lengthCm, widthCm, heightCm].map((v) => (v == null ? '?' : String(v))).join('×')
}

function formatWeight(w: number | null) {
  if (w == null) return '—'
  return `${w} kg`
}

type SortableHeadProps = {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
}

function SortableHead({ label, sortKey, currentKey, dir, onClick }: SortableHeadProps) {
  const active = currentKey === sortKey
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className="inline-flex items-center gap-1 font-medium text-foreground hover:text-foreground/80"
      >
        {label}
        <Icon className={`size-3.5 ${active ? 'text-foreground' : 'text-muted-foreground/60'}`} />
      </button>
    </TableHead>
  )
}
