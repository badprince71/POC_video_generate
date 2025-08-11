# API Testing Quick Reference

## 🚀 Quick Start

### 1. Test Your API Right Now
```bash
# Using the existing Node.js test
node test-public-api.js

# Using the Python test
python test_api_python.py

# Using cURL
curl -X GET http://localhost:3000/api/public/status
```

### 2. Import Postman Collection
1. Open Postman
2. Click "Import" → "File"
3. Select `Video_Generation_API.postman_collection.json`
4. Set environment variables

## 📋 Common Testing Commands

### cURL Commands

#### Basic Status Check
```bash
curl -X GET http://localhost:3000/api/public/status
```

#### Authenticated Request
```bash
curl -X POST http://localhost:3000/api/public/upload-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -d '{"imageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}'
```

#### Test Authentication (Should Fail)
```bash
curl -X POST http://localhost:3000/api/public/upload-image \
  -H "Content-Type: application/json" \
  -d '{"imageData": "test"}'
```

#### Test Rate Limiting
```bash
# Make 10 requests quickly
for i in {1..10}; do
  curl -X GET http://localhost:3000/api/public/status
  sleep 0.1
done
```

### JavaScript/Node.js

#### Basic Test
```javascript
const response = await fetch('http://localhost:3000/api/public/status');
const data = await response.json();
console.log(data);
```

#### Authenticated Test
```javascript
const response = await fetch('http://localhost:3000/api/public/generate-images', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-test-1234567890abcdef'
  },
  body: JSON.stringify({
    image: 'base64_image_data',
    prompt: 'A person walking in a park',
    numImages: 2
  })
});
```

### Python

#### Basic Test
```python
import requests

response = requests.get('http://localhost:3000/api/public/status')
print(response.json())
```

#### Authenticated Test
```python
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-test-1234567890abcdef'
}

data = {
    'image': 'base64_image_data',
    'prompt': 'A person walking in a park',
    'numImages': 2
}

response = requests.post(
    'http://localhost:3000/api/public/generate-images',
    headers=headers,
    json=data
)
print(response.json())
```

## 🔧 Postman Setup

### Environment Variables
```
base_url: http://localhost:3000/api/public
api_key: sk-test-1234567890abcdef
```

### Quick Tests in Postman
1. **Status**: `GET {{base_url}}/status`
2. **Upload**: `POST {{base_url}}/upload-image`
3. **Generate Images**: `POST {{base_url}}/generate-images`
4. **Generate Video**: `POST {{base_url}}/generate-video`

## 🧪 Test Scenarios

### 1. Happy Path Tests
- ✅ Status endpoint returns 200
- ✅ Upload with valid API key works
- ✅ Image generation with valid data works
- ✅ Video generation with valid data works

### 2. Authentication Tests
- ❌ Request without API key returns 401
- ❌ Request with invalid API key returns 401
- ✅ Request with valid API key works

### 3. Error Handling Tests
- ❌ Invalid JSON returns 400
- ❌ Missing required fields returns 400
- ❌ Invalid image data returns 400
- ❌ Large payload returns 413

### 4. Rate Limiting Tests
- ✅ Multiple requests within limits work
- ❌ Too many requests return 429
- ✅ Rate limit headers are present

## 📊 Expected Responses

### Status Endpoint
```json
{
  "status": "ok",
  "service": "Video Generation API",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Upload Success
```json
{
  "s3Key": "uploads/test-image-123456.png",
  "imageUrl": "https://your-bucket.s3.amazonaws.com/uploads/test-image-123456.png"
}
```

### Generation Success
```json
{
  "generatedCount": 2,
  "requestedCount": 2,
  "imageUrls": [
    "/generated-images/generated-123456-0.png",
    "/generated-images/generated-123456-1.png"
  ]
}
```

### Error Response
```json
{
  "error": "Authentication required",
  "statusCode": 401
}
```

## 🚨 Common Issues & Solutions

### CORS Error
```
Access to fetch at 'http://localhost:3000/api/public/status' from origin 'http://localhost:3001' has been blocked by CORS policy
```
**Solution**: Check CORS configuration in your API

### 401 Unauthorized
```
401 Unauthorized
```
**Solution**: Verify API key is correct and properly formatted

### 429 Too Many Requests
```
429 Too Many Requests
```
**Solution**: Implement delays between requests or use different API keys

### Connection Refused
```
connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Make sure your API server is running on port 3000

## 📈 Performance Benchmarks

### Expected Response Times
- **Status**: < 200ms
- **Upload**: < 5s
- **Image Generation**: < 30s
- **Video Generation**: < 60s

### Rate Limits
- **60 requests per minute**
- **1000 requests per hour**

## 🔍 Debugging Tips

1. **Check Network Tab**: Use browser dev tools
2. **Use Postman Console**: View detailed request/response
3. **Add Logging**: Console.log in your test scripts
4. **Test Incrementally**: One endpoint at a time
5. **Verify Environment**: Check base URL and API keys

## 📝 Testing Checklist

- [ ] API server is running
- [ ] Environment variables are set
- [ ] API key is valid
- [ ] CORS is configured
- [ ] All endpoints respond
- [ ] Authentication works
- [ ] Rate limiting works
- [ ] Error handling works
- [ ] Response times are acceptable

## 🎯 Next Steps

1. Set up automated testing in CI/CD
2. Create monitoring and alerting
3. Document API changes
4. Set up staging environment
5. Create load testing scenarios

---

**Need Help?** Check the full `API_TESTING_GUIDE.md` for detailed instructions!





