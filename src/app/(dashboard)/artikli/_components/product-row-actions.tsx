'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
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
import {
  hardDeleteProduct,
  restoreProduct,
  softDeleteProduct,
} from '@/app/actions/products'
import type { ProductDraft } from './product-form-dialog'

type Props = {
  product: ProductDraft & { deletedAt: string | null }
  onEdit: (product: ProductDraft) => void
}

export function ProductRowActions({ product, onEdit }: Props) {
  const [confirmHardDelete, setConfirmHardDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const isDeleted = Boolean(product.deletedAt)

  function handleSoftDelete() {
    startTransition(async () => {
      const res = await softDeleteProduct(product.id)
      if (res.ok) toast.success('Artikl obrisan (moguće vratiti)')
      else toast.error(res.error ?? 'Greška.')
    })
  }

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreProduct(product.id)
      if (res.ok) toast.success('Artikl vraćen')
      else toast.error(res.error ?? 'Greška.')
    })
  }

  function handleHardDelete() {
    startTransition(async () => {
      const res = await hardDeleteProduct(product.id)
      if (res.ok) {
        toast.success('Artikl trajno obrisan')
        setConfirmHardDelete(false)
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
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onEdit(product)} disabled={isDeleted}>
            <Pencil className="mr-2 size-4" />
            Uredi
          </DropdownMenuItem>

          {isDeleted ? (
            <DropdownMenuItem onClick={handleRestore} disabled={pending}>
              <RotateCcw className="mr-2 size-4" />
              Vrati iz obrisanih
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleSoftDelete} disabled={pending}>
              <XCircle className="mr-2 size-4" />
              Obriši (može se vratiti)
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmHardDelete(true)}
            disabled={pending}
          >
            <Trash2 className="mr-2 size-4" />
            Trajno obriši
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmHardDelete} onOpenChange={setConfirmHardDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trajno obrisati artikl?</DialogTitle>
            <DialogDescription>
              Ova radnja trajno briše artikl <strong>{product.nameBs}</strong> ({product.sku}).
              Ako je artikl korišten u dostavama, trajno brisanje neće biti moguće — koristite običnu
              opciju &quot;Obriši&quot; koja se može vratiti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmHardDelete(false)}
              disabled={pending}
            >
              Odustani
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleHardDelete}
              disabled={pending}
            >
              {pending ? 'Brisanje...' : 'Trajno obriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
