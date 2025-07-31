import { NextRequest, NextResponse } from 'next/server'
import { getFrameFromS3, getSignedUrlFromS3 } from '@/lib/upload/s3_upload'

interface ConvertImageRequest {
  imageUrl?: string
  s3Key?: string
  userId?: string
  expiresIn?: number
}

interface ConvertImageResponse {
  success: boolean
  base64?: string
  contentType?: string
  size?: number
  method: 'direct' | 'signed_url' | 's3_key'
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ConvertImageRequest = await request.json()
    const { imageUrl, s3Key, userId, expiresIn = 3600 } = body

    if (!imageUrl && !s3Key) {
      return NextResponse.json(
        { error: 'Either imageUrl or s3Key is required' },
        { status: 400 }
      )
    }

    console.log('🖼️ Converting image to base64:', { imageUrl, s3Key, userId })

    let result: ConvertImageResponse

    // Method 1: Direct S3 key access (most reliable)
    if (s3Key) {
      try {
        console.log('📁 Trying direct S3 key access...')
        const { data, contentType, error } = await getFrameFromS3(s3Key)
        
        if (error || !data) {
          throw new Error(error || 'No data returned from S3')
        }

        const base64 = `data:${contentType || 'image/png'};base64,${data.toString('base64')}`
        
        result = {
          success: true,
          base64,
          contentType: contentType || 'image/png',
          size: data.length,
          method: 's3_key'
        }
        
        console.log(`✅ Successfully converted via S3 key (${data.length} bytes)`)
        return NextResponse.json(result)

      } catch (s3Error) {
        console.log('❌ S3 key access failed:', s3Error)
      }
    }

    // Method 2: Signed URL access
    if (s3Key) {
      try {
        console.log('🔗 Trying signed URL access...')
        const signedUrl = await getSignedUrlFromS3(s3Key, expiresIn)
        
        const response = await fetch(signedUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/png'
        const base64 = `data:${contentType};base64,${buffer.toString('base64')}`

        result = {
          success: true,
          base64,
          contentType,
          size: buffer.length,
          method: 'signed_url'
        }
        
        console.log(`✅ Successfully converted via signed URL (${buffer.length} bytes)`)
        return NextResponse.json(result)

      } catch (signedUrlError) {
        console.log('❌ Signed URL access failed:', signedUrlError)
      }
    }

    // Method 3: Direct URL fetch (may fail due to CORS)
    if (imageUrl) {
      try {
        console.log('🌐 Trying direct URL fetch...')
        const response = await fetch(imageUrl)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/png'
        const base64 = `data:${contentType};base64,${buffer.toString('base64')}`

        result = {
          success: true,
          base64,
          contentType,
          size: buffer.length,
          method: 'direct'
        }
        
        console.log(`✅ Successfully converted via direct URL (${buffer.length} bytes)`)
        return NextResponse.json(result)

      } catch (directError) {
        console.log('❌ Direct URL access failed:', directError)
      }
    }

    // All methods failed
    result = {
      success: false,
      method: 'direct',
      error: 'All conversion methods failed. Please check S3 configuration and image accessibility.'
    }

    console.error('❌ All image conversion methods failed')
    return NextResponse.json(result, { status: 400 })

  } catch (error) {
    console.error('❌ Image conversion API error:', error)
    
    return NextResponse.json(
      { 
        error: `Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET endpoint for testing image access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('imageUrl')
    const s3Key = searchParams.get('s3Key')

    if (!imageUrl && !s3Key) {
      return NextResponse.json({
        error: 'Either imageUrl or s3Key parameter is required',
        usage: {
          'POST': 'Convert image to base64',
          'GET': 'Test image accessibility',
          'parameters': {
            'imageUrl': 'Direct S3 public URL',
            's3Key': 'S3 object key (e.g., reference-frames/userId/image.png)',
            'userId': 'User ID (optional, for logging)',
            'expiresIn': 'Signed URL expiry in seconds (default: 3600)'
          },
          'examples': {
            'POST_body': {
              's3Key': 'reference-frames/user123/frame_01.png',
              'userId': 'user123'
            },
            'GET_url': '/api/convert_s3_image_to_base64?s3Key=reference-frames/user123/frame_01.png'
          }
        }
      })
    }

    // Test image accessibility
    const testResult = {
      imageUrl,
      s3Key,
      accessibility: {
        direct_url: false,
        signed_url: false,
        s3_key: false
      },
      errors: {} as any
    }

    // Test direct URL access
    if (imageUrl) {
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' })
        testResult.accessibility.direct_url = response.ok
        if (!response.ok) {
          testResult.errors.direct_url = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        testResult.errors.direct_url = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test S3 key access
    if (s3Key) {
      try {
        const { data, error } = await getFrameFromS3(s3Key)
        testResult.accessibility.s3_key = !error && !!data
        if (error) {
          testResult.errors.s3_key = error
        }
      } catch (error) {
        testResult.errors.s3_key = error instanceof Error ? error.message : 'Unknown error'
      }

      // Test signed URL access
      try {
        const signedUrl = await getSignedUrlFromS3(s3Key, 300) // 5 min test
        const response = await fetch(signedUrl, { method: 'HEAD' })
        testResult.accessibility.signed_url = response.ok
        if (!response.ok) {
          testResult.errors.signed_url = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        testResult.errors.signed_url = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json(testResult)

  } catch (error) {
    console.error('Error testing image access:', error)
    
    return NextResponse.json(
      { error: 'Failed to test image accessibility' },
      { status: 500 }
    )
  }
}