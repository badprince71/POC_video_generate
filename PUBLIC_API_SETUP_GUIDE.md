# Public API Setup Guide

This guide will help you set up and deploy your video generation APIs as a public service.

## Prerequisites

- Node.js 18+ installed
- AWS S3 bucket configured
- OpenAI API key
- Vercel account (for deployment)

## 1. Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# Admin Configuration
ADMIN_API_KEY=your_admin_api_key_here

# Database (if using Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
```

## 2. API Key Management

### Default API Keys

The system comes with these default API keys for testing:

- **Test Key**: `sk-test-1234567890abcdef` (60 req/min, 1000 req/hour)
- **Production Key**: `sk-prod-abcdef1234567890` (100 req/min, 5000 req/hour)
- **Limited Key**: `sk-limited-xyz789` (10 req/min, 100 req/hour, limited endpoints)

### Managing API Keys

You can manage API keys through the admin endpoint:

```bash
# List all API keys
curl -X GET https://your-domain.com/api/admin/api-keys \
  -H "X-Admin-Key: your_admin_api_key"

# Create new API key
curl -X POST https://your-domain.com/api/admin/api-keys \
  -H "X-Admin-Key: your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Client API Key",
    "description": "API key for client application",
    "rateLimit": {
      "requestsPerMinute": 50,
      "requestsPerHour": 2000
    },
    "allowedEndpoints": ["*"]
  }'

# Update API key
curl -X PUT https://your-domain.com/api/admin/api-keys \
  -H "X-Admin-Key: your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "sk-test-1234567890abcdef",
    "updates": {
      "isActive": false
    }
  }'

# Delete API key
curl -X DELETE https://your-domain.com/api/admin/api-keys \
  -H "X-Admin-Key: your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "sk-test-1234567890abcdef"
  }'
```

## 3. S3 Bucket Configuration

### Bucket Policy

Ensure your S3 bucket has the correct CORS configuration:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## 4. Deployment

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test the API
node test-public-api.js
```

### Vercel Deployment

1. **Connect your repository to Vercel**
2. **Set environment variables** in Vercel dashboard
3. **Deploy**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables in Vercel

Go to your Vercel project dashboard → Settings → Environment Variables and add:

- `OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `ADMIN_API_KEY`

## 5. Testing Your API

### Quick Test

```bash
# Test status endpoint
curl https://your-domain.com/api/public/status

# Test with API key
curl -X POST https://your-domain.com/api/public/upload-image \
  -H "Authorization: Bearer sk-test-1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "filename": "test.png"
  }'
```

### Run Test Suite

```bash
# Update the BASE_URL in test-public-api.js
# Then run:
node test-public-api.js
```

## 6. Production Considerations

### Security

1. **Use HTTPS only** - All API calls should use HTTPS
2. **Rotate API keys regularly** - Implement key rotation policies
3. **Monitor usage** - Set up logging and monitoring
4. **Rate limiting** - Adjust rate limits based on your infrastructure
5. **Input validation** - Validate all inputs thoroughly

### Performance

1. **CDN** - Use a CDN for static assets
2. **Caching** - Implement caching for frequently accessed data
3. **Database optimization** - If using a database, optimize queries
4. **Image optimization** - Compress images before processing

### Monitoring

Set up monitoring for:

- API response times
- Error rates
- Rate limit hits
- S3 upload/download times
- OpenAI API usage

### Logging

Implement structured logging:

```javascript
// Example logging in your API routes
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  endpoint: '/api/public/generate-images',
  apiKey: getApiKeyFromRequest(request)?.substring(0, 10) + '...',
  userId: requestBody.userId,
  success: true,
  duration: Date.now() - startTime
}))
```

## 7. API Documentation

### Auto-generated Documentation

Consider using tools like:

- **Swagger/OpenAPI** - Generate interactive API docs
- **Postman** - Create API collections
- **Insomnia** - API testing and documentation

### Example Swagger Configuration

```yaml
openapi: 3.0.0
info:
  title: Video Generation API
  version: 1.0.0
  description: AI-powered video generation service
servers:
  - url: https://your-domain.com/api/public
security:
  - ApiKeyAuth: []
paths:
  /status:
    get:
      summary: Check API status
      responses:
        '200':
          description: API status
  /generate-images:
    post:
      summary: Generate images from reference
      security:
        - ApiKeyAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                image:
                  type: string
                  description: Base64 encoded image
                prompt:
                  type: string
                  description: Generation prompt
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: Authorization
```

## 8. Troubleshooting

### Common Issues

1. **CORS errors** - Check S3 bucket CORS configuration
2. **Rate limiting** - Monitor API usage and adjust limits
3. **Authentication errors** - Verify API key format and validity
4. **S3 upload failures** - Check AWS credentials and bucket permissions
5. **OpenAI errors** - Verify API key and check usage limits

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=api:*
```

### Health Checks

Implement health check endpoints:

```javascript
// app/api/health/route.ts
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      s3: 'connected',
      openai: 'connected'
    }
  })
}
```

## 9. Scaling

### Horizontal Scaling

- Use multiple server instances
- Implement load balancing
- Use Redis for rate limiting
- Consider serverless functions

### Vertical Scaling

- Increase server resources
- Optimize database queries
- Implement caching layers
- Use CDN for static assets

## 10. Support and Maintenance

### Regular Tasks

1. **Monitor API usage** - Track usage patterns and costs
2. **Update dependencies** - Keep packages updated
3. **Backup data** - Regular backups of configuration
4. **Security audits** - Regular security reviews
5. **Performance optimization** - Monitor and optimize performance

### Support Channels

- Email support
- Documentation updates
- Community forums
- Status page for outages

## Next Steps

1. **Deploy your API** using the steps above
2. **Test thoroughly** with the provided test suite
3. **Set up monitoring** and logging
4. **Create documentation** for your users
5. **Implement additional features** as needed

Your public API is now ready for production use! 🚀 