export interface ApiKeyConfig {
  apiKey: string
  name?: string
  description?: string
  rateLimit?: {
    requestsPerMinute: number
    requestsPerHour: number
  }
  allowedEndpoints?: string[]
  isActive?: boolean
  createdAt?: string
  lastUsed?: string
}

// API Keys configuration
// In production, this should be stored in a database or environment variables
export const API_KEYS: Record<string, ApiKeyConfig> = {
  // Test API key for development
  'sk-test-1234567890abcdef': {
    apiKey: 'sk-test-1234567890abcdef',
    name: 'Test API Key',
    description: 'Development and testing API key',
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    },
    allowedEndpoints: ['*'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  
  // User-provided API key
  'jilqy9efy8jk79v9': {
    apiKey: 'jilqy9efy8jk79v9',
    name: 'Primary API Key',
    description: 'User-provided key for all API access',
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
    },
    allowedEndpoints: ['*'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  
  // Production API key (replace with your actual key)
  'sk-prod-abcdef1234567890': {
    apiKey: 'sk-prod-abcdef1234567890',
    name: 'Production API Key',
    description: 'Production API key for live applications',
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerHour: 5000
    },
    allowedEndpoints: ['*'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  
  // Limited API key for specific endpoints
  'sk-limited-xyz789': {
    apiKey: 'sk-limited-xyz789',
    name: 'Limited API Key',
    description: 'API key with limited access',
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100
    },
    allowedEndpoints: ['/api/public/status', '/api/public/upload-image'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  }
}

// Helper functions for API key management
export function getApiKeyConfig(apiKey: string): ApiKeyConfig | null {
  return API_KEYS[apiKey] || null
}

export function isApiKeyValid(apiKey: string): boolean {
  const config = getApiKeyConfig(apiKey)
  return config !== null && config.isActive !== false
}

export function isEndpointAllowed(apiKey: string, endpoint: string): boolean {
  const config = getApiKeyConfig(apiKey)
  if (!config) return false
  
  // If allowedEndpoints is ['*'], allow all endpoints
  if (config.allowedEndpoints?.includes('*')) return true
  
  // Check if the specific endpoint is allowed
  return config.allowedEndpoints?.includes(endpoint) || false
}

export function getRateLimit(apiKey: string): { requestsPerMinute: number; requestsPerHour: number } {
  const config = getApiKeyConfig(apiKey)
  return config?.rateLimit || {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  }
}

// Function to update last used timestamp
export function updateLastUsed(apiKey: string): void {
  const config = getApiKeyConfig(apiKey)
  if (config) {
    config.lastUsed = new Date().toISOString()
  }
}

// Function to validate API key format
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Relaxed: accept alphanumeric keys 12-64 chars, or legacy 'sk-' keys
  if (apiKey.startsWith('sk-') && apiKey.length >= 20) return true
  return /^[A-Za-z0-9_-]{12,64}$/.test(apiKey)
}