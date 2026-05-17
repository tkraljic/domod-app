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
import { deleteBranch, toggleBranchActive } from '@/app/actions/branches'
import type { BranchDraft } from './branch-form-dialog'

type Props = {
  branch: BranchDraft
  onEdit: (branch: BranchDraft) => void
}

export function BranchRowActions({ branch, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleBranchActive(branch.id)
      if (res.ok) {
        toast.success(branch.active ? 'Poslovnica deaktivirana' : 'Poslovnica aktivirana')
      } else {
        toast.error(res.error ?? 'Greška prilikom promjene statusa.')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteBranch(branch.id)
      if (res.ok) {
        toast.success('Poslovnica obrisana')
        setConfirmOpen(false)
      } else {
        toast.error(res.error ?? 'Greška prilikom brisanja.')
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
          <DropdownMenuItem onClick={() => onEdit(branch)}>
            <Pencil className="mr-2 size-4" />
            Uredi
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggle} disabled={pending}>
            <Power className="mr-2 size-4" />
            {branch.active ? 'Deaktiviraj' : 'Aktiviraj'}
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
            <DialogTitle>Obrisati poslovnicu?</DialogTitle>
            <DialogDescription>
              Ova radnja će trajno obrisati poslovnicu <strong>{branch.name}</strong> ({branch.code}).
              Ako poslovnica ima povezane dostave, brisanje neće biti moguće — koristite deaktivaciju.
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
