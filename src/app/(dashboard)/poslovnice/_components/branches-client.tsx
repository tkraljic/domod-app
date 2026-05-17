'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Globe, Plus, Search, Store } from 'lucide-react'
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
import { BranchFormDialog, type BranchDraft } from './branch-form-dialog'
import { BranchRowActions } from './branch-row-actions'

type SortKey = 'code' | 'name' | 'sortOrder' | 'createdAt'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'physical' | 'web'

type Props = {
  branches: (BranchDraft & { createdAt: string })[]
}

export function BranchesClient({ branches }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('sortOrder')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BranchDraft | null>(null)
  const [openCount, setOpenCount] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return branches
      .filter((b) => {
        if (statusFilter === 'active' && !b.active) return false
        if (statusFilter === 'inactive' && b.active) return false
        if (typeFilter === 'web' && !b.isWeb) return false
        if (typeFilter === 'physical' && b.isWeb) return false
        if (!q) return true
        return (
          b.code.toLowerCase().includes(q) ||
          b.name.toLowerCase().includes(q) ||
          (b.address ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        const av = a[sortKey]
        const bv = b[sortKey]
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av ?? '').localeCompare(String(bv ?? ''), 'bs') * dir
      })
  }, [branches, search, statusFilter, typeFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openCreate() {
    setEditing(null)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  function openEdit(branch: BranchDraft) {
    setEditing(branch)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži po kodu, nazivu ili adresi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="Status">
              {(v: string | null) =>
                v === 'active' ? 'Aktivne' : v === 'inactive' ? 'Neaktivne' : 'Svi statusi'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            <SelectItem value="active">Aktivne</SelectItem>
            <SelectItem value="inactive">Neaktivne</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="Tip">
              {(v: string | null) =>
                v === 'physical' ? 'Fizičke' : v === 'web' ? 'Web' : 'Svi tipovi'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi tipovi</SelectItem>
            <SelectItem value="physical">Fizičke</SelectItem>
            <SelectItem value="web">Web</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Nova poslovnica
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Kod" sortKey="code" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHead label="Naziv" sortKey="name" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <TableHead>Adresa</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Status</TableHead>
              <SortableHead label="Redoslijed" sortKey="sortOrder" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <TableHead className="w-[60px]" aria-label="Akcije" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {branches.length === 0
                    ? 'Nema poslovnica. Kreirajte prvu.'
                    : 'Nema rezultata za trenutne filtere.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((branch) => (
                <TableRow key={branch.id} className={branch.active ? '' : 'opacity-60'}>
                  <TableCell className="font-mono font-medium">{branch.code}</TableCell>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-muted-foreground">{branch.address || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{branch.phone || '—'}</TableCell>
                  <TableCell>
                    {branch.isWeb ? (
                      <Badge variant="secondary">
                        <Globe className="mr-1 size-3" />
                        Web
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Store className="mr-1 size-3" />
                        Fizička
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {branch.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Aktivna
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Neaktivna
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{branch.sortOrder}</TableCell>
                  <TableCell>
                    <BranchRowActions branch={branch} onEdit={openEdit} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Prikazano {filtered.length} od {branches.length} poslovnica
      </p>

      <BranchFormDialog
        key={openCount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
      />
    </>
  )
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
