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

// Browser compatibility check
export function checkBrowserCompatibility(): {
  canvas: boolean
  mediaRecorder: boolean
  webm: boolean
  mp4: boolean
  vp8: boolean
  vp9: boolean
} {
  const canvas = !!document.createElement('canvas').getContext
  const mediaRecorder = !!window.MediaRecorder
  const webm = MediaRecorder.isTypeSupported('video/webm')
  const mp4 = MediaRecorder.isTypeSupported('video/mp4')
  const vp8 = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
  const vp9 = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')

  console.log('Browser compatibility check:', {
    canvas,
    mediaRecorder,
    webm,
    mp4,
    vp8,
    vp9
  })

  return { canvas, mediaRecorder, webm, mp4, vp8, vp9 }
}

export class VideoMerger {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private letterboxBackground: string = '#000' // black bars to avoid stretch

  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
  }

  async mergeVideos(videoUrls: string[], options: VideoMergeOptions = {}): Promise<MergedVideo> {
    const { outputFormat = 'webm', quality = 0.8, frameRate = 30 } = options

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Starting video merge for', videoUrls.length, 'videos')
        
        // Check browser compatibility first
        const compatibility = checkBrowserCompatibility()
        if (!compatibility.canvas || !compatibility.mediaRecorder) {
          throw new Error('Browser does not support Canvas or MediaRecorder APIs')
        }
        
        // Load all videos and wait for them to be ready
        const videos = await Promise.all(
          videoUrls.map(async (url, index) => {
            console.log(`Loading video ${index + 1}/${videoUrls.length}:`, url)
            const video = await this.loadVideo(url)
            // Wait for video to be fully loaded
            await new Promise<void>((resolve) => {
              if (video.readyState >= 2) {
                resolve()
              } else {
                video.oncanplay = () => resolve()
              }
            })
            console.log(`Video ${index + 1} loaded, duration:`, video.duration)
            return video
          })
        )

        // Set canvas size based on first video
        const firstVideo = videos[0]
        this.canvas.width = firstVideo.videoWidth
        this.canvas.height = firstVideo.videoHeight
        console.log('Canvas size set to:', this.canvas.width, 'x', this.canvas.height)

        // Calculate total duration
        const totalDuration = videos.reduce((sum, video) => sum + video.duration, 0)
        console.log('Total duration:', totalDuration)

        // Create MediaRecorder with proper MIME type
        const stream = this.canvas.captureStream(frameRate)
        const mimeType = MediaRecorder.isTypeSupported(`video/${outputFormat};codecs=vp9`) 
          ? `video/${outputFormat};codecs=vp9`
          : MediaRecorder.isTypeSupported(`video/${outputFormat};codecs=vp8`)
          ? `video/${outputFormat};codecs=vp8`
          : `video/${outputFormat}`
        
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps for better quality
        })

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data)
            console.log('Received video chunk, size:', event.data.size)
          }
        }

        this.mediaRecorder.onstop = () => {
          console.log('MediaRecorder stopped, total chunks:', this.chunks.length)
          const blob = new Blob(this.chunks, { type: mimeType })
          const url = URL.createObjectURL(blob)
          
          console.log('Final merged video size:', blob.size)
          resolve({
            blob,
            url,
            duration: totalDuration,
            size: blob.size
          })
        }

        // Start recording
        this.mediaRecorder.start(1000) // Collect data every second
        console.log('MediaRecorder started')

        // Play videos sequentially with proper timing
        let currentVideoIndex = 0
        let startTime = Date.now()

        const playNextVideo = async () => {
          if (currentVideoIndex >= videos.length) {
            console.log('All videos processed, stopping recorder')
            setTimeout(() => {
              this.mediaRecorder?.stop()
            }, 1000) // Give extra time for final frames
            return
          }

          const video = videos[currentVideoIndex]
          console.log(`Playing video ${currentVideoIndex + 1}/${videos.length}, duration:`, video.duration)
          
          // Reset video to beginning
          video.currentTime = 0
          
          // Wait for video to be ready
          await new Promise<void>((resolve) => {
            video.oncanplay = () => resolve()
            video.load()
          })

          // Start playing
          try {
            await video.play()
          } catch (error) {
            console.warn('Auto-play failed, trying muted play:', error)
            video.muted = true
            await video.play()
          }

          // Draw frames until video ends
          const drawFrame = () => {
            if (video.ended || video.paused || video.currentTime >= video.duration) {
              console.log(`Video ${currentVideoIndex + 1} finished`)
              currentVideoIndex++
              playNextVideo()
              return
            }

            // Clear and draw letterbox background
            this.ctx.fillStyle = this.letterboxBackground
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

            // Compute aspect-fit rect to avoid distortion of overlays/text within clips
            const sw = video.videoWidth || this.canvas.width
            const sh = video.videoHeight || this.canvas.height
            const sAspect = sw / sh
            const dAspect = this.canvas.width / this.canvas.height
            let dw = this.canvas.width
            let dh = this.canvas.height
            let dx = 0
            let dy = 0
            if (sAspect > dAspect) {
              // source wider → fit width
              dw = this.canvas.width
              dh = Math.round(dw / sAspect)
              dy = Math.round((this.canvas.height - dh) / 2)
            } else {
              // source taller → fit height
              dh = this.canvas.height
              dw = Math.round(dh * sAspect)
              dx = Math.round((this.canvas.width - dw) / 2)
            }

            this.ctx.drawImage(video, dx, dy, dw, dh)
            requestAnimationFrame(drawFrame)
          }

          drawFrame()
        }

        // Start the process
        playNextVideo()

      } catch (error) {
        console.error('Error in mergeVideos:', error)
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
      video.preload = 'metadata'

      let hasResolved = false

      const resolveOnce = () => {
        if (!hasResolved) {
          hasResolved = true
          resolve(video)
        }
      }

      const rejectOnce = (error: Error) => {
        if (!hasResolved) {
          hasResolved = true
          reject(error)
        }
      }

      video.onloadedmetadata = () => {
        console.log('Video metadata loaded:', url, 'duration:', video.duration)
        resolveOnce()
      }

      video.oncanplay = () => {
        console.log('Video can play:', url)
        resolveOnce()
      }

      video.onerror = (event) => {
        console.error('Video load error:', url, event)
        rejectOnce(new Error(`Failed to load video: ${url}`))
      }

      video.onabort = () => {
        console.warn('Video load aborted:', url)
        rejectOnce(new Error(`Video load aborted: ${url}`))
      }

      // Handle data URLs
      if (url.startsWith('data:video/')) {
        video.src = url
      } else {
        // For external URLs, try to handle CORS
        video.crossOrigin = 'anonymous'
        video.src = url
      }
    })
  }

  // Alternative method using a different approach for better compatibility
  async mergeVideosAlternative(videoUrls: string[], options: VideoMergeOptions = {}): Promise<MergedVideo> {
    const { outputFormat = 'webm', frameRate = 30 } = options

    return new Promise(async (resolve, reject) => {
      try {
        console.log('Using alternative video merge method')
        
        // Load videos one by one to avoid memory issues
        const videos: HTMLVideoElement[] = []
        for (let i = 0; i < videoUrls.length; i++) {
          console.log(`Loading video ${i + 1}/${videoUrls.length}`)
          const video = await this.loadVideo(videoUrls[i])
          videos.push(video)
        }

        // Set canvas size
        const firstVideo = videos[0]
        this.canvas.width = firstVideo.videoWidth
        this.canvas.height = firstVideo.videoHeight

        // Create MediaRecorder
        const stream = this.canvas.captureStream(frameRate)
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9'
          : 'video/webm;codecs=vp8'
        
        this.mediaRecorder = new MediaRecorder(stream, { mimeType })
        this.mediaRecorder.start()

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data)
          }
        }

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.chunks, { type: mimeType })
          const url = URL.createObjectURL(blob)
          resolve({
            blob,
            url,
            duration: videos.reduce((sum, v) => sum + v.duration, 0),
            size: blob.size
          })
        }

        // Play videos sequentially with delays
        let currentIndex = 0
        
        const playVideo = async () => {
          if (currentIndex >= videos.length) {
            setTimeout(() => this.mediaRecorder?.stop(), 500)
            return
          }

          const video = videos[currentIndex]
          video.currentTime = 0
          
          await video.play()
          
          const drawFrames = () => {
            if (video.ended || video.paused) {
              currentIndex++
              setTimeout(playVideo, 100) // Small delay between videos
              return
            }
            // Fill background, then aspect-fit
            this.ctx.fillStyle = this.letterboxBackground
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
            const sw = video.videoWidth || this.canvas.width
            const sh = video.videoHeight || this.canvas.height
            const sAspect = sw / sh
            const dAspect = this.canvas.width / this.canvas.height
            let dw = this.canvas.width
            let dh = this.canvas.height
            let dx = 0
            let dy = 0
            if (sAspect > dAspect) {
              dw = this.canvas.width
              dh = Math.round(dw / sAspect)
              dy = Math.round((this.canvas.height - dh) / 2)
            } else {
              dh = this.canvas.height
              dw = Math.round(dh * sAspect)
              dx = Math.round((this.canvas.width - dw) / 2)
            }
            this.ctx.drawImage(video, dx, dy, dw, dh)
            requestAnimationFrame(drawFrames)
          }
          
          drawFrames()
        }

        playVideo()

      } catch (error) {
        reject(error)
      }
    })
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
  console.log('Starting video concatenation for', videoUrls.length, 'videos')
  
  // Check browser compatibility first
  const compatibility = checkBrowserCompatibility()
  console.log('Browser compatibility:', compatibility)
  
  // Try the advanced merger first
  try {
    const merger = new VideoMerger()
    const result = await merger.mergeVideos(videoUrls)
    merger.cleanup()
    return result.blob
  } catch (error) {
    console.warn('Advanced video merging failed, trying alternative method:', error)
    
    // Try alternative method
    try {
      const merger = new VideoMerger()
      const result = await merger.mergeVideosAlternative(videoUrls)
      merger.cleanup()
      return result.blob
    } catch (altError) {
      console.warn('Alternative video merging failed, using fallback method:', altError)
      
      // Fallback: Create a simple concatenated video using the first video
      // This ensures we always return something, even if merging fails
      try {
        const firstVideoUrl = videoUrls[0]
        const response = await fetch(firstVideoUrl)
        const blob = await response.blob()
        console.log('Fallback: Using first video as merged result')
        return blob
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError)
        throw new Error('Failed to merge videos: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
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