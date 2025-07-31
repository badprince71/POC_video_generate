import { NextRequest, NextResponse } from 'next/server'
import { uploadMovieToStorage } from '@/lib/generate_video_clips/generate_clips'

interface MergeS3VideoClipsRequest {
  userId: string
  sessionId: string
  videoClipUrls: string[]
  outputFilename?: string
  mergeMethod?: 'client' | 'server' // For future server-side processing
}

interface MergeS3VideoClipsResponse {
  success: boolean
  message: string
  sessionId: string
  mergedVideoUrl?: string
  previewUrl?: string
  videoClips: string[]
  totalClips: number
  duration: number
  instructions?: {
    clientSideMerge: {
      description: string
      steps: string[]
      code: string
    }
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: MergeS3VideoClipsRequest = await request.json()
    const { 
      userId, 
      sessionId,
      videoClipUrls,
      outputFilename = `merged_video_${sessionId}`,
      mergeMethod = 'client'
    } = body

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'User ID and Session ID are required' },
        { status: 400 }
      )
    }

    if (!videoClipUrls || videoClipUrls.length === 0) {
      return NextResponse.json(
        { error: 'Video clip URLs are required' },
        { status: 400 }
      )
    }

    console.log(`🎬 Starting video merge for ${videoClipUrls.length} clips from session: ${sessionId}`)

    // For production deployment on Vercel, we use client-side merging
    // as server-side FFmpeg is not available in serverless environment
    
    const estimatedDuration = videoClipUrls.length * 5 // Each clip is 5 seconds
    
    console.log(`📊 Video merge details:`)
    console.log(`   📹 Total clips: ${videoClipUrls.length}`)
    console.log(`   ⏱️  Estimated duration: ${estimatedDuration} seconds`)
    console.log(`   🎯 Output filename: ${outputFilename}`)

    // Since we can't use server-side FFmpeg on Vercel, provide client-side solution
    const response: MergeS3VideoClipsResponse = {
      success: true,
      message: `Ready to merge ${videoClipUrls.length} video clips client-side. Use the provided instructions and video URLs.`,
      sessionId: sessionId,
      videoClips: videoClipUrls,
      totalClips: videoClipUrls.length,
      duration: estimatedDuration,
      instructions: {
        clientSideMerge: {
          description: "Use browser-based video merging with the existing VideoMerger utility",
          steps: [
            "1. Import the VideoMerger class from '@/lib/utils/video-merge'",
            "2. Create a new VideoMerger instance",
            "3. Call mergeVideos() with the provided video clip URLs",
            "4. Upload the resulting blob to S3 using uploadMovieToStorage()",
            "5. Save the final video URL to your database"
          ],
          code: `
// Client-side video merging example
import { VideoMerger } from '@/lib/utils/video-merge'
import { uploadMovieToStorage } from '@/lib/generate_video_clips/generate_clips'

const mergeVideosClientSide = async (videoUrls: string[], userId: string, sessionId: string) => {
  try {
    // Create video merger instance
    const merger = new VideoMerger()
    
    // Merge videos
    const mergedVideo = await merger.mergeVideos(videoUrls, {
      outputFormat: 'webm', // or 'mp4' if supported
      quality: 0.8,
      frameRate: 30
    })
    
    // Upload merged video to storage
    const uploadResult = await uploadMovieToStorage({
      videoUrl: mergedVideo.url,
      userId: userId,
      filename: \`final_video_\${sessionId}\`,
      duration: mergedVideo.duration
    })
    
    // Clean up
    merger.cleanup()
    URL.revokeObjectURL(mergedVideo.url)
    
    return uploadResult.publicUrl
  } catch (error) {
    console.error('Video merge failed:', error)
    throw error
  }
}
          `.trim()
        }
      }
    }

    // Optional: For demonstration, we could also provide a simple concatenation approach
    if (videoClipUrls.length === 1) {
      // If there's only one clip, no merging needed
      try {
        const uploadResult = await uploadMovieToStorage({
          videoUrl: videoClipUrls[0],
          userId: userId,
          filename: outputFilename,
          duration: 5 // Single clip duration
        })
        
        response.mergedVideoUrl = uploadResult.publicUrl
        response.previewUrl = uploadResult.publicUrl
        response.message = "Single video clip uploaded as final video"
        
        console.log(`✅ Single video uploaded: ${uploadResult.publicUrl}`)
      } catch (uploadError) {
        console.error('Failed to upload single video:', uploadError)
        response.error = `Failed to upload video: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
        response.success = false
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Video merge preparation failed:', error)
    
    return NextResponse.json(
      { 
        error: `Failed to prepare video merge: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check available video clips for merging
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

    // This could be enhanced to get actual video clips from S3 or database
    // For now, provide guidance on how to get video clips
    
    const response = {
      userId,
      sessionId,
      message: "Use the video generation API first to create video clips from your S3 frames",
      suggestedWorkflow: [
        "1. Call POST /api/generate_video_from_s3_frames to generate video clips from your uploaded frames",
        "2. Collect the generated video clip URLs from the response",
        "3. Call POST /api/merge_s3_video_clips with the video clip URLs to merge them",
        "4. Use client-side merging with the provided code example"
      ],
      availableEndpoints: {
        generateVideos: "/api/generate_video_from_s3_frames",
        mergeVideos: "/api/merge_s3_video_clips",
        listFrames: `/api/generate_video_from_s3_frames?userId=${userId}`
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error checking video clips:', error)
    
    return NextResponse.json(
      { error: 'Failed to check video clips status' },
      { status: 500 }
    )
  }
}