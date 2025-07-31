# S3 Bucket CORS and Access Fix

## Issues Found
1. **CORS Error**: S3 bucket blocks cross-origin requests
2. **403 Forbidden**: Objects not publicly accessible  
3. **Failed to fetch**: Can't convert images to base64

## Solutions

### 1. Fix S3 Bucket CORS Configuration

Add this CORS configuration to your S3 bucket:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT", 
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://your-domain.com",
            "*"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-meta-custom-header"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

### 2. Fix S3 Bucket Public Access Policy

Add this bucket policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::happinest-aiinvitations/*"
        }
    ]
]
```

### 3. AWS Console Steps

#### Step A: Set CORS Configuration
1. Go to AWS S3 Console
2. Select bucket: `happinest-aiinvitations`
3. Go to **Permissions** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit** and paste the CORS JSON above
6. Click **Save changes**

#### Step B: Set Bucket Policy  
1. In same **Permissions** tab
2. Scroll to **Bucket policy**
3. Click **Edit** and paste the policy JSON above
4. Click **Save changes**

#### Step C: Block Public Access Settings
1. In **Permissions** tab
2. Go to **Block public access (bucket settings)**
3. Click **Edit**
4. **Uncheck** these options:
   - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public access to buckets and objects granted through any public bucket or access point policies
5. Click **Save changes**
6. Type "confirm" when prompted

### 4. Test Configuration

After applying the changes, test with:

```bash
# Test CORS and public access
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/

# Test public object access
curl -I https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/reference-frames/[USER_ID]/[FRAME_FILE]
```

You should see CORS headers in the response and 200 OK for object access.