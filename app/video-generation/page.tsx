"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Video,
  Play,
  Download,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Library,
  Home,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

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

type VideoGenerationStep = "input" | "generating-video" | "video-ready"

export default function VideoGenerationPage() {
  const [currentStep, setCurrentStep] = useState<VideoGenerationStep>("input")
  const [generatedFrames, setGeneratedFrames] = useState<VideoFrame[]>([])
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
  const [isGenerationStopped, setIsGenerationStopped] = useState(false)

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
          setCurrentStep("input")
          return
        }

        const startImage = generatedFrames[i].imageUrl
        const endImage = generatedFrames[i + 1].imageUrl
        
        console.log(`Generating video clip ${i + 1}/${totalClips} (${generatedFrames[i].timestamp} to ${generatedFrames[i + 1].timestamp})`)

        // Update progress
        setVideoGenerationProgress(((i) / totalClips) * 100)

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
                prompt: generatedFrames[i].prompt
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
        setCurrentStep("input")
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
          videoClips: generatedClips
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
        prompt: "Generated from frames",
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
        setCurrentStep("input")
      }
    }
  }

  const stopGeneration = () => {
    setIsGenerationStopped(true)
    setCurrentStep("input")
  }

  const resetGeneration = () => {
    setCurrentStep("input")
    setGeneratedVideo(null)
    setVideoGenerationProgress(0)
    setIsGenerationStopped(false)
  }

  const FrameViewer = ({ frames }: { frames: VideoFrame[] }) => {
    if (frames.length === 0) return null

    return (
      <div className="space-y-4">
        {/* Frame Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{frames.length} frames ready</Badge>
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
          <h4 className="text-sm font-medium">All Frames</h4>
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
                <Link href="/" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Home className="h-4 w-4" />
                  Frame Generation
                </Link>
                <Link href="/video-generation" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                  <Video className="h-4 w-4" />
                  Video Generation
                </Link>
                <Link href="/library" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Library className="h-4 w-4" />
                  My Library
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
              Video Generation
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Transform your generated frames into a smooth, animated video
            </p>
          </div>

          {/* Main Content */}
          {currentStep === "input" && (
            <div className="text-center space-y-6">
              <div className="bg-white rounded-lg p-8 shadow-sm border">
                <Video className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Frames Available
                </h3>
                <p className="text-gray-600 mb-6">
                  You need to generate frames first before creating a video.
                </p>
                <Link href="/">
                  <Button>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go to Frame Generation
                  </Button>
                </Link>
              </div>
            </div>
          )}

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
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 