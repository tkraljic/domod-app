'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ProductOption = {
  id: string
  sku: string
  nameBs: string
  brand: string | null
  carryInDefault: boolean
  crewSizeDefault: number
}

type Props = {
  products: ProductOption[]
  value: string
  onChange: (productId: string, product: ProductOption | null) => void
  disabled?: boolean
}

export function ProductCombobox({ products, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const selected = products.find((p) => p.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {selected ? (
              <span className="truncate">
                <span className="font-mono text-xs text-muted-foreground">{selected.sku}</span>
                <span className="mx-1.5">·</span>
                <span>{selected.nameBs}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Odaberite artikl</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pretraži po SKU, nazivu ili brandu..." />
          <CommandList>
            <CommandEmpty>Nema rezultata.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.sku} ${p.nameBs} ${p.brand ?? ''}`}
                  onSelect={() => {
                    onChange(p.id, p)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === p.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                      <span className="mx-1.5">·</span>
                      {p.nameBs}
                    </span>
                    {p.brand ? (
                      <span className="text-xs text-muted-foreground">{p.brand}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
