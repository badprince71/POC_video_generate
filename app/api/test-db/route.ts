import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/utils/supabase'

export async function GET() {
  try {
    // Check if Supabase is configured
    const configured = isSupabaseConfigured()
    
    if (!configured) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase not configured',
        details: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      }, { status: 500 })
    }

    // Test database connection by trying to query the video_sessions table
    const { data, error } = await supabase
      .from('video_sessions')
      .select('*')
      .limit(1)

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        details: {
          error: error.message,
          code: error.code,
          hint: error.hint
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      data: data
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 