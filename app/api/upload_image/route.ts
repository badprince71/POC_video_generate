import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

// Types for the upload function
interface UploadImageParams {
  imageData: string
  userId: string
  type: string
  filename: string
}

interface UploadImageResult {
  publicUrl: string
}

// For development, we'll use a simple approach
// In production, you would use AWS S3, Google Cloud Storage, or similar

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let imageDataBase64: string | undefined
    let frameId: string | number | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const uploaded = (form.get('image') as File) || (form.get('file') as File) || null
      if (uploaded && typeof uploaded !== 'string') {
        const arrayBuffer = await uploaded.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        imageDataBase64 = buffer.toString('base64')
      }
      frameId = (form.get('frameId') as string) || undefined
    } else {
      const { imageData, frameId: bodyFrameId } = await request.json()
      imageDataBase64 = imageData?.replace(/^data:image\/\w+;base64,/, '')
      frameId = bodyFrameId
    }
    
    if (!imageDataBase64) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 })
    }

    // Generate a unique user ID for this session (in production, use actual user auth)
    const userId : string = process.env.USER_ID || 'user';
    
    // Upload to Supabase Storage
    const result = await uploadImage({
      imageData: imageDataBase64, // already base64 (no data URL prefix)
      userId: userId,
      type: 'frames',
      filename: `frame_${frameId}_${Date.now()}.png`
    })
    
    return NextResponse.json({
      imageUrl: result.publicUrl,
      frameId: frameId,
      userId: userId,
      success: true
    })

  } catch (error) {
    console.error('Error uploading image:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function uploadImage({ imageData, userId, type, filename }: UploadImageParams): Promise<UploadImageResult> {
  if (!process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase service key is not configured")
  }

  try {
    // Convert base64 to blob
    const byteCharacters = atob(imageData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const file = new File([blob], filename, { type: 'image/png' });

    // Create Supabase client with service key
    // const supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_KEY!
    // )

    // Upload to Supabase Storage with user-specific path
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videomaker')
      .upload(`${userId}/${type}/${filename}`, file, {
        cacheControl: '3600'
      })

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }
    console.log("Uploaded image to Supabase Storage")
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videomaker')
      .getPublicUrl(`${userId}/${type}/${filename}`)
    console.log("Public URL:", publicUrl)
    return { publicUrl }
  } catch (error) {
    console.error("Error uploading image:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to upload image")
  }
}