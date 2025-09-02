import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import sharp from 'sharp'
import { uploadImageToS3, getSignedUrlFromS3 } from '@/lib/upload/s3_upload'
import { withApiKeyAuth } from '../../../lib/auth/api-key-auth'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Return base64 image data directly
function formatImageData(base64Data: string): string {
    return `data:image/png;base64,${base64Data}`
}

async function generateSingleImage(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || ''
		let prompt: string | undefined
		let frameIndex: number | undefined
		let totalFrames: number | undefined
		let isFirstFrame: boolean | undefined
		let style: string | undefined
		let mood: string | undefined
		let imageFile: File | null = null
		let userId: string | undefined
		let requestId: string | undefined
		let expiresIn: number | undefined
        let frameAspectRatio: string | undefined

		// Allow overriding via headers (useful for server-to-server or Postman)
		const headerUserId = request.headers.get('x-user-id') || request.headers.get('x-userid') || undefined
		const headerRequestId = request.headers.get('x-request-id') || request.headers.get('x-requestid') || undefined


		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData()
			const uploaded = (form.get('image') as File) || (form.get('file') as File) || null
			if (uploaded && typeof uploaded !== 'string') {
				imageFile = uploaded
			}
			prompt = (form.get('prompt') as string) || undefined
			const frameIndexRaw = form.get('frameIndex') as string
			const totalFramesRaw = form.get('totalFrames') as string
			const isFirstFrameRaw = form.get('isFirstFrame') as string
			style = (form.get('style') as string) || undefined
			mood = (form.get('mood') as string) || undefined
			userId = (form.get('userId') as string) || undefined
			requestId = (form.get('requestId') as string) || undefined
			const expiresInRaw = form.get('expiresIn') as string
            frameAspectRatio = (form.get('frameAspectRatio') as string) || undefined
			expiresIn = typeof expiresInRaw === 'string' && expiresInRaw.length > 0 ? Number(expiresInRaw) : undefined
			frameIndex = frameIndexRaw !== undefined && frameIndexRaw !== null ? Number(frameIndexRaw) : undefined
			totalFrames = totalFramesRaw !== undefined && totalFramesRaw !== null ? Number(totalFramesRaw) : undefined
			if (typeof isFirstFrameRaw === 'string') {
				isFirstFrame = ['true', '1', 'yes', 'on'].includes(isFirstFrameRaw.toLowerCase())
			}
		} else {
			const body = await request.json()
			prompt = body.prompt
			frameIndex = body.frameIndex
			totalFrames = body.totalFrames
			isFirstFrame = body.isFirstFrame
			style = body.style
			mood = body.mood
			userId = body.userId
			requestId = body.requestId
			expiresIn = typeof body.expiresIn === 'number' ? body.expiresIn : undefined
            frameAspectRatio = body.frameAspectRatio
			if (body.image) {
				const imageBuffer = Buffer.from(body.image, 'base64')
				imageFile = new File([imageBuffer], 'reference.png', { type: 'image/png' })
			}
		}

		// Validation
		if (!prompt) {
			return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
		}
		if (!imageFile) {
			return NextResponse.json({ error: "Image is required" }, { status: 400 })
		}
		if (!openai.apiKey) {
			return NextResponse.json({ error: "OpenAI API key is not set" }, { status: 500 })
		}
		if (frameIndex === undefined || totalFrames === undefined) {
			return NextResponse.json({ error: "Frame index and total frames are required" }, { status: 400 })
		}

		console.log(`Generating frame ${Number(frameIndex) + 1}/${Number(totalFrames)} with prompt: "${prompt}"`)

		// Create frame-specific prompt with style and mood
		let framePrompt: string;
		
		// Add style and mood to the prompt if provided
		const styleMoodSuffix = style && mood ? `, ${style.toLowerCase()} style, ${mood.toLowerCase()} mood` : ''

		let response;
		const retries = 2;
		let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (isFirstFrame) {
                    // First scene: create a realistic photograph from original image
                    framePrompt = `STYLE: ${styleMoodSuffix} high-quality, ultra-realistic photograph
TECHNICAL SPECS: Shot with professional camera, 85mm lens, f/2.8 aperture, natural depth of field, sharp focus on subject
LIGHTING: Soft natural lighting, balanced exposure, realistic shadows and highlights, natural skin tones
FACIAL CONSISTENCY: Maintain subject's EXACT facial features - face shape, eye color, eye shape, nose structure, lip shape, facial bone structure, hair color and texture
COMPOSITION: Rule of thirds, professional framing, environmental context
QUALITY: 4K resolution quality, photojournalistic style, authentic human expressions
SCENE: ${prompt}
IMPORTANT: Generate a complete, cohesive scene that looks like a real photograph taken by a professional photographer. Ensure anatomical accuracy, natural proportions, and realistic material textures.`;
                } else {
                    // Subsequent scenes: create new realistic photographs from original image
                    framePrompt = `STYLE: ${styleMoodSuffix} high-quality, ultra-realistic photograph  
TECHNICAL SPECS: Shot with professional camera, 85mm lens, f/2.8 aperture, natural depth of field, sharp focus on subject
LIGHTING: Soft natural lighting, balanced exposure, realistic shadows and highlights, natural skin tones
FACIAL CONSISTENCY: Maintain subject's EXACT facial features - face shape, eye color, eye shape, nose structure, lip shape, facial bone structure, hair color and texture  
COMPOSITION: Rule of thirds, professional framing, environmental context
QUALITY: 4K resolution quality, photojournalistic style, authentic human expressions
SCENE: ${prompt}
IMPORTANT: Generate a complete, cohesive scene that looks like a real photograph taken by a professional photographer. Ensure anatomical accuracy, natural proportions, and realistic material textures.`;
                }
                
                response = await openai.images.edit({
                    model: "gpt-image-1",
                    image: imageFile,
                    prompt: framePrompt,
                    n: 1,
                    size: "1024x1024",
                });
                console.log("framePrompt", frameIndex, framePrompt);
                // If successful, update imageFile to the generated image for the next attempt (if any)
                if (response.data && response.data[0] && response.data[0].b64_json) {
                    const generatedImageData: string = response.data[0].b64_json as string;
                    const generatedBuffer: Buffer = Buffer.from(generatedImageData, 'base64');
                    console.log("frameIndex", frameIndex,framePrompt );
                    imageFile = new File([generatedBuffer], 'reference.png', { type: 'image/png' });
                }

                // If successful, break out of the loop
                break;
            } catch (err: unknown) {
                lastError = err;
                // Check for OpenAI safety system error (400 with specific message)
                if (
                    err && typeof err === 'object' &&
                    'status' in err && err.status === 400 &&
                    'message' in err && typeof err.message === "string" &&
                    err.message.includes("Your request was rejected as a result of our safety system")
                ) {
                    console.warn(`OpenAI safety system rejection on attempt ${attempt + 1}: ${err.message}`);
                    // Optionally, slightly modify the prompt to reduce risk of repeated rejection
                    // framePrompt = framePrompt.replace(/animation sequence/gi, "sequence of images");
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                } else {
                    // If it's a different error, rethrow
                    throw err;
                }
            }
        }

        if (!response) {
            throw lastError;
        }

		if (response.data && response.data[0] && response.data[0].b64_json) {
			// Upload generated image to S3 and return a presigned URL
			let base64Data = response.data[0].b64_json

            // If aspect ratio requested, pad/resize non-destructively using sharp
            if (frameAspectRatio) {
                try {
                    // Parse ratio like "1280:720"
                    const [wStr, hStr] = frameAspectRatio.split(':')
                    const targetW = Math.max(1, parseInt(wStr, 10) || 0)
                    const targetH = Math.max(1, parseInt(hStr, 10) || 0)

                    if (targetW > 0 && targetH > 0) {
                        const inputBuffer = Buffer.from(base64Data, 'base64')
                        // Convert to PNG and fit within target, padding to avoid cropping or distortion
                        const outputBuffer = await sharp(inputBuffer)
                            .resize({
                                width: targetW,
                                height: targetH,
                                fit: 'contain',
                                background: { r: 0, g: 0, b: 0, alpha: 0 }
                            })
                            .png()
                            .toBuffer()

                        base64Data = outputBuffer.toString('base64')
                    }
                } catch (padErr) {
                    console.warn('Aspect ratio processing failed, using original image', padErr)
                }
            }
			const finalUserId = headerUserId || userId || 'public-user'
			const finalRequestId = headerRequestId || requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
			const folderPath = `${finalUserId}/${finalRequestId}/reference-frames`
			const filename = `generated_frame_${frameIndex ?? 0}_${Date.now()}.png`

			const uploadResult = await uploadImageToS3({
				imageData: base64Data,
				userId: folderPath,
				type: 'reference-frames',
				filename
			})

			// Time-limited presigned URL to access the private S3 object directly
			const signedUrl = await getSignedUrlFromS3(uploadResult.key, expiresIn ?? 3600)

			return NextResponse.json({ 
				imageUrl: signedUrl,
				proxyUrl: uploadResult.publicUrl,
				s3Key: uploadResult.key,
				userId: finalUserId,
				requestId: finalRequestId,
				frameIndex: frameIndex,
				totalFrames: totalFrames,
				expiresIn: expiresIn ?? 3600,
                frameAspectRatio: frameAspectRatio,
				success: true
			});
		} else {
            return NextResponse.json({ 
                error: `Failed to generate frame ${frameIndex + 1}: No image data received` 
            }, { status: 500 });
        }

    } catch (error) {
        console.error(`Error generating frame:`, error);
        return NextResponse.json({ 
            error: "Internal server error", 
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return withApiKeyAuth(generateSingleImage)(request);
} 
