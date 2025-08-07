import { NextRequest, NextResponse } from 'next/server'
import { withApiKeyAuth } from '@/lib/auth/api-key-auth'
import { uploadImageToS3 } from '@/lib/upload/s3_upload'

async function uploadImageHandler(request: NextRequest) {
  try {
    const { imageData, filename, userId, requestId, type = 'user-uploads' } = await request.json()
    
    if (!imageData) {
      return NextResponse.json({ 
        error: "Image data is required" 
      }, { status: 400 })
    }

    // Use provided userId/requestId or generate defaults
    const finalUserId = userId || 'public-user'
    const finalRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    
    // Create folder path for S3 storage
    const folderPath = `${finalUserId}/${finalRequestId}/${type}`

    // Generate filename if not provided
    const finalFilename = filename || `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.png`

    console.log(`Uploading image for user: ${finalUserId}, request: ${finalRequestId}`)

    // Upload image to S3
    const result = await uploadImageToS3({
      imageData: imageData.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix
      userId: folderPath,
      type: type as 'reference-frames' | 'user-uploads',
      filename: finalFilename
    })

    return NextResponse.json({
      success: true,
      imageUrl: result.publicUrl,
      s3Key: result.key,
      userId: finalUserId,
      requestId: finalRequestId,
      filename: finalFilename,
      type,
      uploadedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in public image upload API:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Export the handler wrapped with API key authentication
export const POST = withApiKeyAuth(uploadImageHandler) 