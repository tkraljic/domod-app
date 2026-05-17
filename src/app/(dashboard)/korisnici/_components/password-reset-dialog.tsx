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
import { resetUserPassword, type UserFormState } from '@/app/actions/users'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  fullName: string
}

export function PasswordResetDialog({ open, onOpenChange, userId, fullName }: Props) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    resetUserPassword,
    undefined,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success('Lozinka resetovana')
      onOpenChange(false)
    } else if (state && !state.ok && state.formError) {
      toast.error(state.formError)
    }
  }, [state, onOpenChange])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset lozinke</DialogTitle>
          <DialogDescription>
            Postavljanje nove lozinke za <strong>{fullName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={userId} />
          <div className="space-y-1.5">
            <Label htmlFor="password">Nova lozinka</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={fieldErrors?.password ? true : undefined}
            />
            {fieldErrors?.password ? (
              <p className="text-xs text-red-600">{fieldErrors.password[0]}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Minimalno 8 znakova.</p>
            )}
          </div>
          <DialogFooter className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Odustani
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Spremanje...' : 'Resetuj'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
