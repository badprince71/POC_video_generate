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
  credentials: S3_CONFIG.credentials,
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
  const folders = ['reference-frames', 'user-uploads', 'video-clips'] as const
  const allItems: S3MediaItem[] = []

  try {
    // Fetch from all folders
    for (const folder of folders) {
      const prefix = userId ? `${folder}/${userId}/` : `${folder}/`
      
      const command = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: prefix,
        MaxKeys: 1000, // Adjust as needed
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
            downloadUrl,
          })
        }
      }
    }

    // Sort by last modified (newest first)
    allItems.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())

    // Separate images and videos
    const images = allItems.filter(item => item.type === 'image')
    const videos = allItems.filter(item => item.type === 'video')

    return { images, videos, all: allItems }
  } catch (error) {
    console.error('Error listing media files from S3:', error)
    console.error('S3 Config:', {
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      hasCredentials: !!(S3_CONFIG.credentials.accessKeyId && S3_CONFIG.credentials.secretAccessKey)
    })
    throw new Error(`Failed to fetch media files from S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
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