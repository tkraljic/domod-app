'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteVehicle, toggleVehicleActive } from '@/app/actions/vehicles'
import type { VehicleDraft } from './vehicle-form-dialog'

type Props = {
  vehicle: VehicleDraft & { deliveriesCount: number }
  onEdit: (v: VehicleDraft) => void
}

export function VehicleRowActions({ vehicle, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleVehicleActive(vehicle.id)
      if (res.ok) {
        toast.success(vehicle.active ? 'Vozilo deaktivirano' : 'Vozilo aktivirano')
      } else {
        toast.error(res.error ?? 'Greška.')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteVehicle(vehicle.id)
      if (res.ok) {
        toast.success('Vozilo obrisano')
        setConfirmOpen(false)
      } else {
        toast.error(res.error ?? 'Greška.')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Akcije">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onEdit(vehicle)}>
            <Pencil className="mr-2 size-4" />
            Uredi
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggle} disabled={pending}>
            <Power className="mr-2 size-4" />
            {vehicle.active ? 'Deaktiviraj' : 'Aktiviraj'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            <Trash2 className="mr-2 size-4" />
            Obriši
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Obrisati vozilo?</DialogTitle>
            <DialogDescription>
              Ova radnja će trajno obrisati vozilo <strong>{vehicle.name}</strong>.
              {vehicle.deliveriesCount > 0
                ? ` Ovo vozilo je dodijeljeno na ${vehicle.deliveriesCount} dostav${
                    vehicle.deliveriesCount === 1 ? 'i' : 'a'
                  } — brisanje neće biti moguće. Koristite deaktivaciju.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Odustani
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? 'Brisanje...' : 'Obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
