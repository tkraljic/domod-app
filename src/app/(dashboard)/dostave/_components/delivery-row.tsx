'use client'

import { Fragment, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  deleteDelivery,
  updateDeliveryStatus,
} from '@/app/actions/deliveries'
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/lib/schemas/delivery'
import type { DeliveryDraft } from './delivery-form-dialog'
import type { Conflict } from '../_lib/conflicts'

export type DeliveryRowData = DeliveryDraft & {
  sequenceNumber: number
  vehicleName: string | null
  driverName: string | null
  conflicts: Conflict[]
  itemsDetail: {
    productId: string
    sku: string
    nameBs: string
    quantity: number
    notes: string | null
  }[]
}

export const DELIVERY_TABLE_COLUMN_COUNT = 11

type Props = {
  delivery: DeliveryRowData
  onEdit: (d: DeliveryDraft) => void
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

const STATUS_CLASSES: Record<DeliveryStatus, string> = {
  planned: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
  in_transit: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  delivered: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  failed: 'bg-red-100 text-red-800 hover:bg-red-100',
  rescheduled: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
}

function formatConflict(c: Conflict): string {
  if (c.type === 'vehicle_time_overlap') {
    return `Vozilo ${c.vehicleName} preklapa termin sa dostavom #${c.otherSeq}.`
  }
  return `Vozilo ${c.vehicleName} preopterećeno (težina ${c.weightPct}%, volumen ${c.volumePct}%).`
}

function formatAddressLine(d: DeliveryRowData): string {
  const parts: string[] = []
  if (d.customerAddress) parts.push(d.customerAddress)
  if (d.customerHouseNumber) parts.push(`br. ${d.customerHouseNumber}`)
  if (d.customerFloor) parts.push(`sprat ${d.customerFloor}`)
  if (d.customerApartmentNumber) parts.push(`stan ${d.customerApartmentNumber}`)
  return parts.join(', ')
}

function formatItemsSummary(items: DeliveryRowData['itemsDetail']): string {
  if (items.length === 0) return '—'
  const head = items
    .slice(0, 2)
    .map((it) => `${it.nameBs} ×${it.quantity}`)
    .join(', ')
  if (items.length <= 2) return head
  return `${head} (+${items.length - 2})`
}

export function DeliveryRow({ delivery, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleStatus(next: DeliveryStatus) {
    startTransition(async () => {
      const res = await updateDeliveryStatus(delivery.id, next)
      if (res.ok) toast.success(`Status: ${STATUS_LABELS[next]}`)
      else toast.error(res.error ?? 'Greška.')
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteDelivery(delivery.id)
      if (res.ok) {
        toast.success('Dostava obrisana')
        setConfirmDelete(false)
      } else {
        toast.error(res.error ?? 'Greška.')
      }
    })
  }

  const conflictMessages = delivery.conflicts.map(formatConflict)
  const hasConflicts = conflictMessages.length > 0
  const itemsSummary = formatItemsSummary(delivery.itemsDetail)
  const addressLine = formatAddressLine(delivery)
  const rowTint = hasConflicts ? 'bg-amber-50/60 hover:bg-amber-50' : ''

  return (
    <Fragment>
      <TableRow className={rowTint} aria-expanded={expanded}>
        <TableCell className="w-[1%] pr-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={expanded ? 'Sažmi' : 'Proširi'}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <span className="font-mono text-sm font-medium tabular-nums">
              #{delivery.sequenceNumber}
            </span>
            {hasConflicts ? (
              <span
                title={conflictMessages.join('\n')}
                className="inline-flex items-center text-amber-700"
                aria-label="Konflikt"
              >
                <AlertTriangle className="size-3.5" />
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground tabular-nums">
          {delivery.deliveryTime ?? '—'}
        </TableCell>
        <TableCell className="font-medium">{delivery.customerName}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {delivery.customerPhone ?? '—'}
        </TableCell>
        <TableCell className="text-sm">
          <div className="flex items-center gap-1.5">
            <span className="block max-w-[280px] truncate" title={addressLine || undefined}>
              {addressLine || '—'}
            </span>
            {delivery.carryInRequired ? (
              <span
                title="Unos u stan"
                className="inline-flex shrink-0 items-center text-emerald-700"
                aria-label="Unos u stan"
              >
                <PackageCheck className="size-3.5" />
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          <span className="block max-w-[260px] truncate" title={itemsSummary}>
            {itemsSummary}
          </span>
        </TableCell>
        <TableCell className="text-center text-sm tabular-nums">
          {delivery.crewSizeRequired}
        </TableCell>
        <TableCell className="text-sm">{delivery.vehicleName ?? '—'}</TableCell>
        <TableCell className="text-sm">{delivery.driverName ?? '—'}</TableCell>
        <TableCell className="w-[1%]">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 ${STATUS_CLASSES[delivery.status]}`}
                  disabled={pending}
                >
                  {STATUS_LABELS[delivery.status]}
                  <ChevronDown className="ml-1 size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Promijeni status</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {DELIVERY_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={s === delivery.status}
                >
                  {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
        <TableCell className="w-[1%] text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Akcije">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(delivery)}>
                <Pencil className="mr-2 size-4" />
                Uredi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Obriši
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow className={hasConflicts ? 'bg-amber-50/60' : 'bg-muted/20'}>
          <TableCell colSpan={DELIVERY_TABLE_COLUMN_COUNT} className="whitespace-normal p-0">
            <div className="px-4 py-2.5">
              <ul className="space-y-1">
                {delivery.itemsDetail.map((it, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{it.sku}</span>
                    <span className="flex-1">{it.nameBs}</span>
                    <span className="tabular-nums text-muted-foreground">×{it.quantity}</span>
                    {it.notes ? (
                      <Badge variant="outline" className="text-xs">
                        {it.notes}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
              {hasConflicts ? (
                <div className="mt-2 border-t pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <AlertTriangle className="size-3.5" />
                    Mogući konflikt:
                  </div>
                  <ul className="mt-1 ml-5 list-disc space-y-0.5 text-xs text-amber-800">
                    {conflictMessages.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {delivery.notes ? (
                <p className="mt-2 border-t pt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Napomena:</span>{' '}
                  {delivery.notes}
                </p>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Obrisati dostavu?</DialogTitle>
            <DialogDescription>
              Trajno brišete dostavu #{delivery.sequenceNumber} za{' '}
              <strong>{delivery.customerName}</strong>. Ova radnja se ne može
              poništiti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              Odustani
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  )
}
