/**
 * Video utility functions that can be used on both client and server
 */

export function isChunkedVideoUrl(url: string): boolean {
  return url.includes('/api/serve-chunked-video') || url.includes('_manifest.json');
}

export function getDownloadUrlForVideo(videoUrl: string): string {
  // If it's a chunked video, add download parameter
  if (videoUrl.includes('/api/serve-chunked-video')) {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    const url = new URL(videoUrl, baseUrl);
    url.searchParams.set('download', 'true');
    return url.toString();
  }
  
  // For direct videos, return as-is
  return videoUrl;
} 