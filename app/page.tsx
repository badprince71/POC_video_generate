"use client"

import type React from "react"
import Image from "next/image"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Upload,
  Video,
  Wand2,
  Play,
  Download,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Palette,
  Heart,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Progress } from "@/components/ui/progress"

interface VideoFrame {
  id: number
  timestamp: string
  imageUrl: string
  description: string
  prompt: string
}

interface GeneratedVideo {
  id: string
  title: string
  duration: string
  prompt: string
  frames: VideoFrame[]
  videoUrl: string
  videoClips?: string[] // Array of individual video clip URLs
}

type GenerationStep = "input" | "generating-frames" | "frames-ready" | "generating-video" | "video-ready"

export default function AIVideoGeneratorPOC() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [prompt, setPrompt] = useState("")
  const [selectedStyle, setSelectedStyle] = useState<string>("Realistic")
  const [selectedMood, setSelectedMood] = useState<string>("Vibrant")
  const [videoDuration, setVideoDuration] = useState<number>(30)
  const [frameCount, setFrameCount] = useState<number>(6)
  const [currentStep, setCurrentStep] = useState<GenerationStep>("input")
  const [generatedFrames, setGeneratedFrames] = useState<VideoFrame[]>([])
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [frameGenerationProgress, setFrameGenerationProgress] = useState(0)
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0)
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
    
    try {
      const enhancedPrompt = createEnhancedPrompt(prompt, selectedStyle, selectedMood)
      
      // Step 1: First story generation
      setStoryGenerationStep('first-story')
      console.log("Starting first story generation...")
      
      // Simulate first story generation time
      await new Promise(resolve => setTimeout(resolve, 2000))
      
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
        alert(`Error: ${response.error}`)
        return
      }

      // Step 2: Story enhancement (this happens in the API)
      setStoryGenerationStep('enhancing')
      console.log("Story enhancement in progress...")
      
      // Simulate enhancement time to show the step
      await new Promise(resolve => setTimeout(resolve, 1500))

      setGeneratedStory(response)
      setStoryGenerationStep('complete')
      console.log("Generated story:", response)
      
      // Keep complete status for a moment before hiding
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error("Error generating story:", error)
      alert("Failed to generate story")
    } finally {
      setIsGeneratingStory(false)
      setStoryGenerationStep('idle')
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
      
      console.log(`All ${frameCount} frames generated successfully!`)
      
      if (!isGenerationStopped) {
        setCurrentStep("frames-ready")
      }

    } catch (error) {
      console.error("Error during concurrent frame generation:", error)
      
      // If generation was stopped, don't show error
      if (!isGenerationStopped) {
        alert(`Error generating frames: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setCurrentStep("input")
      }
    }
  }
  const stopGeneration = () => {
    setIsGenerationStopped(true)
    setCurrentStep("input")
  }

  const generateVideo = async () => {
    if (generatedFrames.length === 0) return

    setCurrentStep("generating-video")
    setVideoGenerationProgress(0)
    setIsGenerationStopped(false)

    try {
      const totalClips = generatedFrames.length - 1 // Number of transitions between frames
      const generatedClips: string[] = []

      // Generate video clips for each pair of consecutive frames
      for (let i = 0; i < totalClips; i++) {
        // Check if generation was stopped
        if (isGenerationStopped) {
          setCurrentStep("frames-ready")
          return
        }

        const startImage = generatedFrames[i].imageUrl
        const endImage = generatedFrames[i + 1].imageUrl
        
        console.log(`Generating video clip ${i + 1}/${totalClips} (${generatedFrames[i].timestamp} to ${generatedFrames[i + 1].timestamp})`)

        // Update progress
        setVideoGenerationProgress(((i) / totalClips) * 100)

        // Use story-enhanced prompt if available, otherwise use enhanced prompt
        const baseClipPrompt = generatedStory && generatedStory.enhancedStory.scenes[i] 
          ? generatedStory.enhancedStory.scenes[i].description 
          : prompt;
        
        // Enhance the clip prompt with style and mood
        const clipPrompt = createEnhancedPrompt(baseClipPrompt, selectedStyle, selectedMood);

        // Call Runway API to generate video clip with retry mechanism
        let response
        let retryCount = 0
        const maxRetries = 2
        
        while (retryCount <= maxRetries) {
          try {
            response = await fetch("/api/generate_video_clips", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                startImage: startImage,
                endImage: endImage,
                clipIndex: i,
                totalClips: totalClips,
                prompt: clipPrompt
              }),
            })
            .then((res) => res.json())
            
            // If successful, break out of retry loop
            if (response.videoUrl && !response.error) {
              break
            }
            
            // If it's a timeout and we have retries left, try again
            if (response.error && (response.error.includes('timed out') || response.error.includes('408')) && retryCount < maxRetries) {
              console.warn(`Video clip ${i + 1} timed out, retrying... (attempt ${retryCount + 1}/${maxRetries})`)
              retryCount++
              await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds before retry
              continue
            }
            
            break // Exit retry loop for other errors or max retries reached
            
          } catch (error) {
            console.error(`Error generating video clip ${i + 1} (attempt ${retryCount + 1}):`, error)
            if (retryCount < maxRetries) {
              retryCount++
              await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds before retry
              continue
            }
            response = { error: "Failed to generate video clip after retries" }
            break
          }
        }
        if (response.error) {
          console.error(`Video clip ${i + 1} generation failed:`, response.error)
          
          // Handle timeout specifically
          if (response.error.includes('timed out') || response.error.includes('408')) {
            console.warn(`Video clip ${i + 1} timed out, continuing with next clip...`)
            // Continue with next clip instead of failing completely
            continue
          }
          
          throw new Error(`Clip ${i + 1}: ${response.error}`)
        }

        if (response.videoUrl) {
          generatedClips.push(response.videoUrl)
          console.log(`Video clip ${i + 1} generated successfully:`, response.videoUrl)
        }

        // Update progress after each clip (account for partial success)
        const progressPercentage = Math.min(((i + 1) / totalClips) * 100, 90) // Cap at 90% before merging
        setVideoGenerationProgress(progressPercentage)
      }

      // Check if generation was stopped during the process
      if (isGenerationStopped) {
        setCurrentStep("frames-ready")
        return
      }

      // Check if we have any successful clips
      if (generatedClips.length === 0) {
        throw new Error("No video clips were generated successfully")
      }

      console.log(`Successfully generated ${generatedClips.length} out of ${totalClips} video clips`)

      // Merge all video clips into a final video
      console.log("Merging video clips into final video...")
      setVideoGenerationProgress(95) // Show merging progress

      const mergeResponse = await fetch("/api/merge_video_clips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoClips: generatedClips,
          outputFileName: `final_video_${Date.now()}.mp4`
        }),
      })
      .then((res) => res.json())
      .catch((error) => {
        console.error("Error merging video clips:", error)
        return { error: "Failed to merge video clips" }
      })

      if (mergeResponse.error) {
        console.error("Video merging failed:", mergeResponse.error)
        throw new Error(`Video merging failed: ${mergeResponse.error}`)
      }

      setVideoGenerationProgress(100)

      // Create final video object with merged video
      const video: GeneratedVideo = {
        id: "generated-" + Date.now(),
        title: "Your Generated Video",
        duration: `${totalClips * 5}s`,
        prompt: prompt,
        frames: generatedFrames,
        videoUrl: mergeResponse.mergedVideoUrl || generatedClips[0] || "/placeholder-video.mp4",
        videoClips: generatedClips // Store all clips for individual viewing
      }

      setGeneratedVideo(video)
      setCurrentStep("video-ready")
      console.log(`All ${totalClips} video clips generated and merged successfully!`)
      
      // Show success message with clip count
      if (generatedClips.length < totalClips) {
        console.warn(`Note: ${totalClips - generatedClips.length} clips failed to generate due to timeouts`)
      }

    } catch (error) {
      console.error("Error during video generation:", error)
      
      // If generation was stopped, don't show error
      if (!isGenerationStopped) {
        alert(`Error generating video: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setCurrentStep("frames-ready")
      }
    }
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
  const resetGeneration = () => {
    setCurrentStep("input")
    setGeneratedFrames([])
    setGeneratedVideo(null)
    setFrameGenerationProgress(0)
    setVideoGenerationProgress(0)
    setSelectedFrameIndex(0)
    setIsGenerationStopped(false)
    setGeneratedStory(null)
    setIsGeneratingStory(false)
    setStoryGenerationStep('idle')
    setFrameProgress({})
    setSelectedStyle("Realistic")
    setSelectedMood("Vibrant")
    setVideoDuration(30)
    setFrameCount(6)
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
    } catch (error) {
      console.error('Error saving images:', error)
      alert('Failed to save images. Please try again.')
    }
  }

  const regenerateFrames = () => {
    // Stop any ongoing generation and return to input step
    setCurrentStep("input")
    setGeneratedFrames([])
    setGeneratedVideo(null)
    setFrameGenerationProgress(0)
    setVideoGenerationProgress(0)
    setSelectedFrameIndex(0)
    setIsGenerationStopped(false)
    setFrameProgress({})
    setSelectedStyle("Realistic")
    setSelectedMood("Vibrant")
    setVideoDuration(30)
    setFrameCount(6)
    setGeneratedStory(null)
    setIsGeneratingStory(false)
    setStoryGenerationStep('idle')
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            AI Video Generator POC
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Two-step process: First generate frames from your prompt, then create the final video
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-4">
          <div
            className={`flex items-center space-x-2 ${currentStep === "input" || currentStep === "generating-frames" ? "text-blue-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "input" || currentStep === "generating-frames" ? "bg-blue-100" : "bg-gray-100"}`}
            >
              1
            </div>
            <span className="text-sm font-medium">Generate Frames</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div
            className={`flex items-center space-x-2 ${currentStep === "frames-ready" || currentStep === "generating-video" || currentStep === "video-ready" ? "text-blue-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "frames-ready" || currentStep === "generating-video" || currentStep === "video-ready" ? "bg-blue-100" : "bg-gray-100"}`}
            >
              2
            </div>
            <span className="text-sm font-medium">Generate Video</span>
          </div>
        </div>
        <Tabs defaultValue="generator" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generator">Video Generator</TabsTrigger>
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
          </TabsList>
          <TabsContent value="generator" className="space-y-6">
            {/* Step 1: Input and Frame Generation */}
            {(currentStep === "input" || currentStep === "generating-frames") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Step 1: Input Configuration
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
                            disabled=
                            {currentStep === "generating-frames"}
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
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        
                        <div>
                          <Label htmlFor="style-select" className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Style
                          </Label>
                          <select
                            id="style-select"
                            value={selectedStyle}
                            onChange={(e) => {
                              setSelectedStyle(e.target.value)
                              setGeneratedStory(null) // Clear story when style changes
                            }}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            disabled={currentStep === "generating-frames"}
                          >
                            {styleOptions.map((style) => (
                              <option key={style} value={style}>
                                {style}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <Label htmlFor="mood-select" className="flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            Mood
                          </Label>
                          <select
                            id="mood-select"
                            value={selectedMood}
                            onChange={(e) => {
                              setSelectedMood(e.target.value)
                              setGeneratedStory(null) // Clear story when mood changes
                            }}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            disabled={currentStep === "generating-frames"}
                          >
                            {moodOptions.map((mood) => (
                              <option key={mood} value={mood}>
                                {mood}
                              </option>
                            ))}
                          </select>
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
                              Generating Enhanced Story (2-Step)...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Generate Enhanced Story (2-Step)
                            </>
                          )}
                        </Button>
                        {generatedStory && (
                          <Badge variant="secondary" className="self-center">
                            Enhanced Story Ready: {generatedStory.enhancedStory?.title}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Story Generation Status */}
                      {isGeneratingStory && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-blue-800">Story Generation in Progress</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                storyGenerationStep === 'first-story' ? 'bg-blue-500 animate-pulse' : 
                                storyGenerationStep === 'enhancing' || storyGenerationStep === 'complete' ? 'bg-green-500' : 'bg-gray-300'
                              }`}></div>
                              <span className={`text-xs ${
                                storyGenerationStep === 'first-story' ? 'text-blue-700' : 
                                storyGenerationStep === 'enhancing' || storyGenerationStep === 'complete' ? 'text-green-700' : 'text-gray-500'
                              }`}>
                                Step 1: {storyGenerationStep === 'first-story' ? 'Generating first story...' : 'First story generated ✓'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                storyGenerationStep === 'enhancing' ? 'bg-blue-500 animate-pulse' : 
                                storyGenerationStep === 'complete' ? 'bg-green-500' : 'bg-gray-300'
                              }`}></div>
                              <span className={`text-xs ${
                                storyGenerationStep === 'enhancing' ? 'text-blue-700' : 
                                storyGenerationStep === 'complete' ? 'text-green-700' : 'text-gray-500'
                              }`}>
                                Step 2: {storyGenerationStep === 'enhancing' ? 'Enhancing story with more detail...' : 
                                storyGenerationStep === 'complete' ? 'Story enhancement complete ✓' : 'Waiting for first story...'}
                              </span>
                            </div>
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
                      {/* Story Preview */}
                      {generatedStory && !isGeneratingStory && (
                        <div className="mt-4 space-y-4">
                          {/* Enhanced Story (Final Result) */}
                          <div className="p-4 bg-blue-50 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-blue-900">
                                📖 Enhanced Story (Final)
                              </h4>
                              <Badge variant="outline" className="text-xs">2-Step Process</Badge>
                            </div>
                            <h5 className="text-sm font-medium text-blue-800 mb-2">
                              {generatedStory.enhancedStory.title}
                            </h5>
                            <p className="text-sm text-blue-800 mb-3">
                              {generatedStory.enhancedStory.overallStory}
                            </p>
                            <div className="space-y-2">
                              <h6 className="text-sm font-medium text-blue-900">Enhanced Scene Breakdown:</h6>
                              {generatedStory.enhancedStory.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string }, index: number) => (
                                <div key={index} className="text-xs text-blue-700 bg-white p-2 rounded">
                                  <strong>Scene {scene.sceneNumber} ({scene.timeframe}):</strong> {scene.description}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Original Story (First Generation) - Collapsible */}
                          {/* <details className="p-3 bg-gray-50 rounded-lg border">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                              📝 Original Story (Step 1) - Click to expand
                            </summary>
                            <div className="mt-3 space-y-2">
                              <h5 className="text-sm font-medium text-gray-800">
                                {generatedStory.firstStory.title}
                              </h5>
                              <p className="text-sm text-gray-700 mb-3">
                                {generatedStory.firstStory.overallStory}
                              </p>
                              <div className="space-y-2">
                                <h6 className="text-sm font-medium text-gray-800">Original Scene Breakdown:</h6>
                                {generatedStory.firstStory.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string }, index: number) => (
                                  <div key={index} className="text-xs text-gray-600 bg-white p-2 rounded">
                                    <strong>Scene {scene.sceneNumber} ({scene.timeframe}):</strong> {scene.description}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </details> */}
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
            )}

            {/* Step 2: Frame Review and Video Generation */}
            {(currentStep === "frames-ready" ||
              currentStep === "generating-video" ||
              currentStep === "video-ready") && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid3X3 className="h-5 w-5" />
                      Step 2: Review Generated Frames
                    </CardTitle>
                    <CardDescription>
                      Review your generated frames and proceed to create the final video
                    </CardDescription>
                    
                    {/* Style and Mood Summary */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-blue-600" />
                        <Badge variant="secondary" className="text-xs">
                          Style: {selectedStyle}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-600" />
                        <Badge variant="secondary" className="text-xs">
                          Mood: {selectedMood}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FrameViewer frames={generatedFrames} />

                    <div className="flex gap-4 mt-6">
                      <Button
                        onClick={regenerateFrames}
                        variant="outline"
                        disabled={currentStep === "generating-video"}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Modify Prompt & Regenerate
                      </Button>

                      {currentStep === "frames-ready" && (
                        <>
                          <Button 
                            onClick={saveAllImages}
                            variant="outline"
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Save All Images
                          </Button>
                          <Button onClick={generateVideo} className="flex-1">
                            <Video className="h-4 w-4 mr-2" />
                            Generate Video from Frames
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Video Generation Progress */}
                {currentStep === "generating-video" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5" />
                        Video Generation Progress
                      </CardTitle>
                      <CardDescription>Creating video clips using Runway API</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 mb-2">
                            {Math.round(videoGenerationProgress)}%
                          </div>
                          <Progress value={videoGenerationProgress} className="w-full" />
                          <p className="text-sm text-gray-600 mt-2">
                            {videoGenerationProgress >= 95 
                              ? "Merging video clips into final video..."
                              : `Generating video clips... ${Math.floor(videoGenerationProgress / (100 / (generatedFrames.length - 1))) + 1} of ${generatedFrames.length - 1} clips`
                            }
                          </p>
                          
                          {/* Skeleton loading animation for progress */}
                          {videoGenerationProgress < 100 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-center space-x-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <p className="text-xs text-gray-500">Processing with Runway API...</p>
                            </div>
                          )}
                        </div>

                        {/* Individual Clip Progress */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Clip Progress:</h4>
                          <div className="grid grid-cols-5 gap-2">
                            {Array.from({ length: generatedFrames.length - 1 }, (_, i) => (
                              <div key={i} className="text-center">
                                {videoGenerationProgress >= ((i + 1) / (generatedFrames.length - 1)) * 100 ? (
                                  // Completed clip
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-green-100 text-green-600">
                                    ✓
                                  </div>
                                ) : (
                                  // Loading skeleton for incomplete clips
                                  <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex items-center justify-center">
                                    <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Clip {i + 1}</p>
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
                            Stop Video Generation
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Final Video Result */}
                {currentStep === "video-ready" && generatedVideo && (
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
                        <div className="text-center space-y-2">
                          <Video className="h-12 w-12 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">Final Merged Video</p>
                          <p className="text-xs text-gray-500">Duration: {generatedVideo.duration}</p>
                          <p className="text-xs text-gray-500">
                            {generatedVideo.videoClips?.length || 0} clips merged
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(generatedVideo.videoUrl, '_blank')}
                            className="mt-2"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Play Final Video
                          </Button>
                        </div>
                      </div>

                      {/* Video Clips Information */}
                      {generatedVideo.videoClips && generatedVideo.videoClips.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">Generated Video Clips:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {generatedVideo.videoClips.map((clipUrl, index) => (
                              <div key={index} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">Clip {index + 1}</span>
                                  <Badge variant="outline" className="text-xs">5s</Badge>
                                </div>
                                <p className="text-xs text-gray-600 mb-2">
                                  {generatedFrames[index]?.timestamp} → {generatedFrames[index + 1]?.timestamp}
                                </p>
                                {/* Show story prompt for this clip */}
                                {generatedStory && generatedStory.enhancedStory.scenes[index] && (
                                  <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                                    <strong>Scene {index + 1}:</strong> {generatedStory.enhancedStory.scenes[index].description}
                                  </div>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(clipUrl, '_blank')}
                                  className="w-full"
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  View Clip
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <Button className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download MP4
                        </Button>
                        <Button variant="outline" onClick={resetGeneration}>
                          Create New Video
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>



          <TabsContent value="documentation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* How It Works */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    How It Works
                  </CardTitle>
                  <CardDescription>Understanding the AI video generation process</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Story Generation</h4>
                        <p className="text-xs text-gray-600">AI analyzes your prompt and creates a detailed story with scene breakdowns</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Frame Creation</h4>
                        <p className="text-xs text-gray-600">Generate 6 key frames using your photo and story-enhanced prompts</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm font-medium flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Video Compilation</h4>
                        <p className="text-xs text-gray-600">Transform frames into smooth video with transitions and effects</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Best Practices */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Best Practices
                  </CardTitle>
                  <CardDescription>Tips for optimal video generation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-xs text-gray-700">Use clear, descriptive prompts with specific actions</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-xs text-gray-700">Upload high-quality photos with good lighting</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-xs text-gray-700">Include scene context and character emotions</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-xs text-gray-700">Review frames before video generation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Technical Details */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Architecture</CardTitle>
                <CardDescription>Advanced implementation details and system components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-600">Story Enhancement</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">GPT-4</Badge>
                        <span className="text-gray-600">Initial story generation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Claude</Badge>
                        <span className="text-gray-600">Story enhancement</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Custom NLP</Badge>
                        <span className="text-gray-600">Scene breakdown</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-600">Image Generation</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Stable Diffusion</Badge>
                        <span className="text-gray-600">Frame generation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">ControlNet</Badge>
                        <span className="text-gray-600">Character consistency</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">LoRA</Badge>
                        <span className="text-gray-600">Style adaptation</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-purple-600">Video Processing</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">FFmpeg</Badge>
                        <span className="text-gray-600">Video compilation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">OpenCV</Badge>
                        <span className="text-gray-600">Frame analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">WebM</Badge>
                        <span className="text-gray-600">Output format</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Performance Optimization</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">6</div>
                      <div className="text-xs text-gray-600">Frames</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">~30s</div>
                      <div className="text-xs text-gray-600">Generation</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-lg font-bold text-purple-600">1080p</div>
                      <div className="text-xs text-gray-600">Resolution</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">30fps</div>
                      <div className="text-xs text-gray-600">Frame Rate</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
