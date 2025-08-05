import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get recent sessions for this user
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10) // Get the 10 most recent sessions

    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError)
      return NextResponse.json({ error: "Failed to fetch recent sessions" }, { status: 500 })
    }

    console.log(`Found ${sessionsData?.length || 0} recent sessions for user ${userId}`)

    return NextResponse.json({
      sessions: sessionsData || [],
      success: true,
      count: sessionsData?.length || 0
    })

  } catch (error) {
    console.error('Error fetching recent sessions from database:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 