'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
  createDelivery,
  updateDelivery,
  type DeliveryFormState,
} from '@/app/actions/deliveries'
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/lib/schemas/delivery'
import { ProductCombobox, type ProductOption } from './product-combobox'
import { AddressAutocomplete } from './address-autocomplete'
import { cn } from '@/lib/utils'

const TIME_PRESETS = [
  { from: '08:00', to: '10:00' },
  { from: '10:00', to: '12:00' },
  { from: '12:00', to: '14:00' },
  { from: '14:00', to: '16:00' },
  { from: '16:00', to: '18:00' },
]

function parseTimeRange(input: string | null | undefined): { from: string; to: string } {
  if (!input) return { from: '', to: '' }
  const m = input.match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/)
  if (m) return { from: m[1], to: m[2] }
  const single = input.match(/^(\d{2}:\d{2})$/)
  if (single) return { from: single[1], to: '' }
  return { from: '', to: '' }
}

function formatTimeRange(from: string, to: string): string {
  if (!from && !to) return ''
  if (from && to) return `${from}–${to}`
  return from || to
}

export type DeliveryDraft = {
  id: string
  date: string
  channel: 'branch' | 'web'
  branchId: string | null
  vehicleId: string | null
  driverId: string | null
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  latitude: number | null
  longitude: number | null
  deliveryTime: string | null
  carryInRequired: boolean
  crewSizeRequired: number
  status: DeliveryStatus
  notes: string | null
  items: {
    productId: string
    quantity: number
    notes: string | null
  }[]
}

export type BranchOption = {
  id: string
  code: string
  name: string
  isWeb: boolean
}

export type VehicleOption = {
  id: string
  name: string
  payloadKg: number
  volumeM3: number
}

export type DriverOption = {
  id: string
  fullName: string
}

type ItemRow = {
  key: string
  productId: string
  quantity: number
  notes: string
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: DeliveryDraft | null
  defaultDate: string
  branches: BranchOption[]
  products: ProductOption[]
  vehicles: VehicleOption[]
  drivers: DriverOption[]
}

function makeKey() {
  return Math.random().toString(36).slice(2)
}

const VEHICLE_NONE = '__none__'
const DRIVER_NONE = '__none__'

export function DeliveryFormDialog({
  open,
  onOpenChange,
  delivery,
  defaultDate,
  branches,
  products,
  vehicles,
  drivers,
}: Props) {
  const isEdit = Boolean(delivery)
  const action = isEdit ? updateDelivery : createDelivery
  const [state, formAction, pending] = useActionState<DeliveryFormState, FormData>(
    action,
    undefined,
  )

  const [channel, setChannel] = useState<'branch' | 'web'>(delivery?.channel ?? 'branch')
  const [branchId, setBranchId] = useState<string>(delivery?.branchId ?? '')
  const [vehicleId, setVehicleId] = useState<string>(delivery?.vehicleId ?? '')
  const [driverId, setDriverId] = useState<string>(delivery?.driverId ?? '')
  const [status, setStatus] = useState<DeliveryStatus>(delivery?.status ?? 'planned')
  const [address, setAddress] = useState(delivery?.customerAddress ?? '')
  const [latitude, setLatitude] = useState<number | null>(delivery?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(delivery?.longitude ?? null)
  const initTime = parseTimeRange(delivery?.deliveryTime)
  const [timeFrom, setTimeFrom] = useState(initTime.from)
  const [timeTo, setTimeTo] = useState(initTime.to)
  const combinedTime = formatTimeRange(timeFrom, timeTo)
  const [items, setItems] = useState<ItemRow[]>(() =>
    delivery
      ? delivery.items.map((it) => ({
          key: makeKey(),
          productId: it.productId,
          quantity: it.quantity,
          notes: it.notes ?? '',
        }))
      : [{ key: makeKey(), productId: '', quantity: 1, notes: '' }],
  )

  const physicalBranches = useMemo(() => branches.filter((b) => !b.isWeb), [branches])

  useEffect(() => {
    if (state?.ok) {
      toast.success(isEdit ? 'Dostava ažurirana' : 'Dostava kreirana')
      onOpenChange(false)
    } else if (state && !state.ok && state.formError) {
      toast.error(state.formError)
    }
  }, [state, isEdit, onOpenChange])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  function addItem() {
    setItems((s) => [...s, { key: makeKey(), productId: '', quantity: 1, notes: '' }])
  }

  function removeItem(key: string) {
    setItems((s) => (s.length > 1 ? s.filter((r) => r.key !== key) : s))
  }

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((s) => s.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const itemsForSubmit = items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    notes: it.notes,
  }))

  const itemsError = fieldErrors?.items?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Uredi dostavu' : 'Nova dostava'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Ažurirajte podatke o dostavi.' : 'Unesite podatke za novu dostavu.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={delivery!.id} />}
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="branchId" value={branchId} />
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="driverId" value={driverId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="deliveryTime" value={combinedTime} />
          <input type="hidden" name="customerAddress" value={address} />
          <input type="hidden" name="latitude" value={latitude ?? ''} />
          <input type="hidden" name="longitude" value={longitude ?? ''} />
          <input type="hidden" name="itemsJson" value={JSON.stringify(itemsForSubmit)} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              label="Datum"
              name="date"
              type="date"
              required
              defaultValue={delivery?.date ?? defaultDate}
              errors={fieldErrors?.date}
            />

            <div className="space-y-1.5">
              <Label>Kanal</Label>
              <div className="inline-flex rounded-lg border p-0.5">
                <button
                  type="button"
                  onClick={() => setChannel('branch')}
                  className={`rounded-md px-3 py-1 text-sm ${
                    channel === 'branch' ? 'bg-foreground text-background' : 'text-muted-foreground'
                  }`}
                >
                  Poslovnica
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('web')}
                  className={`rounded-md px-3 py-1 text-sm ${
                    channel === 'web' ? 'bg-foreground text-background' : 'text-muted-foreground'
                  }`}
                >
                  Web
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus((v ?? 'planned') as DeliveryStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? STATUS_LABELS[v as DeliveryStatus] ?? v : 'Status'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {channel === 'branch' && (
            <div className="space-y-1.5">
              <Label>
                Poslovnica <span className="text-red-500">*</span>
              </Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Odaberite poslovnicu">
                    {(v: string | null) => {
                      const b = v ? physicalBranches.find((x) => x.id === v) : null
                      return b ? `${b.code} — ${b.name}` : 'Odaberite poslovnicu'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {physicalBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{b.code}</span>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.branchId ? (
                <p className="text-xs text-red-600">{fieldErrors.branchId[0]}</p>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Kupac"
              name="customerName"
              required
              defaultValue={delivery?.customerName}
              errors={fieldErrors?.customerName}
            />
            <FormField
              label="Telefon"
              name="customerPhone"
              defaultValue={delivery?.customerPhone ?? ''}
              errors={fieldErrors?.customerPhone}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Adresa</Label>
            <AddressAutocomplete
              value={address}
              latitude={latitude}
              longitude={longitude}
              onChange={(next) => {
                setAddress(next.address)
                setLatitude(next.latitude)
                setLongitude(next.longitude)
              }}
              placeholder="Počnite kucati adresu (npr. Titova 12, Sarajevo)..."
            />
            {fieldErrors?.customerAddress ? (
              <p className="text-xs text-red-600">{fieldErrors.customerAddress[0]}</p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Termin dostave</Label>
              {(timeFrom || timeTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setTimeFrom('')
                    setTimeTo('')
                  }}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Očisti
                </button>
              )}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((p) => {
                const active = timeFrom === p.from && timeTo === p.to
                return (
                  <button
                    key={`${p.from}-${p.to}`}
                    type="button"
                    onClick={() => {
                      setTimeFrom(p.from)
                      setTimeTo(p.to)
                    }}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p.from}–{p.to}
                  </button>
                )
              })}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Od</span>
                <Input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                />
              </div>
              <span className="pb-2 text-muted-foreground">–</span>
              <div className="flex-1 space-y-1">
                <span className="text-xs text-muted-foreground">Do</span>
                <Input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                />
              </div>
            </div>
            {fieldErrors?.deliveryTime ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.deliveryTime[0]}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vozilo</Label>
              <Select
                value={vehicleId || VEHICLE_NONE}
                onValueChange={(v) => setVehicleId(v === VEHICLE_NONE ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bez vozila">
                    {(v: string | null) => {
                      if (!v || v === VEHICLE_NONE) return 'Bez vozila'
                      const veh = vehicles.find((x) => x.id === v)
                      return veh ? veh.name : 'Bez vozila'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VEHICLE_NONE}>
                    <span className="text-muted-foreground">Bez vozila</span>
                  </SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {v.payloadKg}kg · {v.volumeM3}m³
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vozač</Label>
              <Select
                value={driverId || DRIVER_NONE}
                onValueChange={(v) => setDriverId(v === DRIVER_NONE ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bez vozača">
                    {(v: string | null) => {
                      if (!v || v === DRIVER_NONE) return 'Bez vozača'
                      const drv = drivers.find((x) => x.id === v)
                      return drv ? drv.fullName : 'Bez vozača'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DRIVER_NONE}>
                    <span className="text-muted-foreground">Bez vozača</span>
                  </SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Veličina posade"
              name="crewSizeRequired"
              type="number"
              min={1}
              max={10}
              required
              defaultValue={delivery?.crewSizeRequired ?? 1}
              errors={fieldErrors?.crewSizeRequired}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="carryInRequired"
                  defaultChecked={delivery?.carryInRequired ?? false}
                  className="size-4 rounded border-input accent-foreground"
                />
                Potreban unos u stan
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>
                Artikli <span className="text-red-500">*</span>
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-1 size-3.5" />
                Dodaj artikl
              </Button>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
              {items.map((row, idx) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_90px_1fr_auto] items-start gap-2"
                >
                  <div>
                    <ProductCombobox
                      products={products}
                      value={row.productId}
                      onChange={(pid, prod) => {
                        updateItem(row.key, {
                          productId: pid,
                          quantity: row.quantity || prod?.crewSizeDefault || 1,
                        })
                      }}
                    />
                    {fieldErrors?.[`items.${idx}.productId`]?.[0] ? (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`items.${idx}.productId`][0]}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={row.quantity}
                    onChange={(e) =>
                      updateItem(row.key, { quantity: Number(e.target.value) || 1 })
                    }
                    aria-label="Količina"
                  />
                  <Input
                    type="text"
                    placeholder="Napomena (opcionalno)"
                    value={row.notes}
                    onChange={(e) => updateItem(row.key, { notes: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(row.key)}
                    disabled={items.length === 1}
                    aria-label="Ukloni artikl"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {itemsError ? (
              <p className="mt-1 text-xs text-red-600">{itemsError}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Napomene za dostavu</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={delivery?.notes ?? ''}
              rows={2}
            />
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
              {pending ? 'Spremanje...' : isEdit ? 'Spasi izmjene' : 'Kreiraj dostavu'}
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
