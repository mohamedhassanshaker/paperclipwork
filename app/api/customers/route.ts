import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSession } from '@/lib/api-response'
import { customerRepository, EmailTakenError } from '@/lib/repository/customer'
import { createCustomerSchema, customerListQuerySchema, zodErrorToFields } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  const url = new URL(request.url)
  const parsed = customerListQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (!parsed.success) {
    return errorResponse(
      422,
      'validation_failed',
      'Invalid query parameters.',
      zodErrorToFields(parsed.error),
    )
  }

  try {
    const result = await customerRepository.list(parsed.data)
    return NextResponse.json(result)
  } catch {
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}

export async function POST(request: NextRequest) {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(422, 'validation_failed', 'Request body must be valid JSON.')
  }

  const parsed = createCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(422, 'validation_failed', 'Validation failed.', zodErrorToFields(parsed.error))
  }

  try {
    const customer = await customerRepository.create(parsed.data)
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return errorResponse(409, 'email_taken', 'A customer with that email already exists.')
    }
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}
