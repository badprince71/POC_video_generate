import { NextRequest, NextResponse } from 'next/server'
import { getFrameFromS3 } from '@/lib/upload/s3_upload'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: "S3 key is required" }, { status: 400 })
    }

    // Normalize key: decode once, strip leading slashes and any query/hash fragments
    try {
      key = decodeURIComponent(key)
    } catch {}
    key = key.replace(/^\/+/, '')
    if (key.includes('?')) key = key.split('?')[0]
    if (key.includes('#')) key = key.split('#')[0]

    // Get the image from S3
    const result = await getFrameFromS3(key)

    if (result.error) {
      console.error('Error fetching image from S3:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    if (!result.data) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Return the image with proper headers
    return new NextResponse(result.data, {
      headers: {
        'Content-Type': result.contentType || 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Error proxying S3 image:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 

// Ensure Node.js runtime (not edge) for AWS SDK compatibility
export const runtime = 'nodejs'