import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateApiKey } from '@/lib/auth/api-key-auth'

// Define public API endpoints that don't require authentication
const PUBLIC_API_ENDPOINTS = [
  // S3 proxy endpoints for serving public media
  '/api/proxy_s3_image',
  '/api/proxy_s3_video',
  
  // Public API endpoints
  '/api/public/status',
  
  // Utility and testing endpoints
  '/api/health',
  '/api/test-db',
  '/api/convert_s3_image_to_base64', // Used for testing and debugging
  
  // Media serving endpoints (these serve public content)
  '/api/serve-chunked-video',
  '/api/get_presigned_url' // This generates public URLs for media access
]

export async function middleware(request: NextRequest) {
  // Allow CORS preflight without authentication
  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  // Check if this is a public API endpoint
  const isPublicEndpoint = PUBLIC_API_ENDPOINTS.some(endpoint => 
    request.nextUrl.pathname.startsWith(endpoint)
  )

  // Enforce API key authentication only on protected API routes
  if (request.nextUrl.pathname.startsWith('/api/') && !isPublicEndpoint) {
    const validation = validateApiKey(request)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || 'Authentication failed',
          success: false,
        },
        { status: validation.status ?? 401 },
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}