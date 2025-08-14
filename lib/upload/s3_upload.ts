import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

export interface S3VideoFrame {
  key: string;
  publicUrl: string;
  name: string;
  lastModified?: Date;
  size?: number;
}

interface GetFrameResult {
  data?: Buffer;
  contentType?: string;
  error?: string;
}

interface ListFramesResult {
  frames: S3VideoFrame[];
  error?: string;
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
    // If userId contains slashes, it's a custom folder path, use it directly
    // Otherwise, use the standard folder mapping
    let key: string;
    if (userId.includes('/')) {
      // Custom folder path already includes the folder structure
      key = `${userId}/${filename}`;
    } else {
      // Standard folder mapping
      const folder = S3_FOLDERS[type];
      key = `${folder}/${userId}/${filename}`;
    }

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
    
    // Construct public URL and proxy URL
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    const proxyUrl = `/api/proxy_s3_image?key=${encodeURIComponent(key)}`;
    
    console.log(`✓ Successfully uploaded image to S3: ${publicUrl}`);
    console.log(`✓ Proxy URL available at: ${proxyUrl}`);
    
    return {
      publicUrl: proxyUrl, // Use proxy URL instead of direct S3 URL
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
  userId = 'user', 
  filename,
  folder = 'video-clips'
}: UploadVideoToS3Params): Promise<S3UploadResult> {
  try {
    // Create S3 key with folder structure
    // If userId contains slashes, it's a custom folder path, use it directly
    // Otherwise, use the standard folder mapping
    let key: string;
    if (userId.includes('/')) {
      // Custom folder path already includes the folder structure
      key = `${userId}/${filename}`;
    } else {
      // Standard folder mapping
      const s3Folder = S3_FOLDERS[folder];
      key = `${s3Folder}/${userId}/${filename}`;
    }

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
    
    // Construct public URL and proxy URL
    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    const proxyUrl = `/api/proxy_s3_video?key=${encodeURIComponent(key)}`;
    
    console.log(`✓ Successfully uploaded video to S3: ${publicUrl}`);
    console.log(`✓ Proxy URL available at: ${proxyUrl}`);
    
    return {
      publicUrl: proxyUrl, // Use proxy URL instead of direct S3 URL
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
 * Get a frame (image) from S3 by key
 */
export async function getFrameFromS3(key: string): Promise<GetFrameResult> {
  try {
    console.log(`Getting frame from S3: ${key}`);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return { error: 'No data returned from S3' };
    }

    // Convert body to bytes in a Node-safe way
    // Prefer transformToByteArray when available (AWS SDK v3 on Node 18+)
    // Fallback to stream reader if needed
    let buffer: Buffer;
    const body: any = response.Body;
    if (body && typeof body.transformToByteArray === 'function') {
      const bytes: Uint8Array = await body.transformToByteArray();
      buffer = Buffer.from(bytes);
    } else if (body && typeof body.transformToWebStream === 'function') {
      const chunks: Uint8Array[] = [];
      const reader = body.transformToWebStream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      buffer = Buffer.concat(chunks);
    } else {
      // Last resort: try to read as Node stream
      const nodeStream: NodeJS.ReadableStream | undefined = body as any;
      if (!nodeStream) {
        return { error: 'Unsupported S3 response body type' };
      }
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        nodeStream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        nodeStream.on('end', () => resolve());
        nodeStream.on('error', reject);
      });
      buffer = Buffer.concat(chunks);
    }
    
    console.log(`✓ Successfully retrieved frame from S3: ${key} (${buffer.length} bytes)`);
    
    return {
      data: buffer,
      contentType: response.ContentType || 'image/png'
    };
  } catch (error) {
    console.error('Error getting frame from S3:', error);
    return { 
      error: error instanceof Error ? error.message : 'Failed to get frame from S3' 
    };
  }
}

/**
 * List all frames for a user from S3
 */
export async function listUserFramesFromS3(userId: string): Promise<ListFramesResult> {
  try {
    console.log(`Listing frames for user: ${userId}`);
    
    // Look in both reference-frames and user-uploads folders
    const folders = ['reference-frames', 'user-uploads'];
    const allFrames: S3VideoFrame[] = [];
    
    for (const folder of folders) {
      const prefix = `${folder}/${userId}/`;
      
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: 1000 // Adjust as needed
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        const frames = response.Contents
          .filter(obj => obj.Key && obj.Key !== prefix) // Exclude folder itself
          .map(obj => {
            const key = obj.Key!;
            const fileName = key.split('/').pop() || key;
            const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
            
            return {
              key,
              publicUrl,
              name: fileName,
              lastModified: obj.LastModified,
              size: obj.Size
            };
          });
        
        allFrames.push(...frames);
      }
    }
    
    // Sort by last modified date (newest first)
    allFrames.sort((a, b) => {
      if (!a.lastModified || !b.lastModified) return 0;
      return b.lastModified.getTime() - a.lastModified.getTime();
    });
    
    console.log(`✓ Found ${allFrames.length} frames for user ${userId}`);
    
    return { frames: allFrames };
  } catch (error) {
    console.error('Error listing user frames from S3:', error);
    return { 
      frames: [], 
      error: error instanceof Error ? error.message : 'Failed to list user frames from S3' 
    };
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