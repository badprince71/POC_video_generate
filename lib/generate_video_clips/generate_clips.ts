"use server"

import { supabase } from '@/utils/supabase'
import RunwayML from '@runwayml/sdk'
import { normalizeAspectRatio } from '@/lib/utils/aspect'

interface GenerateVideoClipParams {
  startImage: string  // Base64 or URL of the first image
  prompt: string     // Text description of the desired animation
  totalClips: number // Total number of clips to generate
  clipIndex: number // Index of the current clip (0-based)
  frameAspectRatio: string // Aspect ratio of the video frames
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

// Detects the specific Runway credit exhaustion error from various error shapes
function isInsufficientCreditsError(error: unknown): boolean {
  const anyErr = error as any
  const message = typeof anyErr?.message === 'string' ? anyErr.message.toLowerCase() : ''
  const embedded = typeof anyErr?.error === 'string' ? anyErr.error.toLowerCase() : ''
  return message.includes('enough credits') || embedded.includes('enough credits')
}

export async function generateVideoPrompt({
  prompt,
  mood = "dynamic",
  speed = "normal"
}: GenerateVideoPromptParams): Promise<GenerateVideoPromptResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured")
  }

  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt is required")
  }

  try {
    const systemPrompt = `You are an expert video prompt engineer creating optimized prompts for AI video generation systems like RunwayML Gen-4.

Context: General video generation
Mood: ${mood}
Visual Style: realistic
Camera Work: smooth movements
Lighting: natural sunlight
Speed: ${speed}

CRITICAL REQUIREMENT: Keep the prompt under 900 characters (maximum 900 characters).

Instructions:
- Create a concise but detailed video generation prompt under 900 characters
- Be specific about visual transformations and camera movements
- Include key technical details about lighting and composition
- Use vivid, descriptive language that AI can interpret effectively
- Focus on achievable visual effects and realistic motion
- Ensure the prompt flows naturally as a single description
- Prioritize the most important visual elements
- Optimize for the specified mood and visual style

Return ONLY the optimized video generation prompt. Do not exceed 900 characters.`
console.log("systemPrompt", systemPrompt)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 250,
        top_p: 1,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    let generatedText = data.choices[0].message.content.trim()
    
    if (!generatedText) {
      throw new Error("No text was generated")
    }

    // Safety check: truncate if still over 1000 characters
    if (generatedText.length > 1000) {
      generatedText = generatedText.substring(0, 997) + "..."
    }

    const characterCount = generatedText.length
    const wordCount = generatedText.split(/\s+/).length

    return {
      text: generatedText,
      characterCount,
      wordCount
    }

  } catch (error) {
    console.error("Error generating video prompt:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to generate video prompt")
  }
}

export async function generateVideoClip({ startImage, prompt, clipIndex, totalClips, frameAspectRatio}: GenerateVideoClipParams) {
  
  // Normalize and validate aspect ratio
  const normalizedRatio = normalizeAspectRatio(frameAspectRatio)
  const validRatios = ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672", "1280:768", "768:1280"] as const;
  if (!validRatios.includes(normalizedRatio as any)) {
    throw new Error(`Invalid aspect ratio "${frameAspectRatio}". Must be one of: ${validRatios.join(", ")}`);
  }

  let generatePrompt = buildSafePrompt(prompt);
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error("Runway API key is not configured")
  }

  try {
    if (generatePrompt.length > 1000) {
      generatePrompt = generatePrompt.substring(0, 997) + "..."
    }
    console.log("Initializing video generation...");

    // Initialize RunwayML client with increased timeout and retries
    const client = new RunwayML({
      apiKey: process.env.RUNWAYML_API_SECRET,
      timeout: 180000, // 3 minutes per request
      maxRetries: 3,
    });

    const duration = 5;
    const gen4Ratios = ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"] as const;
    const gen3Ratios = ["1280:768", "768:1280"] as const;
    const selectedModel = (gen3Ratios as readonly string[]).includes(normalizedRatio)
      ? 'gen3a_turbo'
      : 'gen4_turbo';
    // Create the video generation task
    // Prefer passing a URL rather than a large data URL to reduce request size/timeouts
    const imageToVideo = await client.imageToVideo.create(
      {
        model: selectedModel,
        promptImage: startImage,
        ratio: normalizedRatio as "1280:720" | "720:1280" | "1104:832" | "832:1104" | "960:960" | "1584:672" | "1280:768" | "768:1280",
        promptText: generatePrompt,
        duration: duration as 5 | 10,
      },
      {
        timeout: 180000, // 3 minutes for the create call
        maxRetries: 3,
      }
    )
    
    if (!imageToVideo.id) {
      throw new Error("Failed to generate video")
    }
    console.log("Generation started with task ID:", imageToVideo.id);

    // Poll for completion
    let task;
    const startedAt = Date.now();
    const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes
    while (true) {
      task = await client.tasks.retrieve(imageToVideo.id);
      console.log("Status check:", task);

      if (task.status === "SUCCEEDED" && task.output?.[0]) {
        console.log("Video generation completed");
        return {
          clipIndex,
          totalClips,
          videoUrl: task.output[0],
          // previewUrl: task.output[0] // Using the same URL for both since preview isn't specified in output
        }
      } else if (task.status === "FAILED") {
        throw new Error("Video generation failed");
      }

      // Abort if exceeding max wait
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        throw new Error('Request timed out while waiting for Runway task to complete');
      }

      // Wait 10 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

  } catch (error) {
    console.error("Error generating video:", error);
    if (isInsufficientCreditsError(error)) {
      const insufficient = new Error('INSUFFICIENT_CREDITS')
      ;(insufficient as any).name = 'InsufficientCreditsError'
      throw insufficient
    }
    throw new Error(error instanceof Error ? error.message : "Failed to generate video");
  }
}

function buildSafePrompt(input: string): string {
  const preface = [
    'Animate the given image faithfully with subtle, natural motion.',
    'Do not change the subject identity, clothing, background, or lighting conditions.',
    'Avoid adding new objects, text, or elements not present in the image.',
    'Keep movements smooth and minimal: gentle camera drift, minor environmental motion.',
    'Preserve composition and style; emphasize temporal consistency and realism.',
  ].join(' ')
  const combined = `${preface} ${input}`.trim()
  return combined.length > 1000 ? combined.substring(0, 997) + '...' : combined
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
      const chunkPaths = existingChunks.map(chunk => `${chunksPath}/${chunk.name}`);
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
      const manifestPaths = existingManifests.map(manifest => `${manifestPath}/${manifest.name}`);
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

// export async function uploadBase64VideoToStorage({
//   videoData,
//   userId,
//   filename
// }: {
//   videoData: string
//   userId: string
//   filename: string
// }): Promise<string> {
//   try {
//     console.log("Uploading base64 video to Supabase storage...", { filename, userId });

//     // Convert base64 to blob
//     const byteCharacters = atob(videoData.split(',')[1] || videoData);
//     const byteNumbers = new Array(byteCharacters.length);
//     for (let i = 0; i < byteCharacters.length; i++) {
//       byteNumbers[i] = byteCharacters.charCodeAt(i);
//     }
//     const byteArray = new Uint8Array(byteNumbers);
//     const videoBlob = new Blob([byteArray], { type: 'video/mp4' });
    
//     console.log("Video blob size:", videoBlob.size);
    
//     // Create file with timestamp to ensure uniqueness
//     const timestamp = Date.now();
//     const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '_');
//     const finalFilename = `${sanitizedFilename}_${timestamp}.mp4`;

//     // Upload using chunks for large files
//     const publicUrl = await uploadFileInChunks(
//       videoBlob,
//       userId,
//       'temp_video_audio',
//       finalFilename
//     );

//     console.log("Base64 video uploaded successfully:", publicUrl);
//     return publicUrl;

//   } catch (error) {
//     console.error("Error uploading base64 video:", error);
//     throw new Error(error instanceof Error ? error.message : "Failed to upload video to storage");
//   }
// }

// export async function uploadBase64AudioToStorage({
//   audioData,
//   userId,
//   filename
// }: {
//   audioData: string
//   userId: string
//   filename: string
// }): Promise<string> {
//   try {
//     console.log("Uploading base64 audio to Supabase storage...", { filename, userId });

//     // Convert base64 to blob
//     const byteCharacters = atob(audioData.split(',')[1] || audioData);
//     const byteNumbers = new Array(byteCharacters.length);
//     for (let i = 0; i < byteCharacters.length; i++) {
//       byteNumbers[i] = byteCharacters.charCodeAt(i);
//     }
//     const byteArray = new Uint8Array(byteNumbers);
//     const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });
    
//     console.log("Audio blob size:", audioBlob.size);
    
//     // Create file with timestamp to ensure uniqueness
//     const timestamp = Date.now();
//     const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '_');
//     const finalFilename = `${sanitizedFilename}_${timestamp}.mp3`;
//     const file = new File([audioBlob], finalFilename, { type: 'audio/mpeg' });

//     // Upload to Supabase Storage (audio files are usually smaller, so direct upload)
//     const uploadPath = `${userId}/temp_video_audio/${finalFilename}`;
//     const { data: uploadData, error: uploadError } = await supabase.storage
//       .from('videomaker')
//       .upload(uploadPath, file, {
//         cacheControl: '3600',
//         contentType: 'audio/mpeg',
//         upsert: true
//       });

//     if (uploadError) {
//       throw new Error(`Failed to upload audio: ${uploadError.message}`);
//     }

//     // Get public URL
//     const { data: urlData } = supabase.storage
//       .from('videomaker')
//       .getPublicUrl(uploadPath);

//     if (!urlData.publicUrl) {
//       throw new Error("Failed to get public URL for uploaded audio");
//     }

//     console.log("Base64 audio uploaded successfully:", urlData.publicUrl);
//     return urlData.publicUrl;

//   } catch (error) {
//     console.error("Error uploading base64 audio:", error);
//     throw new Error(error instanceof Error ? error.message : "Failed to upload audio to storage");
//   }
// }