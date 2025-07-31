import { NextRequest, NextResponse } from 'next/server'
import { S3VideoGenerationService } from '@/lib/services/s3-video-generation'

interface ProcessS3VideoWorkflowRequest {
  userId: string
  sessionId?: string
  action: 'list_frames' | 'generate_videos' | 'prepare_merge'
  
  // For generate_videos action
  frameAspectRatio?: string
  prompt?: string
  batchSize?: number
  
  // For prepare_merge action
  videoClipUrls?: string[]
}

interface ProcessS3VideoWorkflowResponse {
  success: boolean
  action: string
  data: any
  message: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessS3VideoWorkflowRequest = await request.json()
    const { userId, sessionId, action } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Processing S3 video workflow - Action: ${action}, User: ${userId}`)

    let result: ProcessS3VideoWorkflowResponse

    switch (action) {
      case 'list_frames': {
        console.log(`📸 Listing frames for user: ${userId}`)
        
        const framesResult = await S3VideoGenerationService.getUserFrames(userId)
        
        if (framesResult.error) {
          result = {
            success: false,
            action,
            data: { frames: [] },
            message: `Failed to get frames: ${framesResult.error}`,
            error: framesResult.error
          }
        } else {
          result = {
            success: true,
            action,
            data: { 
              frames: framesResult.frames,
              totalFrames: framesResult.frames.length 
            },
            message: `Found ${framesResult.frames.length} frames in S3`
          }
        }
        break
      }

      case 'generate_videos': {
        console.log(`🎥 Starting video generation for user: ${userId}`)
        
        const options = {
          userId,
          sessionId: sessionId || `session_${Date.now()}`,
          frameAspectRatio: body.frameAspectRatio || "1280:720",
          prompt: body.prompt || "Smooth cinematic transition with natural movement and realistic motion",
          batchSize: body.batchSize || 3
        }
        
        const videoResult = await S3VideoGenerationService.generateVideosFromFrames(options)
        
        result = {
          success: videoResult.success,
          action,
          data: {
            sessionId: videoResult.sessionId,
            totalFrames: videoResult.totalFrames,
            videoClips: videoResult.videoClips,
            progress: videoResult.progress,
            generatedVideoUrls: videoResult.generatedVideoUrls,
            completedCount: videoResult.videoClips.filter(clip => clip.status === 'completed').length,
            failedCount: videoResult.videoClips.filter(clip => clip.status === 'failed').length
          },
          message: videoResult.message,
          error: videoResult.error
        }
        break
      }

      case 'prepare_merge': {
        console.log(`🎬 Preparing video merge for user: ${userId}`)
        
        if (!body.videoClipUrls || body.videoClipUrls.length === 0) {
          result = {
            success: false,
            action,
            data: {},
            message: 'Video clip URLs are required for merging',
            error: 'No video clip URLs provided'
          }
          break
        }
        
        const mergeResult = await S3VideoGenerationService.prepareVideoMerge(
          userId,
          sessionId || `session_${Date.now()}`,
          body.videoClipUrls
        )
        
        result = {
          success: mergeResult.success,
          action,
          data: {
            mergedVideoUrl: mergeResult.mergedVideoUrl,
            duration: mergeResult.duration,
            method: mergeResult.method,
            instructions: mergeResult.instructions,
            fileSize: mergeResult.fileSize,
            totalClips: body.videoClipUrls.length
          },
          message: mergeResult.mergedVideoUrl 
            ? `Video merged successfully (${mergeResult.method} method)`
            : `Prepared for ${mergeResult.method}-side video merging`,
          error: mergeResult.error
        }
        break
      }

      default: {
        result = {
          success: false,
          action,
          data: {},
          message: `Unknown action: ${action}`,
          error: `Unsupported action. Use: list_frames, generate_videos, or prepare_merge`
        }
      }
    }

    console.log(`✅ S3 video workflow ${action} completed:`, result.message)
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ S3 video workflow failed:', error)
    
    return NextResponse.json(
      { 
        error: `S3 video workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET endpoint for checking workflow status and getting instructions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action') || 'info'

    if (!userId && action !== 'info') {
      return NextResponse.json(
        { error: 'User ID is required for most actions' },
        { status: 400 }
      )
    }

    if (action === 'info') {
      return NextResponse.json({
        endpoint: '/api/process_s3_video_workflow',
        description: 'Complete S3 video generation workflow',
        actions: {
          list_frames: {
            description: 'List all uploaded frames for a user',
            method: 'POST',
            body: { userId: 'string', action: 'list_frames' }
          },
          generate_videos: {
            description: 'Generate video clips from uploaded frames',
            method: 'POST',
            body: {
              userId: 'string',
              action: 'generate_videos',
              sessionId: 'string (optional)',
              frameAspectRatio: 'string (optional, default: "1280:720")',
              prompt: 'string (optional)',
              batchSize: 'number (optional, default: 3)'
            }
          },
          prepare_merge: {
            description: 'Prepare video clips for merging into final video',
            method: 'POST',
            body: {
              userId: 'string',
              action: 'prepare_merge',
              sessionId: 'string (optional)',
              videoClipUrls: 'string[] (required)'
            }
          }
        },
        workflow: [
          "1. Upload frames to S3 using existing upload system",
          "2. Call with action='list_frames' to see available frames",
          "3. Call with action='generate_videos' to create video clips from frames",
          "4. Collect the generated video URLs from the response",
          "5. Call with action='prepare_merge' to merge clips into final video",
          "6. Use client-side VideoMerger utility for final merging (instructions provided)"
        ]
      })
    }

    if (action === 'list_frames' && userId) {
      const framesResult = await S3VideoGenerationService.getUserFrames(userId)
      return NextResponse.json({
        userId,
        action: 'list_frames',
        frames: framesResult.frames,
        totalFrames: framesResult.frames.length,
        error: framesResult.error
      })
    }

    return NextResponse.json({
      error: 'Invalid action. Use ?action=info for endpoint documentation'
    }, { status: 400 })

  } catch (error) {
    console.error('Error in workflow GET:', error)
    
    return NextResponse.json(
      { error: 'Failed to process workflow request' },
      { status: 500 }
    )
  }
}