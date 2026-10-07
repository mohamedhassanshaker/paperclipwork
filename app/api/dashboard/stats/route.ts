import { NextResponse } from 'next/server'
import { errorResponse, requireSession } from '@/lib/api-response'
import { customerRepository } from '@/lib/repository/customer'

export async function GET() {
  const session = await requireSession()
  if (!session) {
    return errorResponse(401, 'unauthorized', 'Authentication required.')
  }

  try {
    const stats = await customerRepository.stats()
    return NextResponse.json(stats)
  } catch {
    return errorResponse(500, 'internal_error', 'Something went wrong.')
  }
}
