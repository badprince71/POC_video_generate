// Update the path below to the correct relative path to your supabase client file
import {supabase} from '@/utils/supabase';
import { NextResponse } from 'next/server';

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
}

async function uploadChunkWithRetry(
  file: File,
  uploadPath: string,
  maxRetries: number,
  timeout: number
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries} for ${uploadPath}`);
      
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), timeout);
      });

      // Create the upload promise with upsert to handle existing files
      const uploadPromise = supabase.storage
        .from('videomaker')
        .upload(uploadPath, file, {
          upsert: true, // Allow overwriting if file exists
          cacheControl: '3600',
          duplex: 'half'
        });

      // Race between upload and timeout
      const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

      if (error) {
        console.log(`Upload attempt ${attempt} failed with supabase error:`, error);
        
        // If it's not the last attempt, try again
        if (attempt < maxRetries) {
          console.log(`Waiting ${1000 * attempt}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return { success: false, error: error.message };
      }

      if (data?.path) {
        console.log(`✓ Successfully uploaded ${uploadPath} on attempt ${attempt}`);
        return { success: true };
      }

      // If we get here, something unexpected happened
      return { success: false, error: 'Upload succeeded but no path returned' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Upload attempt ${attempt} failed with error: ${errorMessage}`);
      
      // Check if the error is a timeout
      if (errorMessage.includes('timeout') || errorMessage.includes('Upload timeout')) {
        console.log('Upload timed out, checking if file was actually uploaded...');
        
        // Wait a moment for any background upload to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if the file actually exists in storage
        try {
          const { data: existsData, error: existsError } = await supabase.storage
            .from('videomaker')
            .list(uploadPath.substring(0, uploadPath.lastIndexOf('/')), {
              search: uploadPath.substring(uploadPath.lastIndexOf('/') + 1)
            });
            
          if (!existsError && existsData && existsData.length > 0) {
            console.log(`✓ File ${uploadPath} was uploaded despite timeout`);
            return { success: true };
          }
        } catch (checkError) {
          console.log('Could not verify file existence:', checkError);
        }
      }
      
      // If it's not the last attempt, try again
      if (attempt < maxRetries) {
        console.log(`Waiting ${1000 * attempt}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      return { success: false, error: errorMessage };
    }
  }
  
  return { success: false, error: 'All retry attempts failed' };
}

async function uploadFileInChunks(
  fileBlob: Blob,
  userId: string,
  folder: string,
  filename: string
): Promise<string> {
  
  const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks
  const MAX_RETRIES = 3;
  const CHUNK_TIMEOUT = 180000; // 3 minutes
  const CHUNK_DELAY = 500; // 500ms delay between chunks
  
  const totalChunks = Math.ceil(fileBlob.size / CHUNK_SIZE);
  console.log(`Uploading file in ${totalChunks} chunks (${Math.round(fileBlob.size / 1024 / 1024 * 100) / 100}MB total)`);
  
  // Clean up any existing chunks from previous uploads
  await cleanupExistingChunks(userId, folder, filename);
  
  if (totalChunks === 1) {
    // Single chunk upload with retry logic
    const file = new File([fileBlob], filename, { type: 'video/mp4' });
    const uploadPath = `${userId}/${folder}/${filename}`;
    
    const uploadResult = await uploadChunkWithRetry(file, uploadPath, MAX_RETRIES, CHUNK_TIMEOUT);
    if (!uploadResult.success) {
      throw new Error(`Failed to upload file: ${uploadResult.error}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('videomaker')
      .getPublicUrl(uploadPath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return publicUrlData.publicUrl;
  }

  // Multi-chunk upload
  const uploadedChunks: string[] = [];
  let successfulUploads = 0;
  
  try {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBlob.size);
      const chunk = fileBlob.slice(start, end);
      
      const chunkFilename = `${filename.replace('.mp4', '')}_chunk_${i.toString().padStart(3, '0')}.mp4`;
      const chunkFile = new File([chunk], chunkFilename, { type: 'video/mp4' });
      const chunkPath = `${userId}/${folder}/chunks/${chunkFilename}`;
      
      console.log(`Uploading chunk ${i + 1}/${totalChunks} (${Math.round((chunk.size / 1024 / 1024) * 100) / 100}MB)...`);
      
      const uploadResult = await uploadChunkWithRetry(chunkFile, chunkPath, MAX_RETRIES, CHUNK_TIMEOUT);
      
      if (!uploadResult.success) {
        // Clean up any uploaded chunks on failure
        console.error(`Failed to upload chunk ${i} after ${MAX_RETRIES} retries:`, uploadResult.error);
        await cleanupChunks(userId, folder, uploadedChunks);
        throw new Error(`Failed to upload chunk ${i}: ${uploadResult.error}`);
      }
      
      uploadedChunks.push(chunkPath);
      successfulUploads++;
      
      console.log(`✓ Uploaded chunk ${i + 1}/${totalChunks} (${Math.round(((i + 1) / totalChunks) * 100)}%)`);
      
      // Add a small delay between chunks to prevent overwhelming the server
      if (i < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
      }
    }
    
    // Verify all chunks were uploaded successfully
    if (successfulUploads !== totalChunks) {
      throw new Error(`Upload incomplete: ${successfulUploads}/${totalChunks} chunks uploaded`);
    }
    
    // Create manifest file with chunk information
    const manifest = {
      originalFilename: filename,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      totalSize: fileBlob.size,
      chunks: uploadedChunks,
      uploadedAt: new Date().toISOString()
    };
    
    const manifestPath = `${userId}/${folder}/manifests/${filename.replace('.mp4', '_manifest.json')}`;
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const manifestFile = new File([manifestBlob], `${filename.replace('.mp4', '_manifest.json')}`, { type: 'application/json' });
    
    console.log('Uploading manifest file...');
    const manifestResult = await uploadChunkWithRetry(manifestFile, manifestPath, MAX_RETRIES, CHUNK_TIMEOUT);
      
    if (!manifestResult.success) {
      await cleanupChunks(userId, folder, uploadedChunks);
      throw new Error(`Failed to upload manifest: ${manifestResult.error}`);
    }
    
    // Get public URL for the manifest (this will be used to reconstruct the file when needed)
    const { data: manifestUrlData } = supabase.storage
      .from('videomaker')
      .getPublicUrl(manifestPath);
      
    if (!manifestUrlData?.publicUrl) {
      await cleanupChunks(userId, folder, [...uploadedChunks, manifestPath]);
      throw new Error('Failed to get manifest public URL');
    }
    
    console.log(`File uploaded successfully in ${totalChunks} chunks`);
    
    // Return a URL that serves the reconstructed video instead of the manifest URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const reconstructedVideoUrl = `${baseUrl}/api/serve-chunked-video?manifest=${encodeURIComponent(manifestUrlData.publicUrl)}`;
    return reconstructedVideoUrl;
    
  } catch (error) {
    // Clean up any uploaded chunks on error
    if (uploadedChunks.length > 0) {
      console.log('Cleaning up uploaded chunks due to error...');
      await cleanupChunks(userId, folder, uploadedChunks);
    }
    
    // Re-throw the error with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    console.error('Upload failed:', errorMessage);
    throw new Error(`Upload failed after ${successfulUploads}/${totalChunks} chunks: ${errorMessage}`);
  }
}

async function cleanupChunks(userId: string, folder: string, chunkPaths: string[]) {
  console.log('Cleaning up chunks due to upload failure...');
  
  for (const chunkPath of chunkPaths) {
    try {
      await supabase.storage
        .from('videomaker')
        .remove([chunkPath]);
    } catch (error) {
      console.warn(`Failed to cleanup chunk ${chunkPath}:`, error);
    }
  }
}

async function cleanupExistingChunks(userId: string, folder: string, filename: string) {
  try {
    console.log('Cleaning up any existing chunks from previous uploads...');
    
    const chunkPrefix = filename.replace('.mp4', '');
    const chunksPath = `${userId}/${folder}/chunks`;
    const manifestPath = `${userId}/${folder}/manifests`;
    
    // List and remove existing chunks
    const { data: existingChunks } = await supabase.storage
      .from('videomaker')
      .list(chunksPath, {
        search: chunkPrefix
      });
    
    if (existingChunks && existingChunks.length > 0) {
      const chunkPaths = existingChunks.map((chunk : any) => `${chunksPath}/${chunk.name}`);
      console.log(`Removing ${chunkPaths.length} existing chunks...`);
      
      const { error: removeError } = await supabase.storage
        .from('videomaker')
        .remove(chunkPaths);
        
      if (removeError) {
        console.warn('Failed to remove some existing chunks:', removeError);
      }
    }
    
    // List and remove existing manifest
    const { data: existingManifests } = await supabase.storage
      .from('videomaker')
      .list(manifestPath, {
        search: `${chunkPrefix}_manifest.json`
      });
    
    if (existingManifests && existingManifests.length > 0) {
      const manifestPaths = existingManifests.map((manifest : any) => `${manifestPath}/${manifest.name}`);
      console.log(`Removing ${manifestPaths.length} existing manifests...`);
      
      const { error: removeError } = await supabase.storage
        .from('videomaker')
        .remove(manifestPaths);
        
      if (removeError) {
        console.warn('Failed to remove some existing manifests:', removeError);
      }
    }
    
  } catch (error) {
    console.warn('Failed to cleanup existing chunks:', error);
    // Don't throw error, continue with upload
  }
}

export async function reconstructFileFromChunks(manifestUrl: string): Promise<Blob> {
  try {
    // Fetch the manifest
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error('Failed to fetch manifest file');
    }
    
    const manifest = await manifestResponse.json();
    console.log('Reconstructing file from manifest:', manifest);
    
    // Fetch all chunks in parallel
    const chunkPromises = manifest.chunks.map(async (chunkPath: string) => {
      const { data: chunkUrlData } = supabase.storage
        .from('videomaker')
        .getPublicUrl(chunkPath);
        
      if (!chunkUrlData?.publicUrl) {
        throw new Error(`Failed to get public URL for chunk: ${chunkPath}`);
      }
      
      const chunkResponse = await fetch(chunkUrlData.publicUrl);
      if (!chunkResponse.ok) {
        throw new Error(`Failed to fetch chunk: ${chunkPath}`);
      }
      
      return chunkResponse.blob();
    });
    
    const chunks = await Promise.all(chunkPromises);
    
    // Combine chunks into a single blob
    const combinedBlob = new Blob(chunks, { type: 'video/mp4' });
    
    console.log(`Reconstructed file: expected size ${manifest.totalSize}, actual size ${combinedBlob.size}`);
    
    if (combinedBlob.size !== manifest.totalSize) {
      console.warn('Size mismatch in reconstructed file');
    }
    
    return combinedBlob;
    
  } catch (error) {
    console.error('Error reconstructing file from chunks:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to reconstruct file from chunks');
  }
}

export async function getFileInfo(fileUrl: string): Promise<{
  isChunked: boolean
  manifest?: any
  directUrl?: string
}> {
  try {
    // Check if the URL points to a chunked video (served via our API)
    if (fileUrl.includes('/api/serve-chunked-video')) {
      const url = new URL(fileUrl, 'http://localhost'); // Base URL needed for parsing
      const manifestUrl = url.searchParams.get('manifest');
      
      if (manifestUrl) {
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
          throw new Error('Failed to fetch manifest');
        }
        
        const manifest = await manifestResponse.json();
        return {
          isChunked: true,
          manifest
        };
      }
    }
    
    // Check if the URL points to a manifest file directly (legacy)
    if (fileUrl.includes('_manifest.json')) {
      const manifestResponse = await fetch(fileUrl);
      if (!manifestResponse.ok) {
        throw new Error('Failed to fetch manifest');
      }
      
      const manifest = await manifestResponse.json();
      return {
        isChunked: true,
        manifest
      };
    } else {
      // Direct file URL (single upload)
      return {
        isChunked: false,
        directUrl: fileUrl
      };
    }
  } catch (error) {
    console.error('Error getting file info:', error);
    throw new Error('Failed to get file information');
  }
}

export async function uploadVideo({ videoUrl, type, filename, duration, prompt, userId }: UploadVideoParams): Promise<UploadVideoResult> {
  try {
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
    
    console.log("Fetching video file");
    if (!response.ok) {
      throw new Error('Failed to fetch video file');
    }
    
    // Get the video file as a blob
    const videoBlob = await response.blob();
    console.log("Video blob size:", videoBlob.size);
    
    // Create filename with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '_');
    const finalFilename = `${sanitizedFilename}_${timestamp}.mp4`;
    
    // Upload using chunks (without progress callback)
    const publicUrl = await uploadFileInChunks(
      videoBlob,
      userId,
      type,
      finalFilename
    );
    
    return {
      url: publicUrl
    };
    
  } catch (error: unknown) {
    console.error('Error in uploadVideo:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Video upload timed out - the file may be too large or your connection is slow');
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to upload video');
  }
}

export async function uploadMovieToStorage({
  videoUrl,
  userId,
  filename,
  duration,
  thumbnail
}: UploadMovieParams) {
  try {
    console.log("Uploading movie to storage...", { filename, userId, duration });

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
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '_');
    const finalFilename = `${sanitizedFilename}_${timestamp}.mp4`;

    // Upload using chunks (without progress callback since server actions can't call client functions)
    const publicUrl = await uploadFileInChunks(
      videoBlob,
      userId,
      'movies',
      finalFilename
    );

    console.log("Movie uploaded successfully:", publicUrl);

    return { 
      publicUrl,
      filename: finalFilename,
      size: videoBlob.size,
      thumbnail: thumbnail
    };

  } catch (error) {
    console.error("Error uploading movie:", error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Movie upload timed out - the file may be too large or your connection is slow');
      }
      throw error;
    }
    
    throw new Error("Failed to upload movie to storage. Please try again.");
  }
}