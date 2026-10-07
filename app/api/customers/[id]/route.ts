import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, requireSession } from '@/lib/api-response'
import { customerRepository, EmailTakenError } from '@/lib/repository/customer'
import { updateCustomerSchema, zodErrorToFields } from '@/lib/validation'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  const { id } = await params
  try {
    const customer = await customerRepository.findById(id)
    if (!customer) {
      return errorResponse(404, 'not_found', 'Customer not found.')
    }
    return NextResponse.json(customer)
  } catch {
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(422, 'validation_failed', 'Request body must be valid JSON.')
  }

  const parsed = updateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(422, 'validation_failed', 'Validation failed.', zodErrorToFields(parsed.error))
  }

  try {
    const customer = await customerRepository.update(id, parsed.data)
    if (!customer) {
      return errorResponse(404, 'not_found', 'Customer not found.')
    }
    return NextResponse.json(customer)
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return errorResponse(409, 'email_taken', 'A customer with that email already exists.')
    }
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  const { id } = await params
  try {
    const deleted = await customerRepository.delete(id)
    if (!deleted) {
      return errorResponse(404, 'not_found', 'Customer not found.')
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}
