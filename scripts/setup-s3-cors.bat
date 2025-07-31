@echo off
REM S3 Bucket CORS and Policy Setup Script for Windows
REM This script configures your S3 bucket to allow video generation from uploaded frames

set BUCKET_NAME=happinest-aiinvitations
set REGION=us-east-1

echo 🔧 Setting up S3 bucket configuration for video generation...
echo 📦 Bucket: %BUCKET_NAME%
echo 🌍 Region: %REGION%
echo.

REM Check if AWS CLI is installed
aws --version >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS CLI is not installed. Please install it first:
    echo    https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
    pause
    exit /b 1
)

REM Check if AWS is configured
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS CLI is not configured. Please run 'aws configure' first.
    pause
    exit /b 1
)

echo ✅ AWS CLI is configured
echo.

REM Create CORS configuration file
echo Creating CORS configuration...
(
echo {
echo     "CORSRules": [
echo         {
echo             "AllowedHeaders": ["*"],
echo             "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
echo             "AllowedOrigins": [
echo                 "http://localhost:3000",
echo                 "https://localhost:3000", 
echo                 "https://*.vercel.app",
echo                 "https://*.netlify.app",
echo                 "*"
echo             ],
echo             "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"],
echo             "MaxAgeSeconds": 3000
echo         }
echo     ]
echo }
) > %TEMP%\cors-config.json

REM Create bucket policy file
echo Creating bucket policy...
(
echo {
echo     "Version": "2012-10-17",
echo     "Statement": [
echo         {
echo             "Sid": "PublicReadGetObject",
echo             "Effect": "Allow",
echo             "Principal": "*",
echo             "Action": "s3:GetObject",
echo             "Resource": "arn:aws:s3:::%BUCKET_NAME%/*"
echo         }
echo     ]
echo }
) > %TEMP%\bucket-policy.json

echo 📝 Configuration files created:
echo    - CORS config: %TEMP%\cors-config.json
echo    - Bucket policy: %TEMP%\bucket-policy.json
echo.

REM Apply CORS configuration
echo 🔄 Applying CORS configuration...
aws s3api put-bucket-cors --bucket %BUCKET_NAME% --cors-configuration file://%TEMP%\cors-config.json
if errorlevel 1 (
    echo ❌ Failed to apply CORS configuration
    pause
    exit /b 1
) else (
    echo ✅ CORS configuration applied successfully
)

REM Apply bucket policy
echo 🔄 Applying bucket policy for public read access...
aws s3api put-bucket-policy --bucket %BUCKET_NAME% --policy file://%TEMP%\bucket-policy.json
if errorlevel 1 (
    echo ❌ Failed to apply bucket policy
    pause
    exit /b 1
) else (
    echo ✅ Bucket policy applied successfully
)

REM Update public access block settings
echo 🔄 Updating public access block settings...
(
echo {
echo     "BlockPublicAcls": true,
echo     "IgnorePublicAcls": true,
echo     "BlockPublicPolicy": false,
echo     "RestrictPublicBuckets": false
echo }
) > %TEMP%\public-access-block.json

aws s3api put-public-access-block --bucket %BUCKET_NAME% --public-access-block-configuration file://%TEMP%\public-access-block.json
if errorlevel 1 (
    echo ❌ Failed to update public access block settings
    pause
    exit /b 1
) else (
    echo ✅ Public access block settings updated
)

echo.
echo 🎉 S3 bucket configuration completed successfully!
echo.
echo 📋 Summary:
echo    ✅ CORS configuration applied
echo    ✅ Public read access enabled
echo    ✅ Public access block settings updated
echo.

echo 🔧 Manual verification steps:
echo 1. Check CORS configuration:
echo    aws s3api get-bucket-cors --bucket %BUCKET_NAME%
echo.
echo 2. Check bucket policy:
echo    aws s3api get-bucket-policy --bucket %BUCKET_NAME%
echo.
echo 3. Test a sample frame URL in your browser:
echo    https://%BUCKET_NAME%.s3.%REGION%.amazonaws.com/reference-frames/[USER_ID]/[FRAME_NAME]
echo.
echo 4. Test the image conversion API:
echo    curl -X POST http://localhost:3000/api/convert_s3_image_to_base64 ^
echo         -H "Content-Type: application/json" ^
echo         -d "{\"s3Key\":\"reference-frames/[USER_ID]/[FRAME_NAME]\"}"
echo.

REM Cleanup temporary files
del %TEMP%\cors-config.json >nul 2>&1
del %TEMP%\bucket-policy.json >nul 2>&1
del %TEMP%\public-access-block.json >nul 2>&1

echo 🧹 Temporary files cleaned up
echo.
echo 🚀 Your S3 bucket is now configured for video generation!
echo    You can now use the video generation APIs without CORS issues.
echo.
pause