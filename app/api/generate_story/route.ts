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

        // FIRST STORY GENERATION
        console.log("Starting first story generation...");
        const firstStoryResponse = await openai.chat.completions.create({
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
5. **AVOID SPECIFIC APPEARANCE DETAILS**: Do NOT mention specific clothing items, glasses, accessories, or appearance details that might not match the user's actual photo.

For each scene, provide EXTREMELY DETAILED descriptions including:
1. **Scene Overview**: Complete scenario description that DIRECTLY implements the original prompt
2. **Character Details**: Exact positioning, facial expressions, body language, and natural poses (avoid specific clothing/accessories)
3. **Environment & Setting**: Complete background description that matches the original prompt's setting
4. **Action & Movement**: Specific character actions that fulfill the original prompt's requirements
5. **Visual Elements**: Props, objects, colors, textures, lighting conditions from the original prompt
6. **Emotional Context**: Character emotions, mood, atmosphere that enhance the original prompt
7. **Camera Perspective**: Suggested camera angle, framing, focus points
8. **Story Integration**: How this scene progresses the original prompt's narrative
9. **Original Prompt Connection**: Explicit explanation of how this scene directly implements the original user request

IMPORTANT: Focus on the person's actions, emotions, and the scenario - NOT their clothing, glasses, or specific appearance items. Let the user's actual photo determine their appearance.

The story should be:
- A faithful, detailed expansion of the original user prompt
- Consistent with the core scenario throughout all scenes
- Rich in environmental details that support the original prompt
- Cohesive with smooth transitions between scenes
- Authentic and relatable human moments
- Directly connected to and expanding upon the original user prompt
- Appearance-neutral, focusing on actions and emotions rather than specific clothing/accessories

Format your response as JSON with this structure:
{
  "title": "Story Title that reflects the original prompt",
  "overallStory": "Comprehensive story summary that directly implements and expands the original user prompt",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeframe": "0-5 seconds",
      "description": "EXTREMELY DETAILED scene description that directly implements the original prompt with character positioning, environment, actions, emotions, visual elements, camera perspective, and story context (avoid specific clothing/accessories)",
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
5. **AVOID APPEARANCE DETAILS**: Do NOT mention specific clothing items, glasses, accessories, or appearance details. Focus on actions, emotions, and the scenario.

Break it down into 6 cinematic scenes (5 seconds each for a 30-second total). Each scene should be described with maximum detail including:

- **Complete scenario context** that directly implements the original prompt
- **Character positioning and expressions** that fulfill the original prompt's requirements (avoid specific clothing/accessories)
- **Detailed action sequences** that match the original prompt's actions
- **Rich environmental descriptions** that match the original prompt's setting
- **Visual storytelling elements** that are mentioned in or support the original prompt
- **Emotional progression** that enhances the original prompt's narrative
- **Cinematic details** that best capture the original prompt

MANDATORY REQUIREMENT: Each scene must be a direct implementation of the original user prompt: "${prompt}". The story should be a faithful expansion of what the user specifically requested, maintaining the exact core concept, theme, and scenario throughout all 6 scenes.

IMPORTANT: Focus on the person's actions, emotions, and the scenario - NOT their clothing, glasses, or specific appearance items. Let the user's actual photo determine their appearance naturally.

Make each scene feel like a professional film still with:
- Authentic human moments and natural expressions
- Rich environmental storytelling that matches the original prompt
- Clear narrative progression of the same scenario
- Visually stunning and emotionally engaging content
- Detailed descriptions that capture every visual element
- Direct implementation of the original user prompt
- Appearance-neutral descriptions focusing on actions and emotions

The story should have a complete narrative arc with setup, development, climax, and resolution, all based on the original user's vision: "${prompt}". Each scene should be so detailed that a professional photographer could immediately understand exactly how to capture it, while staying 100% true to the original user's request and avoiding any specific appearance details that might not match the user's actual photo.`
                }
            ],
            max_tokens: 3000,
            temperature: 0.7
        });

        const firstStoryContent = firstStoryResponse.choices[0]?.message?.content;
        if (!firstStoryContent) {
            return NextResponse.json({ error: "Failed to generate first story" }, { status: 500 });
        }

        let firstStoryData;
        try {
            firstStoryData = JSON.parse(firstStoryContent);
        } catch (parseError) {
            console.error("Failed to parse first story JSON:", parseError);
            return NextResponse.json({ error: "Failed to parse generated first story" }, { status: 500 });
        }

        console.log("First story generation completed successfully");

        // SECOND STORY GENERATION - using first story as input
        console.log("Starting second story generation using first story as input...");
        const secondStoryResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are a master storyteller and cinematic director specializing in creating immersive, detailed visual narratives. Your task is to take an existing story and enhance it with even more detail, depth, and cinematic quality for a 30-second video with 6 distinct scenes (5 seconds each).

CRITICAL REQUIREMENTS:
1. **ENHANCE THE EXISTING STORY**: Use the provided first story as your foundation and enhance it with more detail, emotional depth, and cinematic elements.
2. **MAINTAIN CORE ELEMENTS**: Keep all the core elements, theme, and scenario from the original user prompt and first story.
3. **ADD CINEMATIC DEPTH**: Enhance each scene with more detailed visual descriptions, emotional nuances, and professional cinematography.
4. **IMPROVE NARRATIVE FLOW**: Make the transitions between scenes even smoother and more engaging.
5. **AVOID SPECIFIC APPEARANCE DETAILS**: Do NOT mention specific clothing items, glasses, accessories, or appearance details.

For each scene, provide ENHANCED DETAILED descriptions including:
1. **Enhanced Scene Overview**: More detailed scenario description with cinematic elements
2. **Detailed Character Details**: More nuanced positioning, facial expressions, body language, and natural poses
3. **Rich Environment & Setting**: More detailed background description with atmospheric elements
4. **Dynamic Action & Movement**: More specific and engaging character actions
5. **Enhanced Visual Elements**: More detailed props, objects, colors, textures, lighting conditions
6. **Deep Emotional Context**: More nuanced character emotions, mood, atmosphere
7. **Professional Camera Perspective**: More detailed camera angle, framing, focus points
8. **Enhanced Story Integration**: More detailed explanation of narrative progression
9. **Original Prompt Connection**: More detailed explanation of how this scene implements the original user request

The enhanced story should be:
- A more detailed and cinematic version of the first story
- Even more consistent with the core scenario throughout all scenes
- Richer in environmental and atmospheric details
- More cohesive with smoother transitions between scenes
- More authentic and emotionally engaging human moments
- More directly connected to and expanding upon the original user prompt
- More appearance-neutral, focusing on actions and emotions

Format your response as JSON with this structure:
{
  "title": "Enhanced Story Title",
  "overallStory": "Enhanced comprehensive story summary with more detail and cinematic elements",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeframe": "0-5 seconds",
      "description": "ENHANCED EXTREMELY DETAILED scene description with more cinematic elements, character positioning, environment, actions, emotions, visual elements, camera perspective, and story context",
      "characterAction": "Enhanced specific detailed actions, gestures, expressions, and interactions",
      "environment": "Enhanced complete setting description with more atmospheric details",
      "mood": "Enhanced detailed emotional tone, lighting mood, atmospheric elements",
      "props": "Enhanced comprehensive list of objects, props, visual elements",
      "storyContext": "Enhanced explanation of how this scene progresses the narrative",
      "visualDetails": "Enhanced camera angle, framing, focus, color palette, textures",
      "originalPromptConnection": "Enhanced explanation of how this scene implements the original user prompt"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: `Take this first generated story and enhance it with even more detail, cinematic quality, and emotional depth:

ORIGINAL USER PROMPT: "${prompt}"

FIRST GENERATED STORY:
${JSON.stringify(firstStoryData, null, 2)}

CRITICAL INSTRUCTIONS:
1. **ENHANCE THE EXISTING STORY**: Use the first story as your foundation and make it even more detailed and cinematic.
2. **MAINTAIN CORE ELEMENTS**: Keep all the core elements, theme, and scenario from the original user prompt and first story.
3. **ADD CINEMATIC DEPTH**: Enhance each scene with more detailed visual descriptions, emotional nuances, and professional cinematography.
4. **IMPROVE NARRATIVE FLOW**: Make the transitions between scenes even smoother and more engaging.
5. **AVOID APPEARANCE DETAILS**: Do NOT mention specific clothing items, glasses, accessories, or appearance details.

Enhance the 6 cinematic scenes (5 seconds each for a 30-second total) with even more detail including:

- **Enhanced scenario context** with more cinematic elements
- **More detailed character positioning and expressions** with emotional depth
- **More dynamic action sequences** with engaging movements
- **Richer environmental descriptions** with atmospheric details
- **Enhanced visual storytelling elements** with professional cinematography
- **Deeper emotional progression** with nuanced character development
- **More detailed cinematic elements** for professional film quality

MANDATORY REQUIREMENT: Each enhanced scene must maintain the direct implementation of the original user prompt: "${prompt}" while adding more detail, depth, and cinematic quality.

IMPORTANT: Focus on the person's actions, emotions, and the scenario - NOT their clothing, glasses, or specific appearance items. Let the user's actual photo determine their appearance naturally.

Make each enhanced scene feel like a professional film still with:
- Even more authentic human moments and natural expressions
- Richer environmental storytelling with atmospheric details
- Clearer narrative progression with enhanced transitions
- More visually stunning and emotionally engaging content
- More detailed descriptions that capture every visual element
- Direct implementation of the original user prompt with enhanced detail
- More appearance-neutral descriptions focusing on actions and emotions

The enhanced story should have an even more complete narrative arc with enhanced setup, development, climax, and resolution, all based on the original user's vision: "${prompt}". Each enhanced scene should be so detailed that a professional cinematographer could immediately understand exactly how to capture it, while staying 100% true to the original user's request and avoiding any specific appearance details that might not match the user's actual photo.`
                }
            ],
            max_tokens: 4000,
            temperature: 0.7
        });

        const secondStoryContent = secondStoryResponse.choices[0]?.message?.content;
        if (!secondStoryContent) {
            return NextResponse.json({ error: "Failed to generate second story" }, { status: 500 });
        }

        let secondStoryData;
        try {
            secondStoryData = JSON.parse(secondStoryContent);
        } catch (parseError) {
            console.error("Failed to parse second story JSON:", parseError);
            return NextResponse.json({ error: "Failed to parse generated second story" }, { status: 500 });
        }

        console.log("Second story generation completed successfully");

        // Generate frame-specific prompts for image generation with FULL STORY CONTEXT
        const framePrompts = secondStoryData.scenes.map((scene: {
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
            // Create a comprehensive prompt using ALL available story details
            const basePrompt = scene.description || '';
            const characterDetails = scene.characterAction || '';
            const environmentDetails = scene.environment || '';
            const moodDetails = scene.mood || '';
            const propsDetails = scene.props || '';
            const storyContext = scene.storyContext || '';
            const visualDetails = scene.visualDetails || '';
            const originalPromptConnection = scene.originalPromptConnection || '';

            // Include the FULL STORY CONTEXT in each image prompt
            const fullStoryContext = `
FULL STORY CONTEXT:
Title: ${secondStoryData.title}
Overall Story: ${secondStoryData.overallStory}
Original User Prompt: "${prompt}"

SCENE ${index + 1} DETAILS:
${basePrompt} ${characterDetails} 
Environment: ${environmentDetails} 
Mood: ${moodDetails} 
Props: ${propsDetails} 
Story Context: ${storyContext} 
Visual Details: ${visualDetails} 
Original Prompt Connection: ${originalPromptConnection}
`.trim();

            return {
                frameNumber: index + 1,
                timeframe: scene.timeframe,
                prompt: `${fullStoryContext}. Create a cinematic, professional photograph with rich details, perfect lighting, vibrant colors, and authentic human expressions. Make it visually stunning and emotionally engaging. This scene should directly fulfill the original user request: "${prompt}". The image should capture the complete story context and scene details provided above.`
            };
        });

        console.log("Generated enhanced story successfully with full story context in image prompts");

        return NextResponse.json({
            success: true,
            originalPrompt: prompt,
            firstStory: firstStoryData,
            enhancedStory: secondStoryData,
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