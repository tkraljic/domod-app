import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import type { DeliveryStatus } from '@/lib/schemas/delivery'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: 'Planirano',
  in_transit: 'U prevozu',
  delivered: 'Isporučeno',
  failed: 'Neuspjelo',
  rescheduled: 'Preraspoređeno',
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const date = url.searchParams.get('date') ?? ''
  if (!DATE_RE.test(date)) {
    return new Response('Invalid date', { status: 400 })
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const [deliveries, branches] = await Promise.all([
    prisma.delivery.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: {
        items: {
          include: { product: { select: { sku: true, nameBs: true } } },
        },
        branch: { select: { id: true, code: true, name: true, isWeb: true } },
        vehicle: { select: { name: true } },
      },
      orderBy: [{ channel: 'asc' }, { sequenceNumber: 'asc' }],
    }),
    prisma.branch.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, isWeb: true },
    }),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'DOMOD Dostave'
  wb.created = new Date()

  const ws = wb.addWorksheet('Plan dostava', {
    views: [{ state: 'frozen', ySplit: 3 }],
  })

  ws.columns = [
    { header: '#', key: 'seq', width: 4 },
    { header: 'Vrijeme', key: 'time', width: 12 },
    { header: 'Kupac', key: 'customer', width: 28 },
    { header: 'Telefon', key: 'phone', width: 16 },
    { header: 'Adresa', key: 'address', width: 32 },
    { header: 'Posada', key: 'crew', width: 7 },
    { header: 'Unos', key: 'carryIn', width: 6 },
    { header: 'Vozilo', key: 'vehicle', width: 14 },
    { header: 'Artikli', key: 'items', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Napomene', key: 'notes', width: 30 },
  ]

  ws.mergeCells(1, 1, 1, ws.columns.length)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `Plan dostava — ${formatDateLabel(date)}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 22
  ws.getRow(2).height = 6 // spacer

  const headerRow = ws.getRow(3)
  headerRow.values = ws.columns.map((c) => c.header as string)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    }
  })

  const branchOrder = branches.filter((b) => !b.isWeb)
  const byBranchId = new Map<string, typeof deliveries>()
  const webDeliveries: typeof deliveries = []
  for (const d of deliveries) {
    if (d.channel === 'web') webDeliveries.push(d)
    else if (d.branchId) {
      const arr = byBranchId.get(d.branchId) ?? []
      arr.push(d)
      byBranchId.set(d.branchId, arr)
    }
  }

  let rowIdx = 4

  function writeSection(title: string, rows: typeof deliveries) {
    if (rows.length === 0) return
    ws.mergeCells(rowIdx, 1, rowIdx, ws.columns.length)
    const c = ws.getCell(rowIdx, 1)
    c.value = `${title}  (${rows.length})`
    c.font = { bold: true, size: 11 }
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }
    rowIdx++

    rows.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    for (const d of rows) {
      const itemsText = d.items
        .map((it) => `${it.product.sku} — ${it.product.nameBs} ×${it.quantity}`)
        .join('\n')
      const row = ws.getRow(rowIdx)
      row.values = {
        seq: d.sequenceNumber,
        time: d.deliveryTime ?? '',
        customer: d.customerName,
        phone: d.customerPhone ?? '',
        address: d.customerAddress ?? '',
        crew: d.crewSizeRequired,
        carryIn: d.carryInRequired ? 'Da' : '',
        vehicle: d.vehicle?.name ?? '',
        items: itemsText,
        status: STATUS_LABELS[d.status as DeliveryStatus] ?? d.status,
        notes: d.notes ?? '',
      }
      row.alignment = { vertical: 'top', wrapText: true }
      rowIdx++
    }
    rowIdx++ // blank spacer
  }

  for (const branch of branchOrder) {
    const rows = byBranchId.get(branch.id) ?? []
    writeSection(`${branch.code} — ${branch.name}`, rows)
  }
  writeSection('Web narudžbe', webDeliveries)

  if (deliveries.length === 0) {
    ws.mergeCells(rowIdx, 1, rowIdx, ws.columns.length)
    const c = ws.getCell(rowIdx, 1)
    c.value = 'Nema dostava za odabrani datum.'
    c.font = { italic: true, color: { argb: 'FF64748B' } }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `Plan-dostava-${date}.xlsx`

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

const DAY_NAMES = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
const MONTH_NAMES = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
]

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}.`
}
