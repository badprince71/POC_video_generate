# AI Video Generator

A comprehensive Next.js application that generates personalized animated videos from user prompts and images using AI. The system combines OpenAI's image generation, RunwayML's video generation, and AWS S3 storage to create a complete video production pipeline.

## 🏗️ Project Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │◄──►│   Supabase DB   │◄──►│   AWS S3        │
│  (Frontend/API) │    │   (PostgreSQL)  │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAI API    │    │   RunwayML API  │    │ Authentication  │
│ (Image Gen)     │    │ (Video Gen)     │    │    System       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Interactions

1. **Frontend (Next.js App Router)**
   - React components for user interface
   - Client-side video merging and processing
   - Authentication and user management
   - Media library and session management

2. **Backend API Routes**
   - Protected API endpoints with key authentication
   - Integration with external AI services
   - Database operations and media management
   - S3 storage operations with signed URLs

3. **Database (Supabase PostgreSQL)**
   - User sessions and video metadata
   - Frame and clip tracking
   - Authentication and user management

4. **Storage (AWS S3)**
   - Organized folder structure for media assets
   - Signed URLs for secure access
   - Chunked uploads for large files

5. **External Services**
   - **OpenAI**: Image generation and editing 
   - **RunwayML**: Video clip generation from images
   - **Supabase Auth**: User authentication and session management

## 📁 Codebase Structure

```
/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Admin endpoints
│   │   │   └── api-keys/         # API key management
│   │   ├── public/               # Public API endpoints
│   │   │   ├── generate-images/  # Public image generation
│   │   │   ├── generate-video/   # Public video generation
│   │   │   └── upload-image/     # Public image upload
│   │   ├── generate_single_image/# Single frame generation
│   │   ├── generate_single_video_clip/ # Single clip generation
│   │   ├── generate_story/       # AI story generation
│   │   ├── merge_video_clips/    # Video merging
│   │   ├── proxy_s3_*/          # S3 media proxying
│   │   └── upload_*/            # Various upload endpoints
│   ├── auth/                    # Authentication pages
│   ├── video-generation/        # Main video generation UI
│   ├── media-library/          # Media management UI
│   └── layout.tsx              # App layout and providers
├── components/                  # React Components
│   ├── ui/                     # Reusable UI components
│   ├── S3VideoGenerator.tsx    # Main video generation component
│   ├── UserMenu.tsx           # User authentication menu
│   └── ProtectedRoute.tsx     # Route protection wrapper
├── lib/                        # Utility Libraries
│   ├── auth/                   # Authentication utilities
│   │   ├── api-key-auth.ts    # API key validation
│   │   ├── api-keys-config.ts # API key configuration
│   │   └── jwt-auth.ts        # JWT token handling
│   ├── services/              # Service integrations
│   │   ├── s3-media-service.ts # S3 operations
│   │   └── s3-video-generation.ts # Video workflow
│   ├── upload/                # Upload utilities
│   │   ├── s3_config.ts       # S3 configuration
│   │   ├── s3_upload.ts       # S3 upload functions
│   │   └── video_upload.ts    # Video-specific uploads
│   └── utils/                 # General utilities
│       ├── video-merge.ts     # Client-side video merging
│       ├── video-utils.ts     # Video processing utilities
│       └── aspect.ts          # Aspect ratio handling
├── scripts/                   # Utility scripts
│   ├── generate-api-key.js    # API key generation
│   └── setup-s3-cors.*       # S3 CORS configuration
└── middleware.ts              # Next.js middleware for auth
```

### TypeScript Configuration

- **Strict Mode**: Enabled for type safety
- **Path Aliases**: `@/*` maps to project root
- **Target**: ES2017 for modern browser support
- **Module Resolution**: Bundler mode for Next.js compatibility

### Linting and Code Standards

- **ESLint**: Next.js configuration with strict rules
- **Build Settings**: TypeScript and ESLint errors ignored during builds for development flexibility
- **Image Optimization**: Disabled for compatibility with external image sources

## Features

- **Frame Generation**: AI-powered image generation with style/mood prompts using OpenAI
- **Video Generation**: Convert frames to video clips using RunwayML Gen-4
- **Story Generation**: AI-generated story narratives with scene breakdowns
- **Configurable Aspect Ratios**: Support for multiple video aspect ratios
- **Client-side Merging**: Browser-based video concatenation with aspect-fit rendering
- **S3 Storage**: Organized cloud storage with chunked uploads for large files
- **Authentication**: API key-based authentication with rate limiting
- **Media Library**: Comprehensive media management and organization

## Prerequisites

- **Node.js 18+** with npm
- **Next.js 14+** (App Router)
- **Required API Keys:**
  - OpenAI API key (for image generation)
  - RunwayML API key (for video generation)
- **Database**: Supabase PostgreSQL instance
- **Storage**: AWS S3 bucket with proper permissions

## 🗄️ Database Schema

### Tables Overview

The system uses Supabase PostgreSQL with the following schema:

#### `video_sessions`
Tracks video generation sessions and metadata.

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

#### `video_frames`
Individual frame data and generation prompts.

```sql
CREATE TABLE video_frames (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    frame_number INTEGER NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scene_story TEXT,
    story_title VARCHAR(255),
    story_overview TEXT,
    style VARCHAR(100),
    mood VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id)
);
```

#### `video_clips`
Generated video clips from frames.

```sql
CREATE TABLE video_clips (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    clip_number INTEGER NOT NULL,
    start_frame INTEGER NOT NULL,
    end_frame INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    optimized_prompt TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id)
);
```

#### `final_videos`
Final merged video outputs.

```sql
CREATE TABLE final_videos (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    video_url TEXT NOT NULL,
    total_clips INTEGER NOT NULL,
    duration VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id)
);
```

### Relationships

- Sessions contain multiple frames (1:many)
- Sessions contain multiple clips (1:many)
- Sessions have one final video (1:1)
- All foreign keys cascade on delete

### Indexes

Performance-optimized indexes on:
- `user_id` and `session_id` in sessions
- `session_id` and `frame_number` in frames
- `session_id` in clips and final videos

## 🔐 Authentication & Security

### API Key Authentication

The system uses a dual-layer authentication approach:

#### 1. Encrypted API Keys
Generated from environment variables (`SECRET_KEY` + `USER_ID`):
```typescript
// High-privilege access with elevated rate limits
const encryptedKey = generateEncryptedApiKey()
// Rate limits: 200/minute, 10,000/hour
```

#### 2. Configured API Keys
Stored in `lib/auth/api-keys-config.ts`:
```typescript
export const API_KEYS: Record<string, ApiKeyConfig> = {
  'sk-test-1234567890abcdef': {
    name: 'Test API Key',
    rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
    allowedEndpoints: ['*'],
    isActive: true
  }
}
```

### Authentication Flow

1. **Request Headers**: API key in `Authorization: Bearer <key>` or `X-API-Key` header
2. **Middleware Validation**: `middleware.ts` validates keys for protected routes
3. **Rate Limiting**: In-memory rate limiting (Redis recommended for production)
4. **Endpoint Protection**: `withApiKeyAuth()` wrapper for API routes

### Security Headers

```typescript
// Example API request
headers: {
  'Authorization': 'Bearer your-api-key',
  'X-User-ID': 'optional-user-override',
  'X-Request-ID': 'optional-request-override'
}
```

### Storage Security

- **S3 Signed URLs**: Time-limited access to private objects
- **Folder Isolation**: User-specific folder structure
- **CORS Configuration**: Restricted to application domains

## 📡 API Documentation

### Core Endpoints

#### Generate Single Image
**POST** `/api/generate_single_image`

Generate a single frame with OpenAI image editing.

**Request:**
```json
{
  "prompt": "A person walking through a sunny park",
  "frameIndex": 0,
  "totalFrames": 6,
  "isFirstFrame": true,
  "style": "Realistic",
  "mood": "Vibrant",
  "userId": "user123",
  "requestId": "req-abc123",
  "expiresIn": 3600,
  "image": "base64-encoded-reference-image"
}
```

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://s3-signed-url...",
  "proxyUrl": "https://app.com/api/proxy_s3_image/...",
  "s3Key": "user123/req-abc123/reference-frames/generated_frame_0_1234567890.png",
  "userId": "user123",
  "requestId": "req-abc123",
  "frameIndex": 0,
  "totalFrames": 6,
  "expiresIn": 3600
}
```

#### Generate Single Video Clip
**POST** `/api/generate_single_video_clip`

Generate a video clip from an image using RunwayML.

**Request:**
```json
{
  "startImage": "https://image-url-or-base64",
  "prompt": "Person continues walking, birds flying overhead",
  "clipIndex": 0,
  "totalClips": 6,
  "frameAspectRatio": "1280:720",
  "duration": 5,
  "userId": "user123",
  "requestId": "req-abc123",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user123",
  "requestId": "req-abc123",
  "clipIndex": 0,
  "totalClips": 6,
  "duration": 5,
  "s3Key": "user123/req-abc123/video-clips/generated_clip_0_1234567890.mp4",
  "proxyUrl": "https://app.com/api/proxy_s3_video/...",
  "videoUrl": "https://s3-signed-url...",
  "expiresIn": 3600
}
```

#### Generate Story
**POST** `/api/generate_story`

Generate AI story with scene breakdowns for video generation.

**Request:**
```json
{
  "prompt": "A day in the life of a busy city",
  "frameCount": 6,
  "duration": 30,
  "style": "Realistic",
  "mood": "Energetic"
}
```

**Response:**
```json
{
  "success": true,
  "story": {
    "title": "Urban Rhythm",
    "overview": "Following the pulse of city life...",
    "scenes": [
      {
        "frame_number": 1,
        "timestamp": "0:00",
        "description": "Dawn breaks over skyscrapers",
        "prompt": "STYLE: Realistic style, energetic mood, ultra-realistic photograph..."
      }
    ]
  }
}
```

### Public Endpoints

These endpoints don't require authentication:

- **GET** `/api/proxy_s3_image/*` - Proxy S3 images
- **GET** `/api/proxy_s3_video/*` - Proxy S3 videos  
- **GET** `/api/get_presigned_url` - Generate signed URLs
- **POST** `/api/convert_s3_image_to_base64` - Convert images to base64

### Error Responses

```json
{
  "error": "Detailed error message",
  "success": false,
  "details": "Additional context when available"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (invalid API key)
- `402` - Payment Required (insufficient credits)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Key Workflows

### 1) Frame Generation

- Navigate to the video generation interface
- Upload a reference image and provide a descriptive prompt
- Select style (Realistic, Cartoon, etc.) and mood (Vibrant, Calm, etc.)
- Choose frame aspect ratio (defaults to `1280:720`)
- Generate frames with AI-powered image editing

**Technical Details:**
- Uses OpenAI's image editing API with sophisticated prompt engineering
- Supports aspect ratio padding without cropping using Sharp
- Each frame is automatically uploaded to S3 with signed URLs
- Frame metadata is stored in Supabase for session tracking

### 2) Story Generation

- Provide a high-level story concept or theme
- AI generates a complete narrative with scene-by-scene breakdowns
- Each scene includes detailed prompts optimized for visual generation
- Story structure ensures narrative continuity across frames

**Technical Details:**
- Uses OpenAI's GPT models for story generation
- Structured prompts ensure consistent character and setting descriptions
- Scene timing and transitions are automatically calculated

### 3) Video Clip Generation

- Convert generated frames into animated video clips
- Each frame becomes a 5-second video clip using RunwayML
- Support for multiple aspect ratios and video qualities
- Automatic retry logic for failed generations

**Technical Details:**
- RunwayML Gen-4 integration with aspect ratio normalization
- Image preprocessing to meet RunwayML requirements (0.5-2.0 aspect ratio)
- Chunked video uploads to S3 with progress tracking
- Error handling for insufficient credits and API failures

### 4) Client-Side Video Merging

- Combine individual clips into a final cohesive video
- Browser-based processing using Canvas and MediaRecorder APIs
- Aspect-fit rendering prevents distortion during merging
- Progress tracking and error recovery

**Technical Details:**
- Canvas-based video composition with background letterboxing
- WebM output format for broad compatibility
- Automatic upload of final merged video to S3
- Memory-efficient processing for large video files

## 🚀 Deployment & Operations

### Environment Variables

Create `.env.local` with required configuration:

```bash
# Core Services
OPENAI_API_KEY=sk-your-openai-key
RUNWAY_API_KEY=your-runway-key

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage (AWS S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Authentication
SECRET_KEY=your-secret-key-for-api-generation
USER_ID=your-user-identifier

# Application
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Vercel Deployment

#### 1. Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "functions": {
    "app/api/generate_story/route.ts": {
      "maxDuration": 300,
      "memory": 1024
    },
    "app/api/merge_video_clips/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

#### 2. Build Configuration

```json
{
  "scripts": {
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next build",
    "start": "next start"
  }
}
```

#### 3. Deployment Steps

1. **Connect Repository**: Link GitHub/GitLab repository to Vercel
2. **Environment Variables**: Set all required env vars in Vercel dashboard
3. **Domain Configuration**: Configure custom domain if needed
4. **Build Settings**: 
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Node.js Version: 18.x

### AWS S3 Setup

#### 1. Bucket Configuration

```bash
# Create bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Set up CORS (use provided script)
./scripts/setup-s3-cors.sh your-bucket-name
```

#### 2. IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectAcl",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### Database Setup

#### 1. Supabase Project

1. Create new Supabase project
2. Run SQL from `database_schema.sql`
3. Configure Row Level Security if needed
4. Set up authentication providers

#### 2. Connection Testing

```bash
# Test database connection
npm run test-db
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev

# Visit application
open http://localhost:3000
```

## 🔧 Extensibility & Development

### Adding New Frame Styles

1. **Update Style Configuration**

```typescript
// lib/utils/styles.ts
export const FRAME_STYLES = {
  Realistic: {
    prompt: 'photorealistic, professional photography',
    technical: '85mm lens, f/2.8 aperture',
    lighting: 'natural lighting, balanced exposure'
  },
  YourNewStyle: {
    prompt: 'your style description',
    technical: 'your technical specs',
    lighting: 'your lighting setup'
  }
}
```

2. **Update Generation Logic**

```typescript
// app/api/generate_single_image/route.ts
const styleSpecs = FRAME_STYLES[style] || FRAME_STYLES.Realistic
const framePrompt = `STYLE: ${styleSpecs.prompt}
TECHNICAL: ${styleSpecs.technical}
LIGHTING: ${styleSpecs.lighting}
SCENE: ${prompt}`
```

### Adding New Video Backends

1. **Create Service Interface**

```typescript
// lib/services/video-generator-interface.ts
export interface VideoGenerator {
  generateClip(params: GenerateClipParams): Promise<VideoResult>
  getSupportedAspectRatios(): string[]
  getMaxDuration(): number
}
```

2. **Implement New Backend**

```typescript
// lib/services/your-video-service.ts
export class YourVideoService implements VideoGenerator {
  async generateClip(params: GenerateClipParams): Promise<VideoResult> {
    // Your implementation
  }
}
```

3. **Update Configuration**

```typescript
// lib/video-config.ts
export const VIDEO_SERVICES = {
  runway: new RunwayMLService(),
  yourService: new YourVideoService()
}
```

### Replacing Storage Backend

1. **Implement Storage Interface**

```typescript
// lib/storage/storage-interface.ts
export interface StorageProvider {
  uploadFile(params: UploadParams): Promise<UploadResult>
  getSignedUrl(key: string, expiresIn: number): Promise<string>
  deleteFile(key: string): Promise<void>
}
```

2. **Create New Provider**

```typescript
// lib/storage/your-storage-provider.ts
export class YourStorageProvider implements StorageProvider {
  // Implement interface methods
}
```

3. **Update Configuration**

```typescript
// lib/storage/storage-config.ts
const provider = process.env.STORAGE_PROVIDER === 'yours' 
  ? new YourStorageProvider()
  : new S3StorageProvider()
```

### Development Workflow

#### 1. Testing

```bash
# Test API endpoints
npm run test-apis

# Test S3 integration
npm run test-s3

# Test database connection
npm run test-db

# Test video generation pipeline
npm run test-video-workflow
```

#### 2. Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js configuration
- **Formatting**: Consistent indentation and naming
- **Error Handling**: Structured try-catch with proper HTTP codes
- **Logging**: Structured console logging with context

#### 3. API Design Patterns

```typescript
// Standard API route structure
export async function POST(request: NextRequest) {
  return withApiKeyAuth(async (request: NextRequest) => {
    try {
      // Validate input
      const body = await request.json()
      if (!body.requiredField) {
        return NextResponse.json(
          { error: 'requiredField is required' }, 
          { status: 400 }
        )
      }

      // Process request
      const result = await processRequest(body)

      // Return success
      return NextResponse.json({ 
        success: true, 
        ...result 
      })
    } catch (error) {
      console.error('API Error:', error)
      return NextResponse.json(
        { 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, 
        { status: 500 }
      )
    }
  })(request)
}
```

### Contributing Guidelines

1. **Code Style**: Follow existing patterns and TypeScript conventions
2. **Testing**: Test new features with provided test scripts
3. **Documentation**: Update README and inline comments
4. **Error Handling**: Implement proper error boundaries and logging
5. **Security**: Validate all inputs and use proper authentication
6. **Performance**: Consider rate limiting and resource usage

### Troubleshooting Common Issues

#### 1. Video Generation Failures

```bash
# Check RunwayML credits and API key
curl -H "Authorization: Bearer $RUNWAY_API_KEY" \
     https://api.runwayml.com/v1/account

# Test aspect ratio normalization
npm run test-aspect-ratio
```

#### 2. S3 Upload Issues

```bash
# Verify S3 credentials and permissions
aws s3 ls s3://your-bucket-name --region us-east-1

# Test CORS configuration
npm run test-s3-cors
```

#### 3. Database Connection Problems

```bash
# Test Supabase connection
npm run test-supabase-connection

# Check database schema
npm run verify-db-schema
```

## 🔗 Storage Structure

The application uses an organized S3 folder structure:

```
bucket/
├── {userId}/
│   └── {requestId}/
│       ├── reference-frames/     # Generated images/frames
│       │   ├── generated_frame_0_*.png
│       │   └── generated_frame_1_*.png
│       ├── video-clips/          # All videos (clips + final)
│       │   ├── generated_clip_0_*.mp4
│       │   ├── generated_clip_1_*.mp4
│       │   └── final_video_*.mp4
│       └── user-uploads/         # User uploaded content
│           └── reference_image_*.png
```

Each video generation session gets a unique `requestId` to organize all related assets together for easy identification and management.

## 📝 Additional Resources

- **API Testing Guide**: See `API_TESTING_GUIDE.md`
- **S3 Setup Guide**: See `S3_BUCKET_POLICY_SETUP.md`
- **Authentication Setup**: See `AUTHENTICATION_SETUP_GUIDE.md`
- **Database Integration**: See `DATABASE_INTEGRATION.md`
- **Troubleshooting**: See `TROUBLESHOOTING_S3_VIDEO_GENERATION.md`

## 📄 License

This project is private and proprietary. All rights reserved.
