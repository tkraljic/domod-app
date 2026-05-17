'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Truck } from 'lucide-react'
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
import { VehicleFormDialog, type VehicleDraft } from './vehicle-form-dialog'
import { VehicleRowActions } from './vehicle-row-actions'

type StatusFilter = 'all' | 'active' | 'inactive'

type VehicleRow = VehicleDraft & {
  deliveriesCount: number
  createdAt: string
}

type Props = {
  vehicles: VehicleRow[]
}

export function VehiclesClient({ vehicles }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleDraft | null>(null)
  const [openCount, setOpenCount] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (statusFilter === 'active' && !v.active) return false
      if (statusFilter === 'inactive' && v.active) return false
      if (!q) return true
      return v.name.toLowerCase().includes(q)
    })
  }, [vehicles, search, statusFilter])

  function openCreate() {
    setEditing(null)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  function openEdit(v: VehicleDraft) {
    setEditing(v)
    setOpenCount((c) => c + 1)
    setDialogOpen(true)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži po nazivu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="min-w-[160px]">
            <SelectValue placeholder="Status">
              {(v: string | null) =>
                v === 'active' ? 'Aktivna' : v === 'inactive' ? 'Neaktivna' : 'Svi statusi'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            <SelectItem value="active">Aktivna</SelectItem>
            <SelectItem value="inactive">Neaktivna</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Novo vozilo
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv</TableHead>
              <TableHead className="text-right">Nosivost (kg)</TableHead>
              <TableHead className="text-right">Volumen (m³)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Dostave (ukupno)</TableHead>
              <TableHead className="w-[60px]" aria-label="Akcije" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {vehicles.length === 0
                    ? 'Nema vozila. Kreirajte prvo.'
                    : 'Nema rezultata za trenutne filtere.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id} className={v.active ? '' : 'opacity-60'}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      {v.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{v.payloadKg}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.volumeM3}</TableCell>
                  <TableCell>
                    {v.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Aktivno
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Neaktivno
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.deliveriesCount}
                  </TableCell>
                  <TableCell>
                    <VehicleRowActions vehicle={v} onEdit={openEdit} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Prikazano {filtered.length} od {vehicles.length} vozila
      </p>

      <VehicleFormDialog
        key={openCount}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editing}
      />
    </>
  )
}
