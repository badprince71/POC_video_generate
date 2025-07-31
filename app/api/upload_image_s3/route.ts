import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToS3 } from '@/lib/upload/s3_upload'

// Types for the upload function
interface UploadImageParams {
  imageData: string
  userId: string
  type: 'reference-frames' | 'user-uploads'
  filename: string
}

interface UploadImageResult {
  publicUrl: string
  key: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageData, frameId, isUserUpload = false } = await request.json()
    
    if (!imageData) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 })
    }

    // Generate a unique user ID for this session (in production, use actual user auth)
    const userId: string = process.env.USER_ID || 'user';
    
    // Determine upload type based on whether it's a user upload or generated frame
    const uploadType: 'reference-frames' | 'user-uploads' = isUserUpload ? 'user-uploads' : 'reference-frames';
    
    // Upload to S3
    const result = await uploadImageToS3({
      imageData: imageData.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix
      userId: userId,
      type: uploadType,
      filename: `frame_${frameId}_${Date.now()}.png`
    })
    
    return NextResponse.json({
      imageUrl: result.publicUrl,
      frameId: frameId,
      userId: userId,
      success: true,
      s3Key: result.key
    })

  } catch (error) {
    console.error('Error uploading image to S3:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}