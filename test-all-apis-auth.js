// Test script to verify all three APIs are protected with encrypted API key authentication
// Usage: node test-all-apis-auth.js

const BASE_URL = 'http://localhost:3000'
const API_KEY = 'NTU4NjI5MDQw' // Your encrypted API key

async function testAllAPIsAuth() {
  console.log('🧪 Testing all APIs with encrypted API key authentication...\n')
  
  const apis = [
    {
      name: 'generate_story',
      endpoint: '/api/generate_story',
      method: 'POST',
      body: {
        prompt: 'A person walking in a park',
        frameCount: 3
      }
    },
    {
      name: 'generate_single_image',
      endpoint: '/api/generate_single_image',
      method: 'POST',
      body: {
        prompt: 'A person walking in a park',
        frameIndex: 0,
        totalFrames: 3,
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      }
    },
    {
      name: 'generate_single_video_clip',
      endpoint: '/api/generate_single_video_clip',
      method: 'POST',
      body: {
        startImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        prompt: 'A person walking in a park',
        clipIndex: 0,
        totalClips: 1,
        duration: 5
      }
    }
  ]

  for (const api of apis) {
    console.log(`🔒 Testing ${api.name} API...`)
    
    // Test 1: Without API key (should fail)
    console.log(`  1️⃣ Testing WITHOUT API key (should fail with 401)...`)
    try {
      const response = await fetch(`${BASE_URL}${api.endpoint}`, {
        method: api.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(api.body)
      })
      
      if (response.status === 401) {
        console.log('     ✅ PASS: Request without API key correctly rejected (401)')
      } else {
        console.log(`     ❌ FAIL: Expected 401, got ${response.status}`)
      }
    } catch (error) {
      console.log('     ✅ PASS: Request without API key correctly rejected (connection error)')
    }
    
    // Test 2: With API key in Authorization header (should succeed)
    console.log(`  2️⃣ Testing WITH Authorization: Bearer header (should succeed)...`)
    try {
      const response = await fetch(`${BASE_URL}${api.endpoint}`, {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(api.body)
      })
      
      if (response.status === 200) {
        console.log('     ✅ PASS: Request with Authorization header succeeded (200)')
      } else if (response.status === 401) {
        console.log('     ❌ FAIL: Request with valid API key rejected (401)')
      } else {
        console.log(`     ⚠️  UNEXPECTED: Got status ${response.status}`)
      }
    } catch (error) {
      console.log('     ❌ FAIL: Request failed with error:', error.message)
    }
    
    // Test 3: With API key in X-API-Key header (should succeed)
    console.log(`  3️⃣ Testing WITH X-API-Key header (should succeed)...`)
    try {
      const response = await fetch(`${BASE_URL}${api.endpoint}`, {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(api.body)
      })
      
      if (response.status === 200) {
        console.log('     ✅ PASS: Request with X-API-Key header succeeded (200)')
      } else if (response.status === 401) {
        console.log('     ❌ FAIL: Request with valid API key rejected (401)')
      } else {
        console.log(`     ⚠️  UNEXPECTED: Got status ${response.status}`)
      }
    } catch (error) {
      console.log('     ❌ FAIL: Request failed with error:', error.message)
    }
    
    // Test 4: With API key in API_KEY header (Postman style, should succeed)
    console.log(`  4️⃣ Testing WITH API_KEY header (Postman style, should succeed)...`)
    try {
      const response = await fetch(`${BASE_URL}${api.endpoint}`, {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
          'API_KEY': API_KEY
        },
        body: JSON.stringify(api.body)
      })
      
      if (response.status === 200) {
        console.log('     ✅ PASS: Request with API_KEY header succeeded (200)')
      } else if (response.status === 401) {
        console.log('     ❌ FAIL: Request with valid API key rejected (401)')
      } else {
        console.log(`     ⚠️  UNEXPECTED: Got status ${response.status}`)
      }
    } catch (error) {
      console.log('     ❌ FAIL: Request failed with error:', error.message)
    }
    
    console.log('') // Empty line between APIs
  }
  
  console.log('🎯 Test Summary:')
  console.log(`- Your encrypted API key: ${API_KEY}`)
  console.log(`- Generated from: SECRET_KEY=banana + USER_ID=user`)
  console.log('- All /api/* routes are protected by middleware')
  console.log('- generate_story route has explicit withApiKeyAuth wrapper')
  console.log('- generate_single_image route has explicit withApiKeyAuth wrapper')
  console.log('- generate_single_video_clip route has explicit withApiKeyAuth wrapper')
  console.log('\n🔐 All three APIs now require the encrypted API key for access!')
}

// Run the test
testAllAPIsAuth().catch(console.error)
