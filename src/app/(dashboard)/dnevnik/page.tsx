import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AuditChanges } from './_components/audit-changes'

const PAGE_SIZE = 50
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ENTITY_TYPES = ['Branch', 'Product', 'Delivery', 'Vehicle', 'User'] as const
const ACTIONS = ['create', 'update', 'delete'] as const
const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = {
  create: 'Kreirano',
  update: 'Ažurirano',
  delete: 'Obrisano',
}
const ACTION_TONES: Record<(typeof ACTIONS)[number], string> = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
}

type Search = {
  entity?: string
  action?: string
  user?: string
  from?: string
  to?: string
  page?: string
}

type PageProps = {
  searchParams: Promise<Search>
}

export default async function DnevnikPage({ searchParams }: PageProps) {
  const session = await verifySession()
  if (session.role !== 'admin') redirect('/dostave')

  const params = await searchParams
  const where: Prisma.AuditLogWhereInput = {}
  if (params.entity && (ENTITY_TYPES as readonly string[]).includes(params.entity)) {
    where.entityType = params.entity
  }
  if (params.action && (ACTIONS as readonly string[]).includes(params.action)) {
    where.action = params.action
  }
  if (params.user) where.userId = params.user

  const dateFilter: Prisma.DateTimeFilter = {}
  if (params.from && DATE_RE.test(params.from)) {
    dateFilter.gte = new Date(`${params.from}T00:00:00.000Z`)
  }
  if (params.to && DATE_RE.test(params.to)) {
    const end = new Date(`${params.to}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    dateFilter.lt = end
  }
  if (dateFilter.gte || dateFilter.lt) where.createdAt = dateFilter

  const pageNum = Math.max(1, Number(params.page) || 1)
  const skip = (pageNum - 1) * PAGE_SIZE

  const [entries, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Dnevnik aktivnosti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sve izmjene u sistemu — ko, šta i kada. {total} {total === 1 ? 'zapis' : 'zapisa'}.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/dnevnik">
        <FilterField label="Entitet" name="entity" defaultValue={params.entity ?? ''}>
          <option value="">Svi</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterField>
        <FilterField label="Akcija" name="action" defaultValue={params.action ?? ''}>
          <option value="">Sve</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </FilterField>
        <div className="space-y-1.5">
          <Label htmlFor="user">Korisnik</Label>
          <select
            id="user"
            name="user"
            defaultValue={params.user ?? ''}
            className="h-8 w-[200px] rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Svi</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">Od</Label>
          <Input id="from" type="date" name="from" defaultValue={params.from ?? ''} className="w-[150px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Do</Label>
          <Input id="to" type="date" name="to" defaultValue={params.to ?? ''} className="w-[150px]" />
        </div>
        <Button type="submit" variant="outline">
          Primijeni
        </Button>
        {hasAnyFilter(params) ? (
          <a
            href="/dnevnik"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Očisti filtere
          </a>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nema zapisa za odabrane filtere.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Vrijeme</th>
                <th className="px-3 py-2 text-left font-medium">Korisnik</th>
                <th className="px-3 py-2 text-left font-medium">Entitet</th>
                <th className="px-3 py-2 text-left font-medium">Akcija</th>
                <th className="px-3 py-2 text-left font-medium">Detalji</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {formatTimestamp(e.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm">{e.user.fullName}</div>
                    <div className="text-xs text-muted-foreground">{e.user.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{e.entityType}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {e.entityId.slice(0, 12)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      className={
                        ACTION_TONES[e.action as (typeof ACTIONS)[number]] ??
                        'bg-slate-100 text-slate-800'
                      }
                    >
                      {ACTION_LABELS[e.action as (typeof ACTIONS)[number]] ?? e.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <AuditChanges json={e.changes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination page={pageNum} totalPages={totalPages} params={params} />
      ) : null}
    </div>
  )
}

function FilterField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string
  name: string
  defaultValue: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-8 w-[160px] rounded-md border border-input bg-background px-2 text-sm"
      >
        {children}
      </select>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: Search
}) {
  function buildHref(p: number): string {
    const sp = new URLSearchParams()
    if (params.entity) sp.set('entity', params.entity)
    if (params.action) sp.set('action', params.action)
    if (params.user) sp.set('user', params.user)
    if (params.from) sp.set('from', params.from)
    if (params.to) sp.set('to', params.to)
    sp.set('page', String(p))
    return `/dnevnik?${sp.toString()}`
  }
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground tabular-nums">
        Stranica {page} od {totalPages}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <a
            href={buildHref(page - 1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-accent"
          >
            ← Prethodna
          </a>
        ) : null}
        {page < totalPages ? (
          <a
            href={buildHref(page + 1)}
            className="rounded-md border border-input px-3 py-1 hover:bg-accent"
          >
            Sljedeća →
          </a>
        ) : null}
      </div>
    </div>
  )
}

function hasAnyFilter(p: Search): boolean {
  return Boolean(p.entity || p.action || p.user || p.from || p.to)
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`
}
