import { NextRequest, NextResponse } from 'next/server'
import { uploadVideoToS3 } from '@/lib/upload/s3_upload'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const userId = formData.get('userId') as string
    const filename = formData.get('filename') as string
    
    if (!videoFile) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 })
    }

    if (!userId || !filename) {
      return NextResponse.json({ error: "userId and filename are required" }, { status: 400 })
    }

    console.log(`Uploading video via API: ${filename} (${videoFile.size} bytes)`)

    // Convert File to Blob for upload
    const videoBlob = new Blob([await videoFile.arrayBuffer()], { type: videoFile.type })
    
    // Upload to S3
    const result = await uploadVideoToS3({
      videoBlob,
      userId,
      filename,
      folder: 'video-clips'
    })
    
    return NextResponse.json({
      success: true,
      publicUrl: result.publicUrl,
      key: result.key,
      filename: filename,
      size: videoFile.size
    })

  } catch (error) {
    console.error('Error uploading video to S3 via API:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}