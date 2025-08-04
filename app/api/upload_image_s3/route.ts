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
    const { imageData, frameId, isUserUpload = false, folderPath } = await request.json()
    
    if (!imageData) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 })
    }

    // Support custom folder path for new structure or fallback to old structure
    if (folderPath) {
      // New folder structure: <userid>/<requestid>/reference-frames/
      const result = await uploadImageToS3({
        imageData: imageData.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix
        userId: folderPath, // Use folderPath directly as it contains the full path
        type: 'reference-frames', // This will be ignored when userId contains full path
        filename: `frame_${frameId}_${Date.now()}.png`
      })
      
      return NextResponse.json({
        imageUrl: result.publicUrl,
        frameId: frameId,
        userId: folderPath,
        success: true,
        s3Key: result.key
      })
    } else {
      // Legacy folder structure
      const userId: string = process.env.USER_ID || 'user';
      const uploadType: 'reference-frames' | 'user-uploads' = isUserUpload ? 'user-uploads' : 'reference-frames';
      
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
    }

  } catch (error) {
    console.error('Error uploading image to S3:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}