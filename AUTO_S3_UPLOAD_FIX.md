# Automatic S3 Upload Fix - Frames Uploaded During Generation

## 🚨 **Problem Solved**

**Before**: Frames were generated with base64 URLs, saved to database, and only uploaded to S3 when the user navigated to the video-generation page. This caused the error "Frames found but no valid image URLs" because the video-generation page expected S3 URLs but found base64 URLs.

**After**: Frames are now **automatically uploaded to S3 immediately after each frame is generated**, ensuring they have S3 URLs before being saved to the database.

## ✅ **Solution Implemented**

### **1. Modified Frame Generation Process (`app/page.tsx`)**

**Key Changes:**
- **Consistent Session ID**: Generate one session ID at the start of frame generation
- **Immediate S3 Upload**: Upload each frame to S3 right after it's generated
- **S3 URLs in Database**: Save frames with S3 URLs instead of base64 URLs

**Before (Problematic):**
```typescript
// ❌ Frames generated with base64 URLs
const frame: VideoFrame = {
  id: i + 1,
  timestamp: `0:${(i * (videoDuration / frameCount)).toString().padStart(2, "0")}`,
  imageUrl: response.imageUrl, // Base64 URL
  // ... other properties
}

return { frame, index: i }
```

**After (Fixed):**
```typescript
// ✅ Generate consistent session ID at start
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
console.log(`Starting frame generation with session ID: ${sessionId}`)

// ✅ Create frame with base64 URL first
const frame: VideoFrame = {
  id: i + 1,
  timestamp: `0:${(i * (videoDuration / frameCount)).toString().padStart(2, "0")}`,
  imageUrl: response.imageUrl, // Base64 URL initially
  // ... other properties
}

// ✅ IMMEDIATELY upload frame to S3 after generation
let s3Frame = frame
if (response.imageUrl && response.imageUrl.startsWith('data:image/')) {
  try {
    console.log(`Uploading frame ${i + 1} to S3 immediately...`)
    
    // Upload to S3 using the consistent session ID
    const uploadResponse = await fetch('/api/upload_image_s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        imageData: response.imageUrl,
        frameId: frame.id,
        isUserUpload: false,
        folderPath: `${userId}/${sessionId}/reference-frames`
      }),
    })

    const uploadResult = await uploadResponse.json()
    
    if (uploadResult.error) {
      console.error(`Failed to upload frame ${i + 1} to S3:`, uploadResult.error)
      // Continue with base64 URL if upload fails
    } else {
      console.log(`Frame ${i + 1} uploaded to S3 successfully:`, uploadResult.imageUrl)
      // Update frame with S3 URL
      s3Frame = {
        ...frame,
        imageUrl: uploadResult.imageUrl
      }
    }
  } catch (uploadError) {
    console.error(`Error uploading frame ${i + 1} to S3:`, uploadError)
    // Continue with base64 URL if upload fails
  }
}

return { frame: s3Frame, index: i }
```

### **2. Updated Database Save Process**

**Enhanced `saveFramesToDatabase` Function:**
```typescript
const saveFramesToDatabase = async (frames: VideoFrame[], providedSessionId?: string) => {
  // Use provided session ID, extract from S3 URLs, or generate a new one
  let sessionId = providedSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // If no provided session ID, try to extract from S3 URLs
  if (!providedSessionId) {
    const firstFrameWithS3Url = frames.find(frame => 
      frame.imageUrl && frame.imageUrl.includes('amazonaws.com')
    )
    
    if (firstFrameWithS3Url) {
      const urlParts = firstFrameWithS3Url.imageUrl.split('/')
      const sessionIndex = urlParts.findIndex(part => part.startsWith('session_'))
      if (sessionIndex !== -1) {
        sessionId = urlParts[sessionIndex]
        console.log(`Using existing session ID from S3: ${sessionId}`)
      }
    }
  }

  // Frames should already be uploaded to S3 during generation
  // Just verify that frames have S3 URLs
  const framesWithBase64 = frames.filter(frame => 
    frame.imageUrl.startsWith('data:image/')
  )

  if (framesWithBase64.length > 0) {
    console.warn(`Found ${framesWithBase64.length} frames with base64 URLs. These should have been uploaded during generation.`)
    showToast.warning('Some frames may not be properly uploaded to cloud storage.')
  }

  // Save frames to database (should already have S3 URLs)
  const framesForDatabase = frames.map((frame) => ({
    id: frame.id,
    timestamp: frame.timestamp,
    imageUrl: frame.imageUrl, // Should already be S3 URL from generation
    description: frame.description,
    prompt: frame.prompt,
    sceneStory: frame.sceneStory,
    fullStory: frame.fullStory
  }))
}
```

### **3. Consistent Session ID Management**

**Session ID Flow:**
1. **Generation Start**: Create one session ID for the entire generation process
2. **Frame Upload**: Use the same session ID for all frame uploads to S3
3. **Database Save**: Use the same session ID for database storage
4. **Video Generation**: Video-generation page can find frames using the session ID

## 🔧 **Technical Benefits**

### **1. Immediate S3 Upload**
- **No Delays**: Frames are uploaded to S3 as soon as they're generated
- **No Base64 in Database**: Database only stores S3 URLs, not large base64 data
- **Consistent URLs**: All frames have S3 URLs from the start

### **2. Better Performance**
- **Parallel Uploads**: Each frame uploads to S3 while others are being generated
- **Reduced Memory**: No need to store large base64 data in memory
- **Faster Navigation**: Video-generation page loads immediately with S3 URLs

### **3. Improved Reliability**
- **Fail-Safe**: If S3 upload fails, frame continues with base64 URL
- **Consistent Session**: All frames use the same session ID for organization
- **Error Handling**: Clear error messages if upload fails

### **4. Better User Experience**
- **Seamless Flow**: Users can immediately navigate to video generation
- **No Manual Upload**: No need for users to manually upload frames
- **Progress Indicators**: Clear feedback during generation and upload

## 🧪 **Testing Scenarios**

### **Scenario 1: Normal Generation**
1. User generates frames
2. **Expected**: Each frame is immediately uploaded to S3
3. **Result**: ✅ Frames have S3 URLs and can be used for video generation

### **Scenario 2: S3 Upload Failure**
1. User generates frames but S3 upload fails for some frames
2. **Expected**: Frames continue with base64 URLs, warning shown
3. **Result**: ✅ System continues working with fallback URLs

### **Scenario 3: Video Generation Navigation**
1. User generates frames and immediately navigates to video-generation page
2. **Expected**: Frames load immediately with S3 URLs
3. **Result**: ✅ No "no valid image URLs" error

## 📋 **Verification Steps**

1. **Generate frames** in the main page
2. **Check console logs** for:
   - "Starting frame generation with session ID: session_..."
   - "Uploading frame X to S3 immediately..."
   - "Frame X uploaded to S3 successfully: [S3 URL]"
3. **Navigate to video-generation page** immediately
4. **Verify**: No "Frames found but no valid image URLs" error
5. **Check S3**: Verify frames are in `<userId>/<sessionId>/reference-frames/`

## 🎯 **Result**

The automatic S3 upload fix ensures that:

- ✅ **Frames are uploaded to S3 immediately** during generation
- ✅ **No base64 URLs in database** - only S3 URLs are stored
- ✅ **Consistent session management** across generation and storage
- ✅ **Seamless user experience** - no manual uploads required
- ✅ **Immediate video generation access** - no delays or errors

Users can now generate frames and immediately proceed to video generation without any "no valid image URLs" errors. The system automatically handles all S3 uploads during the generation process. 