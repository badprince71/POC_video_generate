# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication to replace AWS Cognito in your video generation application.

## Prerequisites

- A Supabase account (free tier available at https://supabase.com)
- Your Next.js application

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter a project name (e.g., "video-generator-poc")
5. Enter a database password (save this securely)
6. Choose a region close to your users
7. Click "Create new project"

## Step 2: Get Your Project Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)

## Step 3: Configure Environment Variables

1. Copy `env.example` to `.env.local`:
   ```bash
   cp env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   
   # AWS S3 Configuration (for video storage)
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name-here
   
   # User ID for testing
   USER_ID=user
   
   # Next.js Configuration
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

## Step 4: Configure Authentication Settings

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following settings:

### Site URL
- Set to `http://localhost:3000` for development
- Set to your production URL for production

### Redirect URLs
Add these redirect URLs:
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/signin`
- `http://localhost:3000/signup`
- Your production URLs when deploying

### Email Templates (Optional)
1. Go to **Authentication** → **Email Templates**
2. Customize the email templates for:
   - Confirm signup
   - Reset password
   - Magic link

### Email Restrictions (Important)
1. Go to **Authentication** → **Settings** → **Auth Providers**
2. Under **Email**, make sure:
   - **Enable email confirmations** is checked
   - **Enable email change confirmations** is checked
   - **Secure email change** is checked
3. Check if there are any email domain restrictions that might be blocking your test emails

## Step 5: Configure Email Provider

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. You can use Supabase's built-in email service or configure your own SMTP provider
3. For production, consider using a service like SendGrid, Mailgun, or AWS SES

## Step 6: Test the Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/signup`
3. Create a new account
4. Check your email for the confirmation link
5. Click the confirmation link
6. Try signing in at `http://localhost:3000/signin`

## Step 7: Database Schema (Optional)

If you need to store additional user data, you can create custom tables in Supabase:

```sql
-- Example: Create a profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

## Step 8: Production Deployment

When deploying to production:

1. Update your environment variables with production values
2. Update the Site URL and Redirect URLs in Supabase dashboard
3. Configure a production email provider
4. Set up proper CORS settings if needed

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Make sure you've copied the correct URL and anon key from your Supabase dashboard
   - Ensure the environment variables are prefixed with `NEXT_PUBLIC_`

2. **"Unable to validate email address: invalid format"**
   - This error occurs when Supabase rejects the email format
   - Check that you're using a valid email format (e.g., `user@domain.com`)
   - Ensure the email doesn't contain extra spaces or special characters
   - Try using a simple email like `test@example.com` for testing
   - Check your Supabase project settings for any email restrictions

3. **"Invalid login credentials"**
   - Check that the user has confirmed their email
   - Verify the email and password are correct

4. **"User already registered"**
   - The email is already in use, try signing in instead

5. **Confirmation emails not received**
   - Check your spam folder
   - Verify the email address is correct
   - Check Supabase dashboard for email delivery status

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Supabase GitHub](https://github.com/supabase/supabase)

## Migration from AWS Cognito

If you're migrating from AWS Cognito:

1. **User Data**: You'll need to manually migrate existing users or have them re-register
2. **Passwords**: Users will need to reset their passwords as they can't be migrated
3. **Sessions**: Existing sessions will be invalidated
4. **Storage**: Your S3 storage configuration remains the same

## Security Considerations

1. **Row Level Security**: Enable RLS on all tables that contain user data
2. **API Keys**: Never expose your service role key in client-side code
3. **Environment Variables**: Keep your environment variables secure
4. **HTTPS**: Always use HTTPS in production
5. **Rate Limiting**: Consider implementing rate limiting for auth endpoints 