import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Only create the client if we have the service key
const supabase = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

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