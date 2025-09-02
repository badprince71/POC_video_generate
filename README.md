# AI Frame-to-Video Generator

Modern Next.js app to generate story-driven frames from a single image + prompt, convert frames into per-frame 5-second clips via RunwayML Gen-4, and merge them client-side. Includes S3 storage support and resumable uploads.

## Features

- Frame generation with style/mood prompts using OpenAI Images API
- Configurable frame aspect ratio at generation time (no cropping or distortion)
- Per-frame regeneration and per-clip regeneration
- Video clip generation (RunwayML Gen-4) with selectable aspect ratios
- Client-side merge with aspect-fit rendering to avoid text distortion
- S3 upload for frames, clips, final videos (chunked uploads for large files)

## Prerequisites

- Node.js 18+
- Next.js 14+ (App Router)
- Accounts/keys:
  - OpenAI API key (for prompts and images)
  - RunwayML API key (for video generation)
  - Supabase (or S3-compatible) storage credentials

## Environment Variables

Create a `.env.local` with:

```
OPENAI_API_KEY=sk-...
RUNWAYML_API_SECRET=...
NEXT_PUBLIC_API_KEY=your_public_frontend_api_key

# Supabase storage (bucket `videomaker` used by default)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Base URL for reconstructing chunked files
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Ensure your storage bucket `videomaker` exists with public access to objects created by the app.

## Install & Run

```
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Key Workflows

### 1) Frame Generation

- Go to Frame Generation page.
- Upload a reference image and enter a prompt, style, mood.
- Select Frame Aspect Ratio (defaults to `1280:720`).
- Generate frames; each saved to storage and database.

Technical:
- API: `app/api/generate_single_image/route.ts`
- Added `frameAspectRatio` support. The API pads the generated image to the requested ratio using sharp with `fit: 'contain'` (no cropping) and transparent letterboxing.

### 2) Per-Frame Regeneration

- After frames are ready, select a frame and click “Regenerate Selected Frame”. Only that frame is regenerated and updated in-place.

### 3) Clip Generation

- Go to Video Generation page.
- Choose desired video aspect ratio (same presets as RunwayML) and generate clips.
- Each clip is uploaded to storage automatically.

Technical:
- `lib/generate_video_clips/generate_clips.ts` passes `ratio` to Runway.
- `app/api/generate_single_video_clip/route.ts` normalizes prompt image aspect and retries generation.

### 4) Merging Clips (Client-Side)

- Use the Merge action to concatenate clips in-browser.
- The merger draws each frame with aspect-fit and letterboxing to avoid stretch or text distortion.

Technical:
- `lib/utils/video-merge.ts` uses Canvas + MediaRecorder; draws background then aspect-fit video.

## Troubleshooting

- If one clip fails: Use Retry Clip on that item; no need to restart the whole batch.
- If a frame’s text is misaligned: Regenerate that single frame from the Frame Generation page.
- If CORS on S3: the app proxies S3 URLs; ensure the proxy API routes are enabled.

## Security

- Server routes protect with `withApiKeyAuth` and time-limited signed URLs. Set `NEXT_PUBLIC_API_KEY` and keep server keys in server-only env vars.

## Notes

- Supported aspect ratios align with RunwayML presets. Frame-level padding ensures consistency from the start, avoiding truncation when converting frames to clips.

# AI Video Generator

A Next.js application that generates personalized animated videos from user prompts and images using AI.

## Features

- **User Authentication**: Secure sign-up and sign-in using Supabase
- **Frame Generation**: Create story-driven frames from prompts and images
- **Video Generation**: Transform frames into smooth animated video clips
- **AWS S3 Storage**: Upload and store all media (frames, video clips, final videos) in S3
- **Story Generation**: AI-powered story creation with scene breakdowns
- **Media Library**: Organize and manage your generated content

## Video Upload to Supabase

The application now includes comprehensive Supabase integration for uploading video content:

### Automatic Uploads
- **Individual Video Clips**: Each generated video clip is automatically uploaded to Supabase as it's created
- **Final Merged Video**: The complete merged video is automatically uploaded to Supabase when ready

### Manual Upload Options
- **Upload Frames**: Manually upload frame images to Supabase storage
- **Upload Video Clips**: Manually upload completed video clips to Supabase
- **Upload Final Video**: Manually upload the final merged video to Supabase

### Upload Functionality
The `uploadMovieToStorage` function handles all video uploads with the following features:
- Chunked uploads for large files
- Progress tracking and error handling
- Automatic filename generation with timestamps
- Thumbnail support for video previews
- User-specific storage organization

### Storage Structure
```
supabase-storage/
├── users/
│   └── {userId}/
│       ├── frames/          # Individual frame images
│       ├── video-clips/     # Individual video clips
│       └── movies/          # Final merged videos
```

## Environment Variables

Make sure to set up the following environment variables:

```env
# Supabase Configuration (for authentication and storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AWS S3 Configuration (for video storage)
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name-here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Runway Configuration (for video generation)
RUNWAY_API_KEY=your_runway_api_key
```

## Usage

1. **Generate Frames**: Upload an image and provide a prompt to generate story-driven frames
2. **Create Video Clips**: Transform frames into animated video clips (automatically uploaded to Supabase)
3. **Merge Videos**: Combine clips into a final video (automatically uploaded to Supabase)
4. **Manage Media**: Use the Media Library to organize and access your content

## Development

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`
