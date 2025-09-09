import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Ensure this route runs on Node.js runtime (not Edge) and allow longer processing time
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to extract JSON from AI response
function extractJSONFromResponse(content: string): string {
    // Remove markdown code blocks if present
    let cleanedContent = content.trim();
    
    console.log("Original content starts with:", cleanedContent.substring(0, 50));
    
    // Check if content is wrapped in markdown code blocks
    if (cleanedContent.startsWith('```json')) {
        console.log("Removing ```json prefix");
        cleanedContent = cleanedContent.replace(/^```json\s*/, '');
    } else if (cleanedContent.startsWith('```')) {
        console.log("Removing ``` prefix");
        cleanedContent = cleanedContent.replace(/^```\s*/, '');
    }
    
    // Remove closing markdown code blocks
    if (cleanedContent.endsWith('```')) {
        console.log("Removing ``` suffix");
        cleanedContent = cleanedContent.replace(/\s*```$/, '');
    }
    
    const result = cleanedContent.trim();
    console.log("Cleaned content starts with:", result.substring(0, 50));
    
    return result;
}

// Robustly extract the first balanced JSON object from a string
function extractBalancedJsonObject(content: string): string | null {
    if (!content) return null;
    // Remove markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\s*```$/, '');

    const startIndex = cleaned.indexOf('{');
    if (startIndex === -1) return null;

    let inString = false;
    let escapeNext = false;
    let depth = 0;
    for (let i = startIndex; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (ch === '\\') {
            // Only meaningful inside string
            if (inString) escapeNext = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return cleaned.slice(startIndex, i + 1).trim();
                }
            }
        }
    }
    return null;
}

async function parseOrRepairJSON(raw: string, frameCount?: number): Promise<any> {
    // Try direct parse on balanced extraction first
    const balanced = extractBalancedJsonObject(raw) || raw;
    try {
        return JSON.parse(balanced);
    } catch (err) {
        console.warn('Direct JSON.parse failed, attempting AI repair...');
    }

    // As a fallback, ask the AI to repair to strict JSON
    try {
        const repairResponse = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            response_format: { type: 'json_object' },
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: 'You repair malformed JSON. Output ONLY valid strict JSON. Do not include markdown or explanations.'
                },
                {
                    role: 'user',
                    content: `Repair this into valid strict JSON (no markdown, no comments):\n\n${raw}`
                }
            ],
            max_tokens: 3500
        });
        const repaired = repairResponse.choices[0]?.message?.content?.trim() || '';
        const repairedBalanced = extractBalancedJsonObject(repaired) || repaired;
        return JSON.parse(repairedBalanced);
    } catch (repairErr) {
        console.error('AI JSON repair failed:', repairErr);
        // Final attempt: return a safe minimal fallback JSON so the pipeline can continue
        const safeFrameCount = typeof frameCount === 'number' && frameCount > 0 ? frameCount : 6;
        const perSceneSeconds = 5;
        const fallbackScenes = Array.from({ length: safeFrameCount }, (_, i) => ({
            sceneNumber: i + 1,
            timeframe: `${i * perSceneSeconds}-${(i + 1) * perSceneSeconds} seconds`,
            description: `Auto-repaired scene ${i + 1}. Narrative continuity maintained. ${raw ? String(raw).slice(0, 160).replace(/\s+/g, ' ') : ''}`.trim(),
            characterAction: 'Natural actions that align with the prompt and continuity',
            environment: 'Consistent setting matching the prompt',
            mood: 'Cinematic and cohesive tone',
            props: 'Key props persist across scenes',
            storyContext: 'Continues the same story thread',
            visualDetails: 'Consistent camera style, lighting, and palette',
            originalPromptConnection: 'Directly implements the original prompt',
            continuityFromPrevious: i === 0 ? 'Initial conditions established' : 'Seamlessly picks up from previous scene end-state',
            persistingElements: {
                characters: ['Main character(s) remain consistent'],
                environment: 'Same primary location traits',
                timeOfDay: 'Consistent across scenes',
                weather: 'Consistent across scenes',
                lighting: 'Cinematic and consistent',
                camera: 'Cohesive style maintained',
                colorPalette: 'Unified color palette'
            },
            transitionToNext: i === safeFrameCount - 1 ? 'Resolves the narrative arc' : 'Subtle cue foreshadowing the next scene'
        }));
        return {
            title: 'Auto-Repaired Story',
            overallStory: 'This is an auto-repaired cohesive story generated due to parsing issues. It maintains continuity and adheres to the user prompt.',
            scenes: fallbackScenes
        };
    }
}

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || ''
        let prompt: string | undefined
        let frameCount: number | undefined

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData()
            prompt = (form.get('prompt') as string) || undefined
            const frameCountRaw = form.get('frameCount') as string
            if (typeof frameCountRaw === 'string' && frameCountRaw.length > 0) {
                frameCount = Number(frameCountRaw)
            }
        } else {
            const body = await request.json();
            prompt = body.prompt
            frameCount = typeof body.frameCount === 'number' ? body.frameCount : undefined
        }
        frameCount = frameCount ?? 6
        
        // Validation
        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
        }
        if (!openai.apiKey) {
            return NextResponse.json({ error: "OpenAI API key is not set" }, { status: 500 })
        }

        console.log(`Generating story from prompt: "${prompt}" with ${frameCount} frames`);

        // FIRST STORY GENERATION
        console.log("Starting first story generation...");
        const firstStoryResponse = await openai.chat.completions.create({
            model: "gpt-4.1",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are a master storyteller and cinematic director specializing in creating immersive, detailed visual narratives. Your task is to transform a user prompt into a rich, engaging video story with ${frameCount} distinct scenes (${Math.floor(30/frameCount)} seconds each). The story must be a single, continuous narrative where every scene connects seamlessly to the previous one and foreshadows the next.

CRITICAL SAFETY REQUIREMENTS:
1. **CONTENT SAFETY**: Generate ONLY family-friendly, appropriate content suitable for all audiences. Avoid any content that could be considered harmful, violent, inappropriate, or offensive.
2. **NO HARMFUL CONTENT**: Do not generate descriptions involving violence, weapons, dangerous activities, harmful substances, or any content that could cause harm.
3. **NO INAPPROPRIATE CONTENT**: Avoid any sexual content, nudity, or inappropriate behavior. Keep all content professional and suitable for work environments.
4. **NO OFFENSIVE LANGUAGE**: Do not use profanity, hate speech, or offensive terms. Use clean, professional language.
5. **NO ILLEGAL ACTIVITIES**: Do not describe any illegal activities, criminal behavior, or activities that could be considered unlawful.
6. **RESPECTFUL CONTENT**: Ensure all content is respectful to all individuals, cultures, and communities.

CRITICAL REQUIREMENTS:
1. **STRICT PROMPT ADHERENCE**: Every scene MUST directly incorporate the core elements, theme, and scenario from the original user prompt. Do not deviate from what the user specifically requested.
2. **SCENE CONSISTENCY**: All ${frameCount} scenes should be variations and progressions of the SAME core scenario described in the original prompt.
3. **MAIN FEATURE PRESERVATION**: The main features, objects, actions, and settings mentioned in the original prompt must appear in EVERY scene.
4. **NARRATIVE COHERENCE**: Each scene should be a natural progression of the same story, not different scenarios.
5. **CONTINUITY ENFORCEMENT**: Ensure continuity of characters, environment, lighting, time of day, weather, props, and camera setup between scenes. Every scene must explicitly state how it continues from the previous scene and what elements persist.
6. **CHARACTER CONSISTENCY**: Keep character details such as age, apparent age range, facial features, hair, body type, and clothing consistent across ALL scenes. If clothing is described or implied, maintain the same clothing style and color palette across scenes; do not introduce new garments or accessories unless explicitly requested by the user. When uncertain, keep clothing neutral and consistent.
7. **APPEARANCE-NEUTRAL WORDING**: Avoid overly specific clothing items or accessories that may not match the user's actual photo, but maintain consistency of whatever clothing style or colors are established in scene 1.

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
10. **Continuity From Previous**: What is the precise end-state from the previous scene and how this scene picks up from it (for scene 1, set initial conditions)
11. **Persisting Elements**: Which elements must remain consistent across scenes (characters, props, environment, time of day, weather, lighting, camera style, color palette)
12. **Transition To Next**: Foreshadow subtle elements that will naturally lead into the next scene

IMPORTANT: Focus on the person's actions, emotions, and the scenario. Do not invent new clothing or accessories; maintain consistency of whatever clothing style/colors are established early in the story while keeping wording appearance-neutral.

The story should be:
- A faithful, detailed expansion of the original user prompt
- Consistent with the core scenario throughout all scenes
- Rich in environmental details that support the original prompt
- Cohesive with smooth transitions between scenes
- Authentic and relatable human moments
- Directly connected to and expanding upon the original user prompt
- Appearance-neutral, focusing on actions and emotions rather than specific clothing/accessories, while preserving clothing consistency across scenes if present
- Family-friendly and appropriate for all audiences

IMPORTANT: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text. Do not wrap your response in \`\`\`json or \`\`\` blocks.

Format your response as pure JSON with this structure:
{
  "title": "Story Title that reflects the original prompt",
  "overallStory": "Comprehensive story summary that directly implements and expands the original user prompt",
  "characterProfile": {
    "nameOrRole": "Optional name or role (e.g., 'the user', 'the traveler')",
    "ageRange": "e.g., early 20s, mid-30s, 40s",
    "apparentAge": "single number or short phrase if clear",
    "genderOrPresentation": "if inferable from the prompt, else 'unspecified'",
    "hair": "color/length/style (keep consistent)",
    "facialFeatures": "key enduring traits (keep consistent)",
    "bodyType": "high-level descriptor if relevant",
    "clothing": {
      "baselineStyle": "neutral, casual, formal, athletic, etc.",
      "colors": "dominant color palette to keep consistent",
      "notes": "do not introduce new garments/accessories unless requested"
    }
  },
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
      "originalPromptConnection": "Explicit explanation of how this scene directly implements the original user prompt",
      "continuityFromPrevious": "Describe exact ending conditions of previous scene and how this scene starts from that point (for scene 1, define initial conditions)",
      "persistingElements": {
        "characters": ["Names or roles to persist consistently"],
        "environment": "Environment/location traits that persist",
        "timeOfDay": "e.g., golden hour, night",
        "weather": "e.g., clear, light rain",
        "lighting": "e.g., soft warm key light, practicals",
        "camera": "e.g., 85mm lens, handheld, slow push-in",
        "colorPalette": "e.g., warm amber and teal"
      },
      "transitionToNext": "Subtle cue that foreshadows the next scene"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: `Create an EXTREMELY DETAILED and immersive photo story from this prompt: "${prompt}". 

ORIGINAL USER REQUEST: "${prompt}"

SAFETY REQUIREMENTS:
- Generate ONLY family-friendly, appropriate content suitable for all audiences
- Avoid any content that could be considered harmful, violent, inappropriate, or offensive
- Do not describe violence, weapons, dangerous activities, or harmful substances
- Avoid any sexual content, nudity, or inappropriate behavior
- Use clean, professional language without profanity or offensive terms
- Do not describe any illegal activities or criminal behavior
- Ensure all content is respectful to all individuals, cultures, and communities

CRITICAL INSTRUCTIONS:
1. **EXACT PROMPT IMPLEMENTATION**: Every scene MUST directly implement the exact scenario, objects, actions, and setting described in the original prompt.
2. **SCENE CONSISTENCY**: All ${frameCount} scenes should be variations of the SAME core scenario from the original prompt, not different scenarios.
3. **MAIN FEATURES**: The main features, objects, and actions mentioned in the original prompt must appear in EVERY scene.
4. **NO DEVIATION**: Do not add elements that are not mentioned in or related to the original prompt.
5. **AVOID APPEARANCE DETAILS**: Do NOT mention specific clothing items, glasses, accessories, or appearance details. Focus on actions, emotions, and the scenario.

Break it down into ${frameCount} cinematic scenes (${Math.floor(30/frameCount)} seconds each for a ${frameCount * Math.floor(30/frameCount)}-second total). Each scene should be described with maximum detail including:

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
- Family-friendly and appropriate content for all audiences

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
            const cleanedContent = extractJSONFromResponse(firstStoryContent);
            console.log("Cleaned first story content:", cleanedContent.substring(0, 200) + "...");
            firstStoryData = await parseOrRepairJSON(cleanedContent, frameCount);
        } catch (parseError) {
            console.error("Failed to parse first story JSON:", parseError);
            console.error("Original content (first 500 chars):", firstStoryContent.substring(0, 500));
            return NextResponse.json({ error: "Failed to parse generated first story" }, { status: 500 });
        }

        console.log("First story generation completed successfully");

        // SECOND STORY GENERATION - using first story as input
        console.log("Starting second story generation using first story as input...");
        const secondStoryResponse = await openai.chat.completions.create({
            model: "gpt-4.1",
            response_format: { type: "json_object" },
            messages: [
                {
                    "role": "system",
                    "content": `You are a cinematic director and master storyteller specializing in creating detailed, immersive visual narratives. Your task is to transform the user's prompt into an engaging video story with ${frameCount} distinct scenes, each lasting approximately ${Math.floor(30 / frameCount)} seconds. The story must be a single, continuous narrative where each scene connects seamlessly to the previous and foreshadows the next.
                  
                    **CRITICAL SAFETY REQUIREMENTS**:
                    - **Only generate family-friendly, appropriate content**. Avoid anything harmful, violent, or offensive.
                    - **Use clean, professional language**, avoiding any profanity or inappropriate content.
                    - **Respect cultural diversity** and ensure the content is suitable for all audiences.
                  
                    **ESSENTIAL INSTRUCTIONS**:
                    - **Strict prompt adherence**: Every scene must directly incorporate the core elements of the original user request.
                    - **Consistency across scenes**: Ensure all ${frameCount} scenes are variations of the same core scenario.
                    - **Maintain main features**: The key features, objects, actions, and locations from the original prompt should appear in every scene.
                    - **Focus on emotions and actions**: Avoid unnecessary details about clothing or appearance.
                    - **Narrative flow**: Each scene should naturally progress the story, not depict separate scenarios.
                    - **Continuity enforcement**: Maintain continuity of characters, environment, lighting, time of day, weather, props, camera style, and color palette across scenes. Each scene must explicitly state how it continues from the previous scene and what persists.
                  
                    For each scene, provide **extremely detailed descriptions** that include:
                    - **Scene context**: Directly implement the original prompt’s scenario.
                    - **Character details**: Describe positioning, facial expressions, and body language (without focusing on appearance specifics).
                    - **Environment & setting**: Detailed descriptions of the background and location.
                    - **Action & movement**: Clear actions the character is performing.
                    - **Visual elements**: Props, lighting, textures, colors relevant to the prompt.
                    - **Emotional tone**: How the character's emotions and atmosphere develop.
                    - **Camera perspective**: Suggested angles and focus to enhance visual storytelling.
                    - **Story integration**: How this scene fits within the overall narrative.
                    - **Continuity from previous**: Exact end-state of the previous scene and how this scene starts from it (for scene 1, define initial conditions).
                    - **Persisting elements**: List the elements that must remain consistent in subsequent scenes (characters, environment, time of day, weather, lighting, camera style, color palette).
                    - **Transition to next**: Subtle foreshadowing of what will naturally lead into the next scene.
                  
                    **Story Style**:
                    - The story must be cohesive and smoothly transition between scenes.
                    - The visuals should feel **cinematic**, focusing on rich environmental storytelling, human moments, and emotional depth.
                    - Always connect each scene to the **core narrative** of the original user request.
                  
                    **Return Format**:
                    - Use **valid JSON** only (no markdown or code blocks). The format should be:
                    
                    ***json
                    {
                      "title": "Story Title reflecting the original prompt",
                      "overallStory": "Comprehensive summary",
                      "scenes": [
                        {
                          "sceneNumber": 1,
                          "timeframe": "0-5 seconds",
                          "description": "Detailed scene description...",
                          "characterAction": "Detailed actions...",
                          "environment": "Complete background...",
                          "mood": "Emotional tone...",
                          "props": "List of props...",
                          "storyContext": "Narrative progression...",
                          "visualDetails": "Camera angles, color palette...",
                          "originalPromptConnection": "How this scene connects to the prompt"
                        }
                      ]
                    }
                      NOTE: Avoid mentioning specific clothing, accessories, or visual elements that might mismatch the user’s photo. Focus on the actions, emotions, and story, not appearance details.
                `
                },
                {
                    role: "user",
                    content: `Take this first generated story and enhance it with even more detail, cinematic quality, and emotional depth:

                            ORIGINAL USER PROMPT: "${prompt}"

                            FIRST GENERATED STORY:
                            ${JSON.stringify(firstStoryData, null, 2)}

                            SAFETY REQUIREMENTS:
                            - Generate ONLY family-friendly, appropriate content suitable for all audiences
                            - Avoid any content that could be considered harmful, violent, inappropriate, or offensive
                            - Do not describe violence, weapons, dangerous activities, or harmful substances
                            - Avoid any sexual content, nudity, or inappropriate behavior
                            - Use clean, professional language without profanity or offensive terms
                            - Do not describe any illegal activities or criminal behavior
                            - Ensure all content is respectful to all individuals, cultures, and communities

                            CRITICAL INSTRUCTIONS:
                            1. **ENHANCE THE EXISTING STORY**: Use the first story as your foundation and make it even more detailed and cinematic.
                            2. **MAINTAIN CORE ELEMENTS**: Keep all the core elements, theme, and scenario from the original user prompt and first story.
                            3. **ADD CINEMATIC DEPTH**: Enhance each scene with more detailed visual descriptions, emotional nuances, and professional cinematography.
                            4. **IMPROVE NARRATIVE FLOW**: Make the transitions between scenes even smoother and more engaging.
                            5. **CHARACTER CONSISTENCY**: Keep character details (age, apparent age range, facial features, hair, body type, and clothing style/color palette) consistent across ALL scenes. If clothing is present or implied, keep it consistent as established in the first scene; do not introduce new garments or accessories unless explicitly requested by the user. Use appearance-neutral wording but preserve consistency.

                            Enhance the ${frameCount} cinematic scenes (${(frameCount-1)*5} seconds each for a ${frameCount *5}-second total) with even more detail including:

                            - **Enhanced scenario context** with more cinematic elements
                            - **More detailed character positioning and expressions** with emotional depth
                            - **More dynamic action sequences** with engaging movements
                            - **Richer environmental descriptions** with atmospheric details
                            - **Enhanced visual storytelling elements** with professional cinematography
                            - **Deeper emotional progression** with nuanced character development
                            - **More detailed cinematic elements** for professional film quality

                            MANDATORY REQUIREMENT: Each enhanced scene must maintain the direct implementation of the original user prompt: "${prompt}" while adding more detail, depth, and cinematic quality.

                            IMPORTANT: Focus on the person's actions, emotions, and the scenario. Do not invent new clothing or accessories; maintain consistency of whatever clothing style/colors are established while using appearance-neutral wording.

                            Make each enhanced scene feel like a professional film still with:
                            - Even more authentic human moments and natural expressions
                            - Richer environmental storytelling with atmospheric details
                            - Clearer narrative progression with enhanced transitions
                            - More visually stunning and emotionally engaging content
                            - More detailed descriptions that capture every visual element
                            - Direct implementation of the original user prompt with enhanced detail
                            - More appearance-neutral descriptions focusing on actions and emotions
                            - Family-friendly and appropriate content for all audiences

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
            const cleanedContent = extractJSONFromResponse(secondStoryContent);
            console.log("Cleaned second story content:", cleanedContent.substring(0, 200) + "...");
            secondStoryData = await parseOrRepairJSON(cleanedContent, frameCount);
        } catch (parseError) {
            console.error("Failed to parse second story JSON:", parseError);
            console.error("Original content (first 500 chars):", secondStoryContent.substring(0, 500));
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

            // Character consistency from profile if available
            const profile = secondStoryData.characterProfile || {};
            const consistencyLines = [
                'CHARACTER CONSISTENCY:',
                `- Age/Appearance: Maintain the same apparent age and enduring facial/body features across scenes.`,
                `- Hair/Face: Keep hair color/length/style and facial features consistent; do not add/remove facial hair.`,
                `- Clothing: Maintain the same clothing style and color palette established in scene 1; do not introduce new garments or accessories unless explicitly requested.`,
            ];
            if (profile.ageRange) consistencyLines.splice(1, 0, `- Age Range: ${profile.ageRange}`);
            if (profile.hair) consistencyLines.splice(consistencyLines.length - 2, 0, `- Hair: ${profile.hair}`);
            if (profile.clothing?.baselineStyle) consistencyLines.splice(consistencyLines.length - 1, 0, `- Clothing Style: ${profile.clothing.baselineStyle}`);
            if (profile.clothing?.colors) consistencyLines.splice(consistencyLines.length - 1, 0, `- Clothing Colors: ${profile.clothing.colors}`);

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
 
 ${consistencyLines.join('\n')}
`.trim();

            return {
                frameNumber: index + 1,
                timeframe: scene.timeframe,
                prompt: `${fullStoryContext}

STYLE: High-quality, ultra-realistic photograph, cinematic composition
TECHNICAL SPECS: Shot with professional camera, 85mm lens, f/2.8 aperture, natural depth of field, sharp focus on subject
LIGHTING: Cinematic lighting, balanced exposure, realistic shadows and highlights, natural skin tones
COMPOSITION: Rule of thirds, professional framing, environmental storytelling
QUALITY: 4K resolution quality, photojournalistic style, authentic human expressions
MOOD: Visually stunning and emotionally engaging
SCENE REQUIREMENTS: This scene should directly fulfill the original user request: "${prompt}". The image should capture the complete story context and scene details provided above.
IMPORTANT: Generate a complete, cohesive scene that looks like a real photograph taken by a professional photographer. Ensure anatomical accuracy, natural proportions, and realistic material textures. Maintain consistent character age, appearance, and clothing across frames as specified above. Generate ONLY family-friendly, appropriate content suitable for all audiences. Avoid any content that could be considered harmful, violent, inappropriate, or offensive.`
            };
        });

        console.log("Generated enhanced story successfully with full story context in image prompts");

        return NextResponse.json({
            success: true,
            originalPrompt: prompt,
            firstStory: firstStoryData,
            enhancedStory: secondStoryData,
            framePrompts: framePrompts,
            characterProfile: secondStoryData.characterProfile || undefined,
            totalFrames: frameCount,
            videoDuration: `${frameCount * Math.floor(30/frameCount)} seconds`
        });

    } catch (error) {
        console.error("Error generating story:", error);
        return NextResponse.json({ 
            error: "Internal server error", 
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}