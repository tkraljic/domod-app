import { z } from 'zod'

export const VehicleCreateSchema = z.object({
  name: z.string().trim().min(1, 'Naziv je obavezan').max(60, 'Naziv je predugačak'),
  payloadKg: z.coerce.number().positive('Mora biti veće od 0').max(100_000),
  volumeM3: z.coerce.number().positive('Mora biti veće od 0').max(1_000),
  active: z.boolean().default(true),
})

export const VehicleUpdateSchema = VehicleCreateSchema.extend({
  id: z.string().min(1),
})

export type VehicleCreateInput = z.infer<typeof VehicleCreateSchema>
export type VehicleUpdateInput = z.infer<typeof VehicleUpdateSchema>
