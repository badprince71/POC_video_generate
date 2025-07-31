# S3 Video Generation System

Complete guide for generating videos from uploaded frames stored in S3.

## Overview

This system allows you to:
1. **Upload frames to S3** using the existing upload system
2. **Generate video clips** from each frame using RunwayML Gen-4
3. **Merge video clips** into a final video using client-side processing

## Architecture

```
Frames in S3 → Video Generation → Video Clips in S3 → Client-side Merge → Final Video
```

## Quick Start

### 1. Check Available Frames

```typescript
// GET request to see what frames are available
const response = await fetch('/api/process_s3_video_workflow?action=list_frames&userId=YOUR_USER_ID')
const result = await response.json()

console.log(`Found ${result.totalFrames} frames:`, result.frames)
```

### 2. Generate Video Clips from Frames

```typescript
// POST request to generate videos from all uploaded frames
const response = await fetch('/api/process_s3_video_workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'YOUR_USER_ID',
    action: 'generate_videos',
    sessionId: 'my_video_session_1', // optional
    frameAspectRatio: '1280:720',    // optional
    prompt: 'Smooth cinematic motion with natural lighting', // optional
    batchSize: 3 // optional - number of videos to generate simultaneously
  })
})

const result = await response.json()

if (result.success) {
  console.log(`Generated ${result.data.completedCount} video clips`)
  console.log('Video URLs:', result.data.generatedVideoUrls)
} else {
  console.error('Video generation failed:', result.error)
}
```

### 3. Merge Video Clips into Final Video

```typescript
// Prepare for merging (get instructions for client-side merge)
const mergeResponse = await fetch('/api/process_s3_video_workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'YOUR_USER_ID',
    action: 'prepare_merge',
    sessionId: 'my_video_session_1',
    videoClipUrls: result.data.generatedVideoUrls // from step 2
  })
})

const mergeResult = await mergeResponse.json()

// For single video, it's automatically uploaded
if (mergeResult.data.mergedVideoUrl) {
  console.log('Final video ready:', mergeResult.data.mergedVideoUrl)
} else {
  // For multiple videos, use client-side merging
  console.log('Use client-side merging with instructions:', mergeResult.data.instructions)
}
```

## Client-side Video Merging

For multiple video clips, use the browser-based VideoMerger:

```typescript
import { VideoMerger } from '@/lib/utils/video-merge'
import { uploadMovieToStorage } from '@/lib/generate_video_clips/generate_clips'

async function mergeVideosClientSide(videoUrls: string[], userId: string, sessionId: string) {
  try {
    console.log(`🎬 Merging ${videoUrls.length} videos...`)
    
    // Create merger instance
    const merger = new VideoMerger()
    
    // Merge videos
    const mergedVideo = await merger.mergeVideos(videoUrls, {
      outputFormat: 'webm', // or 'mp4' if supported by browser
      quality: 0.8,
      frameRate: 30
    })
    
    console.log(`✅ Videos merged! Duration: ${mergedVideo.duration}s, Size: ${mergedVideo.size} bytes`)
    
    // Upload merged video to S3
    const uploadResult = await uploadMovieToStorage({
      videoUrl: mergedVideo.url, // blob URL
      userId: userId,
      filename: `final_video_${sessionId}`,
      duration: mergedVideo.duration
    })
    
    // Clean up blob URLs
    merger.cleanup()
    URL.revokeObjectURL(mergedVideo.url)
    
    console.log(`🎯 Final video uploaded: ${uploadResult.publicUrl}`)
    return uploadResult.publicUrl
    
  } catch (error) {
    console.error('❌ Video merge failed:', error)
    throw error
  }
}

// Usage
const finalVideoUrl = await mergeVideosClientSide(
  result.data.generatedVideoUrls,
  'YOUR_USER_ID',
  'my_video_session_1'
)
```

## Complete Workflow Example

```typescript
async function generateVideoFromS3Frames(userId: string) {
  try {
    // Step 1: Check available frames
    console.log('📸 Checking available frames...')
    const framesResponse = await fetch(`/api/process_s3_video_workflow?action=list_frames&userId=${userId}`)
    const framesResult = await framesResponse.json()
    
    if (framesResult.totalFrames === 0) {
      throw new Error('No frames found. Upload frames to S3 first.')
    }
    
    console.log(`Found ${framesResult.totalFrames} frames`)
    
    // Step 2: Generate video clips
    console.log('🎥 Generating video clips...')
    const videoResponse = await fetch('/api/process_s3_video_workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        action: 'generate_videos',
        frameAspectRatio: '1280:720',
        prompt: 'Cinematic smooth transition with natural movement',
        batchSize: 3 // Adjust based on API rate limits
      })
    })
    
    const videoResult = await videoResponse.json()
    
    if (!videoResult.success) {
      throw new Error(`Video generation failed: ${videoResult.error}`)
    }
    
    console.log(`✅ Generated ${videoResult.data.completedCount}/${videoResult.data.totalFrames} video clips`)
    
    const videoUrls = videoResult.data.generatedVideoUrls
    if (videoUrls.length === 0) {
      throw new Error('No videos were generated successfully')
    }
    
    // Step 3: Merge videos
    console.log('🎬 Merging video clips...')
    const mergeResponse = await fetch('/api/process_s3_video_workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        action: 'prepare_merge',
        videoClipUrls: videoUrls
      })
    })
    
    const mergeResult = await mergeResponse.json()
    
    if (mergeResult.data.mergedVideoUrl) {
      // Single video - already uploaded
      console.log('🎯 Final video ready:', mergeResult.data.mergedVideoUrl)
      return mergeResult.data.mergedVideoUrl
    } else {
      // Multiple videos - use client-side merge
      const finalVideoUrl = await mergeVideosClientSide(videoUrls, userId, videoResult.data.sessionId)
      console.log('🎯 Final video ready:', finalVideoUrl)
      return finalVideoUrl
    }
    
  } catch (error) {
    console.error('❌ Complete workflow failed:', error)
    throw error
  }
}

// Usage
generateVideoFromS3Frames('YOUR_USER_ID')
  .then(finalVideoUrl => {
    console.log('🎉 Video generation complete!', finalVideoUrl)
  })
  .catch(error => {
    console.error('💥 Video generation failed:', error)
  })
```

## API Endpoints

### `/api/process_s3_video_workflow` (POST)

Main workflow endpoint that handles all video generation actions.

**Actions:**

1. **`list_frames`** - List uploaded frames
2. **`generate_videos`** - Generate video clips from frames  
3. **`prepare_merge`** - Prepare video clips for merging

### Request Examples

```typescript
// List frames
{
  "userId": "user123",
  "action": "list_frames"
}

// Generate videos
{
  "userId": "user123", 
  "action": "generate_videos",
  "sessionId": "optional_session_id",
  "frameAspectRatio": "1280:720",
  "prompt": "Smooth cinematic motion",
  "batchSize": 3
}

// Prepare merge
{
  "userId": "user123",
  "action": "prepare_merge", 
  "videoClipUrls": ["url1", "url2", "url3"]
}
```

## Configuration Options

### Frame Aspect Ratios (RunwayML Gen-4 supported)
- `1280:720` (16:9 landscape)
- `720:1280` (9:16 portrait) 
- `1104:832` (4:3 landscape)
- `832:1104` (3:4 portrait)
- `960:960` (1:1 square)
- `1584:672` (21:9 ultrawide)
- `1280:768` (5:3 landscape)
- `768:1280` (3:5 portrait)

### Video Generation Options
- **Batch Size**: 1-5 (recommended: 3 for balance of speed and API limits)
- **Max Retries**: 0-3 (default: 2)
- **Prompt**: Custom text description for video generation

### Video Output
- **Clip Duration**: 5 seconds per frame (fixed by RunwayML)
- **Output Format**: WebM (client-side merge) or MP4 (server upload)
- **Quality**: Configurable for client-side merge (0.1 - 1.0)

## Error Handling

The system includes comprehensive error handling:

- **Frame retrieval errors**: Missing S3 permissions, empty folders
- **Video generation errors**: API failures, rate limits, invalid frames
- **Upload errors**: S3 upload failures, network issues
- **Merge errors**: Browser compatibility, memory issues

Each step provides detailed error messages and retry mechanisms where appropriate.

## Performance Considerations

- **Batch Processing**: Videos are generated in batches to respect API rate limits
- **Retry Logic**: Failed videos are automatically retried with exponential backoff
- **Memory Management**: Client-side merging includes cleanup of blob URLs
- **Rate Limiting**: 15-second delays between batches to avoid API throttling

## Storage Structure

```
S3 Bucket:
├── reference-frames/
│   └── {userId}/
│       ├── frame_01_timestamp.png
│       ├── frame_02_timestamp.png
│       └── ...
├── video-clips/
│   └── {userId}/
│       ├── frame_01_video_clip.mp4
│       ├── frame_02_video_clip.mp4
│       └── ...
└── video-clips/
    └── {userId}/
        └── final_video_session_id.mp4
```

## Next Steps

1. **Upload your frames** to S3 using the existing upload system
2. **Call the workflow API** with your user ID to generate videos
3. **Use the client-side merge** for multiple clips or get the direct URL for single videos
4. **Store the final video URL** in your database for future reference

The system is designed to work seamlessly with your existing S3 infrastructure and RunwayML integration.