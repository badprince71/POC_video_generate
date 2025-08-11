import { NextRequest, NextResponse } from 'next/server'
import { API_KEYS, getApiKeyConfig, updateLastUsed } from '@/lib/auth/api-keys-config'

export async function GET(request: NextRequest) {

  try {
    // Return all API keys with usage information
    const apiKeys = Object.values(API_KEYS).map(key => ({
      name: key.name,
      description: key.description,
      rateLimit: key.rateLimit,
      allowedEndpoints: key.allowedEndpoints,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      // Don't expose the actual API key for security
      keyPrefix: key.apiKey.substring(0, 10) + '...'
    }))

    return NextResponse.json({
      success: true,
      apiKeys,
      total: apiKeys.length
    })

  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {

  try {
    const { name, description, rateLimit, allowedEndpoints } = await request.json()

    // Generate a new API key
    const apiKey = `sk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    console.log("-----------------apiKey-----------------",apiKey);
    
    // Add to API_KEYS (in production, save to database)
    API_KEYS[apiKey] = {
      apiKey,
      name: name || 'New API Key',
      description: description || '',
      rateLimit: rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 1000
      },
      allowedEndpoints: allowedEndpoints || ['*'],
      isActive: true,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      apiKey,
      message: 'API key created successfully'
    })

  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {

  try {
    const { apiKey, updates } = await request.json()

    const config = getApiKeyConfig(apiKey)
    if (!config) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Update the API key configuration
    Object.assign(config, updates)
    config.lastUsed = new Date().toISOString()

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully'
    })

  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {

  try {
    const { apiKey } = await request.json()

    if (!API_KEYS[apiKey]) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Delete the API key (in production, mark as inactive in database)
    delete API_KEYS[apiKey]

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
} 