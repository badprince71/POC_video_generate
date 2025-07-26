// Client-side video merging utility
// This works in the browser environment and can merge videos without server-side FFmpeg

export interface VideoMergeOptions {
  outputFormat?: 'mp4' | 'webm'
  quality?: number // 0-1
  frameRate?: number
}

export interface MergedVideo {
  blob: Blob
  url: string
  duration: number
  size: number
}

export class VideoMerger {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []

  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
  }

  async mergeVideos(videoUrls: string[], options: VideoMergeOptions = {}): Promise<MergedVideo> {
    const { outputFormat = 'webm', quality = 0.8, frameRate = 30 } = options

    return new Promise(async (resolve, reject) => {
      try {
        // Load all videos
        const videos = await Promise.all(
          videoUrls.map(url => this.loadVideo(url))
        )

        // Set canvas size based on first video
        const firstVideo = videos[0]
        this.canvas.width = firstVideo.videoWidth
        this.canvas.height = firstVideo.videoHeight

        // Calculate total duration
        const totalDuration = videos.reduce((sum, video) => sum + video.duration, 0)

        // Create MediaRecorder
        const stream = this.canvas.captureStream(frameRate)
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: `video/${outputFormat};codecs=vp8`
        })

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data)
          }
        }

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.chunks, { type: `video/${outputFormat}` })
          const url = URL.createObjectURL(blob)
          
          resolve({
            blob,
            url,
            duration: totalDuration,
            size: blob.size
          })
        }

        // Start recording
        this.mediaRecorder.start()

        // Play videos sequentially
        let currentVideoIndex = 0
        let currentTime = 0

        const playNextVideo = () => {
          if (currentVideoIndex >= videos.length) {
            this.mediaRecorder?.stop()
            return
          }

          const video = videos[currentVideoIndex]
          video.currentTime = 0
          video.play()

          const drawFrame = () => {
            if (video.ended || video.paused) {
              currentVideoIndex++
              currentTime += video.duration
              playNextVideo()
              return
            }

            this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height)
            requestAnimationFrame(drawFrame)
          }

          drawFrame()
        }

        playNextVideo()

      } catch (error) {
        reject(error)
      }
    })
  }

  private loadVideo(url: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true

      video.onloadedmetadata = () => {
        resolve(video)
      }

      video.onerror = () => {
        reject(new Error(`Failed to load video: ${url}`))
      }

      video.src = url
    })
  }

  // Alternative method using Web Audio API for audio merging
  async mergeVideosWithAudio(videoUrls: string[], options: VideoMergeOptions = {}): Promise<MergedVideo> {
    // This is a more complex implementation that would handle audio
    // For now, we'll use the basic video-only merge
    return this.mergeVideos(videoUrls, options)
  }

  // Cleanup method
  cleanup() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
    }
    this.chunks = []
    URL.revokeObjectURL(this.canvas.toDataURL())
  }
}

// Utility function for simple video concatenation
export async function concatenateVideos(videoUrls: string[]): Promise<Blob> {
  const merger = new VideoMerger()
  try {
    const result = await merger.mergeVideos(videoUrls)
    return result.blob
  } finally {
    merger.cleanup()
  }
}

// Utility function to convert blob to base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Utility function to convert base64 to blob
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64.split(',')[1])
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
} 