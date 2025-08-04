import { NextRequest, NextResponse } from 'next/server'
import { listMediaFiles, getMediaStats } from '@/lib/services/s3-media-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'

    // Get user ID from query params or use default
    const userId = searchParams.get('userId') || 'default'
    const userEmail = 'default@example.com'

    console.log(`Fetching media files for user: ${userId}`)

    // Fetch media files from S3 for the authenticated user
    const mediaData = await listMediaFiles(userId)
    
    let stats = null
    if (includeStats) {
      stats = await getMediaStats(userId)
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