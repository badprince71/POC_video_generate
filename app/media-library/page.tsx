"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Video,
  Image as ImageIcon,
  Download,
  Trash2,
  Library,
  Home,
  Grid3X3,
  Calendar,
  Clock,
  FileImage,
  FileVideo,
  Eye,
  Play,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

interface MediaItem {
  id: string
  name: string
  url: string
  size?: number
  created_at?: string
  updated_at?: string
  type: 'image' | 'video'
}

interface SessionData {
  id: number
  session_id: string
  user_id: string
  original_prompt: string
  video_duration: number
  frame_count: number
  style: string
  mood: string
  status: string
  created_at: string
  frames: any[]
  clips: any[]
  finalVideos: any[]
}

export default function MediaLibraryPage() {
  const [images, setImages] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('images')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)

  // Get userId from environment variable (you'll need to set this in your .env.local)
  const userId : string = process.env.USER_ID || 'kylesmith010701';

  const fetchUserMedia = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/get_user_media?userId=${userId}`)
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setImages(result.images || [])
      setVideos(result.videos || [])
      setSessions(result.sessions || [])
    } catch (error) {
      console.error('Error fetching user media:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch media')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserMedia()
  }, [userId])

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const deleteFile = async (item: MediaItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) {
      return
    }

    try {
      // Note: You'll need to implement a delete API endpoint
      console.log('Delete functionality would be implemented here')
      alert('Delete functionality not yet implemented')
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-600" />
            <p className="text-gray-600">Loading your media library...</p>
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
                <Link href="/video-generation" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Video className="h-4 w-4" />
                  Video Generation
                </Link>
                <Link href="/media-library" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
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
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">
                Media Library
              </h2>
              <p className="text-lg text-gray-600">
                Your uploaded images and videos from Supabase storage
              </p>
              <p className="text-sm text-gray-500">
                User ID: {userId}
              </p>
            </div>
            <Button onClick={fetchUserMedia} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>Error: {error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileImage className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{images.length}</p>
                    <p className="text-sm text-gray-600">Total Images</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileVideo className="h-8 w-8 text-green-600" />
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
                  <Grid3X3 className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{sessions.length}</p>
                    <p className="text-sm text-gray-600">Total Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {sessions.length > 0 ? formatDate(sessions[0].created_at) : 'None'}
                    </p>
                    <p className="text-sm text-gray-600">Latest Session</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Media Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="images" className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Images ({images.length})
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <FileVideo className="h-4 w-4" />
                Videos ({videos.length})
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Sessions ({sessions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="images" className="space-y-4">
              {images.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileImage className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No images found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Upload some images to see them here.
                    </p>
                    <Link href="/">
                      <Button>
                        <FileImage className="h-4 w-4 mr-2" />
                        Generate Images
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <Card key={image.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="aspect-square relative group">
                          <Image
                            src={image.url}
                            alt={image.name}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = '/placeholder.svg'
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedItem(image)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadFile(image.url, image.name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteFile(image)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate">{image.name}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{formatFileSize(image.size)}</span>
                            <span>{formatDate(image.created_at)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="videos" className="space-y-4">
              {videos.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileVideo className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No videos found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Generate some videos to see them here.
                    </p>
                    <Link href="/video-generation">
                      <Button>
                        <Video className="h-4 w-4 mr-2" />
                        Generate Videos
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <Card key={video.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="aspect-video relative group">
                          <video
                            src={video.url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => window.open(video.url, '_blank')}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadFile(video.url, video.name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteFile(video)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate">{video.name}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{formatFileSize(video.size)}</span>
                            <span>{formatDate(video.created_at)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="sessions" className="space-y-4">
              {sessions.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Grid3X3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No sessions found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Create some video sessions to see them here.
                    </p>
                    <Link href="/">
                      <Button>
                        <Grid3X3 className="h-4 w-4 mr-2" />
                        Create Session
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <Card key={session.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Session {session.session_id}</CardTitle>
                            <CardDescription>
                              {formatDate(session.created_at)} • {session.frame_count} frames • {session.video_duration}s
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{session.style}</Badge>
                            <Badge variant="outline">{session.mood}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-700 mb-4">{session.original_prompt}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Frames:</span> {session.frames.length}
                          </div>
                          <div>
                            <span className="font-medium">Clips:</span> {session.clips.length}
                          </div>
                          <div>
                            <span className="font-medium">Final Videos:</span> {session.finalVideos.length}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Image/Video Modal */}
          {selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedItem.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(null)}
                  >
                    ×
                  </Button>
                </div>
                <div className="p-4">
                  {selectedItem.type === 'image' ? (
                    <Image
                      src={selectedItem.url}
                      alt={selectedItem.name}
                      width={800}
                      height={600}
                      className="max-w-full h-auto"
                    />
                  ) : (
                    <video
                      src={selectedItem.url}
                      controls
                      className="max-w-full h-auto"
                    />
                  )}
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p><strong>Size:</strong> {formatFileSize(selectedItem.size)}</p>
                    <p><strong>Created:</strong> {formatDate(selectedItem.created_at)}</p>
                    <p><strong>Updated:</strong> {formatDate(selectedItem.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 