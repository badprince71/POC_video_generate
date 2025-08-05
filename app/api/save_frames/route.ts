import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'

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

    // Save session metadata to database
    console.log('Attempting to save session to database...')
    const { data: sessionData, error: sessionError } = await supabase
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
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error saving session:', sessionError)
      return NextResponse.json({ 
        error: "Failed to save session", 
        details: sessionError.message,
        code: sessionError.code,
        hint: sessionError.hint || 'No additional hint available'
      }, { status: 500 })
    }

    console.log('Session saved successfully:', sessionData)

    // Save individual frames to database
    console.log('Preparing to save frames...')
    const framesToInsert = frames.map(frame => ({
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