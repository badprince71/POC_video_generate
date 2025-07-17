import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Ensure uploads directory exists
async function ensureUploadsDir() {
    const uploadsDir = join(process.cwd(), 'public', 'generated-images')
    if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
    }
    return uploadsDir
}

// Save base64 image to file system
async function saveImageToFile(base64Data: string, filename: string): Promise<string> {
    const uploadsDir = await ensureUploadsDir()
    const filepath = join(uploadsDir, filename)
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64')
    await writeFile(filepath, buffer)
    
    // Return public URL path
    return `/generated-images/${filename}`
}

// Generate unique filename
function generateFilename(index: number): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `generated-${timestamp}-${index}-${random}.png`
}

export async function POST(request: NextRequest) {
    try {
        const { image, prompt, numImages = 5 } = await request.json();
        
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

        const imageCount = numImages || 3;
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

        const imageUrls: string[] = [];
        const errors: string[] = [];
        let currentReferenceImage = image; // Start with the original uploaded image

        // Generate images sequentially, each based on the previous one
        for (let i = 0; i < imageCount; i++) {
            try {
                console.log(`Generating image ${i + 1}/${imageCount}`);
                
                // Create frame-specific prompt
                let framePrompt: string;
                if (i === 0) {
                    // First frame: based on original image and prompt
                    framePrompt = `Create the first frame of a ${imageCount}-frame animation sequence. ${prompt}. The subject of the images is the person in the photo. Maintain the same face, pose style, clothing, lighting, and background. This is the starting position of the animation sequence.`;
                } else {
                    // Subsequent frames: continue the action from previous frame
                    framePrompt = `Create frame ${i + 1} of a ${imageCount}-frame animation sequence continuing from the previous frame. ${prompt}. Show the next small progression of the action. The subject should have the same face, pose style, clothing, lighting, and background as the previous frame. Ensure natural movement and minimal frame-to-frame differences for smooth animation.`;
                }
                
                // Generate single image using DALL-E 3
                const response = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: framePrompt,
                    n: 1,
                    size: "1024x1024",
                    quality: "standard",
                    response_format: "b64_json",
                });

                if (response.data && response.data[0] && response.data[0].b64_json) {
                    // Save the generated image to file system
                    const filename = generateFilename(i);
                    const imagePath = await saveImageToFile(response.data[0].b64_json, filename);
                    imageUrls.push(imagePath);
                    console.log(`Generated image ${i + 1}: ${imagePath}`);
                    
                    // Update reference image for next iteration (use the just-generated image)
                    currentReferenceImage = response.data[0].b64_json;
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
        if (imageUrls.length === 0) {
            return NextResponse.json({ 
                error: "Failed to generate any images", 
                details: errors 
            }, { status: 500 });
        }

        if (errors.length > 0) {
            console.warn("Some images failed to generate:", errors);
        }

        return NextResponse.json({ 
            imageUrls,
            generatedCount: imageUrls.length,
            requestedCount: imageCount,
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