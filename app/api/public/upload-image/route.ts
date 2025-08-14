import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToS3 } from '@/lib/upload/s3_upload'

async function uploadImageHandler(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let imageDataBase64: string | undefined
    let filename: string | undefined
    let userId: string | undefined
    let requestId: string | undefined
    let type: 'user-uploads' | 'reference-frames' | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const uploaded = (form.get('image') as File) || (form.get('file') as File) || null
      if (uploaded && typeof uploaded !== 'string') {
        const arrayBuffer = await uploaded.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageDataBase64 = buffer.toString('base64')
      }
      filename = (form.get('filename') as string) || undefined
      userId = (form.get('userId') as string) || undefined
      requestId = (form.get('requestId') as string) || undefined
      const typeRaw = (form.get('type') as string) || undefined
      type = (typeRaw === 'reference-frames' || typeRaw === 'user-uploads') ? typeRaw : undefined
    } else {
      const body = await request.json()
      imageDataBase64 = body.imageData?.replace(/^data:image\/\w+;base64,/, '')
      filename = body.filename
      userId = body.userId
      requestId = body.requestId
      type = body.type
    }
    
    if (!imageDataBase64) {
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
      imageData: imageDataBase64, // already base64 (no data URL prefix)
      userId: folderPath,
      type: (type || 'user-uploads') as 'reference-frames' | 'user-uploads',
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

export const POST = uploadImageHandler 