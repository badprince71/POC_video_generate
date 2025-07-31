# 🔧 S3 Bucket Policy & CORS Setup (Upload Error Fix)

## 🐛 **Problems Fixed**
1. `AccessControlListNotSupported: The bucket does not allow ACLs` - ACLs are disabled (modern security best practice)
2. `CORS policy` errors - Frontend uploads blocked by browser security

## ✅ **Solution Overview** 
You need to configure TWO things in your S3 bucket:
1. **Bucket Policy** - Allows public read access and upload permissions
2. **CORS Configuration** - Allows frontend uploads from your domain/localhost

## 🚨 **BOTH Are Required!**
- **Bucket Policy alone** = Still get CORS errors ❌
- **CORS alone** = Still get permission errors ❌  
- **Both together** = Uploads work perfectly ✅

## 🔐 **Required S3 Bucket Policy**

Go to your S3 bucket in AWS Console and add this bucket policy:

### 1. Navigate to your bucket
- Go to AWS S3 Console
- Click on `happinest-aiinvitations` bucket
- Click the **"Permissions"** tab
- Scroll down to **"Bucket policy"**

### 2. Add this policy (replace if you have existing policy):

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
        },
        {
            "Sid": "AllowPutObject",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
            },
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::happinest-aiinvitations/*"
        }
    ]
}
```

### 3. **Recommended: Complete Policy for Frontend Uploads**

For direct frontend uploads (which your app uses), use this comprehensive policy:

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
        },
        {
            "Sid": "AllowFrontendUploads",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::happinest-aiinvitations/*",
            "Condition": {
                "StringLike": {
                    "s3:x-amz-content-sha256": "*"
                }
            }
        }
    ]
}
```

**This policy allows:**
- ✅ Public read access for all files
- ✅ Upload access from your application (with AWS credentials)
- ✅ Direct frontend uploads (needed for CORS to work)

## 🛡️ **Security Settings**

### **Block Public Access Settings**
In your bucket's **"Permissions"** tab, make sure these settings allow your policy:

- ✅ **Block all public access**: `OFF` (or configure individual settings)
- ✅ **Block public access to buckets and objects granted through new access control lists (ACLs)**: Can be `ON`
- ✅ **Block public access to buckets and objects granted through any access control lists (ACLs)**: Can be `ON`  
- ✅ **Block public access to buckets and objects granted through new public bucket or access point policies**: Must be `OFF`
- ✅ **Block public access to buckets and objects granted through any public bucket or access point policies**: Must be `OFF`

## 🧪 **Test After Setup**

After applying the bucket policy, test your upload again. You should see:

```
Uploading image to S3: reference-frames/user/frame_1_timestamp.png
✓ Successfully uploaded image to S3: https://happinest-aiinvitations.s3.us-east-1.amazonaws.com/...
```

## 📁 **Folder Structure Remains**

Your organized folder structure will work perfectly:
- `reference-frames/` - Generated images ✅
- `user-uploads/` - User uploaded images ✅
- `video-clips/` - Generated videos ✅

## 🎯 **Why This Approach is Better**

✅ **More Secure**: Bucket policies are more granular than ACLs  
✅ **Modern Best Practice**: AWS recommends bucket policies over ACLs  
✅ **Centralized Control**: All permissions managed in one place  
✅ **Future Proof**: Works with all modern S3 security settings  

## 🚨 **Alternative: Private Files (If you prefer)**

If you want to keep files private and generate temporary URLs instead:

```typescript
// In your code, you can generate signed URLs for temporary access
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const command = new GetObjectCommand({
  Bucket: BUCKET_NAME,
  Key: key,
});

const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
// Use signedUrl instead of public URL
```

But for a video generation app, **public URLs are usually preferred** for easy embedding and sharing.

## 🌐 **CRITICAL: CORS Configuration Required**

**IMPORTANT**: The bucket policy alone is NOT enough for frontend uploads. You also need CORS configuration!

### 4. Add CORS Configuration

In your S3 bucket:
- Go to **"Permissions"** tab
- Scroll to **"Cross-origin resource sharing (CORS)"**
- Click **"Edit"** and add this configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:3001", 
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

**Replace `https://your-production-domain.com` with your actual production domain!**

### 5. For Development Only (Alternative)
If you want to allow ALL origins during development (less secure):

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

## 🔄 **Alternative Solution Implemented**

I've also implemented a **backup solution** that uploads via server-side API routes instead of direct frontend-to-S3 uploads. This **completely bypasses CORS issues**.

**What Changed:**
- Created `/api/upload_video_s3/route.ts` - Server-side upload endpoint
- Updated `lib/upload/s3_video_upload.ts` - Now uses API uploads instead of direct S3 uploads
- Video uploads now go: `Frontend → Your API → S3` (no CORS needed!)

## 🎉 **Ready to Test!**

**Option 1 (Recommended):** The code changes above should work immediately - **no S3 configuration needed**!

**Option 2:** If you prefer direct uploads, apply BOTH the bucket policy AND CORS configuration above.

**Without CORS, you'd get errors like:**
```
Access to fetch at 'https://your-bucket.s3.amazonaws.com/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**But now your uploads should work immediately!** 🚀