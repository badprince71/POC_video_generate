import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUrl } from '@/lib/services/s3-media-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const download = searchParams.get('download') === 'true'

    if (!key) {
      return NextResponse.json({ 
        error: "File key is required",
        success: false 
      }, { status: 400 })
    }

    console.log(`Generating presigned URL for: ${key} (download: ${download})`)

    // Generate presigned URL
    const url = await getPresignedUrl(key, download)

    return NextResponse.json({ 
      success: true,
      url,
      key,
      download,
      expiresIn: 3600 // 1 hour
    })

  } catch (error) {
    console.error('Error generating presigned URL:', error)
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to generate presigned URL",
      success: false 
    }, { status: 500 })
  }
}

// Also support POST method
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, download = false } = body

    if (!key) {
      return NextResponse.json({ 
        error: "File key is required",
        success: false 
      }, { status: 400 })
    }

    console.log(`Generating presigned URL for: ${key} (download: ${download})`)

    // Generate presigned URL
    const url = await getPresignedUrl(key, download)

    return NextResponse.json({ 
      success: true,
      url,
      key,
      download,
      expiresIn: 3600 // 1 hour
    })

  } catch (error) {
    console.error('Error generating presigned URL:', error)
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to generate presigned URL",
      success: false 
    }, { status: 500 })
  }
}