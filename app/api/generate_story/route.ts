import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();
        
        // Validation
        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
        }
        if (!openai.apiKey) {
            return NextResponse.json({ error: "OpenAI API key is not set" }, { status: 500 })
        }

        console.log(`Generating story from prompt: "${prompt}"`);

        // Generate rich story with scene breakdown
        const storyResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are a master storyteller and cinematic director specializing in creating immersive, detailed visual narratives. Your task is to transform a user prompt into a rich, engaging 30-second video story with 6 distinct scenes (5 seconds each).

For each scene, provide EXTREMELY DETAILED descriptions including:
1. **Scene Overview**: Complete scenario description with full context
2. **Character Details**: Exact positioning, facial expressions, body language, clothing details
3. **Environment & Setting**: Complete background description, location details, spatial relationships
4. **Action & Movement**: Specific character actions, gestures, interactions with objects/people
5. **Visual Elements**: Props, objects, colors, textures, lighting conditions
6. **Emotional Context**: Character emotions, mood, atmosphere, story progression
7. **Camera Perspective**: Suggested camera angle, framing, focus points
8. **Story Integration**: How this scene connects to the overall narrative arc

The story should be:
- Cinematic and visually stunning
- Emotionally engaging with clear character development
- Rich in environmental details and atmospheric elements
- Cohesive with smooth transitions between scenes
- Authentic and relatable human moments

Format your response as JSON with this structure:
{
  "title": "Compelling Story Title",
  "overallStory": "Comprehensive story summary with emotional arc and key themes",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeframe": "0-5 seconds",
      "description": "EXTREMELY DETAILED scene description including character positioning, environment, actions, emotions, visual elements, camera perspective, and story context",
      "characterAction": "Specific detailed actions, gestures, expressions, and interactions",
      "environment": "Complete setting description with spatial details, lighting, atmosphere",
      "mood": "Detailed emotional tone, lighting mood, atmospheric elements",
      "props": "Comprehensive list of objects, props, visual elements with descriptions",
      "storyContext": "How this scene fits into the overall narrative progression",
      "visualDetails": "Camera angle, framing, focus, color palette, textures"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: `Create an EXTREMELY DETAILED and immersive photo story from this prompt: "${prompt}". 

Break it down into 6 cinematic scenes (5 seconds each for a 30-second total). Each scene should be described with maximum detail including:

- **Complete scenario context** with full environmental details
- **Character positioning and expressions** with specific body language
- **Detailed action sequences** with precise movements and interactions
- **Rich environmental descriptions** including lighting, atmosphere, spatial relationships
- **Visual storytelling elements** like props, colors, textures, and composition
- **Emotional progression** showing character development throughout the story
- **Cinematic details** including camera angles, framing, and visual focus

Make each scene feel like a professional film still with:
- Authentic human moments and natural expressions
- Rich environmental storytelling
- Clear narrative progression from beginning to end
- Visually stunning and emotionally engaging content
- Detailed descriptions that capture every visual element

The story should have a complete narrative arc with setup, development, climax, and resolution. Each scene should be so detailed that a professional photographer could immediately understand exactly how to capture it.`
                }
            ],
            max_tokens: 3000,
            temperature: 0.7
        });

        const storyContent = storyResponse.choices[0]?.message?.content;
        if (!storyContent) {
            return NextResponse.json({ error: "Failed to generate story" }, { status: 500 });
        }

        let storyData;
        try {
            storyData = JSON.parse(storyContent);
        } catch (parseError) {
            console.error("Failed to parse story JSON:", parseError);
            return NextResponse.json({ error: "Failed to parse generated story" }, { status: 500 });
        }

        // Generate frame-specific prompts for image generation
        const framePrompts = storyData.scenes.map((scene: any, index: number) => {
            // Create a comprehensive prompt using all available scene details
            const basePrompt = scene.description || '';
            const characterDetails = scene.characterAction || '';
            const environmentDetails = scene.environment || '';
            const moodDetails = scene.mood || '';
            const propsDetails = scene.props || '';
            const storyContext = scene.storyContext || '';
            const visualDetails = scene.visualDetails || '';

            // Combine all elements into a rich, detailed prompt
            const comprehensivePrompt = `${basePrompt} ${characterDetails} Environment: ${environmentDetails} Mood: ${moodDetails} Props: ${propsDetails} ${storyContext} ${visualDetails}`.trim();

            return {
                frameNumber: index + 1,
                timeframe: scene.timeframe,
                prompt: `${comprehensivePrompt}. Create a cinematic, professional photograph with rich details, perfect lighting, vibrant colors, and authentic human expressions. Make it visually stunning and emotionally engaging.`
            };
        });

        console.log("Generated story successfully");

        return NextResponse.json({
            success: true,
            story: storyData,
            framePrompts: framePrompts,
            totalFrames: 6,
            videoDuration: "30 seconds"
        });

    } catch (error) {
        console.error("Error generating story:", error);
        return NextResponse.json({ 
            error: "Internal server error", 
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}