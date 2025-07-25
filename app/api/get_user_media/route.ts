import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get all files from Supabase Storage for the specific user
    const { data: files, error: storageError } = await supabase.storage
      .from('videomaker')
      .list(userId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (storageError) {
      console.error('Error fetching files from storage:', storageError)
      return NextResponse.json({ error: "Failed to fetch files from storage" }, { status: 500 })
    }

    // Get database records for this user
    const { data: sessions, error: sessionsError } = await supabase
      .from('video_sessions')
      .select(`
        *,
        video_frames (*),
        video_clips (*),
        final_videos (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    // Process storage files
    const images: any[] = []
    const videos: any[] = []

    if (files) {
      for (const file of files) {
        const filePath = `${userId}/${file.name}`
        const { data: { publicUrl } } = supabase.storage
          .from('videomaker')
          .getPublicUrl(filePath)

        // Categorize files based on extension
        const extension = file.name.split('.').pop()?.toLowerCase()
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
          images.push({
            id: file.id,
            name: file.name,
            url: publicUrl,
            size: file.metadata?.size,
            created_at: file.created_at,
            updated_at: file.updated_at,
            type: 'image'
          })
        } else if (['mp4', 'avi', 'mov', 'webm'].includes(extension || '')) {
          videos.push({
            id: file.id,
            name: file.name,
            url: publicUrl,
            size: file.metadata?.size,
            created_at: file.created_at,
            updated_at: file.updated_at,
            type: 'video'
          })
        }
      }
    }

    // Process database records
    const processedSessions = sessions?.map(session => ({
      ...session,
      frames: session.video_frames?.map((frame: any) => ({
        ...frame,
        type: 'frame',
        category: 'database'
      })) || [],
      clips: session.video_clips?.map((clip: any) => ({
        ...clip,
        type: 'clip',
        category: 'database'
      })) || [],
      finalVideos: session.final_videos?.map((video: any) => ({
        ...video,
        type: 'final_video',
        category: 'database'
      })) || []
    })) || []

    return NextResponse.json({
      userId: userId,
      images: images,
      videos: videos,
      sessions: processedSessions,
      success: true
    })

  } catch (error) {
    console.error('Error fetching user media:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 