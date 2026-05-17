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
  createVehicle,
  updateVehicle,
  type VehicleFormState,
} from '@/app/actions/vehicles'

export type VehicleDraft = {
  id: string
  name: string
  payloadKg: number
  volumeM3: number
  active: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: VehicleDraft | null
}

export function VehicleFormDialog({ open, onOpenChange, vehicle }: Props) {
  const isEdit = Boolean(vehicle)
  const action = isEdit ? updateVehicle : createVehicle
  const [state, formAction, pending] = useActionState<VehicleFormState, FormData>(
    action,
    undefined,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? 'Vozilo ažurirano' : 'Vozilo kreirano')
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
          <DialogTitle>{isEdit ? 'Uredi vozilo' : 'Novo vozilo'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Ažurirajte podatke o vozilu.' : 'Unesite podatke za novo vozilo.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          {isEdit && <input type="hidden" name="id" value={vehicle!.id} />}

          <FormField
            label="Naziv"
            name="name"
            placeholder="npr. Kombi 1, Kamion 1"
            defaultValue={vehicle?.name}
            required
            errors={fieldErrors?.name}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Nosivost (kg)"
              name="payloadKg"
              type="number"
              step="any"
              min={1}
              placeholder="1000"
              defaultValue={vehicle?.payloadKg}
              required
              errors={fieldErrors?.payloadKg}
            />
            <FormField
              label="Volumen (m³)"
              name="volumeM3"
              type="number"
              step="any"
              min={0.1}
              placeholder="8"
              defaultValue={vehicle?.volumeM3}
              required
              errors={fieldErrors?.volumeM3}
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={vehicle?.active ?? true}
                className="size-4 rounded border-input accent-foreground"
              />
              Aktivno (dostupno za dodjelu)
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
}

function FormField({ label, errors, name, id, ...rest }: FormFieldProps) {
  const inputId = id ?? name
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} name={name} aria-invalid={errors ? true : undefined} {...rest} />
      {errors && errors.length > 0 ? (
        <p className="text-xs text-red-600">{errors[0]}</p>
      ) : null}
    </div>
  )
}
