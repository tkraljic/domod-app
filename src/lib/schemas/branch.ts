import { z } from 'zod'

export const BranchCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Kod mora imati najmanje 2 znaka')
    .max(10, 'Kod može imati najviše 10 znakova')
    .regex(/^[A-Z0-9]+$/, 'Kod smije sadržavati samo velika slova i brojeve'),
  name: z.string().trim().min(1, 'Naziv je obavezan').max(100, 'Naziv je predugačak'),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  isWeb: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
})

export const BranchUpdateSchema = BranchCreateSchema.extend({
  id: z.string().min(1),
})

export type BranchCreateInput = z.infer<typeof BranchCreateSchema>
export type BranchUpdateInput = z.infer<typeof BranchUpdateSchema>
