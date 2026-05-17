import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { UsersClient } from './_components/users-client'

export default async function KorisniciPage() {
  const session = await verifySession()
  if (session.role !== 'admin') redirect('/dostave')

  const users = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })

  const data = users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Korisnici</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upravljanje pristupom i ulogama. Samo admin.
        </p>
      </div>
      <UsersClient users={data} currentUserId={session.userId} />
    </div>
  )
}
