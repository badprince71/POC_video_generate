"use client"

import type React from "react"
import Link from "next/link"


import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Video,
  Play,
  Download,
  ArrowLeft,
  Home,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Trash2,
  Eye,
  RefreshCw,
  UploadIcon,
  X,
} from "lucide-react"
import { uploadVideo, uploadMovieToS3 as uploadMovieToStorage } from "@/lib/upload/s3_video_upload"
import { generateVideoClip } from "@/lib/generate_video_clips/generate_clips"
import { concatenateVideos, blobToBase64 } from "@/lib/utils/video-merge"
import { showToast, toastMessages } from "@/lib/utils/toast"
import { useAuth } from "@/lib/auth-context"
import ProtectedRoute from "@/components/ProtectedRoute"

interface VideoFrame {
  id: number
  timestamp: string
  imageUrl: string
  description: string
  prompt: string
  sceneStory?: string // Scene-specific story from the generated story
  fullStory?: {
    title: string
    overallStory: string
    style: string
    mood: string
  } // Full story context including style and mood
}

interface VideoClip {
  id: number
  startFrame: number
  videoUrl: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  error?: string
  optimizedPrompt?: string // The GPT-4.1 generated prompt
  isFallback?: boolean // Whether this is a fallback video
  note?: string // Additional notes about the clip
}

interface GeneratedVideo {
  id: string
  title: string
  duration: string
  prompt: string
  frames: VideoFrame[]
  videoClips: VideoClip[]
  finalVideoUrl?: string
}

interface S3VideoClip {
  id: string
  name: string
  url: string
  downloadUrl?: string
  size?: number
  created_at?: string
  updated_at?: string
  key: string
}

type VideoGenerationStep = "input" | "generating-clips" | "clips-ready" | "merging-clips" | "video-ready"

export default function VideoGenerationPage() {
  const { user } = useAuth()

  // Generate unique request ID for this video generation session
  const [requestId] = useState(() => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  // Use authenticated user ID
  const userId = user?.id || user?.email || 'anonymous'

  const [currentStep, setCurrentStep] = useState<VideoGenerationStep>("input")
  const [generatedFrames, setGeneratedFrames] = useState<VideoFrame[]>([])
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [videoClips, setVideoClips] = useState<VideoClip[]>([])
  const [clipGenerationProgress, setClipGenerationProgress] = useState(0)
  const [mergeProgress, setMergeProgress] = useState(0)
  const [frameAspectRatio, setFrameAspectRatio] = useState("1280:720")
  const [isGeneratingClips, setIsGeneratingClips] = useState(false)
  const [isMergingClips, setIsMergingClips] = useState(false)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
  const [autoSaving, setAutoSaving] = useState(false)
  const [recoveringFrames, setRecoveringFrames] = useState(false)
  const [videoPlayerModal, setVideoPlayerModal] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
  }>({
    isOpen: false,
    videoUrl: '',
    title: ''
  })

  // S3 Video Clips Management State
  const [s3VideoClips, setS3VideoClips] = useState<S3VideoClip[]>([])
  const [loadingS3Clips, setLoadingS3Clips] = useState(false)
  const [uploadingClip, setUploadingClip] = useState(false)

  const frameOptions = ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672", "1280:768", "768:1280"];
  // Function to convert S3 URLs to proxy URLs to avoid CORS issues
  const convertS3UrlToProxy = (url: string): string => {
    if (url.includes('/api/proxy_s3_image')) return url
    if (url.includes('amazonaws.com')) {
      const urlParts = url.split('.com/')
      if (urlParts.length > 1) {
        // Strip query string if present
        const key = urlParts[1].split('?')[0]
        return `/api/proxy_s3_image?key=${encodeURIComponent(key)}`
      }
    }
    return url
  }

  // Function to convert S3 video URLs to proxy URLs
  const convertS3VideoUrlToProxy = (url: string): string => {
    if (url.includes('amazonaws.com') && !url.includes('/api/proxy_s3_video')) {
      // Extract the key from the S3 URL
      const urlParts = url.split('.com/')
      if (urlParts.length > 1) {
        const key = urlParts[1]
        return `/api/proxy_s3_video?key=${encodeURIComponent(key)}`
      }
    }
    return url
  }

  // Function to ensure frames have accessible URLs
  const ensureFrameUrls = (frames: VideoFrame[]): VideoFrame[] => {
    return frames.map(frame => ({
      ...frame,
      imageUrl: convertS3UrlToProxy(frame.imageUrl)
    }))
  }

  // Function to ensure video clips have accessible URLs
  const ensureVideoClipUrls = (clips: VideoClip[]): VideoClip[] => {
    return clips.map(clip => ({
      ...clip,
      videoUrl: clip.videoUrl ? convertS3VideoUrlToProxy(clip.videoUrl) : clip.videoUrl
    }))
  }

  // Function to ensure S3 video clips have accessible URLs
  const ensureS3VideoClipUrls = (clips: S3VideoClip[]): S3VideoClip[] => {
    return clips.map(clip => ({
      ...clip,
      url: convertS3VideoUrlToProxy(clip.url),
      downloadUrl: clip.downloadUrl ? convertS3VideoUrlToProxy(clip.downloadUrl) : clip.downloadUrl
    }))
  }

  // Function to open video player modal
  const openVideoPlayer = (videoUrl: string, title: string) => {
    setVideoPlayerModal({
      isOpen: true,
      videoUrl: convertS3VideoUrlToProxy(videoUrl),
      title
    })
  }

  // Function to close video player modal
  const closeVideoPlayer = () => {
    setVideoPlayerModal({
      isOpen: false,
      videoUrl: '',
      title: ''
    })
  }

  // Load frames from database on component mount
  useEffect(() => {
    const loadFramesFromDatabase = async () => {
      try {
        // Check if localStorage is available (browser environment)
        if (typeof window === 'undefined' || !window.localStorage) {
          console.warn('localStorage not available')
          return
        }

        // Get current session from localStorage
        const currentSession = localStorage.getItem('currentSession')
        if (!currentSession) {
          console.log('No current session found. Please generate frames first.')
          // Show user-friendly message
          return
        }

        let sessionData
        try {
          sessionData = JSON.parse(currentSession)
          console.log('Session data from localStorage:', sessionData)
        } catch (parseError) {
          console.error('Invalid session data in localStorage:', parseError)
          localStorage.removeItem('currentSession') // Clear corrupted data
          return
        }

        const { sessionId, userId } = sessionData
        console.log(`Extracted sessionId: ${sessionId}, userId: ${userId}`)

        if (!sessionId || !userId) {
          console.error('Incomplete session data:', sessionData)
          localStorage.removeItem('currentSession') // Clear incomplete data
          return
        }

        // Fetch frames from database with better error handling  
        console.log(`Fetching frames for sessionId: ${sessionId}, userId: ${userId}`)
        const response = await fetch(`/api/get_frames?sessionId=${sessionId}&userId=user`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.error) {
          console.error('Database error fetching frames:', result.error)
          // Check if it's a configuration issue
          if (result.error.includes('Supabase not configured') || result.error.includes('not found')) {
            console.error('Database configuration issue. Please check environment variables.')
          }
          return
        }

        if (result.frames && result.frames.length > 0) {
          console.log(`Found ${result.frames.length} frames in database`)

          // Debug: Log the first frame's imageUrl to see what we're getting
          if (result.frames.length > 0) {
            console.log('First frame imageUrl:', result.frames[0].imageUrl)
            console.log('First frame imageUrl type:', typeof result.frames[0].imageUrl)
            console.log('First frame imageUrl length:', result.frames[0].imageUrl?.length)
          }

          // Check if frames have valid image URLs (S3 URLs, proxy URLs, or base64)
          const framesWithValidUrls = result.frames.filter((frame: VideoFrame) => {
            const hasValidUrl = frame.imageUrl &&
              (frame.imageUrl.startsWith('data:image/') ||
                frame.imageUrl.includes('amazonaws.com') ||
                frame.imageUrl.includes('s3.') ||
                frame.imageUrl.includes('http') ||
                frame.imageUrl.startsWith('/api/proxy_s3_image'))

            if (!hasValidUrl) {
              console.warn(`Frame ${frame.id} has invalid URL:`, frame.imageUrl)
            }

            return hasValidUrl
          })

          console.log(`Frames with valid URLs: ${framesWithValidUrls.length}/${result.frames.length}`)

          if (framesWithValidUrls.length === 0) {
            console.warn('Frames found but no valid image URLs. Attempting to recover from S3...')

            // First, try to find any recent sessions for this user
            try {
              console.log('Attempting to find recent sessions for user:', userId)
              const recentSessionsResponse = await fetch(`/api/get_recent_sessions?userId=${userId}`)
              if (recentSessionsResponse.ok) {
                const recentSessions = await recentSessionsResponse.json()
                console.log('Recent sessions found:', recentSessions)

                if (recentSessions.sessions && recentSessions.sessions.length > 0) {
                  // Try the most recent session
                  const mostRecentSession = recentSessions.sessions[0]
                  console.log('Trying most recent session:', mostRecentSession.session_id)

                  const recentFramesResponse = await fetch(`/api/get_frames?sessionId=${mostRecentSession.session_id}&userId=user`)
                  if (recentFramesResponse.ok) {
                    const recentFramesResult = await recentFramesResponse.json()
                    if (recentFramesResult.frames && recentFramesResult.frames.length > 0) {
                      console.log(`Found ${recentFramesResult.frames.length} frames in recent session`)

                      // Check if these frames have valid URLs
                      const recentFramesWithValidUrls = recentFramesResult.frames.filter((frame: VideoFrame) => {
                        const hasValidUrl = frame.imageUrl &&
                          (frame.imageUrl.startsWith('data:image/') ||
                            frame.imageUrl.includes('amazonaws.com') ||
                            frame.imageUrl.includes('s3.') ||
                            frame.imageUrl.includes('http') ||
                            frame.imageUrl.startsWith('/api/proxy_s3_image'))

                        if (!hasValidUrl) {
                          console.warn(`Recent frame ${frame.id} has invalid URL:`, frame.imageUrl)
                        }

                        return hasValidUrl
                      })

                      if (recentFramesWithValidUrls.length > 0) {
                        console.log(`Found ${recentFramesWithValidUrls.length} frames with valid URLs in recent session`)
                        setGeneratedFrames(ensureFrameUrls(recentFramesWithValidUrls))
                        setCurrentStep("input")
                        showToast.success(`Loaded ${recentFramesWithValidUrls.length} frames from recent session`)
                        return
                      }
                    }
                  }
                }
              }
            } catch (recentError) {
              console.error('Error finding recent sessions:', recentError)
            }

            // If no recent sessions work, try S3 recovery
            await attemptFrameRecovery(sessionId, userId)
            return
          }

          // Check if frames have base64 URLs that need to be uploaded to S3
          const framesNeedingS3Upload = framesWithValidUrls.filter((frame: VideoFrame) =>
            frame.imageUrl.startsWith('data:image/')
          )

          if (framesNeedingS3Upload.length > 0) {
            console.log(`Found ${framesNeedingS3Upload.length} frames with base64 URLs. Uploading to S3...`)
            showToast.info('Uploading frames to cloud storage...')

            try {
              // Upload frames to S3
              const uploadPromises = framesNeedingS3Upload.map(async (frame: VideoFrame, index: number) => {
                const frameNumber = (index + 1).toString().padStart(2, '0')

                // Upload to S3
                const uploadResponse = await fetch('/api/upload_image_s3', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    imageData: frame.imageUrl,
                    frameId: frame.id,
                    isUserUpload: false,
                    folderPath: `${userId}/${sessionId}/reference-frames`
                  }),
                })

                const result = await uploadResponse.json()

                if (result.error) {
                  throw new Error(`Failed to upload frame ${frame.id}: ${result.error}`)
                }

                console.log(`Frame ${frame.id} uploaded to S3:`, result.imageUrl)
                return { frameId: frame.id, imageUrl: result.imageUrl }
              })

              // Wait for all uploads to complete
              const results = await Promise.all(uploadPromises)

              // Update frames with S3 URLs
              const updatedFrames = framesWithValidUrls.map((frame: VideoFrame) => {
                const uploadResult = results.find(r => r.frameId === frame.id)
                if (uploadResult) {
                  return {
                    ...frame,
                    imageUrl: uploadResult.imageUrl
                  }
                }
                return frame
              })

              setGeneratedFrames(ensureFrameUrls(updatedFrames))
              setCurrentStep("input")
              console.log(`Successfully uploaded ${results.length} frames to S3 and loaded them`)
              showToast.success(`Successfully loaded ${updatedFrames.length} frames`)

            } catch (uploadError) {
              console.error('Error uploading frames to S3:', uploadError)
              showToast.error('Failed to upload frames to S3. Attempting recovery...')
              await attemptFrameRecovery(sessionId, userId)
              return
            }
          } else {
            // All frames already have S3 URLs
            // All frames have valid URLs - load them
            console.log('Loading frames with valid URLs:', framesWithValidUrls.map((f: VideoFrame) => ({ id: f.id, url: f.imageUrl })))
            setGeneratedFrames(ensureFrameUrls(framesWithValidUrls))
            setCurrentStep("input")
            console.log(`Loaded ${framesWithValidUrls.length} frames from database for session ${sessionId}`)
            showToast.success(`Successfully loaded ${framesWithValidUrls.length} frames`)
          }
        } else {
          console.log('No frames found in database for this session')
          showToast.info('No frames found. Please generate frames first.')
        }
      } catch (error) {
        console.error('Error loading frames from database:', error)
        // Handle network errors or other issues
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error('Network error: Unable to connect to database API')
          showToast.error('Network error: Unable to connect to database')
        }
      }
    }

    loadFramesFromDatabase()
  }, [])

  // Function to attempt frame recovery from S3
  const attemptFrameRecovery = async (sessionId: string, userId: string) => {
    try {
      setRecoveringFrames(true)
      console.log('Attempting to recover frames from S3...')
      showToast.info('Attempting to recover frames from S3...')

      // First, try to get frames from database again (in case they were saved with base64)
      const dbResponse = await fetch(`/api/get_frames?sessionId=${sessionId}&userId=user`)
      if (dbResponse.ok) {
        const dbResult = await dbResponse.json()
        if (dbResult.frames && dbResult.frames.length > 0) {
          console.log(`Found ${dbResult.frames.length} frames in database, attempting to upload to S3...`)

          // Filter frames that have base64 URLs
          const framesWithBase64 = dbResult.frames.filter((frame: VideoFrame) =>
            frame.imageUrl && frame.imageUrl.startsWith('data:image/')
          )

          if (framesWithBase64.length > 0) {
            console.log(`Found ${framesWithBase64.length} frames with base64 URLs. Uploading to S3...`)

            // Upload frames to S3
            const uploadPromises = framesWithBase64.map(async (frame: VideoFrame, index: number) => {
              const uploadResponse = await fetch('/api/upload_image_s3', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  imageData: frame.imageUrl,
                  frameId: frame.id,
                  isUserUpload: false,
                  folderPath: `${userId}/${sessionId}/reference-frames`
                }),
              })

              const result = await uploadResponse.json()

              if (result.error) {
                throw new Error(`Failed to upload frame ${frame.id}: ${result.error}`)
              }

              return { frameId: frame.id, imageUrl: result.imageUrl }
            })

            const results = await Promise.all(uploadPromises)

            // Update frames with S3 URLs
            const updatedFrames = dbResult.frames.map((frame: VideoFrame) => {
              const uploadResult = results.find(r => r.frameId === frame.id)
              if (uploadResult) {
                return { ...frame, imageUrl: uploadResult.imageUrl }
              }
              return frame
            })

            setGeneratedFrames(ensureFrameUrls(updatedFrames))
            setCurrentStep("input")
            console.log(`Successfully recovered and uploaded ${results.length} frames to S3`)
            showToast.success(`Successfully recovered ${updatedFrames.length} frames`)
            return
          }
        }
      }

      // If no frames in database or no base64 URLs, try to list frames from S3
      const response = await fetch(`/api/list_s3_frames?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to list S3 frames')
      }

      const result = await response.json()
      if (result.frames && result.frames.length > 0) {
        // Convert S3 frames to VideoFrame format
        const recoveredFrames: VideoFrame[] = result.frames.map((s3Frame: any, index: number) => ({
          id: index + 1,
          timestamp: `0:${(index * 5).toString().padStart(2, "0")}`,
          imageUrl: s3Frame.publicUrl,
          description: `Recovered frame ${index + 1}`,
          prompt: `Recovered frame from S3`,
        }))

        setGeneratedFrames(ensureFrameUrls(recoveredFrames))
        setCurrentStep("input")
        console.log(`Recovered ${recoveredFrames.length} frames from S3`)
        showToast.success(`Successfully recovered ${recoveredFrames.length} frames from S3`)
      } else {
        console.log('No frames found in S3 for recovery')
        showToast.error('No frames found in S3 for recovery. Please regenerate frames.')
      }
    } catch (error) {
      console.error('Error attempting frame recovery:', error)
      showToast.error('Failed to recover frames from S3')
    } finally {
      setRecoveringFrames(false)
    }
  }

  // Load S3 video clips when component mounts and when clips-ready step is reached
  useEffect(() => {
    if (currentStep === "clips-ready") {
      fetchS3VideoClips()
    }
  }, [currentStep])

  // S3 Video Clips Management Functions
  const fetchS3VideoClips = async () => {
    setLoadingS3Clips(true)
    try {
      const userId = 'user' // Fixed userId for video clips

      const response = await fetch(`/api/get_user_media?userId=${userId}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch video clips')
      }

      // Filter only video clips from the video-clips folder
      const videoClipsFromS3 = result.videos.filter((video: any) =>
        video.folder === 'video-clips'
      )

      setS3VideoClips(ensureS3VideoClipUrls(videoClipsFromS3))
      console.log(`Loaded ${videoClipsFromS3.length} video clips from S3`)
    } catch (error) {
      console.error('Error fetching S3 video clips:', error)
      showToast.error(`Failed to fetch video clips: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingS3Clips(false)
    }
  }

  const uploadVideoClip = async (file: File) => {
    setUploadingClip(true)
    try {
      const userId = 'user' // Fixed userId for video clips

      // Create FormData for upload
      const formData = new FormData()
      formData.append('video', file)
      formData.append('userId', userId)
      formData.append('filename', file.name)

      const response = await fetch('/api/upload_video_s3', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload video clip')
      }

      showToast.success(`Successfully uploaded ${file.name}`)

      // Refresh the clips list
      await fetchS3VideoClips()

    } catch (error) {
      console.error('Error uploading video clip:', error)
      showToast.error(`Failed to upload video clip: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingClip(false)
    }
  }

  const handleVideoUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/mp4,video/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        uploadVideoClip(file)
      }
    }
    input.click()
  }

  const downloadVideoClip = async (clip: S3VideoClip) => {
    try {
      // Use the downloadUrl if available, otherwise generate a new one
      let downloadUrl = clip.downloadUrl

      if (!downloadUrl) {
        const response = await fetch(`/api/get_presigned_url?key=${encodeURIComponent(clip.key)}&download=true`)
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to generate download URL')
        }

        downloadUrl = result.url
      }

      // Create download link
      const link = document.createElement('a')
      link.href = downloadUrl || ''
      link.download = clip.name
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log(`Downloaded: ${clip.name}`)
      showToast.success(`Downloaded ${clip.name}`)
    } catch (error) {
      console.error('Error downloading video clip:', error)
      showToast.error(`Failed to download ${clip.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const deleteVideoClip = async (clip: S3VideoClip) => {
    if (!confirm(`Are you sure you want to delete ${clip.name}?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      const userId = 'user' // Fixed userId for video clips

      const response = await fetch(`/api/delete_media?key=${encodeURIComponent(clip.key)}&userId=${userId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete video clip')
      }

      // Remove the clip from the local state
      setS3VideoClips(prev => prev.filter(c => c.id !== clip.id))

      showToast.success(`Successfully deleted ${clip.name}`)
      console.log(`Deleted: ${clip.name}`)

    } catch (error) {
      console.error('Error deleting video clip:', error)
      showToast.error(`Failed to delete ${clip.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const generateVideoClips = async () => {
    setIsGeneratingClips(true)
    setCurrentStep("generating-clips")
    setClipGenerationProgress(0)
    showToast.success('Starting video clip generation...')

    // Create clips array - each clip uses a single frame
    const clips: VideoClip[] = []
    for (let i = 0; i < generatedFrames.length; i++) {
      clips.push({
        id: i + 1,
        startFrame: i,
        videoUrl: '',
        status: 'pending'
      })
    }

    setVideoClips(clips)

    try {
      // Generate clips sequentially
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const frame = generatedFrames[clip.startFrame] // Use single frame

        // Update clip status to generating
        setVideoClips(prev => prev.map(c =>
          c.id === clip.id ? { ...c, status: 'generating' } : c
        ))

        console.log(`Generating clip ${i + 1}/${clips.length}: Frame ${clip.startFrame + 1}`)

        try {
          // Check if image URL is available
          if (!frame.imageUrl) {
            throw new Error('Image URL is not available. Please regenerate frames.')
          }

          // Convert image URL to base64 if it's not already
          const frameImageData = await convertImageToBase64(frame.imageUrl)

          // Get scene-specific story for this clip
          const sceneStory = frame.sceneStory || frame.description
          const fullStory = frame.fullStory

          // Create system prompt with full story context
          const systemPrompt = fullStory ?
            `You are creating a video clip for: "${fullStory.title}"

Overall Story: ${fullStory.overallStory}

Style: ${fullStory.style}
Mood: ${fullStory.mood}` :
            `Create a smooth 5-second video transition from the start image to the end image. Maintain consistent character appearance and smooth motion between frames.`


          const apiRes = await fetch('/api/generate_single_video_clip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startImage: frameImageData,
              prompt: `${sceneStory} ${systemPrompt}`,
              clipIndex: i,
              totalClips: clips.length,
              frameAspectRatio: frameAspectRatio,
              userId,
              requestId,
              expiresIn: 3600
            })
          })
          const videoResult = await apiRes.json()
          if (!apiRes.ok || !videoResult?.success) {
            throw new Error(videoResult?.error || 'Video generation failed')
          }
          const completedClip = {
            ...clip,
            status: 'completed' as const,
            videoUrl: videoResult.proxyUrl,
            isFallback: false
          }

          setVideoClips(prev => prev.map(c =>
            c.id === clip.id ? completedClip : c
          ))

          console.log(`Clip ${i + 1} generated successfully:`, videoResult.videoUrl)

          // Already saved to S3 by API; skip autosave

        } catch (error) {
          console.error(`Error generating clip ${i + 1}:`, error)

          // Provide more user-friendly error messages
          let errorMessage = 'Unknown error occurred';
          if (error instanceof Error) {
            if (error.message.includes('timed out')) {
              errorMessage = 'Video generation timed out - please try again';
            } else if (error.message.includes('failed')) {
              errorMessage = 'Video generation failed - please try again';
            } else if (error.message.includes('canceled')) {
              errorMessage = 'Video generation was canceled';
            } else {
              errorMessage = error.message;
            }
          }

          // Update clip with error
          setVideoClips(prev => prev.map(c =>
            c.id === clip.id ? {
              ...c,
              status: 'failed',
              error: errorMessage
            } : c
          ))
        }

        // Update progress
        const progress = ((i + 1) / clips.length) * 100
        setClipGenerationProgress(progress)
      }

      // Check if all clips were generated successfully
      const completedClips = clips.filter(clip => clip.status === 'completed')
      if (completedClips.length === clips.length) {
        setCurrentStep("clips-ready")
      } else {
        // Some clips failed
        showToast.success(`Generated clips successfully.`)
        // alert(`Generated ${completedClips.length}/${clips.length} clips successfully. Some clips failed to generate.`)
        setCurrentStep("clips-ready")
      }

    } catch (error) {
      console.error('Error during clip generation:', error)
      alert('Error generating video clips. Please try again.')
      setCurrentStep("input")
    } finally {
      setIsGeneratingClips(false)
    }
  }

  const mergeVideoClips = async () => {
    const completedClips = videoClips.filter(clip => clip.status === 'completed')

    if (completedClips.length === 0) {
      showToast.error('No completed video clips to merge')
      return
    }

    setIsMergingClips(true)
    setCurrentStep("merging-clips")
    setMergeProgress(0)
    showToast.success('Starting video merging...')

    try {
      const clipUrls = completedClips.map(clip => clip.videoUrl)

      console.log(`Merging ${clipUrls.length} video clips using client-side processing`)
      console.log('Video URLs:', clipUrls)

      // Use client-side video merging
      setMergeProgress(25)

      let mergedVideoDataUrl: string
      try {
        const mergedBlob = await concatenateVideos(clipUrls)
        console.log('Video merging completed, blob size:', mergedBlob.size)

        setMergeProgress(75)

        // Convert blob to base64 data URL
        mergedVideoDataUrl = await blobToBase64(mergedBlob)
        console.log('Converted to base64, data URL length:', mergedVideoDataUrl.length)
      } catch (mergeError) {
        console.error('Video merging failed:', mergeError)
        throw mergeError
      }

      setMergeProgress(100)

      // Create final video object
      const finalVideo: GeneratedVideo = {
        id: Date.now().toString(),
        title: `Generated Video - ${new Date().toLocaleDateString()}`,
        duration: `${completedClips.length * 5}s`, // Approximate duration
        prompt: generatedFrames[0]?.prompt || '',
        frames: generatedFrames,
        videoClips: completedClips,
        finalVideoUrl: mergedVideoDataUrl
      };

      setGeneratedVideo(finalVideo)
      setCurrentStep("video-ready")

      console.log('Video clips merged successfully using client-side processing')
      showToast.success('Video clips merged successfully!')

      // Auto-save the final video
      await autoSaveFinalVideo(finalVideo)

    } catch (error) {
      console.error('Error merging video clips:', error)
      showToast.error('Error merging video clips. Please try again.')
      setCurrentStep("clips-ready")
    } finally {
      setIsMergingClips(false)
    }
  }

  const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
    // If it's already a base64 data URL, return it
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl
    }

    // If it's a cloud URL or regular URL, fetch and convert to base64
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting image to base64:', error)
      throw error
    }
  }

  const stopGeneration = () => {
    setIsGeneratingClips(false)
    setIsMergingClips(false)
    setCurrentStep("input")
  }

  const resetGeneration = () => {
    setCurrentStep("input")
    setGeneratedVideo(null)
    setVideoClips([])
    setClipGenerationProgress(0)
    setMergeProgress(0)
    setIsGeneratingClips(false)
    setIsMergingClips(false)
  }

  const downloadVideo = () => {
    if (generatedVideo?.finalVideoUrl) {
      const link = document.createElement('a')
      link.href = generatedVideo.finalVideoUrl
      link.download = `generated-video-${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Autosave function for frames
  const autoSaveFrames = async (frames: VideoFrame[]) => {
    if (frames.length === 0) return

    try {
      setAutoSaving(true)
      console.log(`Auto-saving ${frames.length} frames to ${userId}/${requestId}/reference-frames/`)

      // Check if frames already have S3 URLs to avoid unnecessary re-upload
      const framesNeedingUpload = frames.filter(frame =>
        !frame.imageUrl.includes('amazonaws.com') &&
        !frame.imageUrl.includes('s3.')
      )

      if (framesNeedingUpload.length === 0) {
        console.log('All frames already have S3 URLs, skipping auto-save')
        setAutoSaving(false)
        return
      }

      // Upload each frame to S3 with new folder structure
      const uploadPromises = framesNeedingUpload.map(async (frame, index) => {
        const frameNumber = (index + 1).toString().padStart(2, '0')
        const fileName = `frame_${frameNumber}_${frame.timestamp}_${Date.now()}.png`

        // Convert image URL to base64 if it's not already
        let imageData = frame.imageUrl
        if (!imageData.startsWith('data:image/')) {
          // Fetch the image and convert to base64
          const response = await fetch(imageData)
          const blob = await response.blob()
          imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        }

        // Upload to S3 with new folder structure: <userid>/<requestid>/frames/
        const uploadResponse = await fetch('/api/upload_image_s3', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            imageData: imageData,
            frameId: frame.id,
            isUserUpload: false,
            folderPath: `${userId}/${requestId}/reference-frames` // New folder structure
          }),
        })

        const result = await uploadResponse.json()

        if (result.error) {
          throw new Error(`Failed to upload frame ${frame.id}: ${result.error}`)
        }

        console.log(`Frame ${frame.id} auto-saved to:`, result.imageUrl)
        return { frameId: frame.id, imageUrl: result.imageUrl }
      })

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises)

      // Update frame URLs with S3 URLs, but preserve existing frames
      const updatedFrames = frames.map((frame) => {
        const uploadResult = results.find(r => r.frameId === frame.id)
        if (uploadResult) {
          return {
            ...frame,
            imageUrl: uploadResult.imageUrl // This will already be a proxy URL from the updated S3 upload function
          }
        }
        return frame // Keep existing frame if no upload result found
      })

      // Only update state if we have frames to update
      if (updatedFrames.length > 0) {
        setGeneratedFrames(ensureFrameUrls(updatedFrames))
        showToast.success(`Auto-saved ${results.length} frames to ${userId}/${requestId}/reference-frames/`)
      }

    } catch (error) {
      console.error('Error auto-saving frames:', error)
      showToast.error(`Failed to auto-save frames: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Don't clear frames on error - keep existing frames
    } finally {
      setAutoSaving(false)
    }
  }

  // Autosave function for video clips
  const autoSaveVideoClip = async (clip: VideoClip) => {
    if (!clip.videoUrl || clip.videoUrl.includes('amazonaws.com')) return // Already saved

    try {
      setAutoSaving(true)
      console.log(`Auto-saving video clip ${clip.id} to ${userId}/${requestId}/video-clips/`)

      const uploadResult = await uploadMovieToStorage({
        videoUrl: clip.videoUrl,
        userId: userId,
        filename: `${requestId}_clip_${clip.id}_${Date.now()}`,
        duration: 5, // Each clip is 5 seconds
        thumbnail: generatedFrames[clip.startFrame]?.imageUrl,
        folderPath: `${userId}/${requestId}/video-clips`
      })

      // Update clip with S3 URL
      setVideoClips(prev => prev.map(c =>
        c.id === clip.id ? { ...c, videoUrl: convertS3VideoUrlToProxy(uploadResult.publicUrl) } : c
      ))

      console.log(`Video clip ${clip.id} auto-saved to:`, uploadResult.publicUrl)
      showToast.success(`Auto-saved clip ${clip.id} to ${userId}/${requestId}/video-clips/`)

    } catch (error) {
      console.error(`Error auto-saving video clip ${clip.id}:`, error)
      showToast.error(`Failed to auto-save clip ${clip.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAutoSaving(false)
    }
  }

  // Autosave function for final video
  const autoSaveFinalVideo = async (video: GeneratedVideo) => {
    if (!video?.finalVideoUrl) return

    try {
      setAutoSaving(true)
      console.log(`Auto-saving final video to ${userId}/${requestId}/video-clips/`)

      const uploadResult = await uploadMovieToStorage({
        videoUrl: video.finalVideoUrl,
        userId: userId,
        filename: `${requestId}_final_video_${Date.now()}`,
        duration: video.videoClips.length * 5, // Total duration
        thumbnail: video.frames[0]?.imageUrl,
        folderPath: `${userId}/${requestId}/video-clips`
      })

      // Update the final video with the S3 URL
      setGeneratedVideo(prev => prev ? {
        ...prev,
        finalVideoUrl: convertS3VideoUrlToProxy(uploadResult.publicUrl)
      } : null)

      console.log(`Final video auto-saved to:`, uploadResult.publicUrl)
      showToast.success(`Auto-saved final video to ${userId}/${requestId}/video-clips/`)

    } catch (error) {
      console.error('Error auto-saving final video:', error)
      showToast.error(`Failed to auto-save final video: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAutoSaving(false)
    }
  }

  const goBack = () => {
    // Implement your go back logic here
    switch (currentStep) {
      case "generating-clips":
        setCurrentStep("input")
        setIsGeneratingClips(false)
        break
      case "merging-clips":
        setCurrentStep("clips-ready")
        setIsMergingClips(false)
        break
      case "video-ready":
        setCurrentStep("clips-ready")
        break
      case "input":
        location.href = "/"
        break
      default:
        setCurrentStep("input")
        break
    }
  }

  // Helper function to format file sizes
  // const formatFileSize = (bytes?: number) => {
  //   if (!bytes) return 'Unknown'
  //   const sizes = ['Bytes', 'KB', 'MB', 'GB']
  //   const i = Math.floor(Math.log(bytes) / Math.log(1024))
  //   return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  // }

  // // Helper function to format dates
  // const formatDate = (dateString?: string) => {
  //   if (!dateString) return 'Unknown'
  //   return new Date(dateString).toLocaleDateString('en-US', {
  //     year: 'numeric',
  //     month: 'short',
  //     day: 'numeric',
  //     hour: '2-digit',
  //     minute: '2-digit'
  //   })
  // }

  // // Video Clips Manager Component
  // const VideoClipsManager = () => (
  //   <Card className="mt-6">
  //     <CardHeader>
  //       <div className="flex items-center justify-between">
  //         <div>
  //           <CardTitle className="flex items-center gap-2">
  //             <Video className="h-5 w-5" />
  //             Video Clips Library
  //           </CardTitle>
  //           <CardDescription>
  //             Manage your video clips stored in S3 bucket (video-clips/user/)
  //           </CardDescription>
  //         </div>
  //         <div className="flex gap-2">
  //           <Button
  //             onClick={fetchS3VideoClips}
  //             variant="outline"
  //             size="sm"
  //             disabled={loadingS3Clips}
  //           >
  //             <RefreshCw className={`h-4 w-4 mr-2 ${loadingS3Clips ? 'animate-spin' : ''}`} />
  //             Refresh
  //           </Button>
  //           <Button
  //             onClick={handleVideoUpload}
  //             disabled={uploadingClip}
  //             size="sm"
  //           >
  //             {uploadingClip ? (
  //               <>
  //                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  //                 Uploading...
  //               </>
  //             ) : (
  //               <>
  //                 <UploadIcon className="h-4 w-4 mr-2" />
  //                 Upload Clip
  //               </>
  //             )}
  //           </Button>
  //         </div>
  //       </div>
  //     </CardHeader>
  //     <CardContent>
  //       {loadingS3Clips ? (
  //         <div className="flex items-center justify-center py-8">
  //           <div className="text-center space-y-2">
  //             <Loader2 className="h-6 w-6 mx-auto animate-spin text-blue-600" />
  //             <p className="text-sm text-gray-600">Loading video clips...</p>
  //           </div>
  //         </div>
  //       ) : s3VideoClips.length === 0 ? (
  //         <div className="text-center py-8">
  //           <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
  //           <h3 className="text-lg font-semibold text-gray-900 mb-2">
  //             No video clips found
  //           </h3>
  //           <p className="text-gray-600 mb-4">
  //             Upload video clips to see them here.
  //           </p>
  //           <Button onClick={handleVideoUpload} disabled={uploadingClip}>
  //             <UploadIcon className="h-4 w-4 mr-2" />
  //             Upload Your First Clip
  //           </Button>
  //         </div>
  //       ) : (
  //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  //           {s3VideoClips.map((clip) => (
  //             <Card key={clip.id} className="group hover:shadow-lg transition-all duration-200">
  //               <CardContent className="p-4">
  //                 <div className="relative aspect-video mb-3 bg-gray-100 rounded-lg overflow-hidden">
  //                   <video
  //                     src={clip.url}
  //                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
  //                     preload="metadata"
  //                     muted
  //                     onError={(e) => {
  //                       // Hide video and show fallback if video fails to load
  //                       e.currentTarget.style.display = 'none'
  //                       const fallback = e.currentTarget.nextElementSibling as HTMLElement
  //                       if (fallback) fallback.style.display = 'flex'
  //                     }}
  //                   />
  //                   {/* Fallback div - hidden by default, shown if video fails */}
  //                   <div 
  //                     className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 transition-colors"
  //                     style={{ display: 'none' }}
  //                   >
  //                     <div className="text-center">
  //                       <Play className="h-8 w-8 mx-auto text-blue-600 mb-2" />
  //                       <p className="text-xs text-gray-600">Click to preview</p>
  //                     </div>
  //                   </div>
  //                   {/* Play overlay icon */}
  //                   <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200">
  //                     <Play className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
  //                   </div>
  //                 </div>

  //                 <div className="space-y-2">
  //                   <h3 className="font-medium text-sm text-gray-900 truncate" title={clip.name}>
  //                     {clip.name}
  //                   </h3>

  //                   <div className="flex items-center justify-between text-xs text-gray-500">
  //                     <span>{formatFileSize(clip.size)}</span>
  //                     <span>{formatDate(clip.created_at)}</span>
  //                   </div>

  //                   <div className="flex gap-1">
  //                     <Button
  //                       size="sm"
  //                       variant="outline"
  //                       className="flex-1 text-xs"
  //                       onClick={() => window.open(clip.url, '_blank')}
  //                     >
  //                       <Eye className="h-3 w-3 mr-1" />
  //                       View
  //                     </Button>
  //                     <Button
  //                       size="sm"
  //                       variant="outline"
  //                       className="flex-1 text-xs"
  //                       onClick={() => downloadVideoClip(clip)}
  //                     >
  //                       <Download className="h-3 w-3 mr-1" />
  //                       Download
  //                     </Button>
  //                     <Button
  //                       size="sm"
  //                       variant="destructive"
  //                       className="text-xs"
  //                       onClick={() => deleteVideoClip(clip)}
  //                     >
  //                       <Trash2 className="h-3 w-3" />
  //                     </Button>
  //                   </div>
  //                 </div>
  //               </CardContent>
  //             </Card>
  //           ))}
  //         </div>
  //       )}
  //     </CardContent>
  //   </Card>
  // )

  return (
    <ProtectedRoute>
      <div className="min-h-screen gradient-bg">
        {/* Navigation Header */}
        <nav className="glass border-b border-border/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  AI Video Generator
                </h1>
                <div className="flex items-center gap-2">
                  <Link href="/" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-300">
                    <Home className="h-4 w-4" />
                    Frame Generation
                  </Link>
                  <Link href="/video-generation" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-300 border border-blue-200">
                    <Video className="h-4 w-4" />
                    Video Generation
                  </Link>

                  <Link href="/media-library" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-300">
                    <FileImage className="h-4 w-4" />
                    Media Library
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            {/* Page Header */}
            <div className="text-center space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">
                Video Generation
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Transform your generated frames into a smooth, animated video
              </p>
            </div>

            {/* Main Content */}
            {currentStep === "input" && (
              <div className="space-y-6">
                {generatedFrames.length === 0 ? (
                  <div className="text-center space-y-6">
                    <div className="gradient-card p-8 border border-border">
                      <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No Frames Available
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        You need to generate frames first before creating a video.
                      </p>
                      <Link href="/">
                        <Button className="btn-modern">
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Go to Frame Generation
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Frame Preview Section */}
                    <Card className="gradient-card card-hover">
                      <CardHeader className="pb-6">
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Grid3X3 className="h-6 w-6 text-primary" />
                          </div>
                          Frame Preview
                        </CardTitle>
                        <CardDescription className="text-muted-foreground text-base">
                          Preview your {generatedFrames.length} frames before generating video clips
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Large Frame Display */}
                        <div className="bg-secondary/30 rounded-xl overflow-hidden flex items-center justify-center min-h-[400px] relative border border-border">
                          {generatedFrames[selectedFrameIndex]?.imageUrl ? (
                            <img
                              src={generatedFrames[selectedFrameIndex].imageUrl}
                              alt={`Frame ${selectedFrameIndex + 1}`}
                              className="max-w-full max-h-full object-contain"
                              onLoad={() => console.log(`Frame ${selectedFrameIndex + 1} loaded successfully`)}
                              onError={(e) => {
                                console.error(`Error loading frame ${selectedFrameIndex + 1}:`, e)
                                // Try to convert to proxy URL if it's a direct S3 URL
                                const currentUrl = generatedFrames[selectedFrameIndex].imageUrl
                                if (currentUrl.includes('amazonaws.com') && !currentUrl.includes('/api/proxy_s3_image')) {
                                  const proxyUrl = convertS3UrlToProxy(currentUrl)
                                  if (proxyUrl !== currentUrl) {
                                    // Update the frame with proxy URL
                                    const updatedFrames = [...generatedFrames]
                                    updatedFrames[selectedFrameIndex] = {
                                      ...updatedFrames[selectedFrameIndex],
                                      imageUrl: proxyUrl
                                    }
                                    setGeneratedFrames(updatedFrames)
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center space-y-2">
                              <Video className="h-12 w-12 mx-auto text-gray-400" />
                              <p className="text-sm text-gray-600">Frame {selectedFrameIndex + 1}</p>
                              <p className="text-xs text-gray-500">Image not available</p>
                            </div>
                          )}

                          {/* Frame Navigation */}
                          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFrameIndex(Math.max(0, selectedFrameIndex - 1))}
                              disabled={selectedFrameIndex === 0}
                              className="bg-white/80 backdrop-blur-sm"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                              Frame {selectedFrameIndex + 1} of {generatedFrames.length}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFrameIndex(Math.min(generatedFrames.length - 1, selectedFrameIndex + 1))}
                              disabled={selectedFrameIndex === generatedFrames.length - 1}
                              className="bg-white/80 backdrop-blur-sm"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Frame Info */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{generatedFrames[selectedFrameIndex]?.timestamp}</Badge>
                              <span className="text-sm text-gray-600">Frame {selectedFrameIndex + 1}</span>
                            </div>
                            {generatedFrames[selectedFrameIndex]?.fullStory && (
                              <Badge variant="secondary" className="text-xs">
                                {generatedFrames[selectedFrameIndex].fullStory.style} • {generatedFrames[selectedFrameIndex].fullStory.mood}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {generatedFrames[selectedFrameIndex]?.description}
                          </p>
                          {generatedFrames[selectedFrameIndex]?.sceneStory && (
                            <p className="text-xs text-gray-600 italic">
                              Scene: {generatedFrames[selectedFrameIndex].sceneStory}
                            </p>
                          )}
                        </div>

                        {/* Frame Thumbnails */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">All Frames</h4>
                          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                            {generatedFrames.map((frame, index) => (
                              <button
                                key={frame.id}
                                onClick={() => setSelectedFrameIndex(index)}
                                className={`aspect-square rounded border-2 overflow-hidden transition-all relative bg-gray-100 flex items-center justify-center ${selectedFrameIndex === index
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "border-gray-200 hover:border-gray-300"
                                  }`}
                              >
                                {frame.imageUrl ? (
                                  <img
                                    src={frame.imageUrl}
                                    alt={`Frame ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      console.error(`Error loading thumbnail ${index + 1}:`, e)
                                      // Try to convert to proxy URL if it's a direct S3 URL
                                      const currentUrl = frame.imageUrl
                                      if (currentUrl.includes('amazonaws.com') && !currentUrl.includes('/api/proxy_s3_image')) {
                                        const proxyUrl = convertS3UrlToProxy(currentUrl)
                                        if (proxyUrl !== currentUrl) {
                                          // Update the frame with proxy URL
                                          const updatedFrames = [...generatedFrames]
                                          updatedFrames[index] = {
                                            ...updatedFrames[index],
                                            imageUrl: proxyUrl
                                          }
                                          setGeneratedFrames(updatedFrames)
                                        }
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-xs text-gray-500">No image</span>
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                                  {frame.timestamp}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Video Generation Controls */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Video className="h-5 w-5" />
                          Video Generation
                        </CardTitle>
                        <CardDescription>
                          Generate video clips from your {generatedFrames.length} frames
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Check if frames have image URLs */}
                        {generatedFrames.some(frame => frame.imageUrl) ? (
                          <>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">Ready to Generate</span>
                              </div>
                              <p className="text-sm text-blue-700">
                                This will create {generatedFrames.length} video clips, each 5 seconds long.
                                Each clip will be generated from a single frame using the gen4 model.
                              </p>
                            </div>

                            <div className="flex gap-2 justify-center">
                              <Label htmlFor="aspect-ratio-select" className="flex items-center gap-2">
                                Video Aspect Ratio
                              </Label>
                              <select
                                id="aspect-ratio-select"
                                value={frameAspectRatio}
                                onChange={(e) => {
                                  setFrameAspectRatio(e.target.value)
                                  // Clear story when aspect ratio changes
                                }}
                                className="w-50 mr-2 px-8 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                disabled={isGeneratingClips}
                              >
                                {frameOptions.map((aspectRatio) => (
                                  <option key={aspectRatio} value={aspectRatio}>
                                    {aspectRatio}
                                  </option>
                                ))}
                              </select>
                              <Button
                                onClick={generateVideoClips}
                                disabled={isGeneratingClips}
                                className="px-8"
                              >
                                {isGeneratingClips ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating Clips...
                                  </>
                                ) : (
                                  <>
                                    <Video className="h-4 w-4 mr-2" />
                                    Generate Video Clips
                                  </>
                                )}
                              </Button>
                              <div className="flex items-center gap-2 text-sm">
                                {autoSaving ? (
                                  <div className="flex items-center gap-2 text-blue-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Auto-saving to {userId}/{requestId}/reference-frames/...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    Auto-saved to {userId}/{requestId}/reference-frames/
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                                Images Not Available
                              </h3>
                              <p className="text-sm text-yellow-700 mb-4">
                                The frame images are not available. Please regenerate frames or upload them to Supabase first.
                              </p>
                              <div className="flex gap-2 justify-center">
                                <Link href="/">
                                  <Button variant="outline" size="sm">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Regenerate Frames
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={recoveringFrames}
                                  onClick={async () => {
                                    // Try to recover frames from S3 first
                                    const currentSession = localStorage.getItem('currentSession')
                                    if (currentSession) {
                                      try {
                                        const sessionData = JSON.parse(currentSession)
                                        if (sessionData.userId) {
                                          await attemptFrameRecovery(sessionData.sessionId, sessionData.userId)
                                          return
                                        }
                                      } catch (error) {
                                        console.error('Error parsing session data:', error)
                                      }
                                    }
                                    // If recovery fails, clear session
                                    localStorage.removeItem('currentSession')
                                    setGeneratedFrames([])
                                    setCurrentStep("input")
                                  }}
                                >
                                  {recoveringFrames ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  {recoveringFrames ? 'Recovering...' : 'Recover from S3'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Clear any old session data
                                    localStorage.removeItem('currentSession')
                                    setGeneratedFrames([])
                                    setCurrentStep("input")
                                  }}
                                >
                                  Clear Session
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {currentStep === "generating-clips" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Video Clip Generation Progress
                  </CardTitle>
                  <CardDescription>Creating video clips using Runway API</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        {Math.round(clipGenerationProgress)}%
                      </div>
                      <Progress value={clipGenerationProgress} className="w-full" />
                      <p className="text-sm text-gray-600 mt-2">
                        Generating video clips... {videoClips.filter(c => c.status === 'completed').length} of {videoClips.length} clips
                      </p>
                    </div>

                    {/* Individual Clip Progress */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Clip Progress:</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {videoClips.map((clip) => (
                          <div key={clip.id} className="text-center">
                            {clip.status === 'completed' ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-green-100 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                              </div>
                            ) : clip.status === 'failed' ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-red-100 text-red-600">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                            ) : clip.status === 'generating' ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-blue-100 text-blue-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">Clip {clip.id}</p>
                            <p className="text-xs text-gray-400">
                              Frame {clip.startFrame + 1}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stop Button */}
                    <div className="flex justify-center">
                      <Button
                        onClick={stopGeneration}
                        variant="outline"
                        className="px-6"
                      >
                        Stop Generation
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === "clips-ready" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Video Clips Generated
                  </CardTitle>
                  <CardDescription>
                    {videoClips.filter(c => c.status === 'completed').length} of {videoClips.length} clips generated successfully
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Clip Status Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {videoClips.map((clip) => (
                      <div key={clip.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Clip {clip.id}</span>
                          <Badge
                            variant={clip.status === 'completed' ? 'default' : clip.status === 'failed' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {clip.status === 'completed' ? '✓ Complete' :
                              clip.status === 'failed' ? '✗ Failed' : 'Pending'}
                          </Badge>
                        </div>

                        {/* Preview Image */}
                        {generatedFrames[clip.startFrame]?.imageUrl && (
                          <div className="mb-3">
                            <img
                              src={generatedFrames[clip.startFrame].imageUrl}
                              alt={`Preview of Clip ${clip.id}`}
                              className="w-full object-cover rounded-md border"
                            />
                          </div>
                        )}

                        <p className="text-xs text-gray-600 mb-2">
                          Frame {clip.startFrame + 1}
                        </p>
                        {clip.status === 'completed' && (
                          <div className="space-y-2">
                            {/* Three action buttons in a row */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openVideoPlayer(clip.videoUrl, `Clip ${clip.id} - Frame ${clip.startFrame + 1}`)}
                                className="flex-1 h-8"
                              >
                                <Play className="h-3 w-3" />
                              </Button>

                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete clip ${clip.id}?`)) {
                                    setVideoClips(prev => prev.filter(c => c.id !== clip.id))
                                  }
                                }}
                                className="flex-1 h-8"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {clip.isFallback && (
                              <div className="text-xs text-amber-600 bg-amber-50 p-1 rounded text-center">
                                ⚠️ Fallback Video
                              </div>
                            )}
                          </div>
                        )}
                        {clip.status === 'failed' && clip.error && (
                          <div className="mt-1">
                            <p className="text-xs text-red-600 mb-1">{clip.error}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Retry the specific clip
                                const retryClip = async () => {
                                  try {
                                    // Reset clip status
                                    setVideoClips(prev => prev.map(c =>
                                      c.id === clip.id ? { ...c, status: 'generating', error: undefined } : c
                                    ))

                                    // Regenerate the clip
                                    const startFrame = generatedFrames[clip.startFrame]

                                    const startImageData = await convertImageToBase64(startFrame.imageUrl)

                                    const sceneStory = startFrame.sceneStory || startFrame.description
                                    const fullStory = startFrame.fullStory

                                    const systemPrompt = fullStory ?
                                      `You are creating a video clip for: "${fullStory.title}"
                                    Overall Story: ${fullStory.overallStory}
                                    Style: ${fullStory.style}
                                    Mood: ${fullStory.mood}` :
                                      `Create a smooth 5-second video transition from the start image to the end image. Maintain consistent character appearance and smooth motion between frames.`
                                    const apiRes = await fetch('/api/generate_single_video_clip', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        startImage: startImageData,
                                        prompt: `${sceneStory} ${systemPrompt}`,
                                        clipIndex: clip.id - 1,
                                        totalClips: videoClips.length,
                                        frameAspectRatio: frameAspectRatio,
                                        userId,
                                        requestId,
                                        expiresIn: 3600
                                      })
                                    })
                                    const result = await apiRes.json()
                                    if (!apiRes.ok || !result?.success) {
                                      throw new Error(result?.error || 'Video generation failed')
                                    }

                                    // Update clip with success using S3 proxy URL returned by API
                                    setVideoClips(prev => prev.map(c =>
                                      c.id === clip.id ? {
                                        ...c,
                                        status: 'completed',
                                        videoUrl: result.proxyUrl
                                      } : c
                                    ))

                                  } catch (retryError) {
                                    console.error(`Error retrying clip ${clip.id}:`, retryError)
                                    setVideoClips(prev => prev.map(c =>
                                      c.id === clip.id ? {
                                        ...c,
                                        status: 'failed',
                                        error: retryError instanceof Error ? retryError.message : 'Retry failed'
                                      } : c
                                    ))
                                  }
                                }

                                retryClip()
                              }}
                              className="w-full text-xs"
                            >
                              <Loader2 className="h-3 w-3 mr-1" />
                              Retry Clip
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    {/* <Button 
                    onClick={mergeVideoClips}
                    disabled={videoClips.filter(c => c.status === 'completed').length === 0 || isMergingClips}
                    className="flex-1"
                  >
                    {isMergingClips ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Merging Clips...
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4 mr-2" />
                        Merge Video Clips
                      </>
                    )}
                  </Button> */}
                    <div className="flex items-center gap-2 text-sm">
                      {autoSaving ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Auto-saving clips to {userId}/{requestId}/video-clips/...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Auto-saved clips to {userId}/{requestId}/video-clips/
                        </div>
                      )}
                    </div>
                    <Button variant="outline" onClick={resetGeneration}>
                      Start Over
                    </Button>
                  </div>

                  {/* Video Clips Library Section */}
                  {/* <VideoClipsManager /> */}
                </CardContent>
              </Card>
            )}

            {currentStep === "merging-clips" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Merging Video Clips
                  </CardTitle>
                  <CardDescription>Combining video clips into final video</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        {Math.round(mergeProgress)}%
                      </div>
                      <Progress value={mergeProgress} className="w-full" />
                      <p className="text-sm text-gray-600 mt-2">
                        Merging {videoClips.filter(c => c.status === 'completed').length} video clips...
                      </p>
                    </div>

                    {/* Stop Button */}
                    <div className="flex justify-center">
                      <Button
                        onClick={stopGeneration}
                        variant="outline"
                        className="px-6"
                      >
                        Stop Merging
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === "video-ready" && generatedVideo && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Generated Video
                    </CardTitle>
                    <CardDescription>Your personalized animated video is ready!</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <video
                        className="w-full h-full"
                        autoPlay
                        muted
                        loop
                        src={generatedVideo.finalVideoUrl ? convertS3VideoUrlToProxy(generatedVideo.finalVideoUrl) : undefined}
                        onError={(e) => {
                          console.error('Error loading final video:', e)
                          // Try to convert to proxy URL if it's a direct S3 URL
                          if (generatedVideo.finalVideoUrl && generatedVideo.finalVideoUrl.includes('amazonaws.com')) {
                            const proxyUrl = convertS3VideoUrlToProxy(generatedVideo.finalVideoUrl)
                            if (proxyUrl !== generatedVideo.finalVideoUrl) {
                              // Update the video element with proxy URL
                              e.currentTarget.src = proxyUrl
                            }
                          }
                        }}
                      />
                      {/* <div className="text-center space-y-2">
                      <Video className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600">Final Merged Video</p>
                      <p className="text-xs text-gray-500">Duration: {generatedVideo.duration}</p>
                      <p className="text-xs text-gray-500">
                        {generatedVideo.videoClips.length} clips merged
                      </p>
                      {generatedVideo.finalVideoUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(generatedVideo.finalVideoUrl, '_blank')}
                          className="mt-2"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Play Final Video
                        </Button>
                      )}
                    </div> */}
                    </div>

                    <div className="flex gap-4">
                      <Button
                        onClick={downloadVideo}
                        disabled={!generatedVideo.finalVideoUrl}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download MP4
                      </Button>
                      <Button
                        onClick={() => openVideoPlayer(generatedVideo.finalVideoUrl!, 'Final Generated Video')}
                        disabled={!generatedVideo.finalVideoUrl}
                        variant="outline"
                        className="flex-1"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Play Video
                      </Button>
                      <div className="flex items-center gap-2 text-sm">
                        {autoSaving ? (
                          <div className="flex items-center gap-2 text-blue-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Auto-saving to {userId}/{requestId}/video-clips/...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Auto-saved to {userId}/{requestId}/video-clips/
                          </div>
                        )}
                      </div>
                      <Button variant="outline" onClick={resetGeneration}>
                        Create New Video
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Video Player Modal */}
        {videoPlayerModal.isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              // Close modal when clicking outside
              if (e.target === e.currentTarget) {
                closeVideoPlayer()
              }
            }}
            onKeyDown={(e) => {
              // Close modal with Escape key
              if (e.key === 'Escape') {
                closeVideoPlayer()
              }
            }}
            tabIndex={-1}
          >
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">{videoPlayerModal.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeVideoPlayer}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    className="w-full h-full"
                    controls
                    autoPlay
                    src={videoPlayerModal.videoUrl}
                    onError={(e) => {
                      console.error('Error loading video in modal:', e)
                      // Try to convert to proxy URL if it's a direct S3 URL
                      if (videoPlayerModal.videoUrl.includes('amazonaws.com') && !videoPlayerModal.videoUrl.includes('/api/proxy_s3_video')) {
                        const proxyUrl = convertS3VideoUrlToProxy(videoPlayerModal.videoUrl)
                        if (proxyUrl !== videoPlayerModal.videoUrl) {
                          e.currentTarget.src = proxyUrl
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
} 
