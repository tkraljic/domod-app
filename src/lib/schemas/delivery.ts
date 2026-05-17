import { z } from 'zod'

export const DELIVERY_STATUSES = [
  'planned',
  'in_transit',
  'delivered',
  'failed',
  'rescheduled',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const DELIVERY_CHANNELS = ['branch', 'web'] as const
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number]

export const DeliveryItemSchema = z.object({
  productId: z.string().min(1, 'Proizvod je obavezan'),
  quantity: z.coerce.number().int().min(1, 'Min. 1').max(999, 'Maks. 999'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})
export type DeliveryItemInput = z.infer<typeof DeliveryItemSchema>

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Neispravan datum')

const DeliveryBaseSchema = z.object({
  date: dateStringSchema,
  channel: z.enum(DELIVERY_CHANNELS),
  branchId: z.string().optional().or(z.literal('')),
  vehicleId: z.string().optional().or(z.literal('')),
  driverId: z.string().optional().or(z.literal('')),
  customerName: z.string().trim().min(1, 'Ime kupca je obavezno').max(200),
  customerAddress: z.string().trim().max(300).optional().or(z.literal('')),
  customerHouseNumber: z.string().trim().max(20).optional().or(z.literal('')),
  customerFloor: z.string().trim().max(20).optional().or(z.literal('')),
  customerApartmentNumber: z.string().trim().max(20).optional().or(z.literal('')),
  customerPhone: z.string().trim().max(30).optional().or(z.literal('')),
  latitude: z
    .union([z.literal(''), z.coerce.number().min(-90).max(90)])
    .optional(),
  longitude: z
    .union([z.literal(''), z.coerce.number().min(-180).max(180)])
    .optional(),
  deliveryTime: z.string().trim().max(50).optional().or(z.literal('')),
  carryInRequired: z.boolean().default(false),
  crewSizeRequired: z.coerce.number().int().min(1, 'Min. 1').max(10, 'Maks. 10').default(1),
  status: z.enum(DELIVERY_STATUSES).default('planned'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(DeliveryItemSchema).min(1, 'Dostava mora imati barem jedan artikl'),
})

const branchRequiredForBranchChannel = {
  check: (d: z.infer<typeof DeliveryBaseSchema>) =>
    d.channel !== 'branch' || !!d.branchId,
  message: 'Poslovnica je obavezna za kanal "branch"',
  path: ['branchId'] as const,
}

export const DeliveryCreateSchema = DeliveryBaseSchema.refine(
  branchRequiredForBranchChannel.check,
  { message: branchRequiredForBranchChannel.message, path: [...branchRequiredForBranchChannel.path] },
)

export const DeliveryUpdateSchema = DeliveryBaseSchema.extend({
  id: z.string().min(1),
}).refine(
  branchRequiredForBranchChannel.check,
  { message: branchRequiredForBranchChannel.message, path: [...branchRequiredForBranchChannel.path] },
)

export type DeliveryCreateInput = z.infer<typeof DeliveryCreateSchema>
export type DeliveryUpdateInput = z.infer<typeof DeliveryUpdateSchema>
