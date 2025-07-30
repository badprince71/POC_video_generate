// S3 Configuration using environment variables for better security
export const S3_CONFIG = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  bucket: process.env.AWS_S3_BUCKET || "happinest-aiinvitations"
} as const;

// Folder structure mapping
export const FOLDER_MAPPING = {
  // Original folder name -> S3 folder name
  'frames': 'reference-frames',        // Generated images go to reference-frames
  'images': 'user-uploads',           // User uploaded images go to user-uploads  
  'movies': 'video-clips',            // Generated videos go to video-clips
  'videos': 'video-clips',            // All videos go to video-clips
  'clips': 'video-clips'              // Video clips go to video-clips
} as const;

export type OriginalFolderType = keyof typeof FOLDER_MAPPING;
export type S3FolderType = typeof FOLDER_MAPPING[OriginalFolderType];