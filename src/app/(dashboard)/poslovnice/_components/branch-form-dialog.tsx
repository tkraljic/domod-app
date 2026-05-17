'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createBranch,
  updateBranch,
  type BranchFormState,
} from '@/app/actions/branches'

export type BranchDraft = {
  id: string
  code: string
  name: string
  address: string | null
  phone: string | null
  isWeb: boolean
  active: boolean
  sortOrder: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: BranchDraft | null
}

export function BranchFormDialog({ open, onOpenChange, branch }: Props) {
  const isEdit = Boolean(branch)
  const action = isEdit ? updateBranch : createBranch
  const [state, formAction, pending] = useActionState<BranchFormState, FormData>(
    action,
    undefined,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? 'Poslovnica ažurirana' : 'Poslovnica kreirana')
      onOpenChange(false)
    } else if (state && !state.ok && state.formError) {
      toast.error(state.formError)
    }
  }, [state, isEdit, onOpenChange])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Uredi poslovnicu' : 'Nova poslovnica'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Ažurirajte podatke o poslovnici.'
              : 'Unesite podatke za novu poslovnicu.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          {isEdit && <input type="hidden" name="id" value={branch!.id} />}

          <FormField
            label="Kod"
            name="code"
            placeholder="npr. SRJ"
            defaultValue={branch?.code}
            required
            autoCapitalize="characters"
            errors={fieldErrors?.code}
            hint="Velika slova i brojevi (2–10 znakova)"
          />

          <FormField
            label="Naziv"
            name="name"
            placeholder="npr. Sarajevo"
            defaultValue={branch?.name}
            required
            errors={fieldErrors?.name}
          />

          <FormField
            label="Adresa"
            name="address"
            defaultValue={branch?.address ?? ''}
            errors={fieldErrors?.address}
          />

          <FormField
            label="Telefon"
            name="phone"
            defaultValue={branch?.phone ?? ''}
            errors={fieldErrors?.phone}
          />

          <FormField
            label="Redoslijed"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={branch?.sortOrder ?? 0}
            errors={fieldErrors?.sortOrder}
            hint="Manji broj = viši prikaz u listama"
          />

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isWeb"
                defaultChecked={branch?.isWeb ?? false}
                className="size-4 rounded border-input accent-foreground"
              />
              Web narudžbe
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={branch?.active ?? true}
                className="size-4 rounded border-input accent-foreground"
              />
              Aktivna
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Odustani
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Spremanje...' : isEdit ? 'Spasi izmjene' : 'Kreiraj'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type FormFieldProps = React.ComponentProps<'input'> & {
  label: string
  errors?: string[]
  hint?: string
}

function FormField({ label, errors, hint, name, id, className, ...rest }: FormFieldProps) {
  const inputId = id ?? name
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} name={name} aria-invalid={errors ? true : undefined} {...rest} />
      {errors && errors.length > 0 ? (
        <p className="text-xs text-red-600">{errors[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
