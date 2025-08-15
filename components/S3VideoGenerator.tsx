'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Video, Play, Download, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { VideoMerger } from '@/lib/utils/video-merge'
import { uploadMovieToStorage } from '@/lib/generate_video_clips/generate_clips'

interface S3Frame {
  key: string
  publicUrl: string
  name: string
  lastModified?: Date
  size?: number
}

interface VideoClip {
  frameIndex: number
  frameName: string
  frameUrl: string
  videoUrl?: string
  clipIndex: number
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'retrying'
  error?: string
  duration?: number
  retryCount?: number
}

interface S3VideoGeneratorProps {
  userId: string
  onVideoGenerated?: (videoUrl: string) => void
  className?: string
}

export function S3VideoGenerator({ userId, onVideoGenerated, className }: S3VideoGeneratorProps) {
  const [frames, setFrames] = useState<S3Frame[]>([])
  const [videoClips, setVideoClips] = useState<VideoClip[]>([])
  const [generationProgress, setGenerationProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<'idle' | 'loading_frames' | 'generating_videos' | 'merging' | 'completed' | 'error'>('idle')
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [generationStats, setGenerationStats] = useState({ completed: 0, failed: 0, total: 0 })

  // Video generation options
  const [frameAspectRatio, setFrameAspectRatio] = useState('1280:720')
  const [videoPrompt, setVideoPrompt] = useState('Smooth cinematic transition with natural movement and realistic motion')

  const aspectRatioOptions = [
    { value: '1280:720', label: '16:9 Landscape (1280x720)' },
    { value: '720:1280', label: '9:16 Portrait (720x1280)' },
    { value: '1104:832', label: '4:3 Landscape (1104x832)' },
    { value: '832:1104', label: '3:4 Portrait (832x1104)' },
    { value: '960:960', label: '1:1 Square (960x960)' },
    { value: '1584:672', label: '21:9 Ultrawide (1584x672)' },
  ]

  // Load frames from S3 on component mount
  useEffect(() => {
    loadFrames()
  }, [userId])

  const API_KEY = process.env.NEXT_PUBLIC_API_KEY
  const getAuthHeaders = () => ({ Authorization: `Bearer ${API_KEY}` })

  const loadFrames = async () => {
    try {
      setCurrentStep('loading_frames')
      setErrorMessage('')
      
      const response = await fetch(`/api/process_s3_video_workflow?action=list_frames&userId=${userId}`, { headers: { ...getAuthHeaders() } })
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setFrames(result.frames || [])
      setCurrentStep('idle')
      
    } catch (error) {
      console.error('Error loading frames:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load frames')
      setCurrentStep('error')
    }
  }

  const generateVideos = async () => {
    try {
      setCurrentStep('generating_videos')
      setErrorMessage('')
      setGenerationProgress(0)
      setVideoClips([])
      setGenerationStats({ completed: 0, failed: 0, total: frames.length })
      
      const newSessionId = `session_${Date.now()}`
      setSessionId(newSessionId)

      const response = await fetch('/api/process_s3_video_workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          userId,
          action: 'generate_videos',
          sessionId: newSessionId,
          frameAspectRatio,
          prompt: videoPrompt,
          batchSize: 3
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Video generation failed')
      }

      setVideoClips(result.data.videoClips || [])
      setGenerationProgress(result.data.progress?.progressPercentage || 100)
      setGenerationStats({
        completed: result.data.completedCount || 0,
        failed: result.data.failedCount || 0,
        total: result.data.totalFrames || 0
      })

      // If we have successful videos, prepare for merging
      if (result.data.generatedVideoUrls && result.data.generatedVideoUrls.length > 0) {
        await prepareVideoMerge(result.data.generatedVideoUrls)
      } else {
        throw new Error('No videos were generated successfully')
      }

    } catch (error) {
      console.error('Error generating videos:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate videos')
      setCurrentStep('error')
    }
  }

  const prepareVideoMerge = async (videoUrls: string[]) => {
    try {
      setCurrentStep('merging')
      
      const response = await fetch('/api/process_s3_video_workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          userId,
          action: 'prepare_merge',
          sessionId,
          videoClipUrls: videoUrls
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Video merge preparation failed')
      }

      if (result.data.mergedVideoUrl) {
        // Single video - already uploaded
        setFinalVideoUrl(result.data.mergedVideoUrl)
        setCurrentStep('completed')
        onVideoGenerated?.(result.data.mergedVideoUrl)
      } else {
        // Multiple videos - use client-side merge
        await mergeVideosClientSide(videoUrls)
      }

    } catch (error) {
      console.error('Error preparing video merge:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to prepare video merge')
      setCurrentStep('error')
    }
  }

  const mergeVideosClientSide = async (videoUrls: string[]) => {
    try {
      console.log(`🎬 Merging ${videoUrls.length} videos client-side...`)
      
      // Create merger instance
      const merger = new VideoMerger()
      
      // Merge videos
      const mergedVideo = await merger.mergeVideos(videoUrls, {
        outputFormat: 'webm',
        quality: 0.8,
        frameRate: 30
      })
      
      console.log(`✅ Videos merged! Duration: ${mergedVideo.duration}s`)
      
      // Upload merged video
      const uploadResult = await uploadMovieToStorage({
        videoUrl: mergedVideo.url,
        userId: userId,
        filename: `final_video_${sessionId}`,
        duration: mergedVideo.duration
      })
      
      // Clean up
      merger.cleanup()
      URL.revokeObjectURL(mergedVideo.url)
      
      setFinalVideoUrl(uploadResult.publicUrl)
      setCurrentStep('completed')
      onVideoGenerated?.(uploadResult.publicUrl)
      
    } catch (error) {
      console.error('Client-side merge failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to merge videos')
      setCurrentStep('error')
    }
  }

  const downloadVideo = () => {
    if (finalVideoUrl) {
      const link = document.createElement('a')
      link.href = finalVideoUrl
      link.download = `generated_video_${sessionId}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const resetGenerator = () => {
    setCurrentStep('idle')
    setVideoClips([])
    setGenerationProgress(0)
    setFinalVideoUrl('')
    setSessionId('')
    setErrorMessage('')
    setGenerationStats({ completed: 0, failed: 0, total: 0 })
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            S3 Video Generator
          </CardTitle>
          <CardDescription>
            Generate videos from your uploaded frames in S3
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Frames Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Available Frames</h3>
              <Button variant="outline" size="sm" onClick={loadFrames} disabled={currentStep === 'loading_frames'}>
                {currentStep === 'loading_frames' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
            
            {frames.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {frames.length} frames ready for video generation
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {frames.slice(0, 8).map((frame, index) => (
                    <div key={frame.key} className="relative">
                      <img
                        src={frame.publicUrl}
                        alt={`Frame ${index + 1}`}
                        className="w-full h-16 object-cover rounded border"
                      />
                      <Badge variant="secondary" className="absolute bottom-0 right-0 text-xs">
                        {index + 1}
                      </Badge>
                    </div>
                  ))}
                  {frames.length > 8 && (
                    <div className="w-full h-16 bg-gray-100 rounded border flex items-center justify-center">
                      <span className="text-xs text-gray-600">+{frames.length - 8} more</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    No frames found in S3. Upload frames first to generate videos.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Video Generation Options */}
          {frames.length > 0 && currentStep === 'idle' && (
            <div className="space-y-4">
              <h3 className="font-medium">Video Generation Options</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Aspect Ratio</label>
                  <select
                    value={frameAspectRatio}
                    onChange={(e) => setFrameAspectRatio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {aspectRatioOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Video Prompt</label>
                  <input
                    type="text"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Describe the video motion..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <Button 
                onClick={generateVideos}
                className="w-full"
                size="lg"
              >
                <Play className="h-4 w-4 mr-2" />
                Generate {frames.length} Video Clips
              </Button>
            </div>
          )}

          {/* Generation Progress */}
          {(currentStep === 'generating_videos' || currentStep === 'merging') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {currentStep === 'generating_videos' ? 'Generating Videos' : 'Merging Videos'}
                </h3>
                <Badge variant="outline">
                  {currentStep === 'generating_videos' 
                    ? `${generationStats.completed}/${generationStats.total} completed`
                    : 'Merging clips...'
                  }
                </Badge>
              </div>
              
              <Progress value={generationProgress} className="w-full" />
              
              {currentStep === 'generating_videos' && (
                <div className="text-sm text-gray-600 space-y-1">
                  <div>✅ Completed: {generationStats.completed}</div>
                  <div>❌ Failed: {generationStats.failed}</div>
                  <div>⏳ Remaining: {generationStats.total - generationStats.completed - generationStats.failed}</div>
                </div>
              )}
              
              {currentStep === 'merging' && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Merging video clips into final video...
                </div>
              )}
            </div>
          )}

          {/* Video Clips Status */}
          {videoClips.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Generated Video Clips</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {videoClips.map((clip) => (
                  <div key={clip.clipIndex} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Frame {clip.frameIndex + 1}</span>
                      <Badge variant={
                        clip.status === 'completed' ? 'default' :
                        clip.status === 'failed' ? 'destructive' :
                        clip.status === 'generating' ? 'secondary' : 'outline'
                      }>
                        {clip.status}
                      </Badge>
                    </div>
                    
                    {clip.status === 'completed' && clip.videoUrl && (
                      <video 
                        src={clip.videoUrl}
                        className="w-full h-20 object-cover rounded"
                        preload="metadata"
                        muted
                        loop
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()}
                        onError={(e) => {
                          console.error('Error loading video clip preview:', e)
                        }}
                      />
                    )}
                    
                    {clip.status === 'failed' && clip.error && (
                      <div className="text-xs text-red-600 mt-1">
                        {clip.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Video */}
          {currentStep === 'completed' && finalVideoUrl && (
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Video Generated Successfully!
              </h3>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full max-h-80 rounded"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
                
                <div className="flex gap-2 mt-4">
                  <Button onClick={downloadVideo} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Video
                  </Button>
                  <Button onClick={resetGenerator} variant="outline">
                    Generate Another Video
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {currentStep === 'error' && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Generation Failed</span>
              </div>
              <p className="text-sm text-red-700 mb-3">{errorMessage}</p>
              <Button onClick={resetGenerator} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}

export default S3VideoGenerator