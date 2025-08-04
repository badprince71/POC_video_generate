const fetch = require('node-fetch');

async function testSaveFrames() {
  try {
    const testData = {
      frames: [
        {
          id: 1,
          timestamp: "0:00",
          imageUrl: "https://example.com/test1.jpg",
          description: "Test frame 1",
          prompt: "Test prompt 1"
        },
        {
          id: 2,
          timestamp: "0:05",
          imageUrl: "https://example.com/test2.jpg",
          description: "Test frame 2",
          prompt: "Test prompt 2"
        }
      ],
      userId: "test_user_123",
      sessionId: "test_session_" + Date.now(),
      originalPrompt: "Test video generation",
      videoDuration: 10,
      frameCount: 2,
      style: "Realistic",
      mood: "Vibrant"
    };

    console.log('Testing save_frames API...');
    console.log('Request data:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:3000/api/save_frames', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (!response.ok) {
      console.error('Error:', response.status, result);
    } else {
      console.log('Success!');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSaveFrames(); 