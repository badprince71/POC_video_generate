import { NextRequest, NextResponse } from 'next/server'
import { deleteMediaFile } from '@/lib/services/s3-media-service'
import { withApiKeyAuth } from '@/lib/auth/api-key-auth'

async function handleDelete(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const userId = searchParams.get('userId')

    if (!key) {
      return NextResponse.json({ 
        error: "File key is required",
        success: false 
      }, { status: 400 })
    }

    // Optional: Add user validation to ensure they can only delete their own files
    if (userId && !key.includes(userId)) {
      return NextResponse.json({ 
        error: "Unauthorized: Cannot delete files that don't belong to you",
        success: false 
      }, { status: 403 })
    }

    console.log(`Deleting media file: ${key}`)

    // Delete the file from S3
    await deleteMediaFile(key)

    return NextResponse.json({ 
      success: true,
      message: "File deleted successfully",
      deletedKey: key
    })

  } catch (error) {
    console.error('Error deleting media file:', error)
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to delete media file",
      success: false 
    }, { status: 500 })
  }
}

export const DELETE = withApiKeyAuth(handleDelete)

// Also support POST method for compatibility
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, userId } = body

    if (!key) {
      return NextResponse.json({ 
        error: "File key is required",
        success: false 
      }, { status: 400 })
    }

    // Optional: Add user validation
    if (userId && !key.includes(userId)) {
      return NextResponse.json({ 
        error: "Unauthorized: Cannot delete files that don't belong to you",
        success: false 
      }, { status: 403 })
    }

    console.log(`Deleting media file: ${key}`)

    // Delete the file from S3
    await deleteMediaFile(key)

    return NextResponse.json({ 
      success: true,
      message: "File deleted successfully",
      deletedKey: key
    })

  } catch (error) {
    console.error('Error deleting media file:', error)
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to delete media file",
      success: false 
    }, { status: 500 })
  }
}

export const POST = withApiKeyAuth(handlePost)