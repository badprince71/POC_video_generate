// Test script to verify public APIs are accessible without authentication
const BASE_URL = 'http://localhost:3000';

async function testPublicAPIs() {
  console.log('🧪 Testing Public APIs (No Authentication Required)...\n');

  const tests = [
    {
      name: 'Proxy S3 Image API',
      url: `${BASE_URL}/api/proxy_s3_image?key=test`,
      expectedStatus: 400, // Should fail with 400 (missing key) but not 401 (unauthorized)
      description: 'Should be accessible without auth, but fail due to missing S3 key'
    },
    {
      name: 'Proxy S3 Video API',
      url: `${BASE_URL}/api/proxy_s3_video?key=test`,
      expectedStatus: 400,
      description: 'Should be accessible without auth, but fail due to missing S3 key'
    },
    {
      name: 'Test Database API',
      url: `${BASE_URL}/api/test-db`,
      expectedStatus: 200,
      description: 'Should be accessible without auth'
    },
    {
      name: 'Convert S3 Image API (GET)',
      url: `${BASE_URL}/api/convert_s3_image_to_base64`,
      expectedStatus: 400, // Should fail with 400 (missing params) but not 401
      description: 'Should be accessible without auth, but fail due to missing parameters'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${test.url}`);
      console.log(`Expected: ${test.description}`);
      
      const response = await fetch(test.url);
      const status = response.status;
      
      console.log(`Status: ${status}`);
      
      if (status === test.expectedStatus) {
        console.log('✅ PASS: Status matches expected');
      } else if (status === 401) {
        console.log('❌ FAIL: API requires authentication (should be public)');
      } else {
        console.log(`⚠️  UNEXPECTED: Got ${status}, expected ${test.expectedStatus}`);
      }
      
      if (status !== 401) {
        try {
          const data = await response.json();
          console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
        } catch (e) {
          console.log('Response: (non-JSON response)');
        }
      }
      
      console.log('---\n');
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}\n`);
    }
  }

  console.log('🎯 Test Summary:');
  console.log('- If you see 400 errors (not 401), the APIs are public ✅');
  console.log('- If you see 401 errors, the APIs still require authentication ❌');
  console.log('- The proxy APIs should work for serving images/videos without auth');
}

// Run the tests
testPublicAPIs().catch(console.error);
