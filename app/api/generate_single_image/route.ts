import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Return base64 image data directly
function formatImageData(base64Data: string): string {
    return `data:image/png;base64,${base64Data}`
}

export async function POST(request: NextRequest) {
    try {
        const { image, prompt, frameIndex, totalFrames, isFirstFrame } = await request.json();
        
        // Validation
        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
        }
        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 })
        }
        if (!openai.apiKey) {
            return NextResponse.json({ error: "OpenAI API key is not set" }, { status: 500 })
        }
        if (frameIndex === undefined || totalFrames === undefined) {
            return NextResponse.json({ error: "Frame index and total frames are required" }, { status: 400 })
        }

        console.log(`Generating frame ${frameIndex + 1}/${totalFrames} with prompt: "${prompt}"`);

        // Create frame-specific prompt
        let framePrompt: string;

        let response;
        const retries = 2;
        let lastError;
        // Convert base64 to buffer for image editing
        const imageBuffer = Buffer.from(image, 'base64');
        let imageFile = new File([imageBuffer], 'reference.png', { type: 'image/png' });

        framePrompt = `Create a realistic, high-quality photograph that looks like it was taken with a professional camera. CRITICAL: The person must have the EXACT SAME FACE and identical facial features as in the reference image - same face shape, same eyes, same nose, same mouth, same hair style, same skin tone. Do not alter their facial appearance in any way. Use natural lighting, realistic colors, and genuine human expressions. Focus on photorealistic details - natural skin tones, realistic shadows, authentic environmental elements. This should be a complete photographic scene, not an animation frame. MAINTAIN PERFECT FACIAL CONSISTENCY - only change the background, pose, and setting, never the person's face or distinctive features.`;


        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (isFirstFrame) {
                    // First scene: create a realistic photograph from original image
                    framePrompt = `Create a realistic, high-quality photograph. The subject is the EXACT SAME PERSON from the reference photo - maintain their identical facial features, face shape, eye color, hair style, and all distinctive characteristics. ${prompt}. Make it look like a real photo taken with a professional camera - natural lighting, realistic colors, authentic expressions, and genuine human emotions. Use photorealistic style with natural skin tones, realistic shadows, and authentic environmental details. CRITICAL: Keep the person's face exactly the same as in the reference image. This should be a complete scene, not a frame from a video.`;
                } else {
                    // Subsequent scenes: create new realistic photographs from original image
                    framePrompt = `Create a realistic, high-quality photograph using the original reference image. CRITICAL: The person must have the EXACT SAME FACE, facial features, eye color, hair style, and appearance as in the original reference image - maintain perfect facial consistency. ${prompt}. The same person should appear in a new scene/location that follows the story progression. Make it look like a real photo taken with a professional camera - natural lighting, realistic colors, authentic expressions, and genuine human emotions. Use photorealistic style with natural skin tones, realistic shadows, and authentic environmental details. MAINTAIN IDENTICAL FACIAL FEATURES from the original image - same face shape, same eyes, same nose, same mouth, same hair. This should be a complete scene, not a frame from a video. Only change the setting and pose, never the person's face or appearance.`;
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
                    const generatedImageData = response.data[0].b64_json;
                    const generatedBuffer = Buffer.from(generatedImageData, 'base64');
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
            // Return base64 image data directly
            const imageData = formatImageData(response.data[0].b64_json);
            console.log(`Generated frame ${frameIndex + 1}`);
            
            return NextResponse.json({ 
                imageUrl: imageData,
                frameIndex: frameIndex,
                totalFrames: totalFrames,
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