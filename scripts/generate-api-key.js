#!/usr/bin/env node

// Script to generate encrypted API key from SECRET_KEY and USER_ID
// Usage: node scripts/generate-api-key.js

function generateEncryptedApiKey(secretKey, userId) {
  try {
    if (!secretKey || !userId) {
      console.error('SECRET_KEY and USER_ID are required')
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
    const base64 = Buffer.from(Math.abs(hash).toString()).toString('base64')
    const apiKey = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 24)
    
    return apiKey
  } catch (error) {
    console.error('Error generating encrypted API key:', error)
    return null
  }
}

// Generate API key with your credentials
const SECRET_KEY = 'banana'
const USER_ID = 'user'

console.log('Generating encrypted API key...')
console.log(`SECRET_KEY: ${SECRET_KEY}`)
console.log(`USER_ID: ${USER_ID}`)

const apiKey = generateEncryptedApiKey(SECRET_KEY, USER_ID)

if (apiKey) {
  console.log('\n✅ Generated encrypted API key:')
  console.log(`API Key: ${apiKey}`)
  console.log('\n📋 Usage in Postman:')
  console.log('Auth Type: API Key')
  console.log('Key: API_KEY')
  console.log(`Value: ${apiKey}`)
  console.log('Add to: Header')
  console.log('\n🔑 Or use Authorization header:')
  console.log(`Authorization: Bearer ${apiKey}`)
  console.log('\n📝 Or use X-API-Key header:')
  console.log(`X-API-Key: ${apiKey}`)
} else {
  console.error('❌ Failed to generate API key')
  process.exit(1)
}
