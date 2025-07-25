import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId')

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Get session information
    const { data: sessionData, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Get frames for this session
    const { data: framesData, error: framesError } = await supabase
      .from('video_frames')
      .select('*')
      .eq('session_id', sessionId)
      .order('frame_number', { ascending: true })

    if (framesError) {
      console.error('Error fetching frames:', framesError)
      return NextResponse.json({ error: "Failed to fetch frames" }, { status: 500 })
    }

    // Transform database data to match the expected format
    const frames = framesData.map((frame: any) => ({
      id: frame.frame_number,
      timestamp: frame.timestamp,
      imageUrl: frame.image_url,
      description: frame.description,
      prompt: frame.prompt,
      sceneStory: frame.scene_story,
      fullStory: {
        title: frame.story_title,
        overallStory: frame.story_overview,
        style: frame.style,
        mood: frame.mood
      }
    }))

    return NextResponse.json({
      session: sessionData,
      frames: frames,
      success: true
    })

  } catch (error) {
    console.error('Error fetching frames from database:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 