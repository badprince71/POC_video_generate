import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface MergeVideosRequest {
  videoUrls: string[]
  outputFormat?: 'mp4' | 'webm'
}

interface MergeVideosResponse {
  success: boolean
  mergedVideoUrl: string
  previewUrl: string
  format: string
  duration: number
  fileSize: number
  videoInfo: {
    inputVideos: string[]
    totalInputs: number
    mergeOrder: number[]
  }
  error?: string
}

export async function POST(request: NextRequest) {
  console.log("--------------merge audio api call success~~~~~~~~~~~~~~~~~~~")
  let tempDir: string | null = null
  let downloadedFiles: string[] = []
  let outputFile: string | null = null

  try {
    const body: MergeVideosRequest = await request.json()
    const { videoUrls, outputFormat = 'mp4' } = body

    if (!videoUrls || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'No video URLs provided' },
        { status: 400 }
      )
    }

    if (videoUrls.length === 1) {
      return NextResponse.json(
        { error: 'At least 2 videos are required for merging' },
        { status: 400 }
      )
    }

    console.log('🎬 Starting ffmpeg video merge for:', videoUrls.length, 'videos')

    // Create temporary directory
    const timestamp = Date.now()
    tempDir = path.join(process.cwd(), 'temp', `merge_${timestamp}`)
    
    if (!existsSync(path.dirname(tempDir))) {
      await mkdir(path.dirname(tempDir), { recursive: true })
    }
    await mkdir(tempDir, { recursive: true })

    // Download all videos
    console.log('📥 Downloading videos...')
    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i]
      const fileName = `video_${String(i).padStart(3, '0')}.mp4`
      const filePath = path.join(tempDir, fileName)

      try {
        const response = await fetch(videoUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        await writeFile(filePath, Buffer.from(arrayBuffer))
        downloadedFiles.push(filePath)
        console.log(`✅ Downloaded video ${i + 1}/${videoUrls.length}`)
      } catch (error) {
        throw new Error(`Failed to download video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Create ffmpeg concat file
    const concatFile = path.join(tempDir, 'concat.txt')
    const concatContent = downloadedFiles
      .map(file => `file '${path.basename(file)}'`)
      .join('\n')
    
    await writeFile(concatFile, concatContent)

    // Define output file
    outputFile = path.join(tempDir, `merged.${outputFormat}`)

    // Run ffmpeg command
    console.log('🔄 Running ffmpeg merge...')
    const ffmpegCommand = [
      `ffmpeg`,
      '-f concat',
      '-safe 0',
      `-i "${concatFile}"`,
      '-c copy', // Copy streams without re-encoding for speed
      '-avoid_negative_ts make_zero',
      `"${outputFile}"`
    ].join(' ')

    console.log('Command:', ffmpegCommand)
    
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      cwd: tempDir,
      timeout: 120000 // 2 minute timeout
    })

    if (stderr && !stderr.includes('video:') && !stderr.includes('audio:')) {
      console.warn('FFmpeg stderr:', stderr)
    }

    // Check if output file exists
    if (!existsSync(outputFile)) {
      throw new Error('FFmpeg failed to create output file')
    }

    // Read the merged video file
    const fs = await import('fs')
    const videoBuffer = fs.readFileSync(outputFile)
    
    // Convert to base64 data URL (for immediate use)
    // In production, upload to storage service instead
    const base64Video = videoBuffer.toString('base64')
    const dataUrl = `data:video/${outputFormat};base64,${base64Video}`

    console.log('✅ FFmpeg merge completed successfully')
    console.log(`📊 Output file size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    const response: MergeVideosResponse = {
      success: true,
      mergedVideoUrl: dataUrl, // In production, this would be a storage URL
      previewUrl: dataUrl,
      format: outputFormat,
      duration: videoUrls.length * 5, // You could parse this from ffmpeg output
      fileSize: videoBuffer.length,
      videoInfo: {
        inputVideos: videoUrls,
        totalInputs: videoUrls.length,
        mergeOrder: Array.from({ length: videoUrls.length }, (_, i) => i + 1)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ FFmpeg merge failed:', error)
    return NextResponse.json(
      { 
        error: `Video merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    // Cleanup temporary files
    try {
      if (downloadedFiles.length > 0) {
        await Promise.all(downloadedFiles.map(file => unlink(file).catch(() => {})))
      }
      if (outputFile && existsSync(outputFile)) {
        await unlink(outputFile).catch(() => {})
      }
      if (tempDir && existsSync(tempDir)) {
        const { rm } = await import('fs/promises')
        await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
      console.log('🧹 Cleanup completed')
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError)
    }
  }
} 