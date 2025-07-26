"use client"

import { useState } from 'react'
import { concatenateVideos, checkBrowserCompatibility } from '@/lib/utils/video-merge'
import { showToast } from '@/lib/utils/toast'

export default function TestVideoMergePage() {
  const [compatibility, setCompatibility] = useState<any>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const testCompatibility = () => {
    const compat = checkBrowserCompatibility()
    setCompatibility(compat)
  }

  const testVideoMerge = async () => {
    setIsMerging(true)
    setError(null)
    setResult(null)

    try {
      // Test with sample video URLs (you can replace these with your actual video URLs)
      const testVideoUrls = [
        'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4'
      ]

      console.log('Testing video merge with URLs:', testVideoUrls)
      
      const mergedBlob = await concatenateVideos(testVideoUrls)
      
      // Convert to data URL for display
      const reader = new FileReader()
      reader.onload = () => {
        setResult(reader.result as string)
      }
      reader.readAsDataURL(mergedBlob)
      
      console.log('Video merge test completed successfully')
      showToast.success('Video merge test completed successfully!')
    } catch (err) {
      console.error('Video merge test failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      showToast.error('Video merge test failed. Check console for details.')
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Video Merge Test Page</h1>
      
      <div className="space-y-6">
        {/* Browser Compatibility Test */}
        <div className="bg-gray-100 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Browser Compatibility Test</h2>
          <button 
            onClick={testCompatibility}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Check Compatibility
          </button>
          
          {compatibility && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Results:</h3>
              <pre className="bg-white p-4 rounded border text-sm overflow-auto">
                {JSON.stringify(compatibility, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Video Merge Test */}
        <div className="bg-gray-100 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Video Merge Test</h2>
          <button 
            onClick={testVideoMerge}
            disabled={isMerging}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {isMerging ? 'Merging Videos...' : 'Test Video Merge'}
          </button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {result && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Merged Video Result:</h3>
              <video 
                controls 
                className="w-full max-w-md border rounded"
                src={result}
              >
                Your browser does not support the video tag.
              </video>
              <p className="text-sm text-gray-600 mt-2">
                Data URL length: {result.length} characters
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>First, click "Check Compatibility" to verify your browser supports the required APIs</li>
            <li>Then click "Test Video Merge" to test the video merging functionality</li>
            <li>If the test fails, check the browser console for detailed error messages</li>
            <li>The merged video should appear below if successful</li>
          </ol>
        </div>
      </div>
    </div>
  )
} 