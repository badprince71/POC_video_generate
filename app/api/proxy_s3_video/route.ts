import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "happinest-aiinvitations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: "S3 key is required" }, { status: 400 })
    }

    // Get the video from S3
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Convert the readable stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks);

    // Return the video with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'video/mp4',
        'Content-Length': response.ContentLength?.toString() || buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Accept-Ranges': 'bytes',
      },
    })

  } catch (error) {
    console.error('Error proxying S3 video:', error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 