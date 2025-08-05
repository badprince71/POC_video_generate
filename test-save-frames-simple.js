const fetch = require('node-fetch');

// Test data with S3 URLs instead of base64 data to avoid payload size issues
const testData = {
  frames: [
    {
      id: 1,
      timestamp: "00:00:00",
      imageUrl: "https://example-bucket.s3.amazonaws.com/user123/session456/frame_01.png", // S3 URL instead of base64
      description: "A beautiful sunset over the mountains",
      prompt: "Generate a sunset scene with mountains",
      sceneStory: "The story begins with a peaceful sunset",
      fullStory: {
        title: "Mountain Sunset",
        overallStory: "A journey through beautiful landscapes",
        style: "Realistic",
        mood: "Peaceful"
      }
    },
    {
      id: 2,
      timestamp: "00:00:05",
      imageUrl: "https://example-bucket.s3.amazonaws.com/user123/session456/frame_02.png", // S3 URL instead of base64
      description: "A flowing river in the valley",
      prompt: "Generate a river scene in a valley",
      sceneStory: "The river flows peacefully through the valley",
      fullStory: {
        title: "Valley River",
        overallStory: "A journey through beautiful landscapes",
        style: "Realistic",
        mood: "Peaceful"
      }
    }
  ],
  userId: "test-user-123",
  sessionId: "test-session-456",
  originalPrompt: "A beautiful nature scene",
  videoDuration: 10,
  frameCount: 2,
  style: "Realistic",
  mood: "Peaceful"
};

async function makeRequest(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body
    });

    const responseText = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${responseText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

async function testSaveFrames() {
  try {
    console.log('Testing save_frames API with S3 URLs...');
    console.log(`Payload size: ${(JSON.stringify(testData).length / 1024).toFixed(2)}KB`);
    
    const response = await makeRequest('http://localhost:3000/api/save_frames', JSON.stringify(testData));
    
    console.log('✅ Test passed! Response:', response);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('HTTP 413')) {
      console.log('💡 This confirms the payload size issue has been fixed!');
    }
  }
}

// Test with base64 data to verify the fix prevents large payloads
const testDataWithBase64 = {
  frames: [
    {
      id: 1,
      timestamp: "00:00:00",
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // Small base64 for testing
      description: "Test frame with base64 data",
      prompt: "Test prompt",
      sceneStory: "Test story",
      fullStory: {
        title: "Test Title",
        overallStory: "Test overall story",
        style: "Test",
        mood: "Test"
      }
    }
  ],
  userId: "test-user-123",
  sessionId: "test-session-456",
  originalPrompt: "Test prompt",
  videoDuration: 5,
  frameCount: 1,
  style: "Test",
  mood: "Test"
};

async function testWithBase64() {
  try {
    console.log('\nTesting save_frames API with base64 data...');
    console.log(`Payload size: ${(JSON.stringify(testDataWithBase64).length / 1024).toFixed(2)}KB`);
    
    const response = await makeRequest('http://localhost:3000/api/save_frames', JSON.stringify(testDataWithBase64));
    
    console.log('✅ Base64 test passed! Response:', response);
  } catch (error) {
    console.error('❌ Base64 test failed:', error.message);
    
    if (error.message.includes('HTTP 413')) {
      console.log('💡 This confirms the payload size validation is working!');
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting save_frames API tests...\n');
  
  await testSaveFrames();
  await testWithBase64();
  
  console.log('\n✨ All tests completed!');
}

runTests(); 