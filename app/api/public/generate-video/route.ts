import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToS3 } from '@/lib/upload/s3_upload'
import { generateVideosFromS3Frames } from '@/lib/services/s3-video-generation'

async function generateVideoHandler(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let images: string[] | undefined
    let prompt: string | undefined
    let userId: string | undefined
    let requestId: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      prompt = (form.get('prompt') as string) || undefined
      userId = (form.get('userId') as string) || undefined
      requestId = (form.get('requestId') as string) || undefined

      // Collect multiple file inputs: image, image1, image2, files[]
      const collected: string[] = []
      const possibleKeys = ['image', 'image1', 'image2', 'image3', 'file', 'file1', 'file2']
      for (const key of possibleKeys) {
        const maybe = form.get(key)
        if (maybe && maybe instanceof File) {
          const ab = await maybe.arrayBuffer()
          const buf = Buffer.from(ab)
          collected.push(buf.toString('base64'))
        }
      }
      // Handle files[] as multiple
      const files = form.getAll('files[]')
      for (const f of files) {
        if (f && f instanceof File) {
          const ab = await f.arrayBuffer()
          const buf = Buffer.from(ab)
          collected.push(buf.toString('base64'))
        }
      }
      images = collected
    } else {
      const body = await request.json()
      images = body.images
      prompt = body.prompt
      userId = body.userId
      requestId = body.requestId
    }
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ 
        error: "Images array is required and must not be empty" 
      }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ 
        error: "Prompt is required" 
      }, { status: 400 })
    }

    // Use provided userId/requestId or generate defaults
    const finalUserId = userId || 'public-user'
    const finalRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    
    // Create folder path for S3 storage - use the userId directly for S3 structure
    const s3UserId = `${finalUserId}-${finalRequestId}`

    console.log(`Starting video generation for user: ${finalUserId}, request: ${finalRequestId}`)
    console.log(`Uploading ${images.length} images to S3...`)

    // Upload images to S3
    const uploadedImages = []
    for (let i = 0; i < images.length; i++) {
      try {
        const imageData = images[i].replace(/^data:image\/\w+;base64,/, '') // Remove data URL prefix
        
        const result = await uploadImageToS3({
          imageData,
          userId: s3UserId,
          type: 'reference-frames',
          filename: `frame_${i}_${Date.now()}.png`
        })
        
        uploadedImages.push({
          index: i,
          s3Key: result.key,
          url: result.publicUrl
        })
        
        console.log(`Uploaded image ${i + 1}/${images.length}: ${result.key}`)
      } catch (error) {
        console.error(`Failed to upload image ${i}:`, error)
        return NextResponse.json({ 
          error: `Failed to upload image ${i + 1}`,
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    console.log(`All images uploaded successfully. Starting video generation...`)

    // Generate video from uploaded frames
    const videoResult = await generateVideosFromS3Frames({
      userId: s3UserId,
      sessionId: finalRequestId,
      prompt,
      frameAspectRatio: '16:9'
    })

    if (!videoResult.success) {
      return NextResponse.json({ 
        error: "Video generation failed",
        details: videoResult.error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      videoUrls: videoResult.generatedVideoUrls,
      userId: finalUserId,
      requestId: finalRequestId,
      s3UserId: s3UserId,
      frameCount: uploadedImages.length,
      prompt,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in public video generation API:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const POST = generateVideoHandler 