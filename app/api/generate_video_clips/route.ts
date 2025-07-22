import { NextRequest, NextResponse } from 'next/server'

// Runway API configuration
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY
const RUNWAY_API_URL = 'https://api.runwayml.com/v1'

interface VideoClipRequest {
  startImage: string // base64 image data
  endImage: string   // base64 image data
  clipIndex: number
  totalClips: number
  prompt: string
}

interface RunwayVideoResponse {
  id: string
  status: string
  output?: {
    video_url?: string
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { startImage, endImage, clipIndex, totalClips, prompt }: VideoClipRequest = await request.json()
    
    // Validation
    if (!startImage || !endImage) {
      return NextResponse.json({ error: "Start and end images are required" }, { status: 400 })
    }
    if (!RUNWAY_API_KEY) {
      return NextResponse.json({ error: "Runway API key is not set" }, { status: 500 })
    }
    if (clipIndex === undefined || totalClips === undefined) {
      return NextResponse.json({ error: "Clip index and total clips are required" }, { status: 400 })
    }

    console.log(`Generating video clip ${clipIndex + 1}/${totalClips}`)

    // Create clip-specific prompt
    const clipPrompt = `Create a smooth 5-second video transition from the start image to the end image. ${prompt}. Maintain consistent character appearance and smooth motion between frames.`

    // Prepare images for Runway API
    // Remove data URL prefix if present
    const cleanStartImage = startImage.replace(/^data:image\/\w+;base64,/, '')
    const cleanEndImage = endImage.replace(/^data:image\/\w+;base64,/, '')

    // Create Runway API request payload
    const runwayPayload = {
      model: "gen3a_turbo", // Runway's video generation model
      promptText: clipPrompt,
      promptImage: [
        {
          uri: cleanStartImage,
          position: "first"
        },
        {
          uri: cleanEndImage,
          position: "last"
        }
      ],
      ratio: "1280:768",
      duration: 5,
    }

    // Call Runway API
    const runwayResponse = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(runwayPayload)
    })

    if (!runwayResponse.ok) {
      const errorData = await runwayResponse.text()
      console.error('Runway API error:', errorData)
      return NextResponse.json({ 
        error: `Runway API error: ${runwayResponse.status}`,
        details: errorData
      }, { status: runwayResponse.status })
    }

    const runwayData: RunwayVideoResponse = await runwayResponse.json()

    if (runwayData.error) {
      return NextResponse.json({ 
        error: `Runway generation failed: ${runwayData.error}` 
      }, { status: 500 })
    }

    // Handle different response statuses
    console.log('Runway API response status:', runwayData.status)
    console.log('Runway API response:', JSON.stringify(runwayData, null, 2))

    if (runwayData.status === 'processing' || runwayData.status === 'pending') {
      // Poll for completion with better error handling
      const maxAttempts = 120 // 10 minutes max wait (increased from 5 minutes)
      let attempts = 0
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds (reduced from 5)
        
        try {
          const statusResponse = await fetch(`${RUNWAY_API_URL}/tasks/${runwayData.id}`, {
            headers: {
              'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000) // 10 second timeout per request
          })

          if (statusResponse.ok) {
            const statusData: RunwayVideoResponse = await statusResponse.json()
            console.log(`Poll attempt ${attempts + 1}: Status = ${statusData.status}`)
            
            if (statusData.status === 'completed' && statusData.output?.video_url) {
              console.log(`Video clip ${clipIndex + 1} generated successfully`)
              return NextResponse.json({
                videoUrl: statusData.output.video_url,
                clipIndex: clipIndex,
                totalClips: totalClips,
                success: true
              })
            } else if (statusData.status === 'failed') {
              console.error(`Video generation failed: ${statusData.error}`)
              return NextResponse.json({ 
                error: `Video generation failed: ${statusData.error || 'Unknown error'}` 
              }, { status: 500 })
            } else if (statusData.status === 'cancelled') {
              return NextResponse.json({ 
                error: "Video generation was cancelled" 
              }, { status: 500 })
            }
            // Continue polling for 'processing', 'pending', or other intermediate statuses
          } else {
            console.error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`)
            // Don't fail immediately, continue polling
          }
        } catch (pollError) {
          console.error(`Poll attempt ${attempts + 1} failed:`, pollError)
          // Continue polling unless it's a timeout
          if (pollError instanceof Error && pollError.name === 'TimeoutError') {
            console.error('Polling timeout, continuing...')
          }
        }
        
        attempts++
      }
      
      console.error(`Video generation timed out after ${maxAttempts} attempts`)
      return NextResponse.json({ 
        error: "Video generation timed out after 10 minutes" 
      }, { status: 408 })
    } else if (runwayData.status === 'completed' && runwayData.output?.video_url) {
      // Immediate completion
      console.log(`Video clip ${clipIndex + 1} completed immediately`)
      return NextResponse.json({
        videoUrl: runwayData.output.video_url,
        clipIndex: clipIndex,
        totalClips: totalClips,
        success: true
      })
    } else if (runwayData.status === 'failed') {
      console.error(`Video generation failed immediately: ${runwayData.error}`)
      return NextResponse.json({ 
        error: `Video generation failed: ${runwayData.error || 'Unknown error'}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      error: "Unexpected response from Runway API" 
    }, { status: 500 })

  } catch (error) {
    console.error('Error generating video clip:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 