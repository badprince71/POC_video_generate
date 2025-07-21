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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
}

type GenerationStep = "input" | "generating-frames" | "frames-ready" | "generating-video" | "video-ready"

export default function AIVideoGeneratorPOC() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [prompt, setPrompt] = useState("")
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
    try {
      const response = await fetch("/api/generate_story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
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

      setGeneratedStory(response)
      console.log("Generated story:", response)
    } catch (error) {
      console.error("Error generating story:", error)
      alert("Failed to generate story")
    } finally {
      setIsGeneratingStory(false)
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

    const frameCount = 6
    const inputImage = imagePreview.replace(/^data:image\/\w+;base64,/, "");

    try {
      // Create array of promises for concurrent generation
      const generationPromises = Array.from({ length: frameCount }, async (_, i) => {
        // Check if generation was stopped
        if (isGenerationStopped) {
          throw new Error("Generation stopped")
        }

        console.log(`Starting generation for frame ${i + 1}/${frameCount}`)
        
        // Use story-generated prompt if available, otherwise use original prompt
        const framePrompt = generatedStory && generatedStory.framePrompts 
          ? generatedStory.framePrompts[i]?.prompt || prompt
          : prompt;

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
            isFirstFrame: i === 0
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
          timestamp: `0:${(i * 5).toString().padStart(2, "0")}`,
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

    // Simulate video generation steps
    const steps = [
      "Analyzing frame consistency...",
      "Applying motion blur...",
      "Generating transitions...",
      "Adding effects...",
      "Rendering video...",
      "Finalizing output...",
    ]
    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setVideoGenerationProgress(((i + 1) / steps.length) * 100)
    }
    const video: GeneratedVideo = {
      id: "generated-" + Date.now(),
      title: "Your Generated Video",
      duration: `${generatedFrames.length * 5}s`,
      prompt: prompt,
      frames: generatedFrames,
      videoUrl: "/placeholder-video.mp4",
    }

    setGeneratedVideo(video)
    setCurrentStep("video-ready")
  }

  const getFrameDescription = (frameIndex: number): string => {
    const descriptions = [
      "Character introduction with user's appearance",
      "Scene setup based on prompt context",
      "Main action begins",
      "Character interaction and movement",
      "Climax or key moment",
      "Action resolution",
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
    setFrameProgress({})
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
                    {generatedFrames.length === 0 && currentStep === "input" && (
                      <Alert className="mb-4">
                        <AlertDescription>
                          You can now modify your prompt or image and generate new frames.
                        </AlertDescription>
                      </Alert>
                    )}
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
                          <details className="p-3 bg-gray-50 rounded-lg border">
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
                          </details>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={generateFrames}
                        disabled={!selectedImage || !prompt || currentStep === "generating-frames"}
                        className="flex-1"
                      >
                        {currentStep === "generating-frames" ? (
                          <>
                            <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Frames...
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
                            Generating frames concurrently... {Object.keys(frameProgress).length} of 6 completed
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
                          <div className="grid grid-cols-6 gap-2">
                            {Array.from({ length: 6 }, (_, i) => (
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
                            <h4 className="text-sm font-medium">Generated Frames ({generatedFrames.length} of 6):</h4>
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
                        <Button onClick={generateVideo} className="flex-1">
                          <Video className="h-4 w-4 mr-2" />
                          Generate Video from Frames
                        </Button>
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
                      <CardDescription>Creating final video from generated frames</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 mb-2">
                            {Math.round(videoGenerationProgress)}%
                          </div>
                          <Progress value={videoGenerationProgress} className="w-full" />
                          <p className="text-sm text-gray-600 mt-2">Compiling frames into final video...</p>
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
                          <p className="text-sm text-gray-600">Video Preview</p>
                          <p className="text-xs text-gray-500">Duration: {generatedVideo.duration}</p>
                        </div>
                      </div>

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
