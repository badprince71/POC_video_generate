"use client"

import type React from "react"
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
  Library,
  Home,
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
  const [generatedFrames] = useState<VideoFrame[]>([])
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0)


  const stopGeneration = () => {
     setCurrentStep("input")
  }

  const resetGeneration = () => {
    setCurrentStep("input")
    setGeneratedVideo(null)
    setVideoGenerationProgress(0)
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