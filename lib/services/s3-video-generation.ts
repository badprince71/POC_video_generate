import { listUserFramesFromS3 } from '@/lib/upload/s3_upload'
import { normalizeAspectRatio } from '@/lib/utils/aspect'
import { generateVideoClip, uploadVideo, uploadMovieToStorage } from '@/lib/generate_video_clips/generate_clips'

// Types
export interface S3VideoFrame {
  key: string
  publicUrl: string
  name: string
  lastModified?: Date
  size?: number
}

export interface VideoGenerationOptions {
  userId: string
  sessionId?: string
  frameAspectRatio?: string
  prompt?: string
  batchSize?: number
  maxRetries?: number
}

export interface VideoClipResult {
  frameIndex: number
  frameName: string
  frameUrl: string
  videoUrl?: string
  clipIndex: number
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'retrying'
  error?: string
  duration?: number
  retryCount?: number
}

export interface VideoGenerationProgress {
  totalFrames: number
  completedClips: number
  failedClips: number
  currentBatch: number
  totalBatches: number
  progressPercentage: number
}

export interface VideoGenerationResult {
  success: boolean
  sessionId: string
  totalFrames: number
  videoClips: VideoClipResult[]
  progress: VideoGenerationProgress
  generatedVideoUrls: string[]
  message: string
  error?: string
}

export interface VideoMergeResult {
  success: boolean
  mergedVideoUrl?: string
  duration: number
  fileSize?: number
  method: 'client' | 'server'
  instructions?: any
  error?: string
}

/**
 * S3 Video Generation Service
 * Handles the complete workflow from S3 frames to final video
 */
export class S3VideoGenerationService {
  
  /**
   * Get all frames for a user from S3
   */
  static async getUserFrames(userId: string): Promise<{
    frames: S3VideoFrame[]
    error?: string
  }> {
    try {
      console.log(`📸 Fetching frames for user: ${userId}`)
      
      const result = await listUserFramesFromS3(userId)
      
      if (result.error) {
        return { frames: [], error: result.error }
      }
      
      console.log(`✅ Found ${result.frames.length} frames for user ${userId}`)
      return { frames: result.frames }
      
    } catch (error) {
      console.error('Error getting user frames:', error)
      return { 
        frames: [], 
        error: error instanceof Error ? error.message : 'Failed to get user frames' 
      }
    }
  }

  /**
   * Generate video clips from all S3 frames for a user
   */
  static async generateVideosFromFrames(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const {
      userId,
      sessionId = `session_${Date.now()}`,
      frameAspectRatio = "1280:720",
      prompt = "Smooth cinematic transition with natural movement and realistic motion",
      batchSize = 3, // Reduced batch size to avoid API rate limits
      maxRetries = 2
    } = options

    console.log(`🎬 Starting video generation service for user: ${userId}`)
    console.log(`📋 Options:`, { sessionId, frameAspectRatio, prompt, batchSize, maxRetries })

    try {
      // Get frames from S3
      const { frames, error: framesError } = await this.getUserFrames(userId)
      
      if (framesError) {
        return {
          success: false,
          sessionId,
          totalFrames: 0,
          videoClips: [],
          progress: { totalFrames: 0, completedClips: 0, failedClips: 0, currentBatch: 0, totalBatches: 0, progressPercentage: 0 },
          generatedVideoUrls: [],
          message: `Failed to get frames: ${framesError}`,
          error: framesError
        }
      }

      if (frames.length === 0) {
        return {
          success: false,
          sessionId,
          totalFrames: 0,
          videoClips: [],
          progress: { totalFrames: 0, completedClips: 0, failedClips: 0, currentBatch: 0, totalBatches: 0, progressPercentage: 0 },
          generatedVideoUrls: [],
          message: "No frames found in S3",
          error: "No frames available for video generation"
        }
      }

      console.log(`📸 Processing ${frames.length} frames`)

      // Initialize video clips tracking
      const videoClips: VideoClipResult[] = frames.map((frame, index) => ({
        frameIndex: index,
        frameName: frame.name,
        frameUrl: frame.publicUrl,
        clipIndex: index,
        status: 'pending',
        retryCount: 0
      }))

      // Calculate batches
      const batches = []
      for (let i = 0; i < frames.length; i += batchSize) {
        batches.push(frames.slice(i, i + batchSize))
      }

      const progress: VideoGenerationProgress = {
        totalFrames: frames.length,
        completedClips: 0,
        failedClips: 0,
        currentBatch: 0,
        totalBatches: batches.length,
        progressPercentage: 0
      }

      console.log(`🔄 Processing in ${batches.length} batches of ${batchSize}`)

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        progress.currentBatch = batchIndex + 1
        
        console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} frames)`)

        // Process batch with retry logic
        const normalizedRatio = normalizeAspectRatio(frameAspectRatio)
        await this.processBatchWithRetries(
          batch, 
          batchIndex * batchSize, 
          videoClips, 
          progress, 
          { frameAspectRatio: normalizedRatio, prompt, userId, maxRetries }
        )

        // Add delay between batches to respect API rate limits
        if (batchIndex < batches.length - 1) {
          const delayMs = 15000 // 15 second delay between batches
          console.log(`⏳ Waiting ${delayMs/1000} seconds before next batch...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }

      // Calculate final results
      const completedClips = videoClips.filter(clip => clip.status === 'completed')
      const failedClips = videoClips.filter(clip => clip.status === 'failed')
      const generatedVideoUrls = completedClips.map(clip => clip.videoUrl!).filter(Boolean)

      progress.progressPercentage = 100
      
      const successRate = ((completedClips.length / frames.length) * 100).toFixed(1)
      
      console.log(`🎯 Video generation completed:`)
      console.log(`   ✅ Successful: ${completedClips.length}/${frames.length} (${successRate}%)`)
      console.log(`   ❌ Failed: ${failedClips.length}/${frames.length}`)

      return {
        success: completedClips.length > 0,
        sessionId,
        totalFrames: frames.length,
        videoClips,
        progress,
        generatedVideoUrls,
        message: completedClips.length === frames.length 
          ? `All ${completedClips.length} video clips generated successfully!`
          : `${completedClips.length} of ${frames.length} video clips generated. ${failedClips.length} failed.`
      }

    } catch (error) {
      console.error('❌ Video generation service failed:', error)
      
      return {
        success: false,
        sessionId,
        totalFrames: 0,
        videoClips: [],
        progress: { totalFrames: 0, completedClips: 0, failedClips: 0, currentBatch: 0, totalBatches: 0, progressPercentage: 0 },
        generatedVideoUrls: [],
        message: "Video generation failed",
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Process a batch of frames with retry logic
   */
  private static async processBatchWithRetries(
    batch: S3VideoFrame[],
    batchStartIndex: number,
    videoClips: VideoClipResult[],
    progress: VideoGenerationProgress,
    options: { frameAspectRatio: string; prompt: string; userId: string; maxRetries: number }
  ): Promise<void> {
    const { frameAspectRatio, prompt, userId, maxRetries } = options

    // Process each frame in the batch
    const batchPromises = batch.map(async (frame, batchFrameIndex) => {
      const globalFrameIndex = batchStartIndex + batchFrameIndex
      const clipResult = videoClips[globalFrameIndex]
      
      // Retry logic
      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        try {
          if (retryCount > 0) {
            clipResult.status = 'retrying'
            clipResult.retryCount = retryCount
            console.log(`🔄 Retry ${retryCount}/${maxRetries} for frame: ${frame.name}`)
            
            // Exponential backoff for retries
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          } else {
            clipResult.status = 'generating'
          }

          console.log(`🎥 Generating video clip ${globalFrameIndex + 1}/${progress.totalFrames} from frame: ${frame.name}`)

          // Convert image to base64 using server-side API to avoid CORS issues
          let imageForGeneration = frame.publicUrl
          
          try {
            console.log('🔄 Converting image to base64 to avoid CORS issues...')
            const conversionResponse = await fetch('/api/convert_s3_image_to_base64', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` },
              body: JSON.stringify({
                s3Key: frame.key,
                imageUrl: frame.publicUrl,
                userId: userId
              })
            })
            
            const conversionResult = await conversionResponse.json()
            
            if (conversionResult.success && conversionResult.base64) {
              imageForGeneration = conversionResult.base64
              console.log(`✅ Image converted to base64 via ${conversionResult.method} method (${conversionResult.size} bytes)`)
            } else {
              console.warn('⚠️ Image conversion failed, using public URL:', conversionResult.error)
              // Continue with public URL as fallback
            }
          } catch (conversionError) {
            console.warn('⚠️ Image conversion API failed, using public URL:', conversionError)
            // Continue with public URL as fallback
          }

          // Generate video clip
          const videoClip = await generateVideoClip({
            startImage: imageForGeneration,
            prompt: prompt,
            clipIndex: globalFrameIndex,
            totalClips: progress.totalFrames,
            frameAspectRatio: frameAspectRatio
          })

          if (!videoClip.videoUrl) {
            throw new Error('No video URL returned from video generation')
          }

          // Upload to S3
          const uploadResult = await uploadVideo({
            videoUrl: videoClip.videoUrl,
            type: 'video-clips',
            filename: `${frame.name.replace(/\.[^/.]+$/, '')}_video_clip`,
            duration: 5,
            prompt: prompt,
            userId: userId
          })

          // Success
          clipResult.videoUrl = uploadResult.url
          clipResult.status = 'completed'
          clipResult.duration = 5
          progress.completedClips++
          progress.progressPercentage = Math.round((progress.completedClips / progress.totalFrames) * 100)

          console.log(`✅ Video clip ${globalFrameIndex + 1} completed: ${uploadResult.url}`)
          break // Success, exit retry loop

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`❌ Video clip ${globalFrameIndex + 1} attempt ${retryCount + 1} failed:`, error)
          
          if (retryCount === maxRetries) {
            // Final failure
            clipResult.status = 'failed'
            clipResult.error = errorMessage
            clipResult.retryCount = retryCount
            progress.failedClips++
            progress.progressPercentage = Math.round(((progress.completedClips + progress.failedClips) / progress.totalFrames) * 100)
          }
        }
      }
    })

    // Wait for all clips in the batch to complete
    await Promise.allSettled(batchPromises)
  }

  /**
   * Prepare video clips for client-side merging
   */
  static async prepareVideoMerge(
    userId: string, 
    sessionId: string, 
    videoClipUrls: string[]
  ): Promise<VideoMergeResult> {
    try {
      console.log(`🎬 Preparing video merge for ${videoClipUrls.length} clips`)

      if (videoClipUrls.length === 0) {
        return {
          success: false,
          duration: 0,
          method: 'client',
          error: 'No video clips provided for merging'
        }
      }

      const estimatedDuration = videoClipUrls.length * 5 // Each clip is 5 seconds

      // For single video, upload directly
      if (videoClipUrls.length === 1) {
        try {
          const uploadResult = await uploadMovieToStorage({
            videoUrl: videoClipUrls[0],
            userId: userId,
            filename: `final_video_${sessionId}`,
            duration: 5
          })
          
          return {
            success: true,
            mergedVideoUrl: uploadResult.publicUrl,
            duration: 5,
            method: 'server',
            fileSize: uploadResult.size
          }
        } catch (error) {
          return {
            success: false,
            duration: 5,
            method: 'server',
            error: `Failed to upload single video: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      }

      // For multiple videos, provide client-side merging instructions
      const clientMergeInstructions = {
        description: "Use the VideoMerger utility for browser-based video concatenation",
        videoUrls: videoClipUrls,
        estimatedDuration: estimatedDuration,
        recommendedSettings: {
          outputFormat: 'webm',
          quality: 0.8,
          frameRate: 30
        },
        example: {
          import: "import { VideoMerger } from '@/lib/utils/video-merge'",
          usage: `
const merger = new VideoMerger()
const result = await merger.mergeVideos(videoUrls, {
  outputFormat: 'webm',
  quality: 0.8,
  frameRate: 30
})
// result.blob contains the merged video
// result.url is a blob URL for preview
// Upload result.blob to your storage service
          `.trim()
        }
      }

      return {
        success: true,
        duration: estimatedDuration,
        method: 'client',
        instructions: clientMergeInstructions
      }

    } catch (error) {
      console.error('❌ Video merge preparation failed:', error)
      
      return {
        success: false,
        duration: 0,
        method: 'client',
        error: error instanceof Error ? error.message : 'Failed to prepare video merge'
      }
    }
  }
}

// Convenience functions for direct usage
export const generateVideosFromS3Frames = S3VideoGenerationService.generateVideosFromFrames
export const getUserS3Frames = S3VideoGenerationService.getUserFrames
export const prepareS3VideoMerge = S3VideoGenerationService.prepareVideoMerge