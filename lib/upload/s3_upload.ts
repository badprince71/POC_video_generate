import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// AWS S3 Configuration - Use environment variables directly for server-side code
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "happinest-aiinvitations";

// S3 Folder mapping based on content type
export const S3_FOLDERS = {
  'reference-frames': 'reference-frames',  // For generated images
  'user-uploads': 'user-uploads',          // For user uploaded images
  'video-clips': 'video-clips'             // For generated videos
} as const;

// Types
interface UploadToS3Params {
  file: File | Blob;
  key: string;
  contentType?: string;
}

interface UploadImageToS3Params {
  imageData: string;  // base64 string
  userId: string;
  type: 'reference-frames' | 'user-uploads';
  filename: string;
}

interface UploadVideoToS3Params {
  videoBlob: Blob;
  userId: string;
  filename: string;
  folder?: 'video-clips';
}

interface S3UploadResult {
  publicUrl: string;
  key: string;
}

/**
 * Generic S3 upload function
 */
export async function uploadToS3({ file, key, contentType }: UploadToS3Params): Promise<S3UploadResult> {
  try {
    console.log(`Uploading to S3: ${key}`);
    
    // Convert File/Blob to Buffer to avoid streaming issues
    let body: Buffer;
    if (file instanceof File || file instanceof Blob) {
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } else {
      body = Buffer.from(file);
    }
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      ContentLength: body.length
      // Removed ACL - bucket policy will handle public access
    });

    await s3Client.send(command);
    
    // Construct public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    
    console.log(`✓ Successfully uploaded to S3: ${publicUrl}`);
    
    return {
      publicUrl,
      key
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload image to S3 (replacement for Supabase uploadImage)
 */
export async function uploadImageToS3({ 
  imageData, 
  userId, 
  type, 
  filename 
}: UploadImageToS3Params): Promise<S3UploadResult> {
  try {
    // Convert base64 to Buffer directly (more efficient and avoids streaming issues)
    const buffer = Buffer.from(imageData, 'base64');

    // Create S3 key with folder structure
    const folder = S3_FOLDERS[type];
    const key = `${folder}/${userId}/${filename}`;

    // Upload directly with buffer
    console.log(`Uploading image to S3: ${key}`);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      ContentLength: buffer.length
      // Removed ACL - bucket policy will handle public access
    });

    await s3Client.send(command);
    
    // Construct public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    
    console.log(`✓ Successfully uploaded image to S3: ${publicUrl}`);
    
    return {
      publicUrl,
      key
    };
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw new Error(`Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload video to S3 (replacement for Supabase video upload)
 */
export async function uploadVideoToS3({ 
  videoBlob, 
  userId, 
  filename,
  folder = 'video-clips'
}: UploadVideoToS3Params): Promise<S3UploadResult> {
  try {
    // Create S3 key with folder structure
    const s3Folder = S3_FOLDERS[folder];
    const key = `${s3Folder}/${userId}/${filename}`;

    // Convert blob to buffer to avoid streaming issues
    console.log(`Uploading video to S3: ${key}`);
    const arrayBuffer = await videoBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
      ContentLength: buffer.length
      // Removed ACL - bucket policy will handle public access
    });

    await s3Client.send(command);
    
    // Construct public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    
    console.log(`✓ Successfully uploaded video to S3: ${publicUrl}`);
    
    return {
      publicUrl,
      key
    };
  } catch (error) {
    console.error('Error uploading video to S3:', error);
    throw new Error(`Failed to upload video to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload video with chunked upload for large files
 */
export async function uploadVideoChunkedToS3({
  videoBlob,
  userId,
  filename
}: {
  videoBlob: Blob;
  userId: string;
  filename: string;
}): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (minimum for S3 multipart)
  const totalChunks = Math.ceil(videoBlob.size / CHUNK_SIZE);
  
  console.log(`Uploading video in ${totalChunks} chunks (${Math.round(videoBlob.size / 1024 / 1024 * 100) / 100}MB total)`);
  
  if (totalChunks === 1) {
    // Single upload for small files
    const result = await uploadVideoToS3({
      videoBlob,
      userId,
      filename
    });
    return result.publicUrl;
  }
  
  // For larger files, use regular upload (S3 multipart upload requires more complex setup)
  // You can implement S3 multipart upload here if needed for very large files
  const result = await uploadVideoToS3({
    videoBlob,
    userId,
    filename
  });
  
  return result.publicUrl;
}

/**
 * Get a pre-signed URL for temporary access to an S3 object
 */
export async function getSignedUrlFromS3(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper function to clean filename for S3
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
}

/**
 * Helper function to generate unique filename
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(originalFilename);
  const extension = sanitized.split('.').pop();
  const nameWithoutExt = sanitized.replace(`.${extension}`, '');
  
  return `${nameWithoutExt}_${timestamp}.${extension}`;
}