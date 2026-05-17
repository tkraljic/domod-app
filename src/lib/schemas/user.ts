import { z } from 'zod'

export const USER_ROLES = ['admin', 'planner', 'driver', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

const baseFields = {
  email: z.string().trim().toLowerCase().email('Neispravan email').max(200),
  fullName: z.string().trim().min(1, 'Ime je obavezno').max(100),
  role: z.enum(USER_ROLES),
  active: z.boolean().default(true),
}

const passwordSchema = z
  .string()
  .min(8, 'Lozinka mora imati barem 8 znakova')
  .max(100, 'Lozinka je preduga')

export const UserCreateSchema = z.object({
  ...baseFields,
  password: passwordSchema,
})

export const UserUpdateSchema = z.object({
  id: z.string().min(1),
  ...baseFields,
})

export const PasswordResetSchema = z.object({
  id: z.string().min(1),
  password: passwordSchema,
})

export type UserCreateInput = z.infer<typeof UserCreateSchema>
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>
export type PasswordResetInput = z.infer<typeof PasswordResetSchema>
