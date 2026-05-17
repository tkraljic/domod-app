'use client'

import { useMemo, useState, useTransition } from 'react'
import { Key, MoreHorizontal, Pencil, Plus, Power, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserFormDialog, type UserDraft } from './user-form-dialog'
import { PasswordResetDialog } from './password-reset-dialog'
import { toggleUserActive } from '@/app/actions/users'
import { USER_ROLES, type UserRole } from '@/lib/schemas/user'

type UserRow = UserDraft & { createdAt: string }
type RoleFilter = 'all' | UserRole
type StatusFilter = 'all' | 'active' | 'inactive'

type Props = {
  users: UserRow[]
  currentUserId: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  planner: 'Planer',
  driver: 'Vozač',
  viewer: 'Pregled',
}
const ROLE_TONES: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  planner: 'bg-blue-100 text-blue-800',
  driver: 'bg-emerald-100 text-emerald-800',
  viewer: 'bg-slate-100 text-slate-800',
}

export function UsersClient({ users, currentUserId }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<UserDraft | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: string; fullName: string } | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const [pendingId, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && !u.active) return false
      if (statusFilter === 'inactive' && u.active) return false
      if (!q) return true
      return (
        u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter, statusFilter])

  function openCreate() {
    setEditing(null)
    setEditorKey((k) => k + 1)
    setEditorOpen(true)
  }

  function openEdit(u: UserDraft) {
    setEditing(u)
    setEditorKey((k) => k + 1)
    setEditorOpen(true)
  }

  function openReset(u: UserDraft) {
    setResetTarget({ id: u.id, fullName: u.fullName })
    setResetKey((k) => k + 1)
    setResetOpen(true)
  }

  function handleToggle(u: UserDraft) {
    if (u.id === currentUserId) {
      toast.error('Ne možete sebe deaktivirati.')
      return
    }
    startTransition(async () => {
      const res = await toggleUserActive(u.id)
      if (res.ok) {
        toast.success(u.active ? 'Korisnik deaktiviran' : 'Korisnik aktiviran')
      } else {
        toast.error(res.error ?? 'Greška.')
      }
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži po imenu ili emailu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="Uloga">
              {(v: string | null) =>
                !v || v === 'all' ? 'Sve uloge' : ROLE_LABELS[v as UserRole] ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sve uloge</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="Status">
              {(v: string | null) =>
                v === 'active' ? 'Aktivni' : v === 'inactive' ? 'Neaktivni' : 'Svi statusi'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            <SelectItem value="active">Aktivni</SelectItem>
            <SelectItem value="inactive">Neaktivni</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Novi korisnik
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Uloga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" aria-label="Akcije" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {users.length === 0 ? 'Nema korisnika.' : 'Nema rezultata za trenutne filtere.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const isSelf = u.id === currentUserId
                return (
                  <TableRow key={u.id} className={u.active ? '' : 'opacity-60'}>
                    <TableCell className="font-medium">
                      {u.fullName}
                      {isSelf ? (
                        <span className="ml-2 text-xs text-muted-foreground">(vi)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ROLE_TONES[u.role as UserRole] ?? 'bg-slate-100 text-slate-800'
                        }
                      >
                        {ROLE_LABELS[u.role as UserRole] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Aktivan
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Neaktivan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Akcije">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(u)}>
                            <Pencil className="mr-2 size-4" />
                            Uredi
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openReset(u)}>
                            <Key className="mr-2 size-4" />
                            Reset lozinke
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggle(u)}
                            disabled={isSelf || pendingId}
                          >
                            <Power className="mr-2 size-4" />
                            {u.active ? 'Deaktiviraj' : 'Aktiviraj'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Prikazano {filtered.length} od {users.length} korisnika
      </p>

      <UserFormDialog
        key={editorKey}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        user={editing}
        isSelf={editing?.id === currentUserId}
      />

      {resetTarget ? (
        <PasswordResetDialog
          key={resetKey}
          open={resetOpen}
          onOpenChange={setResetOpen}
          userId={resetTarget.id}
          fullName={resetTarget.fullName}
        />
      ) : null}
    </>
  )
}
