import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Authentication is now handled directly in API routes
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Temporarily disabled to test direct API authentication
    // '/api/:path*',
  ],
} 