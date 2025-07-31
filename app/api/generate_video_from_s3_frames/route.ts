import { NextRequest, NextResponse } from 'next/server'
import { listUserFramesFromS3 } from '@/lib/upload/s3_upload'
import { generateVideoClip, uploadVideo } from '@/lib/generate_video_clips/generate_clips'

interface GenerateVideoFromS3Request {
  userId: string
  sessionId?: string
  frameAspectRatio?: string
  prompt?: string
  batchSize?: number // Number of frames to process at once
}

interface VideoClipResult {
  frameIndex: number
  frameName: string
  frameUrl: string
  videoUrl?: string
  clipIndex: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  error?: string
  duration?: number
}

interface GenerateVideoFromS3Response {
  success: boolean
  message: string
  sessionId?: string
  totalFrames: number
  videoClips: VideoClipResult[]
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoFromS3Request = await request.json()
    const { 
      userId, 
      sessionId = `session_${Date.now()}`, 
      frameAspectRatio = "1280:720",
      prompt = "Smooth cinematic transition with natural movement",
      batchSize = 5 
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`🎬 Starting video generation from S3 frames for user: ${userId}`)

    // Get frames from S3
    const { frames, error: framesError } = await listUserFramesFromS3(userId)
    
    if (framesError) {
      return NextResponse.json(
        { error: `Failed to get frames from S3: ${framesError}` },
        { status: 500 }
      )
    }

    if (frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames found in S3 for this user' },
        { status: 404 }
      )
    }

    console.log(`📸 Found ${frames.length} frames in S3`)

    // Initialize video clips array
    const videoClips: VideoClipResult[] = frames.map((frame, index) => ({
      frameIndex: index,
      frameName: frame.name,
      frameUrl: frame.publicUrl,
      clipIndex: index,
      status: 'pending' as const
    }))

    // Process frames in batches to avoid overwhelming the API
    const batches = []
    for (let i = 0; i < frames.length; i += batchSize) {
      batches.push(frames.slice(i, i + batchSize))
    }

    console.log(`🔄 Processing ${frames.length} frames in ${batches.length} batches of ${batchSize}`)

    let completedVideos = 0
    let failedVideos = 0

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} frames)`)

      // Process batch in parallel
      const batchPromises = batch.map(async (frame, batchFrameIndex) => {
        const globalFrameIndex = batchIndex * batchSize + batchFrameIndex
        const clipResult = videoClips[globalFrameIndex]
        
        try {
          clipResult.status = 'generating'
          console.log(`🎥 Generating video clip ${globalFrameIndex + 1}/${frames.length} from frame: ${frame.name}`)

          // Generate video clip using existing function
          const videoClip = await generateVideoClip({
            startImage: frame.publicUrl,
            prompt: prompt,
            clipIndex: globalFrameIndex,
            totalClips: frames.length,
            frameAspectRatio: frameAspectRatio
          })

          if (!videoClip.videoUrl) {
            throw new Error('No video URL returned from video generation')
          }

          // Upload the generated video to S3
          const uploadResult = await uploadVideo({
            videoUrl: videoClip.videoUrl,
            type: 'video-clips',
            filename: `${frame.name.replace(/\.[^/.]+$/, '')}_video_clip`,
            duration: 5, // RunwayML generates 5-second clips
            prompt: prompt,
            userId: userId
          })

          clipResult.videoUrl = uploadResult.url
          clipResult.status = 'completed'
          clipResult.duration = 5
          completedVideos++

          console.log(`✅ Video clip ${globalFrameIndex + 1} completed: ${uploadResult.url}`)

        } catch (error) {
          clipResult.status = 'failed'
          clipResult.error = error instanceof Error ? error.message : 'Unknown error'
          failedVideos++
          
          console.error(`❌ Video clip ${globalFrameIndex + 1} failed:`, error)
        }
      })

      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises)
      
      // Add delay between batches to respect API rate limits
      if (batchIndex < batches.length - 1) {
        console.log('⏳ Waiting 10 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }

    const successRate = ((completedVideos / frames.length) * 100).toFixed(1)
    
    console.log(`🎯 Video generation completed:`)
    console.log(`   ✅ Successful: ${completedVideos}/${frames.length} (${successRate}%)`)
    console.log(`   ❌ Failed: ${failedVideos}/${frames.length}`)

    const response: GenerateVideoFromS3Response = {
      success: completedVideos > 0,
      message: completedVideos === frames.length 
        ? `All ${completedVideos} video clips generated successfully!`
        : `${completedVideos} of ${frames.length} video clips generated successfully. ${failedVideos} failed.`,
      sessionId: sessionId,
      totalFrames: frames.length,
      videoClips: videoClips
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Video generation from S3 frames failed:', error)
    
    return NextResponse.json(
      { 
        error: `Failed to generate videos from S3 frames: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check the status of video generation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // This could be enhanced to check actual generation status from a database
    // For now, just return the frames available for the user
    const { frames, error: framesError } = await listUserFramesFromS3(userId)
    
    if (framesError) {
      return NextResponse.json(
        { error: `Failed to get frames from S3: ${framesError}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      userId,
      sessionId,
      availableFrames: frames.length,
      frames: frames.map((frame, index) => ({
        frameIndex: index,
        frameName: frame.name,
        frameUrl: frame.publicUrl,
        size: frame.size,
        lastModified: frame.lastModified
      }))
    })

  } catch (error) {
    console.error('Error checking video generation status:', error)
    
    return NextResponse.json(
      { error: 'Failed to check video generation status' },
      { status: 500 }
    )
  }
}