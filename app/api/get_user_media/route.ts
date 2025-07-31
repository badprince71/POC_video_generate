import { NextRequest, NextResponse } from 'next/server'
import { listMediaFiles, getMediaStats } from '@/lib/services/s3-media-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeStats = searchParams.get('includeStats') === 'true'

    // Note: userId is optional - if not provided, will fetch all media files
    // For user-specific filtering, you might want to organize by userId in S3 paths

    console.log(`Fetching media files${userId ? ` for user: ${userId}` : ' (all users)'}`)

    // Fetch media files from S3
    const mediaData = await listMediaFiles(userId || undefined)
    
    let stats = null
    if (includeStats) {
      stats = await getMediaStats(userId || undefined)
    }

    const response = {
      success: true,
      images: mediaData.images.map(item => ({
        id: item.key,
        name: item.name,
        url: item.url,
        downloadUrl: item.downloadUrl,
        size: item.size,
        created_at: item.lastModified.toISOString(),
        updated_at: item.lastModified.toISOString(),
        type: item.type,
        folder: item.folder,
        key: item.key
      })),
      videos: mediaData.videos.map(item => ({
        id: item.key,
        name: item.name,
        url: item.url,
        downloadUrl: item.downloadUrl,
        size: item.size,
        created_at: item.lastModified.toISOString(),
        updated_at: item.lastModified.toISOString(),
        type: item.type,
        folder: item.folder,
        key: item.key
      })),
      all: mediaData.all.map(item => ({
        id: item.key,
        name: item.name,
        url: item.url,
        downloadUrl: item.downloadUrl,
        size: item.size,
        created_at: item.lastModified.toISOString(),
        updated_at: item.lastModified.toISOString(),
        type: item.type,
        folder: item.folder,
        key: item.key
      })),
      ...(stats && { stats }),
      count: {
        total: mediaData.all.length,
        images: mediaData.images.length,
        videos: mediaData.videos.length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching user media:', error)
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch media files",
      success: false,
      images: [],
      videos: [],
      all: [],
      count: { total: 0, images: 0, videos: 0 }
    }, { status: 500 })
  }
}