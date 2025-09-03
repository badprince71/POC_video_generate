import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'
import { uploadImageToS3, getSignedUrlFromS3, sanitizeFilename } from '@/lib/upload/s3_upload'

interface FrameData {
  id: number
  timestamp: string
  imageUrl: string
  description: string
  prompt: string
  sceneStory?: string
  fullStory?: {
    title: string
    overallStory: string
    style: string
    mood: string
  }
}

interface SaveFramesRequest {
  frames: FrameData[]
  userId: string
  sessionId: string
  originalPrompt: string
  videoDuration: number
  frameCount: number
  style: string
  mood: string
}

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
      return NextResponse.json({ 
        error: "Database not configured. Please set up Supabase environment variables.",
        details: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      }, { status: 500 })
    }

    // Get request body
    let requestBody: SaveFramesRequest
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ 
        error: "Invalid request body",
        details: "Failed to parse JSON request body"
      }, { status: 400 })
    }

    const { frames, userId, sessionId, originalPrompt, videoDuration, frameCount, style, mood } = requestBody
    
    console.log('Received save_frames request:', {
      framesCount: frames?.length,
      userId,
      sessionId,
      originalPrompt: originalPrompt?.substring(0, 50) + '...',
      videoDuration,
      frameCount,
      style,
      mood
    })
    
    // Validate payload size
    const payloadSize = JSON.stringify(requestBody).length
    const maxPayloadSize = 6 * 1024 * 1024 // 6MB limit
    console.log(`Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`)
    
    if (payloadSize > maxPayloadSize) {
      console.error(`Payload too large: ${(payloadSize / 1024 / 1024).toFixed(2)}MB exceeds ${(maxPayloadSize / 1024 / 1024).toFixed(2)}MB limit`)
      return NextResponse.json({ 
        error: "Payload too large",
        details: `Request payload size (${(payloadSize / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size (${(maxPayloadSize / 1024 / 1024).toFixed(2)}MB). Please ensure images are uploaded to cloud storage before saving frames.`,
        payloadSize: payloadSize,
        maxPayloadSize: maxPayloadSize
      }, { status: 413 })
    }
    
    // Log first frame for debugging
    if (frames && frames.length > 0) {
      console.log('First frame sample:', {
        id: frames[0].id,
        timestamp: frames[0].timestamp,
        imageUrl: frames[0].imageUrl?.substring(0, 50) + '...',
        description: frames[0].description?.substring(0, 50) + '...',
        prompt: frames[0].prompt?.substring(0, 50) + '...'
      })
    }
    
    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: "Frames data is required" }, { status: 400 })
    }

    if (!userId || !sessionId) {
      return NextResponse.json({ 
        error: "userId and sessionId are required",
        details: {
          userId: userId || 'undefined',
          sessionId: sessionId || 'undefined'
        }
      }, { status: 400 })
    }

    // Check if userId is 'anonymous' which might indicate authentication issues
    if (userId === 'anonymous') {
      console.warn('User is anonymous - authentication might be required')
    }

    // Upload frames to S3 if needed and normalize URLs
    // Folder path: <userId>/<sessionId>/reference-frames
    const folderPath = `${userId}/${sessionId}/reference-frames`
    const expiresIn = 3600

    const normalizedFrames = await Promise.all((frames || []).map(async (frame) => {
      try {
        const url: string = frame.imageUrl || ''
        const isAlreadyUrl = /^https?:\/\//i.test(url)
        const isDataUrl = /^data:image\//i.test(url)

        if (isAlreadyUrl) {
          return frame
        }

        let base64Data: string | null = null
        if (isDataUrl) {
          base64Data = url.replace(/^data:image\/\w+;base64,/, '')
        }

        if (!base64Data) {
          // Not a URL and not a data URL; skip upload
          return frame
        }

        const filename = `frame_${frame.id ?? 'idx'}_${Date.now()}.png`
        const uploadResult = await uploadImageToS3({
          imageData: base64Data,
          userId: folderPath,
          type: 'reference-frames',
          filename
        })

        const signedUrl = await getSignedUrlFromS3(uploadResult.key, expiresIn)

        return {
          ...frame,
          imageUrl: signedUrl,
          s3Key: uploadResult.key
        }
      } catch (e) {
        console.warn('Failed to upload frame to S3, keeping original URL', e)
        return frame
      }
    }))

    // Upload all frame images to S3 under <userId>/<sessionId>/reference-frames
    // and replace frame.imageUrl with the S3 proxy URL
    const targetFolderPath = `${userId}/${sessionId}/reference-frames`
    let uploadedCount = 0

    const origin = new URL(request.url).origin

    const uploadResults = await Promise.all(
      (frames || []).map(async (frame, index) => {
        try {
          let base64Data: string | null = null
          const source = frame.imageUrl || ''

          if (source.startsWith('data:image')) {
            // data URL
            const commaIndex = source.indexOf('base64,')
            base64Data = commaIndex >= 0 ? source.substring(commaIndex + 'base64,'.length) : null
          } else {
            // Fetch from URL (absolute or relative)
            const urlToFetch = source.startsWith('http') ? source : `${origin}${source}`
            const resp = await fetch(urlToFetch)
            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status}`)
            }
            const arrayBuffer = await resp.arrayBuffer()
            base64Data = Buffer.from(arrayBuffer).toString('base64')
          }

          if (!base64Data) {
            throw new Error('No image data')
          }

          const baseName = sanitizeFilename(`frame_${frame.id ?? index}_${Date.now()}.png`)
          const { publicUrl, key } = await uploadImageToS3({
            imageData: base64Data,
            userId: targetFolderPath,
            type: 'reference-frames',
            filename: baseName
          })

          uploadedCount += 1
          // Replace imageUrl with proxy URL for DB
          frame.imageUrl = publicUrl

          return { success: true, key }
        } catch (err) {
          console.warn('Failed to upload frame to S3, keeping original URL', { index, error: err instanceof Error ? err.message : String(err) })
          return { success: false }
        }
      })
    )

    console.log(`Uploaded ${uploadedCount}/${frames?.length ?? 0} frames to S3 path: ${targetFolderPath}`)

    // Save or update session metadata to database (idempotent per sessionId)
    console.log('Attempting to save session to database...')
    let { data: sessionData, error: sessionError } = await supabase
      .from('video_sessions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        original_prompt: originalPrompt,
        video_duration: videoDuration,
        frame_count: frameCount,
        style: style,
        mood: mood,
        status: 'frames_generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError && sessionError.code === '23505') {
      // Duplicate key: update existing session instead of failing
      console.warn('Session already exists, updating instead of inserting')
      const updateResult = await supabase
        .from('video_sessions')
        .update({
          original_prompt: originalPrompt,
          video_duration: videoDuration,
          frame_count: frameCount,
          style: style,
          mood: mood,
          status: 'frames_generated',
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .select()
        .single()
      sessionError = updateResult.error as any
      sessionData = updateResult.data as any
    }

    if (sessionError) {
      console.error('Error saving/updating session:', sessionError)
      return NextResponse.json({ 
        error: "Failed to save session", 
        details: sessionError.message,
        code: sessionError.code,
        hint: sessionError.hint || 'No additional hint available'
      }, { status: 500 })
    }

    console.log('Session saved/updated successfully:', sessionData)

    // Save individual frames to database
    console.log('Preparing to save frames...')
    const framesToInsert = normalizedFrames.map(frame => ({
      session_id: sessionId,
      frame_number: frame.id,
      timestamp: frame.timestamp,
      image_url: frame.imageUrl,
      description: frame.description,
      prompt: frame.prompt,
      scene_story: frame.sceneStory,
      story_title: frame.fullStory?.title,
      story_overview: frame.fullStory?.overallStory,
      style: frame.fullStory?.style,
      mood: frame.fullStory?.mood,
      created_at: new Date().toISOString()
    }))

    console.log('Attempting to save frames to database...')
    // Remove any prior frames for this session to avoid duplicates
    try {
      await supabase.from('video_frames').delete().eq('session_id', sessionId)
    } catch (e) {
      console.warn('Failed to clear existing frames for session; continuing to insert new frames', e)
    }
    const { data: framesData, error: framesError } = await supabase
      .from('video_frames')
      .insert(framesToInsert)
      .select()

    if (framesError) {
      console.error('Error saving frames:', framesError)
      return NextResponse.json({ 
        error: "Failed to save frames", 
        details: framesError.message,
        code: framesError.code,
        hint: framesError.hint || 'No additional hint available'
      }, { status: 500 })
    }

    console.log(`Successfully saved ${frames.length} frames to database for session ${sessionId}`)

    return NextResponse.json({
      sessionId: sessionId,
      userId: userId,
      framesCount: frames.length,
      success: true
    })

  } catch (error) {
    console.error('Unexpected error in save_frames API:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 