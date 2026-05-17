import 'server-only'
import { prisma } from '@/lib/prisma'

type AuditAction = 'create' | 'update' | 'delete'

type AuditInput = {
  entityType: string
  entityId: string
  action: AuditAction
  userId: string
  changes: Record<string, unknown>
}

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      changes: JSON.stringify(input.changes),
    },
  })
}
