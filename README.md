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
