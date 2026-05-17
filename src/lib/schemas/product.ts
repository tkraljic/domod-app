import { z } from 'zod'

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''))

const optionalPositiveFloat = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().positive('Mora biti veće od 0').optional(),
)

export const ProductCreateSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU je obavezan')
    .max(40, 'SKU je predugačak')
    .regex(/^[A-Z0-9._-]+$/, 'Samo velika slova, brojevi i znakovi . _ -'),
  nameBs: z.string().trim().min(1, 'Naziv (BS) je obavezan').max(200),
  nameEn: optionalString(200),
  categoryId: z.string().min(1, 'Kategorija je obavezna'),
  brand: optionalString(80),
  supplier: optionalString(120),
  lengthCm: optionalPositiveFloat,
  widthCm: optionalPositiveFloat,
  heightCm: optionalPositiveFloat,
  weightKg: optionalPositiveFloat,
  carryInDefault: z.boolean().default(false),
  crewSizeDefault: z.coerce.number().int().min(1, 'Min. 1').max(10, 'Maks. 10').default(1),
  notes: optionalString(1000),
})

export const ProductUpdateSchema = ProductCreateSchema.extend({
  id: z.string().min(1),
})

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>
