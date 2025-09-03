"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Upload,
  Video,
  Wand2,
  Download,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Palette,
  Heart,
  Home,
  FileImage,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { showToast, toastMessages, showError } from "@/lib/utils/toast"
import ProtectedRoute from "@/components/ProtectedRoute"
import UserMenu from "@/components/UserMenu"
import { useAuth } from "@/lib/auth-context"

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

type GenerationStep = "input" | "generating-frames" | "frames-ready"

export default function FrameGenerationPage() {
  const { user } = useAuth()
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY
  const getAuthHeaders = () => ({ Authorization: `Bearer ${API_KEY}` })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [prompt, setPrompt] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<string>("Realistic")
  const [selectedMood, setSelectedMood] = useState<string>("Vibrant")
  const [videoDuration, setVideoDuration] = useState<number>(30)
  const [frameCount, setFrameCount] = useState<number>(6)
  const [currentStep, setCurrentStep] = useState<GenerationStep>("input")
  const [generatedFrames, setGeneratedFrames] = useState<VideoFrame[]>([])
  const [frameGenerationProgress, setFrameGenerationProgress] = useState(0)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
  const [isGenerationStopped, setIsGenerationStopped] = useState(false)
  const [frameProgress, setFrameProgress] = useState<{ [key: number]: boolean }>({})
  const [generatedStory, setGeneratedStory] = useState<{
    originalPrompt: string;
    firstStory: {
      title: string;
      overallStory: string;
      scenes: Array<{
        sceneNumber: number;
        timeframe: string;
        description: string;
      }>;
    };
    enhancedStory: {
      title: string;
      overallStory: string;
      scenes: Array<{
        sceneNumber: number;
        timeframe: string;
        description: string;
      }>;
    };
    framePrompts: Array<{
      frameNumber: number;
      timeframe: string;
      prompt: string;
    }>;
  } | null>(null)
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)
  const [storyGenerationStep, setStoryGenerationStep] = useState<'idle' | 'first-story' | 'enhancing' | 'complete'>('idle')
  const [storyGenerationProgress, setStoryGenerationProgress] = useState(0)
  const [isEditingStory, setIsEditingStory] = useState(false)
  const [frameAspectRatio, setFrameAspectRatio] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('frameAspectRatio') || '1280:720'
    }
    return '1280:720'
  })
  const frameOptions = ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672", "1280:768", "768:1280"]
  const [editedSceneDescriptions, setEditedSceneDescriptions] = useState<Record<number, string>>({})
  const [isEditingFrameScene, setIsEditingFrameScene] = useState(false)

  // Get authenticated user ID
  const userId = user?.id || user?.email || 'anonymous'

  // Function to convert S3 URLs to proxy URLs to avoid CORS issues
  const convertS3UrlToProxy = (url: string): string => {
    if (url.includes('/api/proxy_s3_image')) return url
    if (url.includes('amazonaws.com')) {
      const urlParts = url.split('.com/')
      if (urlParts.length > 1) {
        // Remove any query string from the key (e.g., from presigned URLs)
        const key = urlParts[1].split('?')[0]
        return `/api/proxy_s3_image?key=${encodeURIComponent(key)}`
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

  // Utility function to upload images to cloud storage
  const uploadImageToCloud = async (imageData: string, frameId: number): Promise<{ imageUrl: string, userId: string }> => {
    try {
      const response = await fetch('/api/upload_image_s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          imageData: imageData,
          frameId: frameId,
          isUserUpload: false // Generated frame goes to reference-frames
        }),
      })

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      return { imageUrl: result.imageUrl, userId: result.userId }
    } catch (error) {
      console.error(`Error uploading image for frame ${frameId}:`, error)
      throw error
    }
  }

  // Utility function to save frames to database
  const saveFramesToDatabase = async (frames: VideoFrame[], providedRequestId?: string) => {
    try {
      // Check if localStorage is available
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage not available in this environment')
      }

      console.log('Starting frame save process...')
      showToast.info('Saving frame data to database...')

      // Frames should already be uploaded to S3 during generation
      // Just verify that frames have S3 URLs
      const framesWithBase64 = frames.filter(frame => 
        frame.imageUrl.startsWith('data:image/')
      )

      if (framesWithBase64.length > 0) {
        console.warn(`Found ${framesWithBase64.length} frames with base64 URLs. These should have been uploaded during generation.`)
        showToast.warning('Some frames may not be properly uploaded to cloud storage.')
      }

      // Use provided request ID, extract from S3 URLs, or generate a new one
      let requestId = providedRequestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // If no provided request ID, try to extract from S3 URLs
      if (!providedRequestId) {
        const firstFrameWithS3Url = frames.find(frame => 
          frame.imageUrl && frame.imageUrl.includes('amazonaws.com')
        )
        
        if (firstFrameWithS3Url) {
          const urlParts = firstFrameWithS3Url.imageUrl.split('/')
          const requestIndex = urlParts.findIndex(part => part.startsWith('req_'))
          if (requestIndex !== -1) {
            requestId = urlParts[requestIndex]
            console.log(`Using existing request ID from S3: ${requestId}`)
          }
        }
      }

      // Prepare frames for database (frames should already have S3 URLs)
      const framesForDatabase = frames.map((frame) => ({
        id: frame.id,
        timestamp: frame.timestamp,
        imageUrl: frame.imageUrl, // Should already be S3 URL from generation
        description: frame.description,
        prompt: frame.prompt,
        sceneStory: frame.sceneStory,
        fullStory: frame.fullStory
      }))

      // Save frames to database
      const response = await fetch('/api/save_frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          frames: framesForDatabase,
          userId: userId,
          sessionId: requestId, // Use requestId as sessionId for database
          originalPrompt: prompt,
          videoDuration: videoDuration,
          frameCount: frameCount,
          style: selectedStyle,
          mood: selectedMood
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      
      if (result.error) {
        // Provide specific error messages based on error type
        let userMessage = 'Failed to save frames to database'
        if (result.error.includes('Supabase not configured')) {
          userMessage = 'Database not configured. Please check environment variables.'
        } else if (result.error.includes('Failed to save session')) {
          userMessage = 'Unable to create session. Database connection issue.'
        } else if (result.error.includes('Failed to save frames')) {
          userMessage = 'Unable to save frame data. Database error.'
        }
        throw new Error(`${userMessage}: ${result.error}`)
      }

      // Save session info to localStorage for video generation page
      try {
        localStorage.setItem('currentSession', JSON.stringify({
          sessionId: requestId, // Use requestId as sessionId for video-generation page
          userId: userId,
          frameCount: frameCount
        }))
        console.log(`Session saved to localStorage: ${requestId}`)
      } catch (storageError) {
        console.warn('Could not save session to localStorage:', storageError)
        // Continue anyway, as database save succeeded
      }

      console.log('Frames saved to database successfully')
      showToast.success('Frames saved successfully!')
      return { sessionId: requestId, userId }
    } catch (error) {
      console.error('Error saving frames to database:', error)
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          showToast.error('Network error: Unable to connect to server. Please check your internet connection.')
        } else if (error.message.includes('Supabase not configured')) {
          showToast.error('Database not configured. Please set up environment variables.')
        } else if (error.message.includes('HTTP 413')) {
          showToast.error('Payload too large. Please try with fewer frames or contact support.')
        } else {
          showToast.error(`Error saving frames: ${error.message}`)
        }
      } else {
        showToast.error('Unknown error occurred while saving frames')
      }
      
      throw error
    }
  }

  // Style and Mood options
  const styleOptions = ["Realistic", "Artistic", "Cartoon", "Abstract", "Photographic", "Digital Art"]
  const moodOptions = ["Vibrant", "Calm", "Dramatic", "Mysterious", "Cheerful", "Moody"]
  const durationOptions = [5, 10, 15, 20, 25, 30]

  // Function to create enhanced prompt with style and mood
  const createEnhancedPrompt = (basePrompt: string, style: string, mood: string): string => {
    return `${basePrompt}, ${style.toLowerCase()} style, ${mood.toLowerCase()} mood`
  }

  // Function to calculate frame count based on video duration
  const calculateFrameCount = (duration: number): number => {
    return Math.max(2, Math.floor(duration / 5)) // Minimum 2 frames, 5 seconds per frame
  }

  // Function to handle video duration change
  const handleVideoDurationChange = (duration: number) => {
    setVideoDuration(duration)
    setFrameCount(calculateFrameCount(duration))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const generateStory = async () => {
    if (!prompt) return

    setIsGeneratingStory(true)
    setStoryGenerationStep('first-story')
    setStoryGenerationProgress(0)
    
    try {
      const enhancedPrompt = createEnhancedPrompt(prompt, selectedStyle, selectedMood)
      
      // Start progress bar animation (1 minute to reach 98%)
      const startTime = Date.now()
      const duration = 60000 // 1 minute in milliseconds
      const targetProgress = 98
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min((elapsed / duration) * targetProgress, targetProgress)
        setStoryGenerationProgress(progress)
        
        if (progress >= targetProgress) {
          clearInterval(progressInterval)
        }
      }, 100) // Update every 100ms for smooth animation
      
      // Step 1: First story generation
      setStoryGenerationStep('first-story')
      console.log("Starting first story generation...")
      const response = await fetch("/api/generate_story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ 
          prompt: enhancedPrompt,
          frameCount: frameCount 
        }),
      })
      .then((res) => res.json())
      .catch((error) => {
        console.error("Error generating story:", error)
        return { error: "Failed to generate story" }
      })

      if (response.error) {
        console.error("Story API Error:", response.error)
        showToast.error(`Story generation failed: ${response.error}`)
        clearInterval(progressInterval)
        return
      }

      // Step 2: Story enhancement (this happens in the API)
      setStoryGenerationStep('enhancing')
      console.log("Story enhancement in progress...")

      setGeneratedStory(response)
      setStoryGenerationStep('complete')
      setStoryGenerationProgress(100) // Complete the progress bar
      console.log("Generated story:", response)
      showToast.success('Story generated successfully!')
      
      // Keep complete status for a moment before hiding
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error("Error generating story:", error)
      showToast.error("Failed to generate story. Please try again.")
    } finally {
      setIsGeneratingStory(false)
      setStoryGenerationStep('idle')
      setStoryGenerationProgress(0)
    }
  }

  const generateFrames = async () => {
    if (!selectedImage || !prompt) return

    // First generate the story if not already generated
    if (!generatedStory) {
      await generateStory()
    }

    setCurrentStep("generating-frames")
    setFrameGenerationProgress(0)
    setIsGenerationStopped(false)
    setGeneratedFrames([]) // Clear previous frames
    setFrameProgress({}) // Reset frame progress tracking

    // Generate a consistent request ID for this generation (matching video-generation page)
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log(`Starting frame generation with request ID: ${requestId}`)

    const inputImage = imagePreview.replace(/^data:image\/\w+;base64,/, "");

    try {
      // Create array of promises for concurrent generation
      const generationPromises = Array.from({ length: frameCount }, async (_, i) => {
        // Check if generation was stopped
        if (isGenerationStopped) {
          throw new Error("Generation stopped")
        }

        console.log(`Starting generation for frame ${i + 1}/${frameCount}`)
        
        // Use story-generated prompt if available, otherwise use enhanced prompt
        const baseFramePrompt = generatedStory && generatedStory.framePrompts 
          ? generatedStory.framePrompts[i]?.prompt || prompt
          : prompt;
        
        // Enhance the frame prompt with style and mood
        const framePrompt = createEnhancedPrompt(baseFramePrompt, selectedStyle, selectedMood);
        
        // Log the enhanced frame prompt for debugging
        console.log(`Frame ${i + 1} enhanced prompt:`, framePrompt);
        console.log(`Style: ${selectedStyle}, Mood: ${selectedMood}`);

        // Call API to generate single image
        const response = await fetch("/api/generate_single_image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ 
            image: inputImage, 
            prompt: framePrompt, 
            frameIndex: i,
            totalFrames: frameCount,
            isFirstFrame: i === 0,
            style: selectedStyle,
            mood: selectedMood,
            frameAspectRatio
          }),
        })
        .then((res) => res.json())
        .catch((error) => {
          console.error(`Error generating frame ${i + 1}:`, error)
          return { error: "Failed to generate image" }
        })

        if (response.error) {
          console.error(`API Error for frame ${i + 1}:`, response.error)
          throw new Error(`Frame ${i + 1}: ${response.error}`)
        }

        // Create frame object with generated image
        const frame: VideoFrame = {
          id: i + 1,
          timestamp: `0:${(i * (videoDuration / frameCount)).toString().padStart(2, "0")}`,
          imageUrl: response.imageUrl || "/placeholder.svg",
          description: generatedStory && generatedStory.enhancedStory.scenes[i] 
            ? generatedStory.enhancedStory.scenes[i].description 
            : getFrameDescription(i),
          prompt: framePrompt,
          sceneStory: generatedStory && generatedStory.enhancedStory.scenes[i] 
            ? generatedStory.enhancedStory.scenes[i].description 
            : undefined,
          fullStory: generatedStory ? {
            title: generatedStory.enhancedStory.title,
            overallStory: generatedStory.enhancedStory.overallStory,
            style: selectedStyle,
            mood: selectedMood
          } : undefined
        }

        console.log(`Frame ${i + 1} generated successfully`)
        console.log(`Image data length: ${response.imageUrl?.length || 0} characters`)

        // Update progress for this frame
        setFrameProgress(prev => {
          const newProgress = { ...prev, [i]: true }
          // Calculate overall progress based on completed frames
          const completedFrames = Object.keys(newProgress).length
          setFrameGenerationProgress((completedFrames / frameCount) * 100)
          return newProgress
        })

        return { frame, index: i }
      })

      // Generate all frames concurrently
      console.log("Starting concurrent frame generation...")
      const results = await Promise.all(generationPromises)

      // Check if generation was stopped during the process
      if (isGenerationStopped) {
        setCurrentStep("input")
        return
      }

      // Sort results by index to maintain correct sequence
      const sortedResults = results.sort((a, b) => a.index - b.index)
      
      // Create frames array in correct order
      const newFrames = sortedResults.map(result => result.frame)

      // Batch upload all generated images to S3 using the same requestId and folder
      const framesNeedingUpload = newFrames
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => f.imageUrl && f.imageUrl.startsWith('data:image/'))

      if (framesNeedingUpload.length > 0) {
        console.log(`Uploading ${framesNeedingUpload.length} frames to S3 (batch) ...`)
        await Promise.all(framesNeedingUpload.map(async ({ f, idx }) => {
          try {
            const uploadResponse = await fetch('/api/upload_image_s3', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
              },
              credentials: 'include',
              body: JSON.stringify({
                imageData: f.imageUrl,
                frameId: f.id,
                isUserUpload: false,
                folderPath: `${userId}/${requestId}/reference-frames`
              }),
            })
            const uploadResult = await uploadResponse.json()
            if (!uploadResponse.ok || uploadResult.error) {
              console.error(`Failed to upload frame ${f.id}:`, uploadResult.error || uploadResponse.statusText)
              return
            }
            newFrames[idx] = { ...f, imageUrl: uploadResult.imageUrl }
          } catch (err) {
            console.error(`Error uploading frame ${f.id} to S3:`, err)
          }
        }))
        console.log('Batch upload complete')
      }

      // Update state with all frames at once, ensuring S3 URLs are converted to proxy URLs
      setGeneratedFrames(ensureFrameUrls(newFrames))
      setFrameGenerationProgress(100)
      
      // Save frames to database using utility function with the same request ID
      try {
        const { sessionId: dbSessionId, userId } = await saveFramesToDatabase(newFrames, requestId)
        console.log(`Frames saved to database successfully. Session: ${dbSessionId}`)
      } catch (error) {
        console.error('Failed to save frames to database:', error)
        showToast.error('Failed to save frames to database. Video generation may not work properly.')
      }
      
      console.log(`All ${frameCount} frames generated successfully!`)
      showToast.success(`Successfully generated ${frameCount} frames!`)
      
      if (!isGenerationStopped) {
        setCurrentStep("frames-ready")
      }

    } catch (error) {
      console.error("Error during concurrent frame generation:", error)
      
      // If generation was stopped, don't show error
      if (!isGenerationStopped) {
        showToast.error(`Error generating frames: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setCurrentStep("input")
      }
    }
  }

  const regenerateFrame = async (index: number) => {
    try {
      if (!generatedStory) {
        showToast.error('Story not loaded. Regenerate story first.')
        return
      }

      // Determine source image: prefer original upload; fallback to selected frame image
      let sourceBase64 = ''
      if (imagePreview) {
        sourceBase64 = imagePreview.replace(/^data:image\/\w+;base64,/, "")
      } else {
        const srcUrl = generatedFrames[index]?.imageUrl
        if (!srcUrl) {
          showToast.error('No source image available for this frame')
          return
        }
        // Fetch selected frame and convert to base64
        const res = await fetch(srcUrl)
        if (!res.ok) throw new Error('Failed to fetch frame image')
        const blob = await res.blob()
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        sourceBase64 = (dataUrl || '').replace(/^data:image\/\w+;base64,/, '')
      }

      const storyBaseFromGenerated = generatedStory && generatedStory.framePrompts 
        ? generatedStory.framePrompts[index]?.prompt || prompt
        : prompt
      const editedScene = (editedSceneDescriptions[index] ?? '').trim()
      const baseFramePrompt = editedScene.length > 0 ? editedScene : storyBaseFromGenerated
      const framePrompt = createEnhancedPrompt(baseFramePrompt, selectedStyle, selectedMood)

      const res = await fetch("/api/generate_single_image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          image: sourceBase64,
          prompt: framePrompt,
          frameIndex: index,
          totalFrames: frameCount,
          isFirstFrame: index === 0,
          style: selectedStyle,
          mood: selectedMood,
          frameAspectRatio,
          // Persist to same session if available
          userId: (() => { try { return JSON.parse(localStorage.getItem('currentSession') || '{}').userId } catch { return undefined } })(),
          requestId: (() => { try { return JSON.parse(localStorage.getItem('currentSession') || '{}').sessionId } catch { return undefined } })()
        })
      })
      const data = await res.json()
      if (!res.ok || !data?.imageUrl) throw new Error(data?.error || 'Failed to regenerate frame')

      const updated = [...generatedFrames]
      updated[index] = {
        ...updated[index],
        imageUrl: convertS3UrlToProxy(data.imageUrl),
        prompt: framePrompt,
        sceneStory: baseFramePrompt,
        description: baseFramePrompt || updated[index].description
      }
      setGeneratedFrames(updated)

      // Persist edited scene text into the story if available
      try {
        if (generatedStory && generatedStory.enhancedStory && generatedStory.enhancedStory.scenes?.[index]) {
          const scenes = [...generatedStory.enhancedStory.scenes]
          if (baseFramePrompt) {
            scenes[index] = { ...scenes[index], description: baseFramePrompt }
            setGeneratedStory({
              ...generatedStory,
              enhancedStory: { ...generatedStory.enhancedStory, scenes }
            })
          }
        }
      } catch {}

      // Update DB with the new frame URL using the existing session
      try {
        const session = JSON.parse(localStorage.getItem('currentSession') || '{}')
        if (session?.sessionId && session?.userId) {
          // Save to DB to ensure video-generation page fetches the latest regenerated frames
          await saveFramesToDatabase(updated, session.sessionId)
          // Refresh the localStorage session frameCount if needed
          try {
            localStorage.setItem('currentSession', JSON.stringify({ ...session, frameCount: updated.length }))
          } catch {}
        }
      } catch {}

      showToast.success(`Frame ${index + 1} regenerated`)
    } catch (e) {
      console.error('Regenerate frame error', e)
      showToast.error(e instanceof Error ? e.message : 'Failed to regenerate frame')
    }
  }

  // Pre-fill editable scene breakdown when switching selected frame
  useEffect(() => {
    try {
      if (editedSceneDescriptions[selectedFrameIndex] === undefined) {
        const fromStory = generatedStory?.enhancedStory?.scenes?.[selectedFrameIndex]?.description
        const fallback = generatedFrames[selectedFrameIndex]?.sceneStory || generatedFrames[selectedFrameIndex]?.description || ''
        if (fromStory || fallback) {
          setEditedSceneDescriptions(prev => ({ ...prev, [selectedFrameIndex]: fromStory || fallback }))
        }
      }
      // Exit edit mode when switching frames
      setIsEditingFrameScene(false)
    } catch {}
  }, [selectedFrameIndex, generatedStory, generatedFrames])

  const stopGeneration = () => {
    setIsGenerationStopped(true)
    setCurrentStep("input")
  }

  const getFrameDescription = (frameIndex: number): string => {
    const descriptions = [
      "Character introduction with user's appearance",
      "Scene setup based on prompt context",
      "Main action begins",
      "Character interaction and movement",
      "Climax or key moment",
      "Action resolution",
      "Story development",
      "Narrative progression",
      "Emotional peak",
      "Story conclusion",
      "Final moments",
      "Epilogue scene",
    ]
    
    return descriptions[frameIndex] || `Frame ${frameIndex + 1} content`
  }



  const saveAllImages = async () => {
    if (generatedFrames.length === 0) return

    try {
      // Save each frame individually
      for (let i = 0; i < generatedFrames.length; i++) {
        const frame = generatedFrames[i]
        const frameNumber = (i + 1).toString().padStart(2, '0')
        const fileName = `frame_${frameNumber}_${frame.timestamp}.png`
        
        // Create a link element to download the image
        const link = document.createElement('a')
        link.href = frame.imageUrl
        link.download = fileName
        link.style.display = 'none'
        
        // Add to document, click, and remove
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Saved ${generatedFrames.length} frames individually`)
      showToast.success(`Successfully saved ${generatedFrames.length} frames!`)
    } catch (error) {
      console.error('Error saving images:', error)
      showToast.error('Failed to save images. Please try again.')
    }
  }

  const uploadImagesToS3 = async () => {
    if (generatedFrames.length === 0) return

    try {
      // Show loading state
      const uploadButton = document.getElementById('upload-to-s3-btn')
      if (uploadButton) {
        uploadButton.textContent = 'Uploading to S3...'
        uploadButton.setAttribute('disabled', 'true')
      }

      // Check if frames already have S3 URLs to avoid unnecessary re-upload
      const framesNeedingUpload = generatedFrames.filter(frame => 
        !frame.imageUrl.includes('amazonaws.com') && 
        !frame.imageUrl.includes('s3.')
      )
      
      if (framesNeedingUpload.length === 0) {
        alert('All frames already have S3 URLs!')
        return
      }

      // Upload each frame to S3
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

        // Upload to S3
        const uploadResponse = await fetch('/api/upload_image_s3', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({
            imageData: imageData,
            frameId: frame.id,
            isUserUpload: false // Generated frame goes to reference-frames
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
      
      // Update frame URLs with S3 URLs, but preserve existing frames
      const updatedFrames = generatedFrames.map((frame) => {
        const uploadResult = results.find(r => r.frameId === frame.id)
        if (uploadResult) {
          return {
            ...frame,
            imageUrl: uploadResult.imageUrl // This will already be a proxy URL from the updated S3 upload function
          }
        }
        return frame // Keep existing frame if no upload result found
      })
      
      setGeneratedFrames(ensureFrameUrls(updatedFrames))

      // Save updated frames to database
      try {
        const { sessionId, userId } = await saveFramesToDatabase(updatedFrames)
        console.log(`Updated frames saved to database. Session: ${sessionId}`)
      } catch (error) {
        console.error('Failed to save updated frames to database:', error)
        // Don't throw error here - frames are still available in state
      }

      alert(`Successfully uploaded ${results.length} images to S3!`)
      
    } catch (error) {
      console.error('Error uploading images to S3:', error)
      alert(`Failed to upload images to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Don't clear frames on error - keep existing frames
    } finally {
      // Reset button state
      const uploadButton = document.getElementById('upload-to-s3-btn')
      if (uploadButton) {
        uploadButton.textContent = 'Upload to Images'
        uploadButton.removeAttribute('disabled')
      }
    }
  }



  const modifyStory = () => {
    setIsEditingStory(true)
  }

  const saveStoryChanges = () => {
    setIsEditingStory(false)
    // Here you could add logic to save the modified story
    console.log("Story changes saved")
  }

  const cancelStoryEdit = () => {
    setIsEditingStory(false)
  }

  const FrameViewer = ({ frames }: { frames: VideoFrame[] }) => {
    if (frames.length === 0) return null

    return (
      <div className="space-y-6">
        {/* Frame Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300">{frames.length} frames generated</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFrameIndex(Math.max(0, selectedFrameIndex - 1))}
              disabled={selectedFrameIndex === 0}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
              Frame {selectedFrameIndex + 1} of {frames.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFrameIndex(Math.min(frames.length - 1, selectedFrameIndex + 1))}
              disabled={selectedFrameIndex === frames.length - 1}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Selected Frame Display */}
        <div className="bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[400px] border border-gray-200">
          <Image
            src={frames[selectedFrameIndex]?.imageUrl || "/placeholder.svg"}
            alt={`Frame ${selectedFrameIndex + 1}`}
            width={400}
            height={400}
            className="max-w-full max-h-full object-contain"
            onLoad={() => console.log(`Frame ${selectedFrameIndex + 1} loaded successfully`)}
            onError={() => {
              console.error(`Error loading frame ${selectedFrameIndex + 1}`)
            }}
          />
        </div>

        {/* Frame Info */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">{frames[selectedFrameIndex]?.timestamp}</Badge>
            <span className="text-sm text-gray-500">Frame {selectedFrameIndex + 1}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm text-gray-700 leading-relaxed flex-1">
              {isEditingFrameScene ? '' : (frames[selectedFrameIndex]?.sceneStory || frames[selectedFrameIndex]?.description)}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingFrameScene(v => !v)}
            >
              {isEditingFrameScene ? 'Done' : 'Edit'}
            </Button>
          </div>

          {/* Editable per-frame Scene breakdown */}
          {isEditingFrameScene && (
            <div className="mt-3">
              <Label className="text-xs text-gray-600">Scene breakdown for this frame</Label>
              <textarea
                value={editedSceneDescriptions[selectedFrameIndex] ?? ''}
                onChange={(e) => setEditedSceneDescriptions(prev => ({ ...prev, [selectedFrameIndex]: e.target.value }))}
                placeholder="Describe exactly what this frame should show"
                className="w-full mt-1 p-2 border rounded text-sm"
                rows={3}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditedSceneDescriptions(prev => ({ ...prev, [selectedFrameIndex]: '' }))}
                >
                  Clear Scene
                </Button>
                <Button
                  size="sm"
                  onClick={() => regenerateFrame(selectedFrameIndex)}
                  disabled={(editedSceneDescriptions[selectedFrameIndex] ?? '').trim().length === 0}
                >
                  Regenerate Selected Frame
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Frame Thumbnails */}
        <div className="space-y-3">
          <h4 className="text-base font-medium text-gray-900">All Generated Frames</h4>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {frames.map((frame, index) => (
              <button
                key={frame.id}
                onClick={() => setSelectedFrameIndex(index)}
                className={`aspect-square rounded-lg border-2 overflow-hidden transition-all duration-300 relative bg-gray-100 flex items-center justify-center ${
                  selectedFrameIndex === index
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <Image
                  src={frame.imageUrl || "/placeholder.svg"}
                  alt={`Frame ${index + 1}`}
                  width={100}
                  height={100}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gray-800/70 text-white text-xs p-2 text-center backdrop-blur-sm">
                  {frame.timestamp}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
                  <Link href="/" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-300 border border-blue-200">
                    <Home className="h-4 w-4" />
                    Frame Generation
                  </Link>
                  <Link href="/video-generation" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-300">
                    <Video className="h-4 w-4" />
                    Video Generation
                  </Link>
                  
                  <Link href="/media-library" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-300">
                    <FileImage className="h-4 w-4" />
                    Media Library
                  </Link>
                </div>
              </div>
              <UserMenu />
            </div>
          </div>
        </nav>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
          {/* Page Header */}
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-bold text-gray-900">
              Frame Generation
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Generate frames from your prompt and image to create the foundation for your video
            </p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="gradient-card card-hover">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  Input Configuration
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">Upload your photo and describe the video you want to create</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="image-upload" className="text-gray-900 font-medium mb-3 block">Upload Your Photo</Label>
                  <div className="mt-2">
                    <div className="relative">
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={currentStep === "generating-frames"}
                      />
                      <div onClick={() => document.getElementById('image-upload')?.click()} className="flex items-center justify-center w-full h-16 px-6 border-2 border-dashed border-blue-300 rounded-xl bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-all duration-300 cursor-pointer">
                        <Upload className="h-6 w-6 mr-3 text-blue-600" />
                        <span className="text-base font-medium text-gray-700">
                          {selectedImage ? selectedImage.name : "Choose a photo or drag and drop"}
                        </span>
                      </div>
                      
                    </div>
                    {imagePreview && (
                      <div className="mt-4">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="Preview"
                          width={128}
                          height={128}
                          className="w-32 h-32 object-cover rounded-xl border-2 border-blue-200 shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="prompt" className="text-gray-900 font-medium mb-3 block">Video Description</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe your video... e.g., 'Create a birthday invitation video where I'm celebrating with confetti and balloons in a party setting'"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value)
                      setGeneratedStory(null) // Clear story when prompt changes
                    }}
                    className="mt-2 min-h-[120px] input-modern resize-none"
                    disabled={currentStep === "generating-frames"}
                  />
                  
                  {/* Video Duration and Style/Mood Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    
                    <div>
                      <Label htmlFor="style-select" className="flex items-center gap-2 text-gray-900 font-medium mb-3 block" style={{display: "flex"}}>
                        <Palette className="h-4 w-4 text-blue-600" />
                        Style
                      </Label>
                      <input
                        id="style-select"
                        value={selectedStyle}
                        placeholder="e.g., Realistic, Artistic"
                        onChange={(e) => {
                          setSelectedStyle(e.target.value)
                          setGeneratedStory(null) // Clear story when style changes
                        }}
                        className="input-modern w-full"
                        disabled={currentStep === "generating-frames"}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="mood-select" className="flex items-center gap-2 text-gray-900 font-medium mb-3 block" style={{display: "flex"}}>
                        <Heart className="h-4 w-4 text-blue-600" />
                        Mood
                      </Label>
                      <input
                        id="mood-select"
                        value={selectedMood}
                        placeholder="e.g., Vibrant, Calm"
                        onChange={(e) => {
                          setSelectedMood(e.target.value)
                          setGeneratedStory(null) // Clear story when mood changes
                        }}
                        className="input-modern w-full"
                        disabled={currentStep === "generating-frames"}
                      />
                    </div>

                    <div>
                      <Label htmlFor="duration-select" className="flex items-center gap-2 text-gray-900 font-medium mb-3 block" style={{display: "flex"}}>
                        <Video className="h-4 w-4 text-blue-600" />
                        Video Duration
                      </Label>
                      <select
                        id="duration-select"
                        value={videoDuration}
                        onChange={(e) => {
                          const duration = parseInt(e.target.value) || 30
                          handleVideoDurationChange(duration)
                          setGeneratedStory(null) // Clear story when duration changes
                        }}
                        className="input-modern w-full"
                        disabled={currentStep === "generating-frames"}
                      >
                        {durationOptions.map((duration) => (
                          <option key={duration} value={duration}>
                            {duration}s
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-sm text-gray-500">
                        {frameCount} frames ({videoDuration / frameCount}s per frame)
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="frame-ar-select" className="flex items-center gap-2 text-gray-900 font-medium mb-3 block" style={{display: "flex"}}>
                        Frame Aspect Ratio
                      </Label>
                      <select
                        id="frame-ar-select"
                        value={frameAspectRatio}
                        onChange={(e) => {
                          setFrameAspectRatio(e.target.value)
                          try { localStorage.setItem('frameAspectRatio', e.target.value) } catch {}
                        }}
                        className="input-modern w-full"
                        disabled={currentStep === "generating-frames"}
                      >
                        {frameOptions.map((ratio) => (
                          <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Enhanced Prompt Preview */}
                  {prompt && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">Enhanced Prompt Preview</Badge>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {createEnhancedPrompt(prompt, selectedStyle, selectedMood)}
                      </p>
                    </div>
                  )}
                  
                  {/* Generated Story Display */}
                  {generatedStory && !isGeneratingStory && (
                    <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">Generated Story</Badge>
                        {!isEditingStory && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={modifyStory}
                            className="text-xs border-green-300 text-green-600 hover:bg-green-100"
                          >
                            Edit Story
                          </Button>
                        )}
                      </div>
                      
                      {!isEditingStory ? (
                        /* Enhanced Story (Final Result) - Read Only */
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-base font-medium text-green-700 mb-2">
                              {generatedStory.enhancedStory.title}
                            </h5>
                            <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                              {generatedStory.enhancedStory.overallStory}
                            </p>
                          </div>
                          
                          <div className="space-y-3">
                            <h6 className="text-sm font-medium text-green-700">Scene Breakdown:</h6>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {generatedStory.enhancedStory.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string }, index: number) => (
                                <div key={index} className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-green-200">
                                  <strong className="text-green-600">Scene {scene.sceneNumber} ({scene.timeframe}):</strong> {scene.description}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Enhanced Story (Final Result) - Editable */
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="story-title" className="text-sm font-medium text-green-900">Story Title:</Label>
                            <Textarea
                              id="story-title"
                              value={generatedStory.enhancedStory.title}
                              onChange={(e) => {
                                setGeneratedStory({
                                  ...generatedStory,
                                  enhancedStory: {
                                    ...generatedStory.enhancedStory,
                                    title: e.target.value
                                  }
                                })
                              }}
                              className="mt-1 text-sm min-h-[60px]"
                              placeholder="Enter story title..."
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="story-overview" className="text-sm font-medium text-green-900">Story Overview:</Label>
                            <Textarea
                              id="story-overview"
                              value={generatedStory.enhancedStory.overallStory}
                              onChange={(e) => {
                                setGeneratedStory({
                                  ...generatedStory,
                                  enhancedStory: {
                                    ...generatedStory.enhancedStory,
                                    overallStory: e.target.value
                                  }
                                })
                              }}
                              className="mt-1 text-sm min-h-[80px]"
                              placeholder="Enter story overview..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <h6 className="text-sm font-medium text-green-900">Scene Breakdown:</h6>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {generatedStory.enhancedStory.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string }, index: number) => (
                                <div key={index} className="p-2 bg-white rounded border border-green-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-green-700">Scene {scene.sceneNumber}</span>
                                    <input
                                      type="text"
                                      value={scene.timeframe}
                                      onChange={(e) => {
                                        const updatedScenes = [...generatedStory.enhancedStory.scenes]
                                        updatedScenes[index] = {
                                          ...updatedScenes[index],
                                          timeframe: e.target.value
                                        }
                                        setGeneratedStory({
                                          ...generatedStory,
                                          enhancedStory: {
                                            ...generatedStory.enhancedStory,
                                            scenes: updatedScenes
                                          }
                                        })
                                      }}
                                      className="text-xs px-2 py-1 border border-gray-300 rounded w-20"
                                      placeholder="0:00"
                                    />
                                  </div>
                                  <Textarea
                                    value={scene.description}
                                    onChange={(e) => {
                                      const updatedScenes = [...generatedStory.enhancedStory.scenes]
                                      updatedScenes[index] = {
                                        ...updatedScenes[index],
                                        description: e.target.value
                                      }
                                      setGeneratedStory({
                                        ...generatedStory,
                                        enhancedStory: {
                                          ...generatedStory.enhancedStory,
                                          scenes: updatedScenes
                                        }
                                      })
                                    }}
                                    className="text-xs min-h-[60px]"
                                    placeholder="Enter scene description..."
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Edit Actions */}
                          <div className="flex gap-2 pt-2 border-t border-green-200">
                            <Button
                              onClick={saveStoryChanges}
                              size="sm"
                              className="flex-1"
                            >
                              Save Changes
                            </Button>
                            <Button
                              onClick={cancelStoryEdit}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Story Generator Button */}
                  <div className="mt-2 flex gap-2">
                    <Button
                      onClick={generateStory}
                      disabled={!prompt || isGeneratingStory || currentStep === "generating-frames"}
                      variant="outline"
                      size="sm"
                    >
                      {isGeneratingStory ? (
                        <>
                          <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Story...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate Story
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Story Generation Status */}
                  {isGeneratingStory && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse-slow"></div>
                        <span className="text-base font-medium text-gray-900">Story Generation in Progress</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Progress</span>
                          <span className="text-sm font-medium text-gray-900">{Math.round(storyGenerationProgress)}%</span>
                        </div>
                        <Progress value={storyGenerationProgress} className="w-full h-3 bg-gray-200" />
                      </div>
                      
                      {/* Progress indicator */}
                      {storyGenerationStep === 'complete' && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 font-medium">Both steps completed successfully!</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={generateFrames}
                    disabled={!selectedImage || !prompt || !generatedStory || currentStep === "generating-frames"}
                    className="flex-1 btn-modern h-12 text-base font-medium"
                  >
                    {currentStep === "generating-frames" ? (
                      <>
                        <Wand2 className="h-5 w-5 mr-3 animate-spin" />
                        Generating Frames...
                      </>
                    ) : !generatedStory ? (
                      <>
                        <Grid3X3 className="h-5 w-5 mr-3" />
                        Generate Story First
                      </>
                    ) : (
                      <>
                        <Grid3X3 className="h-5 w-5 mr-3" />
                        Generate Frames
                      </>
                    )}
                  </Button>
                  
                  {currentStep === "generating-frames" && (
                    <Button
                      onClick={stopGeneration}
                      variant="outline"
                      className="px-6 h-12 text-base font-medium border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gradient-card card-hover">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Grid3X3 className="h-6 w-6 text-blue-600" />
                  </div>
                  Frame Generation Progress
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">Individual frames are being generated from your prompt</CardDescription>
              </CardHeader>
              <CardContent>
                {currentStep === "generating-frames" ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-3">
                        {Math.round(frameGenerationProgress)}%
                      </div>
                      <Progress value={frameGenerationProgress} className="w-full h-3 bg-gray-200" />
                      <p className="text-base text-gray-600 mt-3">
                        Generating frames concurrently... {Object.keys(frameProgress).length} of {frameCount} completed
                      </p>
                      
                      {/* Skeleton loading animation for progress */}
                      {frameGenerationProgress < 100 && (
                        <div className="mt-6 space-y-3">
                          <div className="flex items-center justify-center space-x-3">
                            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <p className="text-sm text-gray-500">Processing frames...</p>
                        </div>
                      )}
                    </div>

                    {/* Individual Frame Progress */}
                    <div className="space-y-3">
                      <h4 className="text-base font-medium text-gray-900">Frame Progress:</h4>
                      <div className={`grid gap-3 ${frameCount <= 6 ? 'grid-cols-6' : frameCount <= 8 ? 'grid-cols-8' : 'grid-cols-10'}`}>
                        {Array.from({ length: frameCount }, (_, i) => (
                          <div key={i} className="text-center">
                            {frameProgress[i] ? (
                              // Completed frame
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-green-100 text-green-600 border border-green-300">
                                ✓
                              </div>
                            ) : (
                              // Loading skeleton for incomplete frames
                              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex items-center justify-center">
                                <div className="w-5 h-5 bg-gray-400 rounded-full animate-pulse"></div>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">Frame {i + 1}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Generated Frames - Only show completed frames */}
                    {generatedFrames.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-base font-medium text-gray-900">Generated Frames ({generatedFrames.length} of {frameCount}):</h4>
                        <div className="grid grid-cols-4 gap-3">
                          {generatedFrames.map((frame, index) => (
                            <div key={frame.id} className="aspect-square bg-gray-100 rounded-lg border border-gray-200 overflow-hidden relative flex items-center justify-center">
                              <Image
                                src={frame.imageUrl || "/placeholder.svg"}
                                alt={`Frame ${index + 1}`}
                                width={100}
                                height={100}
                                className="max-w-full max-h-full object-contain"
                                onLoad={() => console.log(`Thumbnail ${index + 1} loaded`)}
                                onError={() => {
                                  console.error(`Error loading thumbnail ${index + 1}`)
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : currentStep === "frames-ready" ? (
                  <div className="space-y-6">
                    <FrameViewer frames={generatedFrames} />
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => regenerateFrame(selectedFrameIndex)}
                      >
                        Regenerate Selected Frame
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex gap-3">
                      </div>
                      <Link href="/video-generation" className="flex-1">
                        <Button className="w-full btn-modern h-12 text-base font-medium">
                          <ArrowRight className="h-5 w-5 mr-3" />
                          Continue to Video Generation
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center space-y-4">
                      <Grid3X3 className="h-16 w-16 mx-auto text-gray-400" />
                      <p className="text-base text-gray-500">Upload an image and enter a prompt to generate frames</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}
