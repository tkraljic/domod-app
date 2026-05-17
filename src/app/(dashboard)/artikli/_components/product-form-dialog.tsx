'use client'

import { useActionState, useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createProduct,
  updateProduct,
  type ProductFormState,
} from '@/app/actions/products'

export type ProductDraft = {
  id: string
  sku: string
  nameBs: string
  nameEn: string | null
  categoryId: string
  brand: string | null
  supplier: string | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  weightKg: number | null
  carryInDefault: boolean
  crewSizeDefault: number
  notes: string | null
}

export type CategoryOption = {
  id: string
  label: string
  depth: number
  parentId: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductDraft | null
  categories: CategoryOption[]
}

export function ProductFormDialog({ open, onOpenChange, product, categories }: Props) {
  const isEdit = Boolean(product)
  const action = isEdit ? updateProduct : createProduct
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    undefined,
  )

  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? '')

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? 'Artikl ažuriran' : 'Artikl kreiran')
      onOpenChange(false)
    } else if (state && !state.ok && state.formError) {
      toast.error(state.formError)
    }
  }, [state, isEdit, onOpenChange])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Uredi artikl' : 'Novi artikl'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Ažurirajte podatke o artiklu.' : 'Unesite podatke za novi artikl.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={product!.id} />}
          <input type="hidden" name="categoryId" value={categoryId} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="SKU"
              name="sku"
              required
              placeholder="npr. LG-F4V5"
              defaultValue={product?.sku}
              errors={fieldErrors?.sku}
              autoCapitalize="characters"
            />

            <div className="space-y-1.5">
              <Label htmlFor="categoryId-trigger">
                Kategorija <span className="text-red-500">*</span>
              </Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                <SelectTrigger id="categoryId-trigger" className="w-full">
                  <SelectValue placeholder="Odaberite kategoriju">
                    {(v: string | null) =>
                      v ? categories.find((c) => c.id === v)?.label ?? 'Odaberite kategoriju' : 'Odaberite kategoriju'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className={c.depth > 0 ? 'pl-4 text-muted-foreground' : 'font-medium'}>
                        {c.depth > 0 ? '└ ' : ''}
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.categoryId ? (
                <p className="text-xs text-red-600">{fieldErrors.categoryId[0]}</p>
              ) : null}
            </div>

            <FormField
              label="Naziv (BS)"
              name="nameBs"
              required
              defaultValue={product?.nameBs}
              errors={fieldErrors?.nameBs}
              className="sm:col-span-1"
            />

            <FormField
              label="Naziv (EN)"
              name="nameEn"
              defaultValue={product?.nameEn ?? ''}
              errors={fieldErrors?.nameEn}
            />

            <FormField
              label="Brand"
              name="brand"
              defaultValue={product?.brand ?? ''}
              errors={fieldErrors?.brand}
            />

            <FormField
              label="Dobavljač"
              name="supplier"
              defaultValue={product?.supplier ?? ''}
              errors={fieldErrors?.supplier}
            />
          </div>

          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dimenzije i težina
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FormField
                label="Dužina (cm)"
                name="lengthCm"
                type="number"
                step="0.1"
                min={0}
                defaultValue={product?.lengthCm ?? ''}
                errors={fieldErrors?.lengthCm}
              />
              <FormField
                label="Širina (cm)"
                name="widthCm"
                type="number"
                step="0.1"
                min={0}
                defaultValue={product?.widthCm ?? ''}
                errors={fieldErrors?.widthCm}
              />
              <FormField
                label="Visina (cm)"
                name="heightCm"
                type="number"
                step="0.1"
                min={0}
                defaultValue={product?.heightCm ?? ''}
                errors={fieldErrors?.heightCm}
              />
              <FormField
                label="Težina (kg)"
                name="weightKg"
                type="number"
                step="0.1"
                min={0}
                defaultValue={product?.weightKg ?? ''}
                errors={fieldErrors?.weightKg}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Veličina posade (default)"
              name="crewSizeDefault"
              type="number"
              min={1}
              max={10}
              required
              defaultValue={product?.crewSizeDefault ?? 1}
              errors={fieldErrors?.crewSizeDefault}
              hint="Preporučena veličina posade za unos"
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="carryInDefault"
                  defaultChecked={product?.carryInDefault ?? false}
                  className="size-4 rounded border-input accent-foreground"
                />
                Uobičajeno zahtijeva unos u stan
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Napomene</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={product?.notes ?? ''}
              rows={2}
            />
            {fieldErrors?.notes ? (
              <p className="text-xs text-red-600">{fieldErrors.notes[0]}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-2">
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

function FormField({ label, errors, hint, name, id, required, className, ...rest }: FormFieldProps) {
  const inputId = id ?? name
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input id={inputId} name={name} aria-invalid={errors ? true : undefined} {...rest} />
      {errors && errors.length > 0 ? (
        <p className="text-xs text-red-600">{errors[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
