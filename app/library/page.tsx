"use client"

import type React from "react"
import Link from "next/link"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Video,
  Play,
  Download,
  Trash2,
  Library,
  Home,
  Grid3X3,
  Calendar,
  Clock,
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
  videoClips?: string[]
  createdAt: string
  style: string
  mood: string
}

export default function LibraryPage() {
  const [videos, setVideos] = useState<GeneratedVideo[]>([
    // Sample data - in a real app, this would come from a database
    {
      id: "1",
      title: "Birthday Celebration Video",
      duration: "30s",
      prompt: "Create a birthday invitation video where I'm celebrating with confetti and balloons in a party setting",
      frames: [],
      videoUrl: "/placeholder-video.mp4",
      createdAt: "2024-01-15T10:30:00Z",
      style: "Realistic",
      mood: "Vibrant"
    },
    {
      id: "2", 
      title: "Professional Introduction",
      duration: "20s",
      prompt: "Create a professional introduction video for my LinkedIn profile",
      frames: [],
      videoUrl: "/placeholder-video.mp4",
      createdAt: "2024-01-14T14:20:00Z",
      style: "Photographic",
      mood: "Calm"
    }
  ])
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const deleteVideo = (videoId: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      setVideos(videos.filter(video => video.id !== videoId))
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
                <Link href="/video-generation" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Video className="h-4 w-4" />
                  Video Generation
                </Link>
                <Link href="/library" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
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
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">
                My Library
              </h2>
              <p className="text-lg text-gray-600">
                Your generated videos and frames
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <Library className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Video className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{videos.length}</p>
                    <p className="text-sm text-gray-600">Total Videos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {videos.reduce((total, video) => total + parseInt(video.duration), 0)}s
                    </p>
                    <p className="text-sm text-gray-600">Total Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Grid3X3 className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {videos.reduce((total, video) => total + video.frames.length, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Total Frames</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {new Set(videos.map(v => new Date(v.createdAt).toDateString())).size}
                    </p>
                    <p className="text-sm text-gray-600">Days Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Videos Grid/List */}
          {videos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Library className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No videos yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Start by generating your first video in the Frame Generation page.
                </p>
                <Link href="/">
                  <Button>
                    <Video className="h-4 w-4 mr-2" />
                    Create Your First Video
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {videos.map((video) => (
                <Card 
                  key={video.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${selectedVideo?.id === video.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedVideo(video)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{video.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {video.duration} • {formatDate(video.createdAt)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteVideo(video.id)
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Video Thumbnail */}
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <Video className="h-8 w-8 mx-auto text-gray-400" />
                        <p className="text-xs text-gray-500">Video Preview</p>
                      </div>
                    </div>

                    {/* Video Details */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {video.prompt}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {video.style}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {video.mood}
                        </Badge>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(video.videoUrl, '_blank')
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Play
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Download functionality would go here
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Selected Video Details */}
          {selectedVideo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Video Details
                </CardTitle>
                <CardDescription>
                  Detailed information about &quot;{selectedVideo.title}&quot;
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Video Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Title:</span>
                          <span className="font-medium">{selectedVideo.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">{selectedVideo.duration}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Created:</span>
                          <span className="font-medium">{formatDate(selectedVideo.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Style:</span>
                          <Badge variant="outline" className="text-xs">{selectedVideo.style}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Mood:</span>
                          <Badge variant="outline" className="text-xs">{selectedVideo.mood}</Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Original Prompt</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {selectedVideo.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Video Preview</h4>
                      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Video className="h-12 w-12 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">Video Player</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(selectedVideo.videoUrl, '_blank')}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Play Video
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download MP4
                      </Button>
                      <Button variant="outline">
                        <Grid3X3 className="h-4 w-4 mr-2" />
                        View Frames
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 