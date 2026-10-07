import { describe, expect, it } from 'vitest'
import { createCustomerSchema, updateCustomerSchema, zodErrorToFields } from './validation'

describe('createCustomerSchema', () => {
  it('accepts a minimal valid payload and lowercases the email', () => {
    const result = createCustomerSchema.safeParse({
      name: 'Jane Cooper',
      email: 'Jane.Cooper@Northwind.com',
      status: 'active',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('jane.cooper@northwind.com')
      expect(result.data.phone).toBeUndefined()
      expect(result.data.company).toBeUndefined()
    }
  })

  it('trims the name and rejects a blank one as required', () => {
    const result = createCustomerSchema.safeParse({
      name: '   ',
      email: 'a@b.com',
      status: 'active',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(zodErrorToFields(result.error)).toEqual({ name: 'required' })
    }
  })

  it('rejects a name over 120 chars as too_long', () => {
    const result = createCustomerSchema.safeParse({
      name: 'a'.repeat(121),
      email: 'a@b.com',
      status: 'active',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(zodErrorToFields(result.error).name).toBe('too_long')
  })

  it.each(['not-an-email', '', 'a'.repeat(255) + '@b.com'])(
    'rejects invalid email %s as invalid_email',
    (email) => {
      const result = createCustomerSchema.safeParse({ name: 'A', email, status: 'active' })
      expect(result.success).toBe(false)
      if (!result.success) expect(zodErrorToFields(result.error).email).toBe('invalid_email')
    },
  )

  it('rejects a status outside active/inactive as invalid_status', () => {
    const result = createCustomerSchema.safeParse({ name: 'A', email: 'a@b.com', status: 'pending' })
    expect(result.success).toBe(false)
    if (!result.success) expect(zodErrorToFields(result.error).status).toBe('invalid_status')
  })

  it('rejects a phone with letters as invalid_phone', () => {
    const result = createCustomerSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      status: 'active',
      phone: 'call-me-maybe',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(zodErrorToFields(result.error).phone).toBe('invalid_phone')
  })

  it('accepts a phone with the allowed charset and treats empty string as absent', () => {
    const valid = createCustomerSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      status: 'active',
      phone: '+1 555 0142',
    })
    expect(valid.success).toBe(true)

    const empty = createCustomerSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      status: 'active',
      phone: '',
    })
    expect(empty.success).toBe(true)
    if (empty.success) expect(empty.data.phone).toBeNull()
  })

  it('rejects a company over 120 chars as too_long', () => {
    const result = createCustomerSchema.safeParse({
      name: 'A',
      email: 'a@b.com',
      status: 'active',
      company: 'a'.repeat(121),
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(zodErrorToFields(result.error).company).toBe('too_long')
  })
})

describe('updateCustomerSchema', () => {
  it('accepts a partial payload with only one field', () => {
    const result = updateCustomerSchema.safeParse({ status: 'inactive' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty payload', () => {
    const result = updateCustomerSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates fields that are present', () => {
    const result = updateCustomerSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) expect(zodErrorToFields(result.error).email).toBe('invalid_email')
  })
})
