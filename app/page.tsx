"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  const generateFrames = async () => {
    if (!selectedImage || !prompt) return

    setCurrentStep("generating-frames")
    setFrameGenerationProgress(0)
    setIsGenerationStopped(false)

    // Simulate frame generation process
    const frameCount = 5
    const newFrames: VideoFrame[] = []

    const response = await fetch("/api/generate_images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        image: imagePreview.replace(/^data:image\/\w+;base64,/, ""), 
        prompt: prompt, 
        numImages: frameCount 
      }),
    })
    .then((res) => res.json())
    .catch((error) => {
      console.error("Error generating images:", error)
      return { error: "Failed to generate images" }
    })

    if (response.error) {
      console.error("API Error:", response.error)
      alert(`Error: ${response.error}`)
      setCurrentStep("input")
      return
    }

    const imageUrls = response.imageUrls || []
    
    console.log(`Generated ${response.generatedCount}/${response.requestedCount} images successfully`)

    console.log("imageUrls", imageUrls)
    
    for (let i = 0; i < frameCount; i++) {
      // Check if generation was stopped
      if (isGenerationStopped) {
        setCurrentStep("input")
        return
      }
      // Simulate processing time for each frame
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Check again after the delay
      if (isGenerationStopped) {
        setCurrentStep("input")
        return
      }

      const frame: VideoFrame = {
        id: i + 1,
        timestamp: `0:${(i * 3).toString().padStart(2, "0")}`,
        imageUrl: i === 0 ? imagePreview : imageUrls[i],
        description: getFrameDescription(i),
        prompt: `Frame ${i + 1}: ${getFrameDescription(i)}`,
      }
      newFrames.push(frame)
      setGeneratedFrames([...newFrames])
      setFrameGenerationProgress(((i + 1) / frameCount) * 100)
    }

    if (!isGenerationStopped) {
      setCurrentStep("frames-ready")
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
    console.log("generatedFrames", generatedFrames)
    const video: GeneratedVideo = {
      id: "generated-" + Date.now(),
      title: "Your Generated Video",
      duration: `${generatedFrames.length * 3}s`,
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
      "Conclusion setup",
      "Final message or call-to-action",
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
    // Keep the existing prompt and image so user can modify them
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
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={frames[selectedFrameIndex]?.imageUrl || "/placeholder.svg"}
            alt={`Frame ${selectedFrameIndex + 1}`}
            className="w-full h-full object-cover"
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
                className={`aspect-video rounded border-2 overflow-hidden transition-all relative ${
                  selectedFrameIndex === index
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <img
                  src={frame.imageUrl || "/placeholder.svg"}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generator">Video Generator</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="tools">AI Tools</TabsTrigger>
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
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="mt-1"
                        disabled={currentStep === "generating-frames"}
                      />
                      {imagePreview && (
                        <div className="mt-2">
                          <img
                            src={imagePreview || "/placeholder.svg"}
                            alt="Preview"
                            className="w-32 h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="prompt">Video Description</Label>
                      <Textarea
                        id="prompt"
                        placeholder="Describe your video... e.g., 'Create a birthday invitation video where I'm celebrating with confetti and balloons in a party setting'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="mt-1 min-h-[100px]"
                        disabled={currentStep === "generating-frames"}
                      />
                      
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
                            Generating frame {Math.ceil((frameGenerationProgress / 100) * 5)} of 5
                          </p>
                        </div>

                        {generatedFrames.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Generated Frames:</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {generatedFrames.map((frame, index) => (
                                <div key={frame.id} className="aspect-video bg-gray-100 rounded border overflow-hidden">
                                  <img
                                    src={frame.imageUrl || "/placeholder.svg"}
                                    alt={`Frame ${index + 1}`}
                                    className="w-full h-full object-cover"
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

          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Two-Step AI Video Generation Workflow</CardTitle>
                <CardDescription>Detailed breakdown of the frame-first video generation process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Step 1 */}
                  <div className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-semibold mb-4 text-blue-600">Step 1: Frame Generation</h3>
                    <div className="space-y-4">
                      {[
                        {
                          title: "Prompt Analysis",
                          description:
                            "AI analyzes the text prompt to understand scene requirements, character actions, and visual elements",
                          tools: ["GPT-4", "Claude", "Custom NLP models"],
                        },
                        {
                          title: "Character Modeling",
                          description:
                            "Extract facial features from uploaded photo and create consistent character model",
                          tools: ["MediaPipe", "Face++", "Custom ML models"],
                        },
                        {
                          title: "Scene Planning",
                          description: "Plan 8 keyframes with specific timestamps and scene descriptions",
                          tools: ["Storyboard AI", "Scene planning algorithms"],
                        },
                        {
                          title: "Frame Generation",
                          description: "Generate individual frames maintaining character consistency across all scenes",
                          tools: ["Stable Diffusion", "Midjourney API", "Custom image models"],
                        },
                      ].map((substep, index) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <h4 className="font-semibold">{substep.title}</h4>
                            <p className="text-gray-600 text-sm">{substep.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {substep.tools.map((tool, toolIndex) => (
                                <Badge key={toolIndex} variant="outline" className="text-xs">
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-semibold mb-4 text-green-600">Step 2: Video Compilation</h3>
                    <div className="space-y-4">
                      {[
                        {
                          title: "Frame Consistency Check",
                          description: "Analyze generated frames for character consistency and visual coherence",
                          tools: ["Computer Vision", "Consistency algorithms"],
                        },
                        {
                          title: "Transition Generation",
                          description: "Create smooth transitions between keyframes using interpolation",
                          tools: ["Motion interpolation", "Optical flow"],
                        },
                        {
                          title: "Effects and Enhancement",
                          description: "Add motion blur, lighting effects, and visual enhancements",
                          tools: ["After Effects API", "Custom shaders"],
                        },
                        {
                          title: "Video Rendering",
                          description: "Compile frames into final MP4 with proper timing and compression",
                          tools: ["FFmpeg", "Video codecs", "Compression algorithms"],
                        },
                      ].map((substep, index) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm font-medium">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <h4 className="font-semibold">{substep.title}</h4>
                            <p className="text-gray-600 text-sm">{substep.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {substep.tools.map((tool, toolIndex) => (
                                <Badge key={toolIndex} variant="outline" className="text-xs">
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Tools for Two-Step Process</CardTitle>
                <CardDescription>
                  Tools categorized by their role in frame generation vs video compilation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Frame Generation Tools */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-600">Step 1: Frame Generation Tools</h3>
                    {[
                      {
                        name: "Stable Diffusion",
                        description: "Generate consistent character images across frames",
                        features: ["Character consistency", "Style control", "Batch generation"],
                      },
                      {
                        name: "Midjourney API",
                        description: "High-quality artistic frame generation",
                        features: ["Artistic styles", "Character reference", "Scene composition"],
                      },
                      {
                        name: "DALL-E 3",
                        description: "Prompt-based frame generation with character consistency",
                        features: ["Text understanding", "Character persistence", "Scene variety"],
                      },
                    ].map((tool, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-base">{tool.name}</CardTitle>
                          <CardDescription className="text-sm">{tool.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-1">
                            {tool.features.map((feature, featureIndex) => (
                              <Badge key={featureIndex} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Video Compilation Tools */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-600">Step 2: Video Compilation Tools</h3>
                    {[
                      {
                        name: "Runway ML",
                        description: "Frame-to-video compilation with AI enhancement",
                        features: ["Frame interpolation", "Motion generation", "Video effects"],
                      },
                      {
                        name: "Pika Labs",
                        description: "Transform static frames into animated sequences",
                        features: ["Animation generation", "Smooth transitions", "Style preservation"],
                      },
                      {
                        name: "FFmpeg + AI",
                        description: "Professional video rendering with AI-enhanced transitions",
                        features: ["Video encoding", "Transition effects", "Quality optimization"],
                      },
                    ].map((tool, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-base">{tool.name}</CardTitle>
                          <CardDescription className="text-sm">{tool.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-1">
                            {tool.features.map((feature, featureIndex) => (
                              <Badge key={featureIndex} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Two-Step Process Documentation</CardTitle>
                <CardDescription>Technical implementation and benefits of the frame-first approach</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Why Two Steps?</h3>
                  <Alert>
                    <AlertDescription>
                      <ul className="space-y-1 text-sm">
                        <li>
                          • <strong>Quality Control:</strong> Review and approve frames before video generation
                        </li>
                        <li>
                          • <strong>Cost Efficiency:</strong> Avoid expensive video regeneration for frame issues
                        </li>
                        <li>
                          • <strong>Flexibility:</strong> Modify individual frames without regenerating entire video
                        </li>
                        <li>
                          • <strong>Consistency:</strong> Ensure character appearance is consistent across all frames
                        </li>
                        <li>
                          • <strong>Debugging:</strong> Identify and fix issues at the frame level
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Technical Benefits</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Step 1 Advantages</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>• Parallel frame generation</p>
                        <p>• Individual frame optimization</p>
                        <p>• Character consistency validation</p>
                        <p>• Scene composition control</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Step 2 Advantages</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>• Optimized video compilation</p>
                        <p>• Professional transitions</p>
                        <p>• Efficient rendering pipeline</p>
                        <p>• Quality-focused output</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">8</div>
                      <div className="text-xs text-gray-600">Frames Generated</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">12s</div>
                      <div className="text-xs text-gray-600">Frame Generation</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">12s</div>
                      <div className="text-xs text-gray-600">Video Compilation</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">95%</div>
                      <div className="text-xs text-gray-600">Frame Consistency</div>
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
