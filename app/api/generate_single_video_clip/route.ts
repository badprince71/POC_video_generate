import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrlFromS3, uploadVideoToS3, sanitizeFilename, uploadImageToS3 } from '@/lib/upload/s3_upload'
import { generateVideoClip } from '@/lib/generate_video_clips/generate_clips'
import sharp from 'sharp'
import { normalizeAspectRatio } from '@/lib/utils/aspect'
import { withApiKeyAuth } from '../../../lib/auth/api-key-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface GenerateSingleVideoClipRequest {
  startImage: string
  prompt: string
  clipIndex?: number
  totalClips?: number
  frameAspectRatio?: string
  duration?: number
  userId?: string
  requestId?: string
  expiresIn?: number
}

async function generateSingleVideoClip(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    const headerUserId = request.headers.get('x-user-id') || request.headers.get('x-userid') || undefined
    const headerRequestId = request.headers.get('x-request-id') || request.headers.get('x-requestid') || undefined

    let startImage: string | undefined
    let prompt: string | undefined
    let clipIndex = 0
    let totalClips = 1
    let frameAspectRatio = '1280:720'
    let duration = 5
    let userId: string | undefined
    let requestId: string | undefined
    let expiresIn = 3600

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = (form.get('startImage') as File) || (form.get('image') as File) || (form.get('file') as File)
      const startImageString = (form.get('startImage') as string) || undefined
      prompt = (form.get('prompt') as string) || undefined
      const clipIndexRaw = form.get('clipIndex') as string
      const totalClipsRaw = form.get('totalClips') as string
      frameAspectRatio = (form.get('frameAspectRatio') as string) || frameAspectRatio
      const durationRaw = form.get('duration') as string
      userId = (form.get('userId') as string) || undefined
      requestId = (form.get('requestId') as string) || undefined
      const expiresInRaw = form.get('expiresIn') as string

      if (typeof clipIndexRaw === 'string' && clipIndexRaw.length > 0) {
        const n = Number(clipIndexRaw)
        if (!Number.isNaN(n)) clipIndex = n
      }
      if (typeof totalClipsRaw === 'string' && totalClipsRaw.length > 0) {
        const n = Number(totalClipsRaw)
        if (!Number.isNaN(n)) totalClips = n
      }
      if (typeof durationRaw === 'string' && durationRaw.length > 0) {
        const n = Number(durationRaw)
        if (!Number.isNaN(n)) duration = n
      }
      if (typeof expiresInRaw === 'string' && expiresInRaw.length > 0) {
        const n = Number(expiresInRaw)
        if (!Number.isNaN(n)) expiresIn = n
      }

      if (file && typeof file !== 'string') {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mime = file.type || 'image/png'
        startImage = `data:${mime};base64,${base64}`
      } else if (typeof startImageString === 'string' && startImageString.length > 0) {
        // Accept URL or base64 string from form field
        startImage = startImageString
      }
    } else {
      const body: GenerateSingleVideoClipRequest = await request.json()
      startImage = body.startImage
      prompt = body.prompt
      clipIndex = body.clipIndex ?? clipIndex
      totalClips = body.totalClips ?? totalClips
      frameAspectRatio = body.frameAspectRatio || frameAspectRatio
      duration = body.duration ?? duration
      userId = body.userId
      requestId = body.requestId
      expiresIn = body.expiresIn ?? expiresIn
    }

    if (!startImage || !prompt) {
      return NextResponse.json({ error: 'startImage and prompt are required' }, { status: 400 })
    }

    const finalUserId = headerUserId || userId || 'public-user'
    const finalRequestId = headerRequestId || requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

    // Ensure the prompt image aspect ratio is within [0.5, 2] by padding if necessary
    const normalizedStartImage = await normalizeImageAspect(startImage)

    // If startImage is data URL, upload to S3 and use a signed URL to avoid large payloads causing timeouts
    let runwayStartImage = normalizedStartImage
    if (normalizedStartImage.startsWith('data:')) {
      try {
        const commaIdx = normalizedStartImage.indexOf(',')
        const base64 = commaIdx >= 0 ? normalizedStartImage.substring(commaIdx + 1) : normalizedStartImage
        const imgFilename = `prompt_image_${clipIndex}_${Date.now()}.png`
        const imgUpload = await uploadImageToS3({
          imageData: base64,
          userId: `${finalUserId}/${finalRequestId}/user-uploads`,
          type: 'user-uploads',
          filename: imgFilename
        })
        runwayStartImage = await getSignedUrlFromS3(imgUpload.key, Math.max(600, expiresIn))
      } catch (e) {
        console.warn('Failed to upload prompt image to S3 for URL-based generation, falling back to data URL', e)
      }
    }

    // Normalize aspect ratio and generate video clip using Runway with internal retry to reduce upstream timeouts
    const clip = await generateWithRetries({
      startImage: runwayStartImage,
      prompt,
      clipIndex,
      totalClips,
      frameAspectRatio: normalizeAspectRatio(frameAspectRatio)
    })

    if (!clip?.videoUrl) {
      return NextResponse.json({ error: 'No video URL returned from generation' }, { status: 500 })
    }

    // Fetch the generated video and upload to S3 under official folder structure
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minutes
    const response = await fetch(clip.videoUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch generated video' }, { status: 502 })
    }

    const videoBlob = await response.blob()

    const filename = `generated_clip_${clipIndex}_${Date.now()}.mp4`
    const sanitized = sanitizeFilename(filename)
    const folderPath = `${finalUserId}/${finalRequestId}/video-clips`

    const upload = await uploadVideoToS3({
      videoBlob,
      userId: folderPath,
      filename: sanitized,
      folder: 'video-clips'
    })

    const signedUrl = await getSignedUrlFromS3(upload.key, expiresIn)

    return NextResponse.json({
      success: true,
      userId: finalUserId,
      requestId: finalRequestId,
      clipIndex,
      totalClips,
      duration,
      s3Key: upload.key,
      proxyUrl: upload.publicUrl,
      videoUrl: signedUrl,
      expiresIn
    })
  } catch (error) {
    console.error('Error generating single video clip:', error)
    // Map known errors to appropriate HTTP status codes
    if (error instanceof Error && (error.name === 'InsufficientCreditsError' || error.message === 'INSUFFICIENT_CREDITS')) {
      return NextResponse.json({
        error: 'Insufficient credits',
        details: 'Your Runway balance is too low to run this task. Please top up credits and try again.'
      }, { status: 402 })
    }
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
async function generateWithRetries(params: {
  startImage: string
  prompt: string
  clipIndex: number
  totalClips: number
  frameAspectRatio: string
}): Promise<{ videoUrl: string }> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await generateVideoClip(params)
      if (!result?.videoUrl) throw new Error('No video URL returned')
      return { videoUrl: result.videoUrl }
    } catch (err) {
      // Do not retry when credits are insufficient
      if (err instanceof Error && (err.name === 'InsufficientCreditsError' || err.message === 'INSUFFICIENT_CREDITS')) {
        throw err
      }
      lastError = err
      // Small backoff before retry
      await new Promise(r => setTimeout(r, attempt * 2000))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Generation failed')
}

/**
 * Normalize image aspect ratio into the allowed [0.5, 2] range by padding
 * - Accepts data URL or http(s) URL
 * - Returns data URL (image/png)
 */
async function normalizeImageAspect(input: string): Promise<string> {
  try {
    const isDataUrl = input.startsWith('data:')
    let buffer: Buffer

    if (isDataUrl) {
      const commaIndex = input.indexOf(',')
      const base64 = commaIndex >= 0 ? input.substring(commaIndex + 1) : input
      buffer = Buffer.from(base64, 'base64')
    } else {
      const res = await fetch(input)
      if (!res.ok) return input
      const ab = await res.arrayBuffer()
      buffer = Buffer.from(ab)
    }

    const image = sharp(buffer)
    const meta = await image.metadata()
    const width = meta.width || 0
    const height = meta.height || 0
    if (width === 0 || height === 0) return input

    const ratio = width / height
    const MIN = 0.5
    const MAX = 2

    if (ratio >= MIN && ratio <= MAX) {
      // Within allowed range; ensure PNG data URL output
      const out = await image.png().toBuffer()
      return `data:image/png;base64,${out.toString('base64')}`
    }

    // Compute padding to bring ratio into range without scaling the original content
    if (ratio < MIN) {
      // Too tall: need to extend width to height * MIN
      const targetWidth = Math.ceil(height * MIN)
      const padTotal = Math.max(0, targetWidth - width)
      const left = Math.floor(padTotal / 2)
      const right = padTotal - left
      const out = await image
        .extend({ left, right, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      return `data:image/png;base64,${out.toString('base64')}`
    }

    // ratio > MAX -> too wide: need to extend height to width / MAX
    const targetHeight = Math.ceil(width / MAX)
    const padTotal = Math.max(0, targetHeight - height)
    const top = Math.floor(padTotal / 2)
    const bottom = padTotal - top
    const out = await image
      .extend({ top, bottom, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    return `data:image/png;base64,${out.toString('base64')}`
  } catch {
    // If anything fails, return the original input
    return input
  }
}

export const POST = withApiKeyAuth(generateSingleVideoClip);


