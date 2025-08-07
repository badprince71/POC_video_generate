const API_KEY = 'sk-test-1234567890abcdef';
const BASE_URL = 'http://localhost:3000/api/public'; // Change this to your domain

// Simple base64 test image (1x1 pixel PNG)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function testAPI() {
  console.log('🧪 Testing Public API Endpoints...\n');

  try {
    // Test 1: Status endpoint (no auth required)
    console.log('1. Testing status endpoint...');
    const statusResponse = await fetch(`${BASE_URL}/status`);
    const statusData = await statusResponse.json();
    console.log('✅ Status:', statusData.status);
    console.log('📋 Available endpoints:', Object.keys(statusData.endpoints.public).length);
    console.log('');

    // Test 2: Upload image (with auth)
    console.log('2. Testing image upload...');
    const uploadResponse = await fetch(`${BASE_URL}/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        imageData: TEST_IMAGE_BASE64,
        filename: 'test-image.png'
      })
    });
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('✅ Image uploaded successfully');
      console.log('📁 S3 Key:', uploadData.s3Key);
      console.log('🔗 URL:', uploadData.imageUrl);
    } else {
      const errorData = await uploadResponse.json();
      console.log('❌ Upload failed:', errorData.error);
    }
    console.log('');

    // Test 3: Generate images (with auth)
    console.log('3. Testing image generation...');
    const generateResponse = await fetch(`${BASE_URL}/generate-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        image: TEST_IMAGE_BASE64,
        prompt: 'A person walking in a park',
        numImages: 2
      })
    });
    
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      console.log('✅ Images generated successfully');
      console.log('🖼️ Generated count:', generateData.generatedCount);
      console.log('📊 Requested count:', generateData.requestedCount);
      if (generateData.errors) {
        console.log('⚠️ Errors:', generateData.errors);
      }
    } else {
      const errorData = await generateResponse.json();
      console.log('❌ Generation failed:', errorData.error);
    }
    console.log('');

    // Test 4: Test without API key (should fail)
    console.log('4. Testing authentication (should fail without API key)...');
    const noAuthResponse = await fetch(`${BASE_URL}/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageData: TEST_IMAGE_BASE64
      })
    });
    
    if (noAuthResponse.status === 401) {
      const errorData = await noAuthResponse.json();
      console.log('✅ Authentication working correctly');
      console.log('🔒 Error:', errorData.error);
    } else {
      console.log('❌ Authentication not working properly');
    }
    console.log('');

    // Test 5: Test rate limiting (make multiple requests quickly)
    console.log('5. Testing rate limiting...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch(`${BASE_URL}/status`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        })
      );
    }
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.ok).length;
    const rateLimitCount = responses.filter(r => r.status === 429).length;
    
    console.log(`📊 Rate limit test: ${successCount} successful, ${rateLimitCount} rate limited`);
    console.log('');

    console.log('🎉 API testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testAPI(); 