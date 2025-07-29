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
        const { image, prompt, frameIndex, totalFrames, isFirstFrame, style, mood } = await request.json();
        
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

        // Create frame-specific prompt with style and mood
        let framePrompt: string;
        
        // Add style and mood to the prompt if provided
        const styleMoodSuffix = style && mood ? `, ${style.toLowerCase()} style, ${mood.toLowerCase()} mood` : '';

        let response;
        const retries = 2;
        let lastError;
        // Convert base64 to buffer for image editing
        const imageBuffer = Buffer.from(image, 'base64');
        let imageFile = new File([imageBuffer], 'reference.png', { type: 'image/png' });

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
