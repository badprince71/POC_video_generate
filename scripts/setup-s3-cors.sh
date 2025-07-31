#!/bin/bash

# S3 Bucket CORS and Policy Setup Script
# This script configures your S3 bucket to allow video generation from uploaded frames

BUCKET_NAME="happinest-aiinvitations"
REGION="us-east-1"

echo "🔧 Setting up S3 bucket configuration for video generation..."
echo "📦 Bucket: $BUCKET_NAME"
echo "🌍 Region: $REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Create CORS configuration file
cat > /tmp/cors-config.json << 'EOF'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": [
                "http://localhost:3000",
                "https://localhost:3000",
                "https://*.vercel.app",
                "https://*.netlify.app",
                "*"
            ],
            "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

# Create bucket policy file
cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF

echo "📝 Configuration files created:"
echo "   - CORS config: /tmp/cors-config.json"
echo "   - Bucket policy: /tmp/bucket-policy.json"
echo ""

# Apply CORS configuration
echo "🔄 Applying CORS configuration..."
if aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration file:///tmp/cors-config.json; then
    echo "✅ CORS configuration applied successfully"
else
    echo "❌ Failed to apply CORS configuration"
    exit 1
fi

# Apply bucket policy
echo "🔄 Applying bucket policy for public read access..."
if aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file:///tmp/bucket-policy.json; then
    echo "✅ Bucket policy applied successfully"
else
    echo "❌ Failed to apply bucket policy"
    exit 1
fi

# Update public access block settings
echo "🔄 Updating public access block settings..."
cat > /tmp/public-access-block.json << 'EOF'
{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": false,
    "RestrictPublicBuckets": false
}
EOF

if aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration file:///tmp/public-access-block.json; then
    echo "✅ Public access block settings updated"
else
    echo "❌ Failed to update public access block settings"
    exit 1
fi

echo ""
echo "🎉 S3 bucket configuration completed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ CORS configuration applied"
echo "   ✅ Public read access enabled"
echo "   ✅ Public access block settings updated"
echo ""
echo "🧪 Testing configuration..."

# Test CORS configuration
echo "🔍 Testing CORS headers..."
CORS_TEST=$(curl -sI -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  "https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/" | grep -i "access-control")

if [ -n "$CORS_TEST" ]; then
    echo "✅ CORS headers are present:"
    echo "$CORS_TEST"
else
    echo "⚠️  CORS headers not detected (may take a few minutes to propagate)"
fi

echo ""
echo "🔧 Manual verification steps:"
echo "1. Check CORS configuration:"
echo "   aws s3api get-bucket-cors --bucket $BUCKET_NAME"
echo ""
echo "2. Check bucket policy:"
echo "   aws s3api get-bucket-policy --bucket $BUCKET_NAME"
echo ""
echo "3. Test a sample frame URL in your browser:"
echo "   https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/reference-frames/[USER_ID]/[FRAME_NAME]"
echo ""
echo "4. Test the image conversion API:"
echo "   curl -X POST http://localhost:3000/api/convert_s3_image_to_base64 \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"s3Key\":\"reference-frames/[USER_ID]/[FRAME_NAME]\"}'"
echo ""

# Cleanup temporary files
rm -f /tmp/cors-config.json /tmp/bucket-policy.json /tmp/public-access-block.json

echo "🧹 Temporary files cleaned up"
echo ""
echo "🚀 Your S3 bucket is now configured for video generation!"
echo "   You can now use the video generation APIs without CORS issues."