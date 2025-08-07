import { NextRequest, NextResponse } from 'next/server'
import { 
  getApiKeyConfig, 
  isApiKeyValid, 
  isEndpointAllowed, 
  getRateLimit, 
  updateLastUsed,
  isValidApiKeyFormat 
} from './api-keys-config'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function validateApiKey(request: NextRequest): { valid: boolean; config?: any; error?: string } {
  const authHeader = request.headers.get('authorization')
  const apiKey = request.headers.get('x-api-key')
  
  // Check for API key in Authorization header (Bearer token)
  let key = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    key = authHeader.substring(7)
  } else if (apiKey) {
    // Check for API key in X-API-Key header
    key = apiKey
  } else {
    return { valid: false, error: 'API key required. Use Authorization: Bearer <key> or X-API-Key header.' }
  }

  // Validate API key format
  if (!isValidApiKeyFormat(key)) {
    return { valid: false, error: 'Invalid API key format' }
  }

  // Check if API key exists and is valid
  if (!isApiKeyValid(key)) {
    return { valid: false, error: 'Invalid or inactive API key' }
  }

  const config = getApiKeyConfig(key)
  if (!config) {
    return { valid: false, error: 'API key not found' }
  }

  // Check endpoint access
  const endpoint = request.nextUrl.pathname
  if (!isEndpointAllowed(key, endpoint)) {
    return { valid: false, error: 'Access denied to this endpoint' }
  }

  // Check rate limiting
  const clientId = key
  const now = Date.now()
  const minuteKey = `${clientId}:minute:${Math.floor(now / 60000)}`
  const hourKey = `${clientId}:hour:${Math.floor(now / 3600000)}`

  const rateLimit = getRateLimit(key)

  // Check minute rate limit
  const minuteData = rateLimitStore.get(minuteKey) || { count: 0, resetTime: now + 60000 }
  if (minuteData.count >= rateLimit.requestsPerMinute) {
    return { valid: false, error: 'Rate limit exceeded. Too many requests per minute.' }
  }

  // Check hour rate limit
  const hourData = rateLimitStore.get(hourKey) || { count: 0, resetTime: now + 3600000 }
  if (hourData.count >= rateLimit.requestsPerHour) {
    return { valid: false, error: 'Rate limit exceeded. Too many requests per hour.' }
  }

  // Update rate limit counters
  rateLimitStore.set(minuteKey, { count: minuteData.count + 1, resetTime: minuteData.resetTime })
  rateLimitStore.set(hourKey, { count: hourData.count + 1, resetTime: hourData.resetTime })

  // Update last used timestamp
  updateLastUsed(key)

  return { valid: true, config }
}

export function withApiKeyAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = validateApiKey(request)
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.error || 'Authentication failed',
          success: false 
        }, 
        { status: 401 }
      )
    }

    // Add API key info to request for logging/monitoring
    ;(request as any).apiKeyConfig = validation.config

    return handler(request)
  }
}

// Helper function to get API key from request
export function getApiKeyFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  const apiKey = request.headers.get('x-api-key')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  return apiKey
} 