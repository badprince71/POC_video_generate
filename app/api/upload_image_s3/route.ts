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
    const contentType = request.headers.get('content-type') || ''
    let imageDataBase64: string | undefined
    let frameId: string | number | undefined
    let isUserUpload = false
    let folderPath: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const uploaded = (form.get('image') as File) || (form.get('file') as File) || null
      if (uploaded && typeof uploaded !== 'string') {
        const arrayBuffer = await uploaded.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageDataBase64 = buffer.toString('base64')
      }
      const isUserUploadRaw = form.get('isUserUpload') as string
      isUserUpload = typeof isUserUploadRaw === 'string' ? ['true','1','yes','on'].includes(isUserUploadRaw.toLowerCase()) : false
      folderPath = (form.get('folderPath') as string) || undefined
      frameId = (form.get('frameId') as string) || undefined
    } else {
      const { imageData, frameId: bodyFrameId, isUserUpload: bodyIsUserUpload = false, folderPath: bodyFolderPath } = await request.json()
      imageDataBase64 = imageData?.replace(/^data:image\/\w+;base64,/, '')
      isUserUpload = !!bodyIsUserUpload
      folderPath = bodyFolderPath
      frameId = bodyFrameId
    }

    if (!imageDataBase64) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 })
    }

    // Support custom folder path for new structure or fallback to old structure
    if (folderPath) {
      // New folder structure: <userid>/<requestid>/reference-frames/
      const result = await uploadImageToS3({
        imageData: imageDataBase64, // already base64 (no data URL prefix)
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
        imageData: imageDataBase64, // already base64 (no data URL prefix)
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