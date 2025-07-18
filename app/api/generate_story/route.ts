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

CRITICAL REQUIREMENTS:
1. **STRICT PROMPT ADHERENCE**: Every scene MUST directly incorporate the core elements, theme, and scenario from the original user prompt. Do not deviate from what the user specifically requested.
2. **SCENE CONSISTENCY**: All 6 scenes should be variations and progressions of the SAME core scenario described in the original prompt.
3. **MAIN FEATURE PRESERVATION**: The main features, objects, actions, and settings mentioned in the original prompt must appear in EVERY scene.
4. **NARRATIVE COHERENCE**: Each scene should be a natural progression of the same story, not different scenarios.

For each scene, provide EXTREMELY DETAILED descriptions including:
1. **Scene Overview**: Complete scenario description that DIRECTLY implements the original prompt
2. **Character Details**: Exact positioning, facial expressions, body language, clothing details
3. **Environment & Setting**: Complete background description that matches the original prompt's setting
4. **Action & Movement**: Specific character actions that fulfill the original prompt's requirements
5. **Visual Elements**: Props, objects, colors, textures, lighting conditions from the original prompt
6. **Emotional Context**: Character emotions, mood, atmosphere that enhance the original prompt
7. **Camera Perspective**: Suggested camera angle, framing, focus points
8. **Story Integration**: How this scene progresses the original prompt's narrative
9. **Original Prompt Connection**: Explicit explanation of how this scene directly implements the original user request

The story should be:
- A faithful, detailed expansion of the original user prompt
- Consistent with the core scenario throughout all scenes
- Rich in environmental details that support the original prompt
- Cohesive with smooth transitions between scenes
- Authentic and relatable human moments
- Directly connected to and expanding upon the original user prompt

Format your response as JSON with this structure:
{
  "title": "Story Title that reflects the original prompt",
  "overallStory": "Comprehensive story summary that directly implements and expands the original user prompt",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeframe": "0-5 seconds",
      "description": "EXTREMELY DETAILED scene description that directly implements the original prompt with character positioning, environment, actions, emotions, visual elements, camera perspective, and story context",
      "characterAction": "Specific detailed actions, gestures, expressions, and interactions that directly fulfill the original prompt",
      "environment": "Complete setting description that matches the original prompt's location and atmosphere",
      "mood": "Detailed emotional tone, lighting mood, atmospheric elements that enhance the original prompt",
      "props": "Comprehensive list of objects, props, visual elements that are mentioned in or support the original prompt",
      "storyContext": "How this scene directly progresses the original prompt's narrative",
      "visualDetails": "Camera angle, framing, focus, color palette, textures that best capture the original prompt",
      "originalPromptConnection": "Explicit explanation of how this scene directly implements the original user prompt"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: `Create an EXTREMELY DETAILED and immersive photo story from this prompt: "${prompt}". 

ORIGINAL USER REQUEST: "${prompt}"

CRITICAL INSTRUCTIONS:
1. **EXACT PROMPT IMPLEMENTATION**: Every scene MUST directly implement the exact scenario, objects, actions, and setting described in the original prompt.
2. **SCENE CONSISTENCY**: All 6 scenes should be variations of the SAME core scenario from the original prompt, not different scenarios.
3. **MAIN FEATURES**: The main features, objects, and actions mentioned in the original prompt must appear in EVERY scene.
4. **NO DEVIATION**: Do not add elements that are not mentioned in or related to the original prompt.

Break it down into 6 cinematic scenes (5 seconds each for a 30-second total). Each scene should be described with maximum detail including:

- **Complete scenario context** that directly implements the original prompt
- **Character positioning and expressions** that fulfill the original prompt's requirements
- **Detailed action sequences** that match the original prompt's actions
- **Rich environmental descriptions** that match the original prompt's setting
- **Visual storytelling elements** that are mentioned in or support the original prompt
- **Emotional progression** that enhances the original prompt's narrative
- **Cinematic details** that best capture the original prompt

MANDATORY REQUIREMENT: Each scene must be a direct implementation of the original user prompt: "${prompt}". The story should be a faithful expansion of what the user specifically requested, maintaining the exact core concept, theme, and scenario throughout all 6 scenes.

Make each scene feel like a professional film still with:
- Authentic human moments and natural expressions
- Rich environmental storytelling that matches the original prompt
- Clear narrative progression of the same scenario
- Visually stunning and emotionally engaging content
- Detailed descriptions that capture every visual element
- Direct implementation of the original user prompt

The story should have a complete narrative arc with setup, development, climax, and resolution, all based on the original user's vision: "${prompt}". Each scene should be so detailed that a professional photographer could immediately understand exactly how to capture it, while staying 100% true to the original user's request.`
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
        const framePrompts = storyData.scenes.map((scene: {
            description?: string;
            characterAction?: string;
            environment?: string;
            mood?: string;
            props?: string;
            storyContext?: string;
            visualDetails?: string;
            originalPromptConnection?: string;
            timeframe?: string;
        }, index: number) => {
            // Create a comprehensive prompt using all available scene details
            const basePrompt = scene.description || '';
            const characterDetails = scene.characterAction || '';
            const environmentDetails = scene.environment || '';
            const moodDetails = scene.mood || '';
            const propsDetails = scene.props || '';
            const storyContext = scene.storyContext || '';
            const visualDetails = scene.visualDetails || '';
            const originalPromptConnection = scene.originalPromptConnection || '';

            // Combine all elements into a rich, detailed prompt
            const comprehensivePrompt = `${basePrompt} ${characterDetails} Environment: ${environmentDetails} Mood: ${moodDetails} Props: ${propsDetails} ${storyContext} ${visualDetails} ${originalPromptConnection}`.trim();

            return {
                frameNumber: index + 1,
                timeframe: scene.timeframe,
                prompt: `${comprehensivePrompt}. Create a cinematic, professional photograph with rich details, perfect lighting, vibrant colors, and authentic human expressions. Make it visually stunning and emotionally engaging. This scene should directly fulfill the original user request: "${prompt}".`
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