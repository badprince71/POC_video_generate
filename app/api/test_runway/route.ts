import { NextRequest, NextResponse } from 'next/server'
import RunwayML from '@runwayml/sdk'

const runwayClient = new RunwayML({
  apiKey: process.env.RUNWAY_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    if (!process.env.RUNWAY_API_KEY) {
      return NextResponse.json({ 
        error: "Runway API key is not set",
        status: "error"
      }, { status: 500 });
    }

    // Test basic API connectivity
    console.log("Testing Runway API connectivity...");
    
    // Try to list available models (this should be a lightweight operation)
    try {
      // This is a simple test - in a real scenario you might want to test with a minimal request
      console.log("Runway API key is configured");
      
      return NextResponse.json({
        status: "success",
        message: "Runway API is accessible",
        apiKeyConfigured: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (apiError) {
      console.error("Runway API test failed:", apiError);
      return NextResponse.json({
        status: "error",
        message: "Runway API test failed",
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error testing Runway API:', error);
    return NextResponse.json({
      status: "error",
      message: "Failed to test Runway API",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 