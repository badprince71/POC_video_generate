import { 
  uploadVideoToS3, 
  uploadVideoChunkedToS3, 
  generateUniqueFilename, 
  sanitizeFilename 
} from './s3_upload';

// Types (keeping same interface as original for compatibility)
interface GenerateVideoParams {
  startImage: string  // Base64 or URL of the first image
  prompt: string     // Text description of the desired animation
  duration: number  // Duration in seconds (must be either 5 or 10)
}

interface GenerateVideoPromptParams {
  prompt: string
  mood?: string
  speed?: string
}

interface GenerateVideoPromptResult {
  text: string
  characterCount: number
  wordCount: number
}

interface UploadVideoParams {
  videoUrl: string
  type: string
  filename: string
  duration: number
  prompt: string
  userId: string
}

interface UploadVideoResult {
  url: string
}

interface UploadMovieParams {
  videoUrl: string
  userId: string
  filename: string
  duration: number
  thumbnail?: string
  folderPath?: string // New optional parameter for custom folder structure
}

interface UploadMovieResult {
  publicUrl: string
  filename: string
  size: number
  thumbnail?: string
}

/**
 * Upload video to S3 via API (CORS-free solution)
 */
export async function uploadVideo({ 
  videoUrl, 
  type, 
  filename, 
  duration, 
  prompt, 
  userId 
}: UploadVideoParams): Promise<UploadVideoResult> {
  try {
    console.log("Uploading video to S3 via API...", { filename, userId, duration });

    // Fetch the video file from the URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch video file');
    }
    
    // Get the video file as a blob
    const videoBlob = await response.blob();
    console.log("Video blob size:", videoBlob.size);
    
    // Create unique filename
    const uniqueFilename = generateUniqueFilename(filename);

    // Create FormData for API upload
    const formData = new FormData();
    formData.append('video', new File([videoBlob], uniqueFilename, { type: 'video/mp4' }));
    formData.append('userId', userId);
    formData.append('filename', uniqueFilename);

    // Upload via API route (bypasses CORS issues)
    const apiResponse = await fetch('/api/upload_video_s3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
      body: formData
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await apiResponse.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    console.log("Video uploaded successfully to S3 via API:", result.publicUrl);

    return { 
      url: result.publicUrl
    };

  } catch (error) {
    console.error("Error uploading video to S3 via API:", error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload video to S3');
  }
}

/**
 * Upload movie to S3 storage (replacement for Supabase uploadMovieToStorage)
 */
export async function uploadMovieToS3({
  videoUrl,
  userId,
  filename,
  duration,
  thumbnail,
  folderPath
}: UploadMovieParams): Promise<UploadMovieResult> {
  try {
    console.log("Uploading movie to S3 via API...", { filename, userId, duration });

    // Fetch the video file from the URL with increased timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'video/mp4,video/*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('Failed to fetch movie file');
    }
    
    // Get the video file as a blob
    const videoBlob = await response.blob();
    console.log("Movie blob size:", videoBlob.size);
    
    // Create file with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const sanitizedFilename = sanitizeFilename(filename);
    const finalFilename = `${sanitizedFilename}_${timestamp}.mp4`;

    // Create FormData for API upload (bypasses CORS issues)
    const formData = new FormData();
    formData.append('video', new File([videoBlob], finalFilename, { type: 'video/mp4' }));
    formData.append('userId', userId);
    formData.append('filename', finalFilename);
    
    // Add custom folder path if provided
    if (folderPath) {
      formData.append('folderPath', folderPath);
    }

    // Upload via API route instead of direct S3 upload
    const apiResponse = await fetch('/api/upload_video_s3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
      body: formData
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await apiResponse.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    console.log("Movie uploaded successfully to S3 via API:", result.publicUrl);

    return { 
      publicUrl: result.publicUrl,
      filename: result.filename,
      size: result.size,
      thumbnail: thumbnail
    };

  } catch (error) {
    console.error("Error uploading movie to S3 via API:", error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Movie upload timed out - the file may be too large or your connection is slow');
      }
      throw error;
    }
    
    throw new Error("Failed to upload movie to S3. Please try again.");
  }
}

/**
 * Helper function to convert base64 to blob
 */
export function base64ToBlob(base64: string, contentType: string = 'video/mp4'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * Upload base64 video directly to S3
 */
export async function uploadBase64VideoToS3({
  videoData,
  userId,
  filename
}: {
  videoData: string
  userId: string
  filename: string
}): Promise<string> {
  try {
    console.log("Uploading base64 video to S3...", { filename, userId });

    // Convert base64 to blob
    const videoBlob = base64ToBlob(videoData.replace(/^data:video\/\w+;base64,/, ''));
    
    // Create unique filename
    const uniqueFilename = generateUniqueFilename(filename);

    // Upload to S3
    const result = await uploadVideoToS3({
      videoBlob,
      userId,
      filename: uniqueFilename,
      folder: 'video-clips'
    });

    console.log("Base64 video uploaded successfully to S3:", result.publicUrl);
    return result.publicUrl;

  } catch (error) {
    console.error("Error uploading base64 video to S3:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload base64 video to S3");
  }
}