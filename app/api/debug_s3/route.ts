import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3_CONFIG } from '@/lib/upload/s3_config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'user'
    const testKey = searchParams.get('testKey')

    // Initialize S3 client
    const s3Client = new S3Client({
      region: S3_CONFIG.region,
      credentials: S3_CONFIG.credentials,
    })

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      userId,
      s3Config: {
        region: S3_CONFIG.region,
        bucket: S3_CONFIG.bucket,
        hasCredentials: !!(S3_CONFIG.credentials.accessKeyId && S3_CONFIG.credentials.secretAccessKey),
        accessKeyIdPrefix: S3_CONFIG.credentials.accessKeyId?.substring(0, 8) + '...',
      },
      tests: []
    }

    // Test 1: List objects in reference-frames folder
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: S3_CONFIG.bucket,
        Prefix: `reference-frames/${userId}/`,
        MaxKeys: 5,
      })
      
      const listResponse = await s3Client.send(listCommand)
      diagnostics.tests.push({
        test: 'List Objects',
        success: true,
        objectCount: listResponse.Contents?.length || 0,
        objects: listResponse.Contents?.slice(0, 3).map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified
        })) || []
      })
    } catch (error) {
      diagnostics.tests.push({
        test: 'List Objects',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 2: Generate presigned URL for a specific object
    if (testKey) {
      try {
        const urlCommand = new GetObjectCommand({
          Bucket: S3_CONFIG.bucket,
          Key: testKey,
        })
        
        const presignedUrl = await getSignedUrl(s3Client, urlCommand, { expiresIn: 3600 })
        
        diagnostics.tests.push({
          test: 'Generate Presigned URL',
          success: true,
          key: testKey,
          url: presignedUrl,
          urlLength: presignedUrl.length
        })

        // Test 3: Head object to check if it exists
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: S3_CONFIG.bucket,
            Key: testKey,
          })
          
          const headResponse = await s3Client.send(headCommand)
          diagnostics.tests.push({
            test: 'Object Exists Check',
            success: true,
            key: testKey,
            contentType: headResponse.ContentType,
            contentLength: headResponse.ContentLength,
            lastModified: headResponse.LastModified
          })
        } catch (error) {
          diagnostics.tests.push({
            test: 'Object Exists Check',
            success: false,
            key: testKey,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }

      } catch (error) {
        diagnostics.tests.push({
          test: 'Generate Presigned URL',
          success: false,
          key: testKey,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Test 4: Environment variables check
    diagnostics.environment = {
      NODE_ENV: process.env.NODE_ENV,
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      hasAwsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasAwsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    }

    return NextResponse.json({
      success: true,
      diagnostics
    })

  } catch (error) {
    console.error('S3 diagnostics error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: null
    }, { status: 500 })
  }
}