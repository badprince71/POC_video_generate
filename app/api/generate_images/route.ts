import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { uploadImageToS3, getSignedUrlFromS3 } from '@/lib/upload/s3_upload'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Generate unique filename
function generateFilename(index: number): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `generated-${timestamp}-${index}-${random}.png`
}

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || ''
        let prompt: string | undefined
        let numImages: number | undefined
        let currentReferenceImage: string | undefined
        let userId: string | undefined
        let requestId: string | undefined
        let expiresIn: number | undefined
        const headerUserId = request.headers.get('x-user-id') || request.headers.get('x-userid') || undefined
        const headerRequestId = request.headers.get('x-request-id') || request.headers.get('x-requestid') || undefined

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData()
            prompt = (form.get('prompt') as string) || undefined
            const numImagesRaw = form.get('numImages') as string
            if (typeof numImagesRaw === 'string' && numImagesRaw.length > 0) {
                numImages = Number(numImagesRaw)
            }
            userId = (form.get('userId') as string) || undefined
            requestId = (form.get('requestId') as string) || undefined
            const expiresInRaw = form.get('expiresIn') as string
            expiresIn = typeof expiresInRaw === 'string' && expiresInRaw.length > 0 ? Number(expiresInRaw) : undefined
            const uploaded = (form.get('image') as File) || (form.get('file') as File) || null
            if (uploaded && typeof uploaded !== 'string') {
                const arrayBuffer = await uploaded.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                currentReferenceImage = buffer.toString('base64')
            }
        } else {
            const body = await request.json();
            prompt = body.prompt
            numImages = body.numImages
            userId = body.userId
            requestId = body.requestId
            expiresIn = typeof body.expiresIn === 'number' ? body.expiresIn : undefined
            if (body.image) {
                currentReferenceImage = body.image
            }
        }
        
        // Validation
        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
        }
        if (!currentReferenceImage) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 })
        }
        if (!openai.apiKey) {
            return NextResponse.json({ error: "OpenAI API key is not set" }, { status: 500 })
        }

        const imageCount = numImages || 5;
        console.log(`Generating ${imageCount} images with prompt: "${prompt}"`);

        // Optional: Human detection (commented out for now)
        // const visionResponse = await openai.chat.completions.create({
        //     model: "gpt-4o-mini",
        //     messages: [
        //         {
        //             role: "user",
        //             content: [
        //                 { type: "text", text: "Is there a human in this image? Answer only 'yes' or 'no'." },
        //                 { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
        //             ]
        //         }
        //     ],
        //     max_tokens: 3,
        // });
        // const visionResult = visionResponse.choices?.[0]?.message?.content?.toLowerCase().trim();
        // if (visionResult !== "yes") {
        //     return NextResponse.json({ error: "No human detected in the image." }, { status: 400 });
        // }

        const results: Array<{ imageUrl: string; proxyUrl: string; s3Key: string; filename: string }> = [];
        const errors: string[] = [];
        const finalUserId = headerUserId || userId || 'public-user'
        const finalRequestId = headerRequestId || requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        // currentReferenceImage already set

        // Generate images sequentially, each based on the previous one
        for (let i = 0; i < imageCount; i++) {
            try {
                console.log(`Generating image ${i + 1}/${imageCount}`);
                
                // Create frame-specific prompt
                let framePrompt: string;
                if (i === 0) {
                    // First frame: based on original image and prompt
                    framePrompt = `STYLE: High-quality, ultra-realistic photograph
TECHNICAL SPECS: Shot with professional camera, 85mm lens, f/2.8 aperture, natural depth of field, sharp focus on subject
LIGHTING: Soft natural lighting, balanced exposure, realistic shadows and highlights, natural skin tones
FACIAL CONSISTENCY: Maintain subject's EXACT facial features from the reference image - face shape, eye color, eye shape, nose structure, lip shape, facial bone structure, hair color and texture
COMPOSITION: Rule of thirds, professional framing, environmental context
QUALITY: 4K resolution quality, photojournalistic style, authentic human expressions
SCENE: The subject of the images is the person in the photo. ${prompt}
CHARACTER CONSISTENCY: Keep the same apparent age, facial features, hair, and clothing style/color palette across all frames. Do not introduce new garments or accessories unless explicitly requested.
IMPORTANT: Generate a complete, cohesive scene that looks like a real photograph taken by a professional photographer. Ensure anatomical accuracy, natural proportions, and realistic material textures.`;
                } else {
                    // Subsequent frames: continue the action from previous frame
                    framePrompt = `STYLE: High-quality, ultra-realistic photograph, continuing from previous scene
TECHNICAL SPECS: Shot with professional camera, 85mm lens, f/2.8 aperture, natural depth of field, sharp focus on subject
LIGHTING: Soft natural lighting, balanced exposure, realistic shadows and highlights, natural skin tones
FACIAL CONSISTENCY: Maintain subject's EXACT facial features from previous image - face shape, eye color, eye shape, nose structure, lip shape, facial bone structure, hair color and texture
COMPOSITION: Rule of thirds, professional framing, environmental context
QUALITY: 4K resolution quality, photojournalistic style, authentic human expressions
SCENE: Continue the action from the previous image. ${prompt}
CHARACTER CONSISTENCY: Keep the same apparent age, facial features, hair, and clothing style/color palette as in the first frame. Do not introduce new garments or accessories unless explicitly requested.
IMPORTANT: Generate a complete, cohesive scene that looks like a real photograph taken by a professional photographer. Ensure anatomical accuracy, natural proportions, and realistic material textures.`;
                }
                
                // Generate single image using GPT-4o Vision (gpt-image-1)
                // Retry logic for OpenAI safety system rejections
                let response;
                const retries = 2;
                let lastError;
                for (let attempt = 0; attempt <= retries; attempt++) {
                    try {
                                                 // Convert base64 to buffer for image editing
                         const imageBuffer: Buffer = Buffer.from(currentReferenceImage as string, 'base64');
                         const imageFile: File = new File([imageBuffer], 'reference.png', { type: 'image/png' });
                         
                         response = await openai.images.edit({
                            model: "gpt-image-1",
                            image: imageFile,
                            prompt: framePrompt,
                            n: 1,
                            size: "1024x1024",
                         });
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
                            framePrompt = framePrompt.replace(/animation sequence/gi, "sequence of images");
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
                    const filename = generateFilename(i);
                    const folderPath = `${finalUserId}/${finalRequestId}/reference-frames`
                    const base64Data: string = response.data[0].b64_json as string

                    const uploadResult = await uploadImageToS3({
                        imageData: base64Data,
                        userId: folderPath,
                        type: 'reference-frames',
                        filename
                    })

                    const signedUrl = await getSignedUrlFromS3(uploadResult.key, expiresIn ?? 3600)
                    results.push({ imageUrl: signedUrl, proxyUrl: uploadResult.publicUrl, s3Key: uploadResult.key, filename })
                    console.log(`Generated image ${i + 1}: ${uploadResult.key}`);
                    
                    // Update reference for iterative generation
                    currentReferenceImage = base64Data;
                } else {
                    errors.push(`Failed to generate image ${i + 1}: No image data received`);
                }

                // Add delay between requests to avoid rate limits
                if (i < imageCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error(`Error generating image ${i + 1}:`, error);
                errors.push(`Failed to generate image ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Return results
        if (results.length === 0) {
            return NextResponse.json({ 
                error: "Failed to generate any images", 
                details: errors 
            }, { status: 500 });
        }

        if (errors.length > 0) {
            console.warn("Some images failed to generate:", errors);
        }

        return NextResponse.json({ 
            success: true,
            userId: finalUserId,
            requestId: finalRequestId,
            generatedCount: results.length,
            requestedCount: imageCount,
            images: results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Error in generate_images API:", error);
        return NextResponse.json({ 
            error: "Internal server error", 
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}