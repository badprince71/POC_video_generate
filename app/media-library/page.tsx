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
  downloadUrl?: string
  size?: number
  created_at?: string
  updated_at?: string
  type: 'image' | 'video'
  folder?: 'reference-frames' | 'user-uploads' | 'video-clips'
  key: string
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
  const [loading, setLoading] = useState(true)
  const [groupBySession, setGroupBySession] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('images')
  const [organizationMode, setOrganizationMode] = useState<'type' | 'folder'>('type')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewModalItem, setViewModalItem] = useState<MediaItem | null>(null)

  // Get userId from environment variable (you'll need to set this in your .env.local)
  const userId : string = process.env.USER_ID || 'user';

  // Group media by folder
  const groupedByFolder = {
    'reference-frames': [...images, ...videos].filter(item => item.folder === 'reference-frames'),
    'user-uploads': [...images, ...videos].filter(item => item.folder === 'user-uploads'),
    'video-clips': [...images, ...videos].filter(item => item.folder === 'video-clips'),
  }

  const fetchUserMedia = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/get_user_media?userId=${userId}&includeStats=true`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch media')
      }

      setImages(result.images || [])
      setVideos(result.videos || [])
      // Note: Sessions are no longer fetched from Supabase, but you could integrate with a database if needed
      setSessions([])
      
      console.log('Media fetched:', {
        images: result.images?.length || 0,
        videos: result.videos?.length || 0,
        total: result.count?.total || 0
      })
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

  const downloadFile = async (item: MediaItem) => {
    try {
      // Use the downloadUrl if available, otherwise generate a new one
      let downloadUrl = item.downloadUrl
      
      if (!downloadUrl) {
        const response = await fetch(`/api/get_presigned_url?key=${encodeURIComponent(item.key)}&download=true`)
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to generate download URL')
        }
        
        downloadUrl = result.url
      }

      // Create download link
      const link = document.createElement('a')
      link.href = downloadUrl || ''
      link.download = item.name
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log(`Downloaded: ${item.name}`)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert(`Failed to download ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const deleteFile = async (item: MediaItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      setLoading(true)
      
      const response = await fetch(`/api/delete_media?key=${encodeURIComponent(item.key)}&userId=${userId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete file')
      }
      
      // Remove the item from the local state
      if (item.type === 'image') {
        setImages(prev => prev.filter(img => img.id !== item.id))
      } else {
        setVideos(prev => prev.filter(vid => vid.id !== item.id))
      }
      
      // Show success message
      alert(`Successfully deleted ${item.name}`)
      console.log(`Deleted: ${item.name}`)
      
    } catch (error) {
      console.error('Error deleting file:', error)
      alert(`Failed to delete ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const viewFullResolution = async (item: MediaItem) => {
    try {
      // Generate a fresh presigned URL for viewing
      let viewUrl = item.url
      
      if (!viewUrl) {
        const response = await fetch(`/api/get_presigned_url?key=${encodeURIComponent(item.key)}&download=false`)
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to generate view URL')
        }
        
        viewUrl = result.url
      }

      // Set the item with the URL for the modal
      setViewModalItem({ ...item, url: viewUrl })
      setViewModalOpen(true)
      
    } catch (error) {
      console.error('Error opening full resolution view:', error)
      alert(`Failed to open ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const refreshMedia = () => {
    fetchUserMedia()
  }

  // Helper function to extract request ID from S3 key
  const extractRequestId = (key: string): string | null => {
    // New structure: <userId>/<requestId>/<folder>/filename
    const parts = key.split('/')
    if (parts.length >= 3) {
      return parts[1] // requestId is the second part
    }
    return null
  }

  // Helper function to get folder display name
  const getFolderDisplayName = (key: string, folder: string): string => {
    const requestId = extractRequestId(key)
    if (requestId) {
      return `${folder.replace('-', ' ')} (${requestId.substring(0, 8)}...)`
    }
    return folder.replace('-', ' ')
  }

  // Helper function to get folder tooltip
  const getFolderTooltip = (key: string, folder: string): string => {
    const requestId = extractRequestId(key)
    if (requestId) {
      return `Session: ${requestId}\nFolder: ${folder.replace('-', ' ')}`
    }
    return `Folder: ${folder.replace('-', ' ')}`
  }

  // Helper function to get all unique sessions from media items
  const getAvailableSessions = (): { requestId: string; count: number; lastModified: Date }[] => {
    const sessionMap = new Map<string, { count: number; lastModified: Date }>()
    
    const allItems = [...images, ...videos]
    allItems.forEach(item => {
      const requestId = extractRequestId(item.key)
      if (requestId) {
        const existing = sessionMap.get(requestId)
        const itemDate = new Date(item.created_at || '')
        
        if (existing) {
          existing.count++
          if (itemDate > existing.lastModified) {
            existing.lastModified = itemDate
          }
        } else {
          sessionMap.set(requestId, { count: 1, lastModified: itemDate })
        }
      }
    })
    
    return Array.from(sessionMap.entries())
      .map(([requestId, data]) => ({ requestId, ...data }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  // Helper function to filter media by session
  const getFilteredMedia = (): { images: MediaItem[]; videos: MediaItem[] } => {
    if (!selectedSession) {
      return { images, videos }
    }
    
    const filterBySession = (item: MediaItem) => {
      const requestId = extractRequestId(item.key)
      return requestId === selectedSession
    }
    
    return {
      images: images.filter(filterBySession),
      videos: videos.filter(filterBySession)
    }
  }

  // Enhanced Media Card Component
  const MediaCard = ({ item }: { item: MediaItem }) => (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="relative aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden">
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
              onClick={() => viewFullResolution(item)}
              onError={(e) => {
                console.error(`Failed to load image: ${item.name}`, {
                  url: item.url,
                  key: item.key,
                  error: e
                })
                e.currentTarget.src = '/placeholder-image.svg'
                // Try generating a fresh presigned URL
                fetch(`/api/get_presigned_url?key=${encodeURIComponent(item.key)}`)
                  .then(res => res.json())
                  .then(data => {
                    if (data.success && data.url !== item.url) {
                      console.log(`Trying fresh URL for ${item.name}:`, data.url)
                      e.currentTarget.src = data.url
                    }
                  })
                  .catch(err => console.error('Failed to get fresh presigned URL:', err))
              }}
              onLoad={() => {
                console.log(`Successfully loaded image: ${item.name}`)
              }}
            />
          ) : (
            <div className="relative w-full h-full cursor-pointer group-hover:scale-105 transition-transform duration-200">
              <video
                src={item.url}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
                onClick={() => viewFullResolution(item)}
                onError={(e) => {
                  // Hide video and show fallback if video fails to load
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              {/* Fallback div - hidden by default, shown if video fails */}
              <div 
                className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 transition-colors"
                style={{ display: 'none' }}
                onClick={() => viewFullResolution(item)}
              >
                <div className="text-center">
                  <Play className="h-12 w-12 mx-auto text-blue-600 mb-2" />
                  <p className="text-sm text-gray-600">Click to play</p>
                </div>
              </div>
              {/* Play overlay icon */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200">
                <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </div>
          )}
          
          {/* Folder Badge */}
          {item.folder && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-xs"
              title={getFolderTooltip(item.key, item.folder)}
            >
              {getFolderDisplayName(item.key, item.folder)}
            </Badge>
          )}
          
          {/* Type Badge */}
          <Badge 
            variant={item.type === 'image' ? 'default' : 'outline'}
            className="absolute top-2 right-2 text-xs"
          >
            {item.type === 'image' ? (
              <><FileImage className="w-3 h-3 mr-1" /> IMG</>
            ) : (
              <><FileVideo className="w-3 h-3 mr-1" /> VID</>
            )}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-gray-900 truncate" title={item.name}>
            {item.name}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatFileSize(item.size)}</span>
            <span>{formatDate(item.created_at)}</span>
          </div>
          
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => viewFullResolution(item)}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => downloadFile(item)}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={() => deleteFile(item)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

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
                <Link href="/debug-s3" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <AlertCircle className="h-4 w-4" />
                  Debug S3
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
                Your uploaded images and videos from S3 storage
              </p>
              {/* <p className="text-sm text-gray-500">
                User ID: {userId}
              </p> */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {/* <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Grid3X3 className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{sessions.length}</p>
                    <p className="text-sm text-gray-600">Total Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card> */}
            {/* <Card>
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
            </Card> */}
          </div>

          {/* Media Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            {/* Session Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="groupBySession"
                    checked={groupBySession}
                    onChange={(e) => setGroupBySession(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="groupBySession" className="text-sm font-medium text-gray-700">
                    Group by Session
                  </label>
                </div>
                
                {groupBySession && (
                  <select
                    value={selectedSession || ''}
                    onChange={(e) => setSelectedSession(e.target.value || null)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Sessions</option>
                    {getAvailableSessions().map((session) => (
                      <option key={session.requestId} value={session.requestId}>
                        {session.requestId.substring(0, 8)}... ({session.count} items)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                {groupBySession && selectedSession ? (
                  <span>Showing session: {selectedSession.substring(0, 8)}...</span>
                ) : (
                  <span>Showing all media</span>
                )}
              </div>
            </div>

            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="images" className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Images ({images.length})
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <FileVideo className="h-4 w-4" />
                Videos ({videos.length})
              </TabsTrigger>
              {/* <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Sessions ({sessions.length})
              </TabsTrigger> */}
            </TabsList>

            <TabsContent value="images" className="space-y-4">
              {(() => {
                const { images: filteredImages } = getFilteredMedia()
                return filteredImages.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileImage className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No images found
                      </h3>
                      <p className="text-gray-600 mb-6">
                        {selectedSession ? 'No images found for this session.' : 'Upload some images to see them here.'}
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
                    {filteredImages.map((image) => (
                      <MediaCard key={image.id} item={image} />
                    ))}
                  </div>
                )
              })()}
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
                          <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
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
                                onClick={() => downloadFile(video)}
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
            {/* <TabsContent value="sessions" className="space-y-4">
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
            </TabsContent> */}
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

      {/* Full Resolution View Modal */}
      {viewModalOpen && viewModalItem && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setViewModalOpen(false)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setViewModalOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {viewModalItem.type === 'image' ? (
              <img
                src={viewModalItem.url}
                alt={viewModalItem.name}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={viewModalItem.url}
                controls
                className="max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              >
                Your browser does not support the video tag.
              </video>
            )}
            
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded">
              <h3 className="font-semibold">{viewModalItem.name}</h3>
              <p className="text-sm text-gray-300">
                {viewModalItem.folder && (
                  <span className="mr-4">Folder: {viewModalItem.folder}</span>
                )}
                {viewModalItem.size && (
                  <span className="mr-4">Size: {formatFileSize(viewModalItem.size)}</span>
                )}
                {viewModalItem.created_at && (
                  <span>Created: {formatDate(viewModalItem.created_at)}</span>
                )}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadFile(viewModalItem)
                  }}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewModalOpen(false)
                    deleteFile(viewModalItem)
                  }}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 