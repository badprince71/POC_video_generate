# Database Integration with Supabase

## 🎯 **Overview**

This implementation uses Supabase to store generated images and frame metadata in a database, solving the localStorage quota issue and providing persistent storage for the AI Video Generator.

## 🏗️ **Architecture**

### **Storage Flow**
```
1. Frame Generation → 2. Image Upload to Supabase Storage → 3. Metadata Save to Database → 4. Video Generation from Database
```

### **Database Schema**
- **video_sessions**: Store session metadata
- **video_frames**: Store individual frame data with Supabase image URLs
- **video_clips**: Store generated video clip information
- **final_videos**: Store merged final video information

## 🛠️ **Setup Instructions**

### **1. Supabase Configuration**

#### **Environment Variables**
Add to your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

#### **Supabase Client Setup**
Create `utils/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### **2. Database Setup**

#### **Run the Schema**
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the `database_schema.sql` file

#### **Storage Bucket Setup**
1. Go to Storage in Supabase dashboard
2. Create a new bucket called `videomaker`
3. Set bucket to public
4. Configure RLS policies as needed

## 📊 **Database Tables**

### **video_sessions**
```sql
CREATE TABLE video_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    original_prompt TEXT NOT NULL,
    video_duration INTEGER NOT NULL,
    frame_count INTEGER NOT NULL,
    style VARCHAR(100) NOT NULL,
    mood VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'frames_generated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **video_frames**
```sql
CREATE TABLE video_frames (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    frame_number INTEGER NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scene_story TEXT,
    story_title VARCHAR(255),
    story_overview TEXT,
    style VARCHAR(100),
    mood VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id) ON DELETE CASCADE
);
```

## 🔄 **API Endpoints**

### **1. Upload Image** (`/api/upload_image`)
```typescript
POST /api/upload_image
{
  "imageData": "base64_image_data",
  "frameId": 1
}

Response:
{
  "imageUrl": "https://supabase.co/storage/v1/object/public/videomaker/user_123/frames/frame_1_123456.png",
  "frameId": 1,
  "userId": "user_123",
  "success": true
}
```

### **2. Save Frames** (`/api/save_frames`)
```typescript
POST /api/save_frames
{
  "frames": [...],
  "userId": "user_123",
  "sessionId": "session_456",
  "originalPrompt": "A person walking in a park",
  "videoDuration": 30,
  "frameCount": 6,
  "style": "Realistic",
  "mood": "Vibrant"
}
```

### **3. Get Frames** (`/api/get_frames`)
```typescript
GET /api/get_frames?sessionId=session_456&userId=user_123

Response:
{
  "session": {...},
  "frames": [...],
  "success": true
}
```

## 🚀 **Implementation Details**

### **Frame Generation Process**
```typescript
// 1. Generate frames with base64 images
const frames = await generateFrames()

// 2. Upload images to Supabase Storage
const framesWithUrls = await Promise.all(
  frames.map(async (frame) => {
    const { imageUrl, userId } = await uploadImageToCloud(frame.imageUrl, frame.id)
    return { ...frame, imageUrl, userId }
  })
)

// 3. Save to database
const { sessionId, userId } = await saveFramesToDatabase(framesWithUrls)

// 4. Store session info locally
localStorage.setItem('currentSession', JSON.stringify({ sessionId, userId }))
```

### **Video Generation Process**
```typescript
// 1. Load session info
const { sessionId, userId } = JSON.parse(localStorage.getItem('currentSession'))

// 2. Fetch frames from database
const response = await fetch(`/api/get_frames?sessionId=${sessionId}&userId=${userId}`)
const { frames } = await response.json()

// 3. Generate video clips using database images
const clips = await generateVideoClips(frames)
```

## 🎯 **Benefits**

### **For Users**
- ✅ **No Storage Limits**: Images stored in cloud, not browser
- ✅ **Persistent Data**: Frames available across sessions
- ✅ **Better Performance**: Faster page loads
- ✅ **Reliable**: No more quota errors

### **For Developers**
- ✅ **Scalable**: Handles unlimited frames
- ✅ **Organized**: Structured database schema
- ✅ **Trackable**: Session and frame history
- ✅ **Extensible**: Easy to add features

## 🔧 **Error Handling**

### **Upload Failures**
```typescript
try {
  const { imageUrl, userId } = await uploadImageToCloud(imageData, frameId)
} catch (error) {
  console.error('Upload failed:', error)
  // Fallback: use data URL temporarily
  return imageData
}
```

### **Database Errors**
```typescript
try {
  const { sessionId, userId } = await saveFramesToDatabase(frames)
} catch (error) {
  console.error('Database save failed:', error)
  alert('Failed to save frames. Please try again.')
}
```

## 📈 **Performance Optimizations**

### **Image Optimization**
- **Compression**: Consider compressing images before upload
- **Format**: Use WebP for smaller file sizes
- **Resolution**: Optimize resolution for video generation

### **Database Optimization**
- **Indexes**: Created on frequently queried columns
- **Pagination**: For large frame sets
- **Caching**: Consider Redis for frequently accessed data

## 🔒 **Security Considerations**

### **Row Level Security (RLS)**
```sql
-- Example RLS policy for user-specific data
CREATE POLICY "Users can only access their own sessions" ON video_sessions
    FOR ALL USING (auth.uid()::text = user_id);
```

### **Storage Security**
- **Bucket Policies**: Configure Supabase Storage policies
- **File Validation**: Validate uploaded file types
- **Size Limits**: Set maximum file size limits

## 🚀 **Production Deployment**

### **Environment Setup**
1. **Supabase Project**: Create production project
2. **Environment Variables**: Set production credentials
3. **Database Migration**: Run schema in production
4. **Storage Bucket**: Configure production bucket

### **Monitoring**
- **Error Tracking**: Monitor upload and database errors
- **Performance**: Track upload times and database queries
- **Usage**: Monitor storage usage and costs

## 📝 **Future Enhancements**

### **Planned Features**
- **User Authentication**: Integrate with Supabase Auth
- **Video History**: Store and retrieve past videos
- **Sharing**: Share videos via generated links
- **Analytics**: Track usage and performance metrics

### **Advanced Features**
- **Batch Processing**: Process multiple sessions
- **Video Templates**: Pre-defined video styles
- **Collaboration**: Multi-user video projects
- **API Access**: External API for integrations

---

**Result**: Complete database integration with Supabase providing persistent, scalable storage for the AI Video Generator! 🎉 