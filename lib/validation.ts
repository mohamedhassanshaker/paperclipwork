import { z, type ZodError } from 'zod'

// Mirrors the prototype's own email rule (interface-contract §4): simple,
// intentionally permissive, not RFC-5322-strict.
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN),
  // 8 is the CTO's interim floor (interface-contract §4, decision-log on
  // TAH-14) until the Business Analyst rules on TAH-17. The login screen's
  // copy intentionally still says "4+ characters" — this does not change any
  // screen in the design, only server enforcement.
  password: z.string().min(8),
})

export type LoginInput = z.infer<typeof loginSchema>

// --- Customer CRUD validation (interface-contract §4) -----------------------
//
// Error codes are carried as the Zod issue `message` itself, so a failing
// field can be read straight off `error.issues` into the API's `fields` map
// (see `zodErrorToFields` below) without a second translation table.

const nameSchema = z
  .string({ required_error: 'required', invalid_type_error: 'required' })
  .trim()
  .min(1, 'required')
  .max(120, 'too_long')

const customerEmailSchema = z
  .string({ required_error: 'invalid_email', invalid_type_error: 'invalid_email' })
  .min(1, 'invalid_email')
  .max(254, 'invalid_email')
  .regex(EMAIL_PATTERN, 'invalid_email')
  .transform((value) => value.toLowerCase())

const phoneSchema = z
  .string({ invalid_type_error: 'invalid_phone' })
  .trim()
  .max(32, 'invalid_phone')
  .regex(/^[0-9+\-() \s]*$/, 'invalid_phone')
  .transform((value) => (value.length === 0 ? null : value))
  .nullish()

const companySchema = z
  .string({ invalid_type_error: 'too_long' })
  .trim()
  .max(120, 'too_long')
  .transform((value) => (value.length === 0 ? null : value))
  .nullish()

const statusSchema = z.enum(['active', 'inactive'], {
  errorMap: () => ({ message: 'invalid_status' }),
})

export const createCustomerSchema = z.object({
  name: nameSchema,
  email: customerEmailSchema,
  phone: phoneSchema,
  company: companySchema,
  status: statusSchema,
})

export const updateCustomerSchema = z.object({
  name: nameSchema.optional(),
  email: customerEmailSchema.optional(),
  phone: phoneSchema,
  company: companySchema,
  status: statusSchema.optional(),
})

export const customerListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>

/**
 * Flattens a ZodError into the `fields` map of the API error envelope: one
 * i18n error code per field (first failure wins).
 */
export function zodErrorToFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_'
    if (!(field in fields)) {
      fields[field] = issue.message
    }
  }
  return fields
}
