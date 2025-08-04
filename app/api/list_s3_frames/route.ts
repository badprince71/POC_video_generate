import { NextRequest, NextResponse } from 'next/server'
import { listUserFramesFromS3 } from '@/lib/upload/s3_upload'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // List frames from S3 for this user
    const result = await listUserFramesFromS3(userId)

    if (result.error) {
      console.error('Error listing S3 frames:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Filter to only include image files (PNG, JPG, etc.)
    const imageFrames = result.frames.filter(frame => 
      frame.name.toLowerCase().includes('.png') ||
      frame.name.toLowerCase().includes('.jpg') ||
      frame.name.toLowerCase().includes('.jpeg') ||
      frame.name.toLowerCase().includes('.webp')
    )

    return NextResponse.json({
      frames: imageFrames,
      success: true,
      count: imageFrames.length
    })

  } catch (error) {
    console.error('Error listing S3 frames:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 