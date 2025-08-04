# Supabase Authentication Setup Guide

This guide will help you set up and configure the Supabase authentication system for your AI Video Generator application.

## 🚀 What's Been Implemented

### Authentication Features
- ✅ **Sign In Page** (`/signin`) - Email and password authentication
- ✅ **Sign Up Page** (`/signup`) - User registration with email confirmation
- ✅ **Forgot Password Page** (`/forgot-password`) - Password reset functionality
- ✅ **Protected Routes** - Automatic redirection for unauthenticated users
- ✅ **User Menu** - Display user info and sign out option
- ✅ **Landing Page** (`/landing`) - Public landing page with sign up/sign in options
- ✅ **Authentication Middleware** - API route protection
- ✅ **User-Scoped S3 Operations** - All file operations scoped to authenticated user

### File Structure
```
app/
├── signin/page.tsx              # Sign in page
├── signup/page.tsx              # Sign up page
├── forgot-password/page.tsx     # Password reset page
├── landing/page.tsx             # Public landing page
├── auth/callback/route.ts       # Auth callback handler
├── page.tsx                     # Main app (protected)
└── media-library/page.tsx       # Media library (protected)

components/
├── ProtectedRoute.tsx           # Route protection component
├── UserMenu.tsx                 # User dropdown menu
└── ui/dropdown-menu.tsx         # Dropdown menu component

lib/
├── auth-context.tsx             # Authentication context
└── supabase-config.ts          # Supabase client configuration

middleware.ts                    # Authentication middleware
```

## 📋 Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project in your Supabase dashboard
3. **Environment Variables**: Configure your local environment

## 🔧 Step-by-Step Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project name (e.g., "ai-video-generator")
5. Set a secure database password
6. Choose a region close to your users
7. Click "Create new project"

### 2. Get Project Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)
   - **service_role** key (starts with `eyJ`) - Keep this secret!

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   
   # AWS S3 Configuration (for video storage)
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name-here
   
   # Next.js Configuration
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

### 4. Configure Supabase Authentication Settings

1. In your Supabase dashboard, go to **Authentication** → **Settings**

2. **Site URL**: Set to `http://localhost:3000` for development

3. **Redirect URLs**: Add these URLs:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/signin
   http://localhost:3000/signup
   http://localhost:3000/forgot-password
   ```

4. **Email Settings**:
   - Go to **Authentication** → **Settings** → **Auth Providers**
   - Under **Email**, ensure:
     - ✅ **Enable email confirmations** is checked
     - ✅ **Enable email change confirmations** is checked
     - ✅ **Secure email change** is checked

5. **Email Templates** (Optional):
   - Go to **Authentication** → **Email Templates**
   - Customize templates for:
     - Confirm signup
     - Reset password
     - Magic link

### 5. Install Dependencies

The following packages should already be installed:
- `@supabase/supabase-js` - Supabase client
- `@radix-ui/react-dropdown-menu` - Dropdown menu component

If any are missing, install them:
```bash
npm install @supabase/supabase-js @radix-ui/react-dropdown-menu
```

## 🧪 Testing the Authentication

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test User Registration
1. Navigate to `http://localhost:3000/landing`
2. Click "Sign Up" or go to `http://localhost:3000/signup`
3. Enter a valid email and password (minimum 6 characters)
4. Click "Create account"
5. Check your email for the confirmation link
6. Click the confirmation link

### 3. Test User Sign In
1. Go to `http://localhost:3000/signin`
2. Enter your email and password
3. Click "Sign in"
4. You should be redirected to the main application

### 4. Test Protected Routes
1. Try accessing `http://localhost:3000` without signing in
2. You should be redirected to the sign-in page
3. After signing in, you should have access to all protected routes

### 5. Test User Menu
1. After signing in, look for the user icon in the top-right corner
2. Click it to see the dropdown menu
3. Verify your email is displayed
4. Test the "Sign out" functionality

## 🔒 Security Features

### User-Scoped S3 Operations
- All S3 file operations are now scoped to the authenticated user
- Files are stored in the structure: `/<USERID>/<requestId>/<folder>/`
- Users can only access their own files
- API routes are protected by authentication middleware

### Protected Routes
- Main application (`/`) - Requires authentication
- Media library (`/media-library`) - Requires authentication
- All API routes - Protected by middleware

### Authentication Flow
1. **Public Pages**: Landing page, sign in, sign up, forgot password
2. **Protected Pages**: Main app, media library, all API routes
3. **Automatic Redirects**: Unauthenticated users are redirected to sign in
4. **Session Management**: Automatic session persistence and renewal

## 🚨 Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Ensure all environment variables are set in `.env.local`
   - Check that variable names match exactly

2. **"Unable to validate email address"**
   - Use a valid email format (e.g., `test@example.com`)
   - Check Supabase project settings for email restrictions

3. **"Invalid login credentials"**
   - Ensure the user has confirmed their email
   - Verify email and password are correct

4. **"User already registered"**
   - The email is already in use, try signing in instead

5. **Confirmation emails not received**
   - Check spam folder
   - Verify email address is correct
   - Check Supabase dashboard for email delivery status

6. **API routes returning 401 errors**
   - Ensure middleware is properly configured
   - Check that user is authenticated
   - Verify service role key is set correctly

### Debug Steps

1. **Check Browser Console**: Look for JavaScript errors
2. **Check Network Tab**: Monitor API requests and responses
3. **Check Supabase Dashboard**: Monitor authentication events
4. **Check Environment Variables**: Ensure all required variables are set

## 🔄 User Flow

### New User Journey
1. User visits landing page
2. Clicks "Sign Up"
3. Enters email and password
4. Receives confirmation email
5. Confirms email address
6. Signs in to access the application

### Returning User Journey
1. User visits any page
2. If not authenticated, redirected to sign in
3. Enters credentials
4. Access granted to protected routes

### Password Reset Journey
1. User clicks "Forgot password"
2. Enters email address
3. Receives reset email
4. Clicks reset link
5. Sets new password
6. Signs in with new password

## 📱 User Interface

### Navigation
- **Public**: Landing page with sign up/sign in buttons
- **Authenticated**: Main navigation with user menu
- **User Menu**: Shows email, user ID, and sign out option

### Responsive Design
- All pages are mobile-responsive
- Modern UI with Tailwind CSS
- Consistent design language throughout

## 🔧 Customization

### Styling
- All components use Tailwind CSS classes
- Easy to customize colors, spacing, and layout
- Consistent design system with shadcn/ui components

### Functionality
- Authentication context can be extended with additional user data
- Protected route component can be customized
- User menu can be enhanced with additional options

### Email Templates
- Customize email templates in Supabase dashboard
- Brand with your logo and colors
- Modify email content and styling

## 🚀 Production Deployment

### Environment Variables
- Update all URLs to production domain
- Use production Supabase project
- Configure production email provider

### Supabase Settings
- Update Site URL to production domain
- Add production redirect URLs
- Configure production email settings

### Security
- Ensure HTTPS is enabled
- Configure proper CORS settings
- Set up monitoring and logging

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase documentation
3. Check browser console for errors
4. Verify environment variable configuration

## 🎉 Success!

Once configured, your application will have:
- ✅ Secure user authentication
- ✅ Protected routes and API endpoints
- ✅ User-scoped file operations
- ✅ Modern, responsive UI
- ✅ Complete user management flow

Users can now register, sign in, and have their own isolated workspace for video generation! 