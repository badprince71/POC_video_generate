"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"

import { useState } from "react"
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

  // Utility function to upload images to cloud storage
  const uploadImageToCloud = async (imageData: string, frameId: number): Promise<{ imageUrl: string, userId: string }> => {
    try {
      const response = await fetch('/api/upload_image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: imageData,
          frameId: frameId
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
  const saveFramesToDatabase = async (frames: VideoFrame[]) => {
    try {
      // Upload images to cloud storage and get URLs
      const framesWithCloudUrls = await Promise.all(
        frames.map(async (frame) => {
          if (frame.imageUrl && frame.imageUrl.startsWith('data:image/')) {
            // Upload base64 image to cloud storage
            const { imageUrl, userId } = await uploadImageToCloud(frame.imageUrl, frame.id)
            return {
              ...frame,
              imageUrl: imageUrl,
              userId: userId
            }
          }
          return frame
        })
      )

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const userId = (framesWithCloudUrls[0] as any)?.userId || `user_${Date.now()}`

      // Save frames to database
      const response = await fetch('/api/save_frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frames: framesWithCloudUrls,
          userId: userId,
          sessionId: sessionId,
          originalPrompt: prompt,
          videoDuration: videoDuration,
          frameCount: frameCount,
          style: selectedStyle,
          mood: selectedMood
        }),
      })

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      // Save session info to localStorage for video generation page
      localStorage.setItem('currentSession', JSON.stringify({
        sessionId: sessionId,
        userId: userId,
        frameCount: frameCount
      }))

      console.log('Frames saved to database successfully')
      showToast.success('Frames saved successfully!')
      return { sessionId, userId }
    } catch (error) {
      console.error('Error saving frames to database:', error)
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
          },
          body: JSON.stringify({ 
            image: inputImage, 
            prompt: framePrompt, 
            frameIndex: i,
            totalFrames: frameCount,
            isFirstFrame: i === 0,
            style: selectedStyle,
            mood: selectedMood
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
      
      // Update state with all frames at once
      setGeneratedFrames(newFrames)
      setFrameGenerationProgress(100)
      
      // Save frames to database using utility function
      try {
        const { sessionId, userId } = await saveFramesToDatabase(newFrames)
        console.log(`Frames saved to database successfully. Session: ${sessionId}`)
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

  const uploadImagesToSupabase = async () => {
    if (generatedFrames.length === 0) return

    try {
      // Show loading state
      const uploadButton = document.getElementById('upload-to-supabase-btn')
      if (uploadButton) {
        uploadButton.textContent = 'Uploading to Supabase...'
        uploadButton.setAttribute('disabled', 'true')
      }

      // Upload each frame to Supabase
      const uploadPromises = generatedFrames.map(async (frame, index) => {
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

        // Upload to Supabase
        const uploadResponse = await fetch('/api/upload_image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: imageData,
            frameId: frame.id
          }),
        })

        const result = await uploadResponse.json()
        
        if (result.error) {
          throw new Error(`Failed to upload frame ${frame.id}: ${result.error}`)
        }

        console.log(`Frame ${frame.id} uploaded to Supabase:`, result.imageUrl)
        return result
      })

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises)
      
      // Update frame URLs with Supabase URLs
      const updatedFrames = generatedFrames.map((frame, index) => ({
        ...frame,
        imageUrl: results[index].imageUrl
      }))
      
      setGeneratedFrames(updatedFrames)

      // Save updated frames to database
      try {
        const { sessionId, userId } = await saveFramesToDatabase(updatedFrames)
        console.log(`Updated frames saved to database. Session: ${sessionId}`)
      } catch (error) {
        console.error('Failed to save updated frames to database:', error)
      }

      alert(`Successfully uploaded ${generatedFrames.length} images to Supabase!`)
      
    } catch (error) {
      console.error('Error uploading images to Supabase:', error)
      alert(`Failed to upload images to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // Reset button state
      const uploadButton = document.getElementById('upload-to-supabase-btn')
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
      <div className="space-y-4">
        {/* Frame Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{frames.length} frames generated</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFrameIndex(Math.max(0, selectedFrameIndex - 1))}
              disabled={selectedFrameIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Frame {selectedFrameIndex + 1} of {frames.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFrameIndex(Math.min(frames.length - 1, selectedFrameIndex + 1))}
              disabled={selectedFrameIndex === frames.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Selected Frame Display */}
        <div className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
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
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">{frames[selectedFrameIndex]?.timestamp}</Badge>
            <span className="text-sm text-gray-600">Frame {selectedFrameIndex + 1}</span>
          </div>
          <p className="text-sm text-gray-700">{frames[selectedFrameIndex]?.description}</p>
        </div>

        {/* Frame Thumbnails */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">All Generated Frames</h4>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {frames.map((frame, index) => (
              <button
                key={frame.id}
                onClick={() => setSelectedFrameIndex(index)}
                className={`aspect-square rounded border-2 overflow-hidden transition-all relative bg-gray-100 flex items-center justify-center ${
                  selectedFrameIndex === index
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Image
                  src={frame.imageUrl || "/placeholder.svg"}
                  alt={`Frame ${index + 1}`}
                  width={100}
                  height={100}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Video Generator
              </h1>
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                  <Home className="h-4 w-4" />
                  Frame Generation
                </Link>
                <Link href="/video-generation" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Video className="h-4 w-4" />
                  Video Generation
                </Link>
                
                <Link href="/media-library" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <FileImage className="h-4 w-4" />
                  Media Library
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-gray-900">
              Frame Generation
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Generate frames from your prompt and image to create the foundation for your video
            </p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Input Configuration
                </CardTitle>
                <CardDescription>Upload your photo and describe the video you want to create</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="image-upload">Upload Your Photo</Label>
                  <div className="mt-1">
                    <div className="relative">
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={currentStep === "generating-frames"}
                      />
                      <div className="flex items-center justify-center w-full h-12 px-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors duration-200 cursor-pointer">
                        <Upload className="h-5 w-5 mr-2 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {selectedImage ? selectedImage.name : "Choose a photo or drag and drop"}
                        </span>
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="mt-3">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="Preview"
                          width={128}
                          height={128}
                          className="w-32 h-32 object-cover rounded-lg border shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="prompt">Video Description</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe your video... e.g., 'Create a birthday invitation video where I'm celebrating with confetti and balloons in a party setting'"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value)
                      setGeneratedStory(null) // Clear story when prompt changes
                    }}
                    className="mt-1 min-h-[100px]"
                    disabled={currentStep === "generating-frames"}
                  />
                  
                  {/* Video Duration and Style/Mood Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    
                    <div>
                      <Label htmlFor="style-select" className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
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
                        className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none border-gray-300 focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={currentStep === "generating-frames"}
                      >
                        {/* {styleOptions.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))} */}
                      </input>
                    </div>
                    
                    <div>
                      <Label htmlFor="mood-select" className="flex items-center gap-2">
                        <Heart className="h-4 w-4" />
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
                        className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none border-gray-300 focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={currentStep === "generating-frames"}
                      >
                        {/* {moodOptions.map((mood) => (
                          <option key={mood} value={mood}>
                            {mood}
                          </option>
                        ))} */}
                      </input>
                    </div>

                    <div>
                      <Label htmlFor="duration-select" className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
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
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={currentStep === "generating-frames"}
                      >
                        {durationOptions.map((duration) => (
                          <option key={duration} value={duration}>
                            {duration}s
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-gray-500">
                        {frameCount} frames ({videoDuration / frameCount}s per frame)
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Prompt Preview */}
                  {prompt && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">Enhanced Prompt Preview</Badge>
                      </div>
                      <p className="text-sm text-blue-800">
                        {createEnhancedPrompt(prompt, selectedStyle, selectedMood)}
                      </p>
                    </div>
                  )}
                  
                  {/* Generated Story Display */}
                  {generatedStory && !isGeneratingStory && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800">Generated Story</Badge>
                        {!isEditingStory && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={modifyStory}
                            className="text-xs"
                          >
                            Edit Story
                          </Button>
                        )}
                      </div>
                      
                      {!isEditingStory ? (
                        /* Enhanced Story (Final Result) - Read Only */
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-medium text-green-900 mb-1">
                              {generatedStory.enhancedStory.title}
                            </h5>
                            <p className="text-sm text-green-800 mb-2">
                              {generatedStory.enhancedStory.overallStory}
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h6 className="text-sm font-medium text-green-900">Scene Breakdown:</h6>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {generatedStory.enhancedStory.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string }, index: number) => (
                                <div key={index} className="text-xs text-green-700 bg-white p-2 rounded border border-green-200">
                                  <strong>Scene {scene.sceneNumber} ({scene.timeframe}):</strong> {scene.description}
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
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-blue-800">Story Generation in Progress</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-blue-700">Progress</span>
                          <span className="text-xs font-medium text-blue-700">{Math.round(storyGenerationProgress)}%</span>
                        </div>
                        <Progress value={storyGenerationProgress} className="w-full h-2" />
                      </div>
                      
                      {/* Progress indicator */}
                      {storyGenerationStep === 'complete' && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-700 font-medium">Both steps completed successfully!</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={generateFrames}
                    disabled={!selectedImage || !prompt || !generatedStory || currentStep === "generating-frames"}
                    className="flex-1"
                  >
                    {currentStep === "generating-frames" ? (
                      <>
                        <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Frames...
                      </>
                    ) : !generatedStory ? (
                      <>
                        <Grid3X3 className="h-4 w-4 mr-2" />
                        Generate Story First
                      </>
                    ) : (
                      <>
                        <Grid3X3 className="h-4 w-4 mr-2" />
                        Generate Frames
                      </>
                    )}
                  </Button>
                  
                  {currentStep === "generating-frames" && (
                    <Button
                      onClick={stopGeneration}
                      variant="outline"
                      className="px-4"
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5" />
                  Frame Generation Progress
                </CardTitle>
                <CardDescription>Individual frames are being generated from your prompt</CardDescription>
              </CardHeader>
              <CardContent>
                {currentStep === "generating-frames" ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-2">
                        {Math.round(frameGenerationProgress)}%
                      </div>
                      <Progress value={frameGenerationProgress} className="w-full" />
                      <p className="text-sm text-gray-600 mt-2">
                        Generating frames concurrently... {Object.keys(frameProgress).length} of {frameCount} completed
                      </p>
                      
                      {/* Skeleton loading animation for progress */}
                      {frameGenerationProgress < 100 && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <p className="text-xs text-gray-500">Processing frames...</p>
                        </div>
                      )}
                    </div>

                    {/* Individual Frame Progress */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Frame Progress:</h4>
                      <div className={`grid gap-2 ${frameCount <= 6 ? 'grid-cols-6' : frameCount <= 8 ? 'grid-cols-8' : 'grid-cols-10'}`}>
                        {Array.from({ length: frameCount }, (_, i) => (
                          <div key={i} className="text-center">
                            {frameProgress[i] ? (
                              // Completed frame
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-green-100 text-green-600">
                                ✓
                              </div>
                            ) : (
                              // Loading skeleton for incomplete frames
                              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex items-center justify-center">
                                <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">Frame {i + 1}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Generated Frames - Only show completed frames */}
                    {generatedFrames.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Generated Frames ({generatedFrames.length} of {frameCount}):</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {generatedFrames.map((frame, index) => (
                            <div key={frame.id} className="aspect-square bg-gray-100 rounded border overflow-hidden relative flex items-center justify-center">
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
                  <div className="space-y-4">
                    <FrameViewer frames={generatedFrames} />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex gap-2">
                      </div>
                      <Link href="/video-generation" className="flex-1">
                        <Button className="w-full">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continue to Video Generation
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Grid3X3 className="h-12 w-12 mx-auto text-gray-300" />
                      <p className="text-sm text-gray-500">Upload an image and enter a prompt to generate frames</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
