# API Testing Guide: Public APIs and Postman

## Table of Contents
1. [Testing Public APIs](#testing-public-apis)
2. [Using Postman for API Testing](#using-postman-for-api-testing)
3. [Testing Your Video Generation API](#testing-your-video-generation-api)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

## Testing Public APIs

### 1. Understanding API Testing

API testing involves verifying that your API endpoints work correctly, handle errors properly, and return expected responses. Here are the key aspects to test:

- **Functionality**: Does the API do what it's supposed to do?
- **Authentication**: Are protected endpoints properly secured?
- **Rate Limiting**: Are request limits enforced?
- **Error Handling**: Does the API return appropriate error messages?
- **Performance**: How fast does the API respond?

### 2. Testing Methods

#### A. Using cURL (Command Line)

```bash
# Test status endpoint (no auth required)
curl -X GET http://localhost:3000/api/public/status

# Test authenticated endpoint
curl -X POST http://localhost:3000/api/public/upload-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -d '{
    "imageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "filename": "test.png"
  }'
```

#### B. Using JavaScript/Node.js

```javascript
// Test API with fetch
async function testAPI() {
  const response = await fetch('http://localhost:3000/api/public/status');
  const data = await response.json();
  console.log(data);
}

// Test with authentication
async function testAuthenticatedAPI() {
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
  
  const data = await response.json();
  console.log(data);
}
```

#### C. Using Python

```python
import requests
import json

# Test status endpoint
response = requests.get('http://localhost:3000/api/public/status')
print(response.json())

# Test authenticated endpoint
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

## Using Postman for API Testing

### 1. Getting Started with Postman

1. **Download and Install**: Get Postman from [postman.com](https://www.postman.com/downloads/)
2. **Create an Account**: Sign up for a free account
3. **Create a Workspace**: Organize your API tests

### 2. Setting Up Your API Collection

#### Step 1: Create a New Collection
1. Click "New" → "Collection"
2. Name it "Video Generation API"
3. Add description: "Testing endpoints for video generation service"

#### Step 2: Set Up Environment Variables
1. Click "Environments" → "New Environment"
2. Name it "Local Development"
3. Add these variables:
   - `base_url`: `http://localhost:3000/api/public`
   - `api_key`: `sk-test-1234567890abcdef`
   - `admin_key`: `your_admin_api_key`

#### Step 3: Create Request Templates

**1. Status Check Request**
- Method: `GET`
- URL: `{{base_url}}/status`
- Headers: None required
- Tests tab:
```javascript
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has status field", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('status');
    pm.expect(response.status).to.eql('ok');
});
```

**2. Image Upload Request**
- Method: `POST`
- URL: `{{base_url}}/upload-image`
- Headers:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer {{api_key}}`
- Body (raw JSON):
```json
{
  "imageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "filename": "test-image.png"
}
```
- Tests tab:
```javascript
pm.test("Upload successful", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has S3 key", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('s3Key');
    pm.expect(response).to.have.property('imageUrl');
});
```

**3. Image Generation Request**
- Method: `POST`
- URL: `{{base_url}}/generate-images`
- Headers:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer {{api_key}}`
- Body (raw JSON):
```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "prompt": "A person walking in a park",
  "numImages": 2
}
```

### 3. Advanced Postman Features

#### A. Pre-request Scripts
Add this to automatically set the current timestamp:
```javascript
pm.environment.set("timestamp", new Date().toISOString());
```

#### B. Dynamic Variables
Use these in your requests:
- `{{$timestamp}}` - Current timestamp
- `{{$randomInt}}` - Random integer
- `{{$guid}}` - Random GUID

#### C. Test Scripts for Validation
```javascript
// Test response time
pm.test("Response time is less than 5000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});

// Test JSON structure
pm.test("Response is valid JSON", function () {
    pm.response.to.be.json;
});

// Test specific fields
pm.test("Has required fields", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('status');
    pm.expect(response).to.have.property('timestamp');
});
```

#### D. Environment Switching
Create multiple environments:
- **Local**: `http://localhost:3000/api/public`
- **Staging**: `https://staging.yourdomain.com/api/public`
- **Production**: `https://api.yourdomain.com/api/public`

### 4. Running Tests

#### A. Individual Requests
1. Select the request
2. Click "Send"
3. View response and test results

#### B. Collection Runner
1. Click "Runner" in the top bar
2. Select your collection
3. Choose environment
4. Set iterations (for load testing)
5. Click "Run"

#### C. Newman (Command Line)
```bash
# Install Newman
npm install -g newman

# Run collection
newman run "Video Generation API.postman_collection.json" \
  --environment "Local Development.postman_environment.json" \
  --reporters cli,json \
  --reporter-json-export results.json
```

## Testing Your Video Generation API

### 1. Quick Start Testing

Use the existing test file in your project:

```bash
# Run the Node.js test script
node test-public-api.js
```

### 2. Manual Testing Checklist

#### Authentication Tests
- [ ] Test without API key (should return 401)
- [ ] Test with invalid API key (should return 401)
- [ ] Test with valid API key (should work)

#### Rate Limiting Tests
- [ ] Make multiple requests quickly
- [ ] Verify rate limit headers are present
- [ ] Check that limits are enforced

#### Endpoint Tests
- [ ] Status endpoint (GET /status)
- [ ] Image upload (POST /upload-image)
- [ ] Image generation (POST /generate-images)
- [ ] Video generation (POST /generate-video)

#### Error Handling Tests
- [ ] Invalid JSON payload
- [ ] Missing required fields
- [ ] Invalid image data
- [ ] Large payloads (413 errors)

### 3. Load Testing

#### Using Artillery
```bash
# Install Artillery
npm install -g artillery

# Create load test config
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  headers:
    Authorization: 'Bearer sk-test-1234567890abcdef'
    Content-Type: 'application/json'

scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/public/status"
      - post:
          url: "/api/public/upload-image"
          json:
            imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            filename: "test.png"
EOF

# Run load test
artillery run load-test.yml
```

## Best Practices

### 1. Test Organization
- Group related tests together
- Use descriptive test names
- Include both positive and negative test cases
- Test edge cases and error conditions

### 2. Environment Management
- Use environment variables for different stages
- Never commit API keys to version control
- Use different API keys for testing vs production

### 3. Documentation
- Document expected responses
- Include example requests and responses
- Note any special requirements or limitations

### 4. Security Testing
- Test authentication thoroughly
- Verify rate limiting works
- Check for common vulnerabilities (SQL injection, XSS, etc.)

### 5. Performance Testing
- Test response times under normal load
- Verify the API handles concurrent requests
- Monitor resource usage during tests

## Troubleshooting

### Common Issues

#### 1. CORS Errors
```
Access to fetch at 'http://localhost:3000/api/public/status' from origin 'http://localhost:3001' has been blocked by CORS policy
```
**Solution**: Ensure your API has proper CORS configuration.

#### 2. Authentication Errors
```
401 Unauthorized
```
**Solution**: Check that your API key is correct and properly formatted.

#### 3. Rate Limiting
```
429 Too Many Requests
```
**Solution**: Implement proper delays between requests or use different API keys.

#### 4. Timeout Errors
```
Request timeout
```
**Solution**: Increase timeout settings or optimize your API performance.

### Debugging Tips

1. **Check Network Tab**: Use browser dev tools to see request/response details
2. **Log Everything**: Add console.log statements to track API calls
3. **Use Postman Console**: View detailed request/response information
4. **Test Incrementally**: Test one endpoint at a time
5. **Verify Environment**: Make sure you're using the correct base URL and API keys

### Getting Help

1. Check the API documentation
2. Review error logs
3. Test with simpler requests first
4. Verify your environment configuration
5. Check if the API service is running

## Next Steps

1. Set up your Postman collection using the templates above
2. Run through the testing checklist
3. Create automated tests for your CI/CD pipeline
4. Set up monitoring and alerting for your API
5. Document your testing procedures for your team

Remember: Good API testing is iterative. Start simple and gradually add more comprehensive tests as you learn more about your API's behavior and requirements.





