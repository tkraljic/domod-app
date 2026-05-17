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
import { createUser, updateUser, type UserFormState } from '@/app/actions/users'
import { USER_ROLES, type UserRole } from '@/lib/schemas/user'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  planner: 'Planer',
  driver: 'Vozač',
  viewer: 'Pregled',
}

export type UserDraft = {
  id: string
  email: string
  fullName: string
  role: string
  active: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserDraft | null
  isSelf: boolean
}

export function UserFormDialog({ open, onOpenChange, user, isSelf }: Props) {
  const isEdit = Boolean(user)
  const action = isEdit ? updateUser : createUser
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    action,
    undefined,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? 'Korisnik ažuriran' : 'Korisnik kreiran')
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
          <DialogTitle>{isEdit ? 'Uredi korisnika' : 'Novi korisnik'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Ažurirajte podatke o korisniku. Lozinku resetujte zasebno.'
              : 'Unesite podatke za novog korisnika i početnu lozinku.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          {isEdit && <input type="hidden" name="id" value={user!.id} />}

          <FormField
            label="Email"
            name="email"
            type="email"
            required
            defaultValue={user?.email}
            errors={fieldErrors?.email}
          />

          <FormField
            label="Ime i prezime"
            name="fullName"
            required
            defaultValue={user?.fullName}
            errors={fieldErrors?.fullName}
          />

          <div className="space-y-1.5">
            <Label htmlFor="role">Uloga</Label>
            <select
              id="role"
              name="role"
              defaultValue={user?.role ?? 'viewer'}
              disabled={isSelf}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            {isSelf ? (
              <p className="text-xs text-muted-foreground">
                Ne možete sebi promijeniti rolu.
              </p>
            ) : null}
            {fieldErrors?.role ? (
              <p className="text-xs text-red-600">{fieldErrors.role[0]}</p>
            ) : null}
          </div>

          {!isEdit ? (
            <FormField
              label="Početna lozinka"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              errors={fieldErrors?.password}
              hint="Minimalno 8 znakova. Korisnik je može promijeniti kasnije."
            />
          ) : null}

          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={user?.active ?? true}
                disabled={isSelf}
                className="size-4 rounded border-input accent-foreground disabled:opacity-50"
              />
              Aktivan {isSelf ? '(ne možete sebe deaktivirati)' : ''}
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

function FormField({ label, errors, hint, name, id, ...rest }: FormFieldProps) {
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
