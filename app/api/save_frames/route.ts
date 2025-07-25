import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

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
    const { frames, userId, sessionId, originalPrompt, videoDuration, frameCount, style, mood }: SaveFramesRequest = await request.json()
    
    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: "Frames data is required" }, { status: 400 })
    }

    // Save session metadata to database
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
      return NextResponse.json({ error: "Failed to save session" }, { status: 500 })
    }

    // Save individual frames to database
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

    const { data: framesData, error: framesError } = await supabase
      .from('video_frames')
      .insert(framesToInsert)
      .select()

    if (framesError) {
      console.error('Error saving frames:', framesError)
      return NextResponse.json({ error: "Failed to save frames" }, { status: 500 })
    }

    console.log(`Saved ${frames.length} frames to database for session ${sessionId}`)

    return NextResponse.json({
      sessionId: sessionId,
      userId: userId,
      framesCount: frames.length,
      success: true
    })

  } catch (error) {
    console.error('Error saving frames to database:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 