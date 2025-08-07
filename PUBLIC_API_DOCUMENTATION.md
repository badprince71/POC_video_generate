# Public API Documentation

## Overview

This API provides access to video generation and image processing services. All endpoints require API key authentication.

## Authentication

All API requests must include an API key in one of the following ways:

### Option 1: Authorization Header (Recommended)
```
Authorization: Bearer sk-test-1234567890abcdef
```

### Option 2: X-API-Key Header
```
X-API-Key: sk-test-1234567890abcdef
```

## Rate Limits

- **60 requests per minute**
- **1000 requests per hour**

## Base URL

```
https://your-domain.com/api/public
```

## Endpoints

### 1. Status Check

Check if the API is running and get basic information.

**Endpoint:** `GET /api/public/status`

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "service": "Video Generation API",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "endpoints": {
    "public": {
      "status": "GET /api/public/status",
      "generateImages": "POST /api/public/generate-images",
      "generateVideo": "POST /api/public/generate-video",
      "uploadImage": "POST /api/public/upload-image"
    }
  },
  "authentication": {
    "type": "API Key",
    "header": "Authorization: Bearer <your-api-key>",
    "alternativeHeader": "X-API-Key: <your-api-key>"
  },
  "rateLimits": {
    "requestsPerMinute": 60,
    "requestsPerHour": 1000
  }
}
```

### 2. Generate Images

Generate multiple images from a reference image and prompt using AI.

**Endpoint:** `POST /api/public/generate-images`

**Authentication:** Required

**Request Body:**
```json
{
  "image": "base64_encoded_image_data",
  "prompt": "A person walking in a park",
  "numImages": 5
}
```

**Parameters:**
- `image` (required): Base64 encoded image data
- `prompt` (required): Text description for image generation
- `numImages` (optional): Number of images to generate (default: 5, max: 10)

**Response:**
```json
{
  "imageUrls": [
    "/generated-images/generated-1704067200000-0-abc123.png",
    "/generated-images/generated-1704067200000-1-def456.png"
  ],
  "generatedCount": 2,
  "requestedCount": 5,
  "errors": [
    "Failed to generate image 3: OpenAI safety system rejection"
  ]
}
```

### 3. Upload Image

Upload an image to S3 storage.

**Endpoint:** `POST /api/public/upload-image`

**Authentication:** Required

**Request Body:**
```json
{
  "imageData": "base64_encoded_image_data",
  "filename": "my-image.png",
  "userId": "user123",
  "requestId": "req456",
  "type": "user-uploads"
}
```

**Parameters:**
- `imageData` (required): Base64 encoded image data
- `filename` (optional): Custom filename (auto-generated if not provided)
- `userId` (optional): User identifier (default: "public-user")
- `requestId` (optional): Request identifier (auto-generated if not provided)
- `type` (optional): "user-uploads" or "reference-frames" (default: "user-uploads")

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://your-bucket.s3.amazonaws.com/user123/req456/user-uploads/my-image.png",
  "s3Key": "user123/req456/user-uploads/my-image.png",
  "userId": "user123",
  "requestId": "req456",
  "filename": "my-image.png",
  "type": "user-uploads",
  "uploadedAt": "2024-01-01T00:00:00.000Z"
}
```

### 4. Generate Video

Generate a video from multiple images using AI.

**Endpoint:** `POST /api/public/generate-video`

**Authentication:** Required

**Request Body:**
```json
{
  "images": [
    "base64_encoded_image_1",
    "base64_encoded_image_2",
    "base64_encoded_image_3"
  ],
  "prompt": "A person walking in a park",
  "userId": "user123",
  "requestId": "req456"
}
```

**Parameters:**
- `images` (required): Array of base64 encoded image data
- `prompt` (required): Text description for video generation
- `userId` (optional): User identifier (default: "public-user")
- `requestId` (optional): Request identifier (auto-generated if not provided)

**Response:**
```json
{
  "success": true,
  "videoUrl": "https://your-bucket.s3.amazonaws.com/user123/req456/video-clips/final-video.mp4",
  "userId": "user123",
  "requestId": "req456",
  "frameCount": 3,
  "prompt": "A person walking in a park",
  "generatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "success": false
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (missing required parameters)
- `401`: Unauthorized (invalid or missing API key)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Usage Examples

### JavaScript/Node.js

```javascript
const API_KEY = 'sk-test-1234567890abcdef';
const BASE_URL = 'https://your-domain.com/api/public';

// Check API status
async function checkStatus() {
  const response = await fetch(`${BASE_URL}/status`);
  const data = await response.json();
  console.log(data);
}

// Generate images
async function generateImages(imageBase64, prompt) {
  const response = await fetch(`${BASE_URL}/generate-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      image: imageBase64,
      prompt: prompt,
      numImages: 3
    })
  });
  
  const data = await response.json();
  return data;
}

// Upload image
async function uploadImage(imageBase64, filename) {
  const response = await fetch(`${BASE_URL}/upload-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      imageData: imageBase64,
      filename: filename
    })
  });
  
  const data = await response.json();
  return data;
}

// Generate video
async function generateVideo(images, prompt) {
  const response = await fetch(`${BASE_URL}/generate-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      images: images,
      prompt: prompt
    })
  });
  
  const data = await response.json();
  return data;
}
```

### Python

```python
import requests
import base64

API_KEY = 'sk-test-1234567890abcdef'
BASE_URL = 'https://your-domain.com/api/public'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Check API status
def check_status():
    response = requests.get(f'{BASE_URL}/status')
    return response.json()

# Generate images
def generate_images(image_base64, prompt):
    data = {
        'image': image_base64,
        'prompt': prompt,
        'numImages': 3
    }
    response = requests.post(f'{BASE_URL}/generate-images', 
                           headers=headers, json=data)
    return response.json()

# Upload image
def upload_image(image_base64, filename):
    data = {
        'imageData': image_base64,
        'filename': filename
    }
    response = requests.post(f'{BASE_URL}/upload-image', 
                           headers=headers, json=data)
    return response.json()

# Generate video
def generate_video(images, prompt):
    data = {
        'images': images,
        'prompt': prompt
    }
    response = requests.post(f'{BASE_URL}/generate-video', 
                           headers=headers, json=data)
    return response.json()
```

### cURL

```bash
# Check status
curl -X GET https://your-domain.com/api/public/status

# Generate images
curl -X POST https://your-domain.com/api/public/generate-images \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_image_data",
    "prompt": "A person walking in a park",
    "numImages": 3
  }'

# Upload image
curl -X POST https://your-domain.com/api/public/upload-image \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "base64_encoded_image_data",
    "filename": "my-image.png"
  }'

# Generate video
curl -X POST https://your-domain.com/api/public/generate-video \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{
    "images": ["base64_image_1", "base64_image_2"],
    "prompt": "A person walking in a park"
  }'
```

## Best Practices

1. **Always handle errors gracefully** - Check for error responses and implement retry logic
2. **Respect rate limits** - Implement exponential backoff for rate limit errors
3. **Use appropriate image formats** - PNG or JPEG with reasonable file sizes
4. **Store API keys securely** - Never expose API keys in client-side code
5. **Monitor usage** - Track API calls and implement logging for debugging

## Support

For API support and questions, please contact your API provider. 