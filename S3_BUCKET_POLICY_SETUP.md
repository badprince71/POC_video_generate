# 🔧 S3 Bucket Policy Setup (ACL Error Fix)

## 🐛 **Problem Fixed**
The error `AccessControlListNotSupported: The bucket does not allow ACLs` occurs because your S3 bucket has ACLs disabled (which is a modern security best practice).

## ✅ **Solution**
I've removed all `ACL: 'public-read'` parameters from the upload functions. Now you need to set up a **bucket policy** instead to allow public read access.

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

### 3. **If you don't know your Account ID or IAM user**, use this simpler policy:

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
}
```

**Note**: This simpler policy allows public read access but relies on your AWS credentials for upload permissions.

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
Uploading image to S3: reference-frames/kylesmith010701/frame_1_timestamp.png
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

## 🎉 **Ready to Test!**

Once you apply the bucket policy, your uploads should work perfectly! 🚀