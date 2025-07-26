import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const manifestUrl = searchParams.get('manifest')
    const download = searchParams.get('download') === 'true'
    
    if (!manifestUrl) {
      return NextResponse.json({ error: 'Manifest URL is required' }, { status: 400 })
    }

    // Fetch the manifest
    const manifestResponse = await fetch(manifestUrl)
    if (!manifestResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 404 })
    }
    
    const manifest = await manifestResponse.json()
    console.log('Serving chunked video from manifest:', manifest.originalFilename)
    
    // Fetch all chunks in parallel
    const chunkPromises = manifest.chunks.map(async (chunkPath: string) => {
      const { data: chunkUrlData } = supabase.storage
        .from('videomaker')
        .getPublicUrl(chunkPath)
        
      if (!chunkUrlData?.publicUrl) {
        throw new Error(`Failed to get public URL for chunk: ${chunkPath}`)
      }
      
      const chunkResponse = await fetch(chunkUrlData.publicUrl)
      if (!chunkResponse.ok) {
        throw new Error(`Failed to fetch chunk: ${chunkPath}`)
      }
      
      return chunkResponse.arrayBuffer()
    })
    
    const chunks = await Promise.all(chunkPromises)
    
    // Combine chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const combinedBuffer = new Uint8Array(totalSize)
    
    let offset = 0
    for (const chunk of chunks) {
      combinedBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Length': totalSize.toString(),
      'Accept-Ranges': 'bytes'
    }
    
    if (download) {
      // Add download headers
      headers['Content-Disposition'] = `attachment; filename="${manifest.originalFilename}"`
      headers['Cache-Control'] = 'no-cache'
    } else {
      // Streaming headers
      headers['Cache-Control'] = 'public, max-age=3600'
    }
    
    // Return as video stream or download
    return new NextResponse(combinedBuffer, {
      status: 200,
      headers
    })
    
  } catch (error) {
    console.error('Error serving chunked video:', error)
    return NextResponse.json(
      { error: 'Failed to serve chunked video' }, 
      { status: 500 }
    )
  }
} 