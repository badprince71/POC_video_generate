import { NextRequest, NextResponse } from 'next/server'
import { 
  getApiKeyConfig, 
  getRateLimit, 
  updateLastUsed,
  isValidApiKeyFormat 
} from './api-keys-config'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Generate encrypted API key from SECRET_KEY and USER_ID
export function generateEncryptedApiKey(): string | null {
  try {
    const secretKey = process.env.SECRET_KEY
    const userId = process.env.USER_ID
    
    if (!secretKey || !userId) {
      console.warn('SECRET_KEY or USER_ID not set, cannot generate encrypted API key')
      return null
    }
    
    // Create a simple hash-based API key from SECRET_KEY + USER_ID
    const combined = secretKey + userId
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Convert to base64-like string and make it URL-safe
    const base64 = btoa(Math.abs(hash).toString())
    const apiKey = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 24)
    
    return apiKey
  } catch (error) {
    console.error('Error generating encrypted API key:', error)
    return null
  }
}

// Validate API key against SECRET_KEY and USER_ID
function validateEncryptedApiKey(apiKey: string): boolean {
  try {
    const expectedKey = generateEncryptedApiKey()
    return expectedKey === apiKey
  } catch (error) {
    console.error('Error validating encrypted API key:', error)
    return false
  }
}

export function validateApiKey(request: NextRequest): { valid: boolean; config?: any; error?: string; status?: number } {
  const authHeader = request.headers.get('authorization')
  // Accept several common header names for API keys to improve client compatibility
  const possibleKeyHeaders = [
    'x-api-key',
    'api-key',
    'api_key',
    'apikey',
    'apiKey',
    'api-key-id',
    'api_token',
    'api-token',
    'api',
    'key',
    'API_KEY',
  ] as const
  let apiKey: string | null = null
  for (const headerName of possibleKeyHeaders) {
    const value = request.headers.get(headerName as unknown as string)
    if (value) {
      apiKey = value
      break
    }
  }

  let key: string

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Check for API key in Authorization header
    key = authHeader.substring(7)
  } else if (apiKey) {
    // Check for API key in X-API-Key header
    key = apiKey
  } else {
    return { valid: false, error: 'API key required. Use Authorization: Bearer <key> or X-API-Key header.', status: 401 }
  }

  // First, check if this is the encrypted API key from SECRET_KEY + USER_ID
  if (validateEncryptedApiKey(key)) {
    // This is the encrypted key - grant full access with high rate limits
    const clientId = 'encrypted_key'
    const now = Date.now()
    const minuteKey = `${clientId}:minute:${Math.floor(now / 60000)}`
    const hourKey = `${clientId}:hour:${Math.floor(now / 3600000)}`
    
    // Check rate limits
    const minuteData = rateLimitStore.get(minuteKey) || { count: 0, resetTime: now + 60000 }
    if (minuteData.count >= 200) {
      return { valid: false, error: 'Rate limit exceeded. Too many requests per minute.', status: 429 }
    }
    
    const hourData = rateLimitStore.get(hourKey) || { count: 0, resetTime: now + 3600000 }
    if (hourData.count >= 10000) {
      return { valid: false, error: 'Rate limit exceeded. Too many requests per hour.', status: 429 }
    }
    
    // Update rate limit counters
    rateLimitStore.set(minuteKey, { count: minuteData.count + 1, resetTime: minuteData.resetTime })
    rateLimitStore.set(hourKey, { count: hourData.count + 1, resetTime: hourData.resetTime })
    
    const config = {
      apiKey: key,
      name: 'Encrypted API Key',
      description: 'API key encrypted with SECRET_KEY and USER_ID',
      allowedEndpoints: ['*'],
      isActive: true,
      rateLimit: { requestsPerMinute: 200, requestsPerHour: 10000 }
    }
    
    return { valid: true, config }
  }

  // Validate API key format
  if (!isValidApiKeyFormat(key)) {
    return { valid: false, error: 'Invalid API key format', status: 401 }
  }

  // Check if API key exists and is valid
  const config = getApiKeyConfig(key)
  if (!config) {
    return { valid: false, error: 'Invalid or inactive API key', status: 401 }
  }

  if (!config.isActive) {
    return { valid: false, error: 'API key is inactive', status: 401 }
  }

  // Check rate limits
  const rateLimit = getRateLimit(key)
  const clientId = key
  const now = Date.now()
  const minuteKey = `${clientId}:minute:${Math.floor(now / 60000)}`
  const hourKey = `${clientId}:hour:${Math.floor(now / 3600000)}`
  
  // Check minute rate limit
  const minuteData = rateLimitStore.get(minuteKey) || { count: 0, resetTime: now + 60000 }
  if (minuteData.count >= rateLimit.requestsPerMinute) {
    return { valid: false, error: 'Rate limit exceeded. Too many requests per minute.', status: 429 }
  }
  
  // Check hour rate limit
  const hourData = rateLimitStore.get(hourKey) || { count: 0, resetTime: now + 3600000 }
  if (hourData.count >= rateLimit.requestsPerHour) {
    return { valid: false, error: 'Rate limit exceeded. Too many requests per hour.', status: 429 }
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
          success: false,
        },
        { status: validation.status ?? 401 },
      )
    }
    
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