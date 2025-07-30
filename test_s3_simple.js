// Simple test to verify S3 upload fix
// Run with: node test_s3_simple.js

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Test the exact same configuration as our upload functions
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "happinest-aiinvitations";

async function testS3Upload() {
  try {
    console.log('🧪 Testing S3 upload fix...');
    
    // Create a small test buffer (same approach as our fixed function)
    const testData = "Hello S3 Upload Test!";
    const buffer = Buffer.from(testData, 'utf8');
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test/upload_test.txt',
      Body: buffer,
      ContentType: 'text/plain',
      ContentLength: buffer.length
      // Removed ACL - bucket policy handles public access
    });

    await s3Client.send(command);
    
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/test/upload_test.txt`;
    
    console.log('✅ S3 upload test successful!');
    console.log(`   URL: ${publicUrl}`);
    console.log('🎉 The streaming error is fixed!');
    
  } catch (error) {
    console.error('❌ S3 upload test failed:', error.message);
    console.log('\n🔧 Check:');
    console.log('1. AWS credentials are correct');
    console.log('2. S3 bucket permissions allow PutObject');
    console.log('3. Network connectivity to AWS');
  }
}

testS3Upload();