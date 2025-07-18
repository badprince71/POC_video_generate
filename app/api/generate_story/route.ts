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
                    content: `You are a creative storyteller and video director. Your task is to transform a simple user prompt into a rich, engaging 30-second video story with 6 distinct scenes (5 seconds each).

For each scene, provide:
1. A detailed description of what happens
2. The character's actions and emotions
3. Background/environment details
4. Props and visual elements
5. Lighting and mood

The story should be fun, engaging, and visually interesting. Each scene should flow naturally into the next, creating a complete narrative arc.

Format your response as JSON with this structure:
{
  "title": "Story Title",
  "overallStory": "Brief story summary",
  "scenes": [
    {
             "sceneNumber": 1,
       "timeframe": "0-5 seconds",
      "description": "Detailed scene description",
      "characterAction": "What the person is doing",
      "environment": "Background and setting details",
      "mood": "Emotional tone and lighting",
      "props": "Objects and visual elements"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: `Create a rich, engaging photo story from this prompt: "${prompt}". Break it down into 6 realistic photographic scenes (5 seconds each for a 30-second total). Make it authentic, visually interesting, and full of genuine human moments. The main character should show natural expressions and the story should have a clear beginning, middle, and end. Each scene should be like a professional photograph capturing a real moment in time, not animation frames.`
                }
            ],
            max_tokens: 2000,
            temperature: 0.8
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
        const framePrompts = storyData.scenes.map((scene: { sceneNumber: number; timeframe: string; description: string; characterAction: string; environment: string; mood: string; props: string }, index: number) => {
            return {
                frameNumber: index + 1,
                timeframe: scene.timeframe,
                prompt: `${scene.description} ${scene.characterAction} Environment: ${scene.environment} Mood: ${scene.mood} Props: ${scene.props}. Make it vibrant, well-lit, and visually engaging with rich details and expressive emotions.`
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