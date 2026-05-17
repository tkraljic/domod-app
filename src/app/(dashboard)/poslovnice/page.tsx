import { prisma } from '@/lib/prisma'
import { BranchesClient } from './_components/branches-client'

export default async function PoslovnicePage() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const data = branches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    address: b.address,
    phone: b.phone,
    isWeb: b.isWeb,
    active: b.active,
    sortOrder: b.sortOrder,
    createdAt: b.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Poslovnice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upravljanje poslovnicama i web kanalom.
        </p>
      </div>
      <BranchesClient branches={data} />
    </div>
  )
}
