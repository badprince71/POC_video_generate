/**
 * Test script to verify S3 upload functionality
 * Run with: npx ts-node scripts/test_s3_upload.ts
 */

import { uploadImageToS3, uploadVideoToS3 } from '../lib/upload/s3_upload';

// Create a small test image (1x1 pixel PNG in base64)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9UhPDQwAAAABJRU5ErkJggg==';

// Create a small test video blob (this is just a placeholder - in real usage, you'd have actual video data)
function createTestVideoBlob(): Blob {
  const testData = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]); // MP4 header start
  return new Blob([testData], { type: 'video/mp4' });
}

async function testS3Upload() {
  console.log('🧪 Testing S3 Upload Functionality...\n');

  try {
    // Test 1: Upload a generated image to reference-frames
    console.log('📸 Test 1: Uploading test image to reference-frames...');
    const imageResult = await uploadImageToS3({
      imageData: TEST_IMAGE_BASE64,
      userId: 'test_user',
      type: 'reference-frames',
      filename: 'test_frame.png'
    });
    console.log('✅ Image upload successful!');
    console.log(`   URL: ${imageResult.publicUrl}`);
    console.log(`   Key: ${imageResult.key}\n`);

    // Test 2: Upload a user image to user-uploads
    console.log('👤 Test 2: Uploading test image to user-uploads...');
    const userImageResult = await uploadImageToS3({
      imageData: TEST_IMAGE_BASE64,
      userId: 'test_user',
      type: 'user-uploads',
      filename: 'test_user_image.png'
    });
    console.log('✅ User image upload successful!');
    console.log(`   URL: ${userImageResult.publicUrl}`);
    console.log(`   Key: ${userImageResult.key}\n`);

    // Test 3: Upload a video to video-clips
    console.log('🎬 Test 3: Uploading test video to video-clips...');
    const testVideoBlob = createTestVideoBlob();
    const videoResult = await uploadVideoToS3({
      videoBlob: testVideoBlob,
      userId: 'test_user',
      filename: 'test_video.mp4'
    });
    console.log('✅ Video upload successful!');
    console.log(`   URL: ${videoResult.publicUrl}`);
    console.log(`   Key: ${videoResult.key}\n`);

    console.log('🎉 All tests passed! Your S3 integration is working correctly.');
    console.log('\nYou can now:');
    console.log('1. Check your S3 bucket to see the uploaded files');
    console.log('2. Access the files using the provided URLs');
    console.log('3. Start using the S3 upload functions in your app');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check your AWS credentials in .env.local');
    console.log('2. Verify your S3 bucket permissions');
    console.log('3. Ensure your bucket CORS configuration is correct');
    console.log('4. Check your internet connection');
  }
}

// Run the test
testS3Upload();