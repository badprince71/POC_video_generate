-- Database Schema for AI Video Generator
-- Run this in your Supabase SQL editor

-- Create video_sessions table
CREATE TABLE IF NOT EXISTS video_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    original_prompt TEXT NOT NULL,
    video_duration INTEGER NOT NULL,
    frame_count INTEGER NOT NULL,
    style VARCHAR(100) NOT NULL,
    mood VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'frames_generated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create video_frames table
CREATE TABLE IF NOT EXISTS video_frames (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    frame_number INTEGER NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scene_story TEXT,
    story_title VARCHAR(255),
    story_overview TEXT,
    style VARCHAR(100),
    mood VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id) ON DELETE CASCADE
);

-- Create video_clips table for storing generated video clips
CREATE TABLE IF NOT EXISTS video_clips (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    clip_number INTEGER NOT NULL,
    start_frame INTEGER NOT NULL,
    end_frame INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    optimized_prompt TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id) ON DELETE CASCADE
);

-- Create final_videos table for storing merged videos
CREATE TABLE IF NOT EXISTS final_videos (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    video_url TEXT NOT NULL,
    total_clips INTEGER NOT NULL,
    duration VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES video_sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_sessions_user_id ON video_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_session_id ON video_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_video_frames_session_id ON video_frames(session_id);
CREATE INDEX IF NOT EXISTS idx_video_frames_frame_number ON video_frames(frame_number);
CREATE INDEX IF NOT EXISTS idx_video_clips_session_id ON video_clips(session_id);
CREATE INDEX IF NOT EXISTS idx_final_videos_session_id ON final_videos(session_id);

-- DISABLE Row Level Security for development
-- This allows all operations without authentication requirements
ALTER TABLE video_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE video_frames DISABLE ROW LEVEL SECURITY;
ALTER TABLE video_clips DISABLE ROW LEVEL SECURITY;
ALTER TABLE final_videos DISABLE ROW LEVEL SECURITY;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_video_sessions_updated_at 
    BEFORE UPDATE ON video_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to allow all operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert sample data (optional, for testing)
-- INSERT INTO video_sessions (session_id, user_id, original_prompt, video_duration, frame_count, style, mood) 
-- VALUES ('test_session_1', 'test_user_1', 'A person walking in a park', 30, 6, 'Realistic', 'Vibrant');

-- Note: This schema disables RLS for development purposes
-- For production, you should enable RLS and create proper policies based on your authentication system 