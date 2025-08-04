import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3_CONFIG } from '@/lib/upload/s3_config'

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_CONFIG.region,
  credentials: S3_CONFIG.credentials.accessKeyId && S3_CONFIG.credentials.secretAccessKey ? {
    accessKeyId: S3_CONFIG.credentials.accessKeyId,
    secretAccessKey: S3_CONFIG.credentials.secretAccessKey
  } : undefined,
})

export interface S3MediaItem {
  key: string
  name: string
  size: number
  lastModified: Date
  type: 'image' | 'video'
  folder: 'reference-frames' | 'user-uploads' | 'video-clips'
  url?: string
  downloadUrl?: string
}

/**
 * Get file type based on extension
 */
function getFileType(filename: string): 'image' | 'video' {
  const ext = filename.toLowerCase().split('.').pop()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv']
  
  if (imageExts.includes(ext || '')) return 'image'
  if (videoExts.includes(ext || '')) return 'video'
  return 'image' // default to image
}

/**
 * List all media files from S3 in the specified folders
 */
export async function listMediaFiles(userId?: string): Promise<{
  images: S3MediaItem[]
  videos: S3MediaItem[]
  all: S3MediaItem[]
}> {
  const allItems: S3MediaItem[] = []

  try {
    if (userId) {
      // New folder structure: <userId>/<requestId>/<reference-frames>
      // List all request IDs for this user
      const userPrefix = `${userId}/`
      
      const userCommand = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: userPrefix,
        Delimiter: '/',
        MaxKeys: 1000,
      })

      const userResponse = await s3Client.send(userCommand)
      
      if (userResponse.CommonPrefixes) {
        // For each request ID, check for reference-frames and video-clips folders
        for (const prefix of userResponse.CommonPrefixes) {
          if (!prefix.Prefix) continue
          
          const requestId = prefix.Prefix.replace(userPrefix, '').replace('/', '')
          
          // Check for reference-frames folder
          const framesPrefix = `${userId}/${requestId}/reference-frames/`
          await listFilesFromPrefix(framesPrefix, 'reference-frames', allItems)
          
          // Check for video-clips folder
          const clipsPrefix = `${userId}/${requestId}/video-clips/`
          await listFilesFromPrefix(clipsPrefix, 'video-clips', allItems)
        }
      }
      
      // Also check for old structure: <folder>/<userId>/
      const oldFolders = ['reference-frames', 'user-uploads', 'video-clips'] as const
      for (const folder of oldFolders) {
        const oldPrefix = `${folder}/${userId}/`
        await listFilesFromPrefix(oldPrefix, folder, allItems)
      }
    } else {
      // If no userId provided, list all files from all folders (old structure)
      const oldFolders = ['reference-frames', 'user-uploads', 'video-clips'] as const
      for (const folder of oldFolders) {
        const prefix = `${folder}/`
        await listFilesFromPrefix(prefix, folder, allItems)
      }
    }

    // Sort by last modified date (newest first)
    allItems.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())

    return {
      images: allItems.filter(item => item.type === 'image'),
      videos: allItems.filter(item => item.type === 'video'),
      all: allItems
    }

  } catch (error) {
    console.error('Error listing media files:', error)
    return {
      images: [],
      videos: [],
      all: []
    }
  }
}

/**
 * Helper function to list files from a specific prefix
 */
async function listFilesFromPrefix(prefix: string, folder: 'reference-frames' | 'user-uploads' | 'video-clips', allItems: S3MediaItem[]): Promise<void> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.bucket,
      Prefix: prefix,
      MaxKeys: 1000,
    })

    const response = await s3Client.send(command)
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (!object.Key || !object.Size || object.Key.endsWith('/')) continue

        const filename = object.Key.split('/').pop() || ''
        const type = getFileType(filename)

        // Generate presigned URL for viewing (valid for 1 hour)
        let viewUrl: string
        let downloadUrl: string
        
        try {
          const viewCommand = new GetObjectCommand({
            Bucket: S3_CONFIG.bucket,
            Key: object.Key,
          })
          viewUrl = await getSignedUrl(s3Client, viewCommand, { expiresIn: 3600 })

          // Generate presigned URL for downloading (valid for 1 hour)
          const downloadCommand = new GetObjectCommand({
            Bucket: S3_CONFIG.bucket,
            Key: object.Key,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          })
          downloadUrl = await getSignedUrl(s3Client, downloadCommand, { expiresIn: 3600 })
        } catch (urlError) {
          console.error(`Failed to generate presigned URLs for ${object.Key}:`, urlError)
          // Skip this item if we can't generate URLs
          continue
        }

        allItems.push({
          key: object.Key,
          name: filename,
          size: object.Size,
          lastModified: object.LastModified || new Date(),
          type,
          folder,
          url: viewUrl,
          downloadUrl
        })
      }
    }
  } catch (error) {
    console.error(`Error listing files from prefix ${prefix}:`, error)
  }
}

/**
 * Delete a media file from S3
 */
export async function deleteMediaFile(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    })

    await s3Client.send(command)
  } catch (error) {
    console.error('Error deleting media file from S3:', error)
    throw new Error('Failed to delete media file from S3')
  }
}

/**
 * Generate a fresh presigned URL for a media file
 */
export async function getPresignedUrl(key: string, download = false): Promise<string> {
  try {
    const filename = key.split('/').pop() || ''
    
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      ...(download && {
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
    })

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    throw new Error('Failed to generate presigned URL')
  }
}

/**
 * Get media statistics
 */
export async function getMediaStats(userId?: string): Promise<{
  totalFiles: number
  totalSize: number
  imageCount: number
  videoCount: number
  folderStats: Record<string, { count: number; size: number }>
}> {
  const { all } = await listMediaFiles(userId)
  
  const stats = {
    totalFiles: all.length,
    totalSize: all.reduce((sum, item) => sum + item.size, 0),
    imageCount: all.filter(item => item.type === 'image').length,
    videoCount: all.filter(item => item.type === 'video').length,
    folderStats: {} as Record<string, { count: number; size: number }>,
  }

  // Calculate folder statistics
  for (const item of all) {
    if (!stats.folderStats[item.folder]) {
      stats.folderStats[item.folder] = { count: 0, size: 0 }
    }
    stats.folderStats[item.folder].count++
    stats.folderStats[item.folder].size += item.size
  }

  return stats
}