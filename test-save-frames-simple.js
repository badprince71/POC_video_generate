const https = require('https');
const http = require('http');

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

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
        }
      ],
      userId: "test_user_123",
      sessionId: "test_session_" + Date.now(),
      originalPrompt: "Test video generation",
      videoDuration: 10,
      frameCount: 1,
      style: "Realistic",
      mood: "Vibrant"
    };

    console.log('Testing save_frames API...');
    console.log('Request data:', JSON.stringify(testData, null, 2));

    const response = await makeRequest('http://localhost:3000/api/save_frames', JSON.stringify(testData));
    
    console.log('Response status:', response.status);
    console.log('Response body:', response.body);

    if (response.status !== 200) {
      console.error('Error occurred!');
      try {
        const errorData = JSON.parse(response.body);
        console.error('Error details:', errorData);
      } catch (e) {
        console.error('Could not parse error response');
      }
    } else {
      console.log('Success!');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSaveFrames(); 