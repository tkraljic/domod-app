'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Upload, FileText } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { importProducts, type ImportFormState } from '@/app/actions/products-import'

const SAMPLE = `sku,nameBs,nameEn,categoryNameBs,brand,supplier,lengthCm,widthCm,heightCm,weightKg,carryInDefault,crewSizeDefault,notes
LG-WM-9KG,LG mašina za pranje 9kg,LG Washing Machine 9kg,Mašine za pranje,LG,LG Bosnia,60,60,85,70,1,2,
SAMSUNG-RB34,Samsung frižider RB34,Samsung Fridge RB34,Frižideri,Samsung,Samsung Adriatic,60,66,185,80,1,2,Combi`

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportCsvDialog({ open, onOpenChange }: Props) {
  const [state, formAction, pending] = useActionState<ImportFormState, FormData>(
    importProducts,
    undefined,
  )
  const [csv, setCsv] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state && state.ok) {
      const errs = state.errors.length
      if (errs === 0) {
        toast.success(
          `Uvoz završen — kreirano ${state.created}, ažurirano ${state.updated}.`,
        )
      } else {
        toast.warning(
          `Uvoz završen sa ${errs} ${errs === 1 ? 'greškom' : 'grešaka'}. Vidi detalje.`,
        )
      }
    } else if (state && !state.ok) {
      toast.error(state.formError)
    }
  }, [state])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
  }

  function close() {
    setCsv('')
    if (fileRef.current) fileRef.current.value = ''
    onOpenChange(false)
  }

  const summary = state && state.ok ? state : null

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uvoz artikala iz CSV-a</DialogTitle>
          <DialogDescription>
            Header obavezan. Polja: sku, nameBs, categoryNameBs (ostalo opciono).
            Postojeći SKU se ažurira; novi se kreira.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="csv" value={csv} />

          <div className="space-y-1.5">
            <Label htmlFor="csv-file">Učitaj CSV datoteku</Label>
            <div className="flex items-center gap-2">
              <input
                id="csv-file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="csv-text">ili zalijepi sadržaj</Label>
              <button
                type="button"
                onClick={() => setCsv(SAMPLE)}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Učitaj primjer
              </button>
            </div>
            <Textarea
              id="csv-text"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder="sku,nameBs,categoryNameBs,..."
            />
            {csv ? (
              <p className="text-xs text-muted-foreground">
                <FileText className="mr-1 inline size-3" />
                {csv.split(/\r?\n/).filter(Boolean).length} redova (uključujući header)
              </p>
            ) : null}
          </div>

          {summary ? (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <SummaryStat label="Ukupno" value={summary.totalRows} />
                <SummaryStat label="Kreirano" value={summary.created} tone="emerald" />
                <SummaryStat label="Ažurirano" value={summary.updated} tone="blue" />
              </div>
              {summary.errors.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-red-700">
                    Greške ({summary.errors.length}):
                  </div>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                    {summary.errors.slice(0, 50).map((e, i) => (
                      <li key={i} className="text-red-700">
                        Red {e.row}
                        {e.sku ? ` (${e.sku})` : ''}: {e.message}
                      </li>
                    ))}
                    {summary.errors.length > 50 ? (
                      <li className="text-muted-foreground">
                        ... i još {summary.errors.length - 50}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-emerald-700">Bez grešaka. ✓</p>
              )}
            </div>
          ) : null}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              {summary ? 'Zatvori' : 'Odustani'}
            </Button>
            <Button type="submit" disabled={pending || !csv.trim()}>
              <Upload className="mr-1 size-4" />
              {pending ? 'Obrada...' : 'Obradi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SummaryStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'emerald' | 'blue'
}) {
  const cls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'blue'
      ? 'text-blue-700'
      : 'text-foreground'
  return (
    <div className="rounded-md bg-card px-2 py-1.5 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
}
