# Fix: "Auth UserPool not configured" Error

## Problem
You're getting this error when trying to sign up:
```
AuthUserPoolException: Auth UserPool not configured.
```

This happens because AWS Amplify requires Cognito User Pool configuration, which is missing from your environment variables.

## Solution: Set up AWS Cognito User Pool

### Step 1: Create AWS Cognito User Pool

1. **Go to AWS Console**
   - Navigate to: https://console.aws.amazon.com/cognito/
   - Make sure you're in the same region as your S3 bucket (us-east-1)

2. **Create User Pool**
   - Click "Create user pool"
   - **Pool name**: `ai-video-generator-pool`
   - Click "Review defaults" and then "Create pool"

3. **Configure Sign-in Experience**
   - **Cognito user pool sign-in options**: Select "Email"
   - **User name requirements**: Select "Allow email addresses"
   - Click "Next"

4. **Configure Security Requirements**
   - **Password policy**: Choose your preference (recommend default)
   - **Multi-factor authentication**: Optional (recommend "No MFA")
   - Click "Next"

5. **Configure Sign-up Experience**
   - **Self-service sign-up**: Enabled
   - **Cognito-assisted verification and confirmation**: Enabled
   - **Required attributes**: Select "Email"
   - Click "Next"

6. **Configure Message Delivery**
   - **Email provider**: Choose "Send email with Cognito"
   - Click "Next"

7. **Integrate Your App**
   - **User pool name**: `ai-video-generator-pool`
   - **Initial app client**: Create app client
   - **App client name**: `ai-video-generator-client`
   - **Client secret**: Don't generate a client secret
   - Click "Next"

8. **Review and Create**
   - Review your settings
   - Click "Create user pool"

### Step 2: Get Your Configuration Values

After creating the user pool:

1. **Note the User Pool ID**
   - In your user pool dashboard, copy the "User pool ID"
   - Format: `us-east-1_xxxxxxxxx`

2. **Note the App Client ID**
   - Go to "App integration" → "App clients"
   - Copy the "App client ID"
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 3: Update Your Environment Variables

Add these variables to your `.env.local` file:

```env
# AWS Cognito Configuration (REQUIRED for authentication)
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COOKIE_DOMAIN=localhost
```

**Replace the placeholder values with your actual Cognito configuration.**

### Step 4: Restart Your Development Server

```bash
npm run dev
```

### Step 5: Test Authentication

1. Navigate to `/signup` to create a new account
2. Check your email for the confirmation code
3. Confirm your account at `/signin`
4. Test the protected routes

## Troubleshooting

### Common Issues:

1. **"User pool not found" error**
   - Check your `NEXT_PUBLIC_USER_POOL_ID` is correct
   - Ensure you're using the right AWS region

2. **"App client not found" error**
   - Check your `NEXT_PUBLIC_USER_POOL_CLIENT_ID` is correct
   - Make sure you didn't generate a client secret

3. **CORS errors**
   - In Cognito User Pool → App integration → App client settings
   - Add `http://localhost:3000` to "Callback URLs"
   - Add `http://localhost:3000` to "Sign out URLs"

4. **Email not received**
   - Check spam folder
   - Verify email settings in Cognito User Pool

### Verification

To verify your configuration is working:

1. Check browser console for any errors
2. Try signing up with a new email
3. Check that confirmation emails are received
4. Test sign-in after confirmation

## Security Notes

- Never commit your `.env.local` file to version control
- Use environment variables for all sensitive configuration
- Consider implementing additional security measures for production
- Regularly rotate AWS credentials 