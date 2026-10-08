import { NextResponse } from 'next/server'
import { customerRepository } from '@/lib/repository/customer'

export async function GET() {
  const ok = await customerRepository.healthCheck()
  if (!ok) {
    return NextResponse.json({ status: 'degraded', db: 'error' }, { status: 503 })
  }
  return NextResponse.json({ status: 'ok', db: 'ok' })
}
