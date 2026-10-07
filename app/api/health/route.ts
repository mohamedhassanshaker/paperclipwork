import { NextResponse } from 'next/server'

export async function GET() {
  // TAH-22 rollback drill: deliberately unhealthy, reverted immediately after.
  return NextResponse.json({ status: 'degraded', db: 'error' }, { status: 503 })
}
