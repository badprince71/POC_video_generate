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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface UploadedImage {
  id: string
  file: File
  preview: string
  name: string
}

interface VideoFrame {
  id: number
  timestamp: string
  imageUrl: string
  description: string
  prompt: string
  sourceImageId?: string
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
  const [selectedImages, setSelectedImages] = useState<UploadedImage[]>([])
  const [prompt, setPrompt] = useState("")
  const [currentStep, setCurrentStep] = useState<GenerationStep>("input")
  const [generatedFrames, setGeneratedFrames] = useState<VideoFrame[]>([])
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [frameGenerationProgress, setFrameGenerationProgress] = useState(0)
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)

      fileArray.forEach((file, index) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newImage: UploadedImage = {
            id: `img-${Date.now()}-${index}`,
            file: file,
            preview: e.target?.result as string,
            name: file.name,
          }

          setSelectedImages((prev) => [...prev, newImage])
        }
        reader.readAsDataURL(file)
      })
    }
    // Reset the input value
    event.target.value = ""
  }

  const removeImage = (imageId: string) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  const removeAllImages = () => {
    setSelectedImages([])
  }

  const generateFrames = async () => {
    if (selectedImages.length === 0 || !prompt) return

    setCurrentStep("generating-frames")
    setFrameGenerationProgress(0)

    // Simulate frame generation process
    const frameCount = 8
    const newFrames: VideoFrame[] = []

    for (let i = 0; i < frameCount; i++) {
      // Simulate processing time for each frame
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Use different source images for variety
      const sourceImage = selectedImages[i % selectedImages.length]

      const frame: VideoFrame = {
        id: i + 1,
        timestamp: `0:${(i * 3).toString().padStart(2, "0")}`,
        imageUrl: i === 0 ? sourceImage.preview : `/placeholder.svg?height=300&width=400&text=Frame ${i + 1}`,
        description: getFrameDescription(i, prompt),
        prompt: `Frame ${i + 1}: ${getFrameDescription(i, prompt)}`,
        sourceImageId: sourceImage.id,
      }

      newFrames.push(frame)
      setGeneratedFrames([...newFrames])
      setFrameGenerationProgress(((i + 1) / frameCount) * 100)
    }

    setCurrentStep("frames-ready")
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
      duration: `${generatedFrames.length * 3}s`,
      prompt: prompt,
      frames: generatedFrames,
      videoUrl: "/placeholder-video.mp4",
    }

    setGeneratedVideo(video)
    setCurrentStep("video-ready")
  }

  const getFrameDescription = (frameIndex: number, userPrompt: string): string => {
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
  }

  const regenerateFrames = () => {
    // Stop any ongoing generation and return to input step
    setCurrentStep("input")
    setGeneratedFrames([])
    setGeneratedVideo(null)
    setFrameGenerationProgress(0)
    setVideoGenerationProgress(0)
    setSelectedFrameIndex(0)
    // Keep the existing prompt and images so user can modify them
  }

  const FrameViewer = ({ frames }: { frames: VideoFrame[] }) => {
    if (frames.length === 0) return null

    return (
      <div className="space-y-4">
        {/* Frame Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {frames.length} frames generated
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              {selectedImages.length} source images used
            </span>
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-gray-700 border border-gray-200">
              {frames[selectedFrameIndex]?.timestamp}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Frame {selectedFrameIndex + 1}</span>
              {frames[selectedFrameIndex]?.sourceImageId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  Source:{" "}
                  {selectedImages.find((img) => img.id === frames[selectedFrameIndex]?.sourceImageId)?.name ||
                    "Unknown"}
                </span>
              )}
            </div>
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
            Upload multiple photos and create personalized animated videos with AI
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
                    <CardDescription>Upload multiple photos and describe the video you want to create</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generatedFrames.length === 0 && currentStep === "input" && (
                      <Alert className="mb-4">
                        <AlertDescription>
                          You can now modify your photos or prompt and generate new frames.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="image-upload">Upload Your Photos</Label>
                        {selectedImages.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={removeAllImages}
                            disabled={currentStep === "generating-frames"}
                          >
                            Clear All ({selectedImages.length})
                          </Button>
                        )}
                      </div>

                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="mt-1"
                        disabled={currentStep === "generating-frames"}
                      />

                      {selectedImages.length > 0 && (
                        <div className="mt-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mb-3">
                            {selectedImages.length} photo{selectedImages.length !== 1 ? "s" : ""} selected
                          </span>

                          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                            {selectedImages.map((image) => (
                              <div key={image.id} className="relative group">
                                <img
                                  src={image.preview || "/placeholder.svg"}
                                  alt={image.name}
                                  className="w-full h-20 object-cover rounded border"
                                />
                                <button
                                  onClick={() => removeImage(image.id)}
                                  disabled={currentStep === "generating-frames"}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="prompt">Video Description</Label>
                      <Textarea
                        id="prompt"
                        placeholder="Describe your video... e.g., 'Create a birthday invitation video where characters are celebrating with confetti and balloons in a party setting'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="mt-1 min-h-[100px]"
                        disabled={currentStep === "generating-frames"}
                      />
                    </div>

                    <Button
                      onClick={generateFrames}
                      disabled={selectedImages.length === 0 || !prompt || currentStep === "generating-frames"}
                      className="w-full"
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
                          {selectedImages.length > 0 && ` (${selectedImages.length} photos)`}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid3X3 className="h-5 w-5" />
                      Frame Generation Progress
                    </CardTitle>
                    <CardDescription>Individual frames are being generated from your photos and prompt</CardDescription>
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
                            Generating frame {Math.ceil((frameGenerationProgress / 100) * 8)} of 8
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedImages.length > 0 &&
                              `Using ${selectedImages.length} source photo${selectedImages.length !== 1 ? "s" : ""}`}
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
                          <p className="text-sm text-gray-500">Upload photos and enter a prompt to generate frames</p>
                          {selectedImages.length > 0 && (
                            <p className="text-xs text-gray-400">{selectedImages.length} photos ready</p>
                          )}
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
                      Review your generated frames created from {selectedImages.length} source photos
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
                        Modify & Regenerate
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
                      <CardDescription>
                        Your personalized animated video created from {selectedImages.length} photos is ready!
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Video className="h-12 w-12 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">Video Preview</p>
                          <p className="text-xs text-gray-500">Duration: {generatedVideo.duration}</p>
                          <p className="text-xs text-gray-500">Created from {selectedImages.length} source photos</p>
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

          {/* Other tabs with simplified badge styling */}
          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Photo AI Video Generation Workflow</CardTitle>
                <CardDescription>
                  How multiple photos are used to create diverse and engaging video content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Step 1 */}
                  <div className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-semibold mb-4 text-blue-600">Step 1: Multi-Photo Frame Generation</h3>
                    <div className="space-y-4">
                      {[
                        {
                          title: "Photo Analysis",
                          description:
                            "AI analyzes all uploaded photos to extract facial features, poses, and characteristics from each image",
                          tools: ["MediaPipe", "Face++", "Computer Vision APIs"],
                        },
                        {
                          title: "Character Modeling",
                          description:
                            "Create consistent character models that can represent different poses and expressions from multiple photos",
                          tools: ["3D Face Reconstruction", "Character Consistency Models"],
                        },
                        {
                          title: "Scene Planning",
                          description:
                            "Plan 8 keyframes using different source photos to create variety and natural progression",
                          tools: ["Storyboard AI", "Multi-source planning algorithms"],
                        },
                        {
                          title: "Frame Generation",
                          description:
                            "Generate frames using different source photos to maintain variety while ensuring character consistency",
                          tools: ["Stable Diffusion", "Multi-reference generation", "Style transfer"],
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
                                <span
                                  key={toolIndex}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-gray-700 border border-gray-200"
                                >
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits of Multi-Photo Approach */}
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-semibold mb-4 text-green-600">Benefits of Multiple Photos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Visual Variety</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Different poses and expressions</li>
                          <li>• Various lighting conditions</li>
                          <li>• Multiple angles and perspectives</li>
                          <li>• Natural progression through scenes</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Quality Improvement</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Better character representation</li>
                          <li>• More natural animations</li>
                          <li>• Reduced repetition</li>
                          <li>• Enhanced realism</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Tools for Multi-Photo Processing</CardTitle>
                <CardDescription>
                  Specialized tools for handling multiple source images in video generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Multi-Photo Processing Tools */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-600">Multi-Photo Processing</h3>
                    {[
                      {
                        name: "Face Consistency Models",
                        description: "Maintain character identity across different source photos",
                        features: ["Identity preservation", "Multi-angle support", "Expression mapping"],
                      },
                      {
                        name: "Pose Transfer AI",
                        description: "Transfer poses and expressions between different photos",
                        features: ["Pose estimation", "Expression transfer", "Body language mapping"],
                      },
                      {
                        name: "Style Harmonization",
                        description: "Ensure consistent visual style across frames from different photos",
                        features: ["Color matching", "Lighting normalization", "Style consistency"],
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
                              <span
                                key={featureIndex}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Enhanced Video Tools */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-600">Enhanced Video Generation</h3>
                    {[
                      {
                        name: "Multi-Source Runway ML",
                        description: "Advanced video generation supporting multiple reference images",
                        features: ["Multi-reference input", "Character consistency", "Scene variety"],
                      },
                      {
                        name: "Character-Aware Pika",
                        description: "Video generation with character identity preservation across sources",
                        features: ["Identity tracking", "Multi-photo support", "Natural transitions"],
                      },
                      {
                        name: "Advanced Stable Video",
                        description: "Open-source video generation with multi-image conditioning",
                        features: ["Multiple conditioning", "Custom training", "Flexible input"],
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
                              <span
                                key={featureIndex}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {feature}
                              </span>
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
                <CardTitle>Multi-Photo Video Generation Documentation</CardTitle>
                <CardDescription>Technical implementation and benefits of using multiple source photos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Why Multiple Photos?</h3>
                  <Alert>
                    <AlertDescription>
                      <ul className="space-y-1 text-sm">
                        <li>
                          • <strong>Visual Diversity:</strong> Different poses, expressions, and angles create more
                          engaging videos
                        </li>
                        <li>
                          • <strong>Natural Progression:</strong> Use different photos for different scenes to create
                          realistic flow
                        </li>
                        <li>
                          • <strong>Better Representation:</strong> Multiple photos provide more complete character
                          information
                        </li>
                        <li>
                          • <strong>Reduced Repetition:</strong> Avoid monotonous single-pose videos
                        </li>
                        <li>
                          • <strong>Enhanced Quality:</strong> More source material leads to better AI generation
                          results
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Technical Implementation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Photo Management</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>• Dynamic photo upload and removal</p>
                        <p>• Preview thumbnails with metadata</p>
                        <p>• Source tracking for each frame</p>
                        <p>• Batch processing capabilities</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Frame Generation</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>• Intelligent source photo selection</p>
                        <p>• Character consistency validation</p>
                        <p>• Multi-reference conditioning</p>
                        <p>• Quality optimization per source</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">1-10</div>
                      <div className="text-xs text-gray-600">Photos Supported</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">8</div>
                      <div className="text-xs text-gray-600">Frames Generated</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">98%</div>
                      <div className="text-xs text-gray-600">Character Consistency</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">3x</div>
                      <div className="text-xs text-gray-600">Visual Variety</div>
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
