# Troubleshooting S3 Video Generation Issues

## 🔍 Common Error Analysis

### Error 1: CORS Policy Violation
```
Access to fetch at 'video-generation:1' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Root Cause:** S3 bucket doesn't allow cross-origin requests from your domain.

**Solutions:**
1. ✅ **Use the automated script** (recommended):
   ```bash
   chmod +x scripts/setup-s3-cors.sh
   ./scripts/setup-s3-cors.sh
   ```

2. ✅ **Manual AWS Console Setup:**
   - Go to S3 Console → Your Bucket → Permissions → CORS
   - Add the CORS configuration from `S3_BUCKET_CORS_FIX.md`

3. ✅ **Use server-side conversion** (bypasses CORS):
   - The system now automatically tries server-side image conversion
   - Uses `/api/convert_s3_image_to_base64` endpoint

### Error 2: 403 Forbidden on S3 Objects
```
GET https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/reference-fra... net::ERR_FAILED 403 (Forbidden)
```

**Root Cause:** S3 objects are not publicly accessible.

**Solutions:**
1. ✅ **Apply bucket policy** for public read access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow", 
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::happinest-aiinvitations/*"
     }]
   }
   ```

2. ✅ **Update public access block settings:**
   - Uncheck "Block public access to buckets and objects granted through any public bucket or access point policies"

3. ✅ **Use signed URLs** (alternative):
   - The system now automatically falls back to signed URLs
   - Generated via `getSignedFrameUrl()` function

### Error 3: Failed to Convert Image to Base64
```
Error converting image to base64: TypeError: Failed to fetch
```

**Root Cause:** Cannot access S3 images due to CORS or permissions.

**Solutions:**
1. ✅ **Server-side conversion** (implemented):
   - Uses `/api/convert_s3_image_to_base64` endpoint
   - Tries multiple access methods: S3 direct, signed URL, public URL

2. ✅ **Test image accessibility:**
   ```bash
   curl -I "https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/reference-frames/[USER_ID]/[FRAME]"
   ```

3. ✅ **API testing endpoint:**
   ```bash
   curl "http://localhost:3000/api/convert_s3_image_to_base64?s3Key=reference-frames/[USER_ID]/[FRAME]"
   ```

## 🛠️ Step-by-Step Fix Process

### Step 1: Verify AWS Configuration
```bash
# Check AWS CLI access
aws sts get-caller-identity

# List bucket contents
aws s3 ls s3://happinest-aiinvitations/reference-frames/ --recursive

# Check current CORS config
aws s3api get-bucket-cors --bucket happinest-aiinvitations
```

### Step 2: Apply S3 Configuration
```bash
# Run the automated setup script
chmod +x scripts/setup-s3-cors.sh
./scripts/setup-s3-cors.sh
```

### Step 3: Test Configuration
```bash
# Test CORS headers
curl -sI -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  "https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/"

# Test public access to a frame
curl -I "https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/reference-frames/[USER_ID]/[FRAME_FILE]"
```

### Step 4: Test Video Generation API
```bash
# Test image conversion
curl -X POST http://localhost:3000/api/convert_s3_image_to_base64 \
  -H "Content-Type: application/json" \
  -d '{"s3Key":"reference-frames/[USER_ID]/[FRAME_NAME]"}'

# Test video generation workflow
curl -X POST http://localhost:3000/api/process_s3_video_workflow \
  -H "Content-Type: application/json" \
  -d '{"userId":"[USER_ID]","action":"list_frames"}'
```

## 🔧 Advanced Troubleshooting

### Check S3 Bucket Permissions
```bash
# Get bucket policy
aws s3api get-bucket-policy --bucket happinest-aiinvitations

# Get public access block settings  
aws s3api get-public-access-block --bucket happinest-aiinvitations

# Get bucket ACL
aws s3api get-bucket-acl --bucket happinest-aiinvitations
```

### Check Object-Level Permissions
```bash
# Get object ACL for a specific frame
aws s3api get-object-acl --bucket happinest-aiinvitations --key "reference-frames/[USER_ID]/[FRAME_NAME]"

# List objects with metadata
aws s3api list-objects-v2 --bucket happinest-aiinvitations --prefix "reference-frames/[USER_ID]/"
```

### Network Debugging
```bash
# Test connectivity to S3
ping happinest-aiinvitations.s3.us-east-1.amazonaws.com

# Test DNS resolution
nslookup happinest-aiinvitations.s3.us-east-1.amazonaws.com

# Check SSL certificate
openssl s_client -connect happinest-aiinvitations.s3.us-east-1.amazonaws.com:443 -servername happinest-aiinvitations.s3.us-east-1.amazonaws.com
```

## 🐛 Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| **403 Forbidden** | No read access to S3 object | Apply bucket policy + public access settings |
| **CORS Error** | Cross-origin request blocked | Configure S3 CORS rules |
| **TypeError: Failed to fetch** | Network/permission issue | Use server-side conversion API |
| **ERR_FAILED** | Generic network failure | Check S3 permissions and connectivity |
| **NoSuchKey** | S3 object doesn't exist | Verify frame upload and S3 key path |

## 📊 System Architecture

```
Frontend Request → CORS Check → Server-side Conversion → S3 Access → RunwayML → Video Generation
                      ↓              ↓                    ↓
                 Browser Direct → API Endpoint → Multiple Methods:
                 (if CORS OK)    (bypasses CORS)   1. Direct S3
                                                   2. Signed URL  
                                                   3. Public URL
```

## 🎯 Testing Checklist

- [ ] AWS CLI configured and working
- [ ] S3 bucket CORS configuration applied
- [ ] S3 bucket policy for public read access applied
- [ ] Public access block settings configured
- [ ] Can access S3 frames via browser (test a URL)
- [ ] Image conversion API returns base64 data
- [ ] Video generation API lists frames successfully
- [ ] Video generation API generates clips successfully
- [ ] Client-side video merging works

## 📞 Getting Help

### Debug Information to Collect
```bash
# Environment info
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "AWS CLI: $(aws --version)"

# S3 configuration
aws s3api get-bucket-location --bucket happinest-aiinvitations
aws s3api get-bucket-cors --bucket happinest-aiinvitations
aws s3api get-bucket-policy --bucket happinest-aiinvitations

# Test API endpoints
curl -X GET "http://localhost:3000/api/convert_s3_image_to_base64"
curl -X GET "http://localhost:3000/api/process_s3_video_workflow?action=info"
```

### Common Fixes Summary
1. **Run the setup script**: `./scripts/setup-s3-cors.sh`
2. **Use server-side conversion**: Already implemented in the new system
3. **Check browser console**: Look for specific error messages
4. **Test individual components**: Use the API testing endpoints
5. **Verify S3 configuration**: Use AWS CLI commands above

The new system includes multiple fallback mechanisms, so most CORS and access issues should be automatically resolved. If problems persist, the issue is likely in the S3 bucket configuration rather than the code.