import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create a default client that won't throw errors if env vars are missing
// This prevents the app from crashing during build or when env vars aren't set
let supabase: ReturnType<typeof createClient>

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Create a mock client that will log warnings instead of throwing errors
  console.warn('Supabase environment variables are not set. Some features may not work.')
  
  // Create a minimal mock client to prevent crashes
  supabase = {
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: null, error: null })
      })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          order: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
        })
      })
    })
  } as any
}

export { supabase }

// For server-side operations, you might want to use the service key
export const createServiceClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!serviceKey || !supabaseUrl) {
    console.warn('Missing Supabase service key or URL')
    return supabase // Return the same mock client
  }
  
  return createClient(supabaseUrl, serviceKey)
}

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey)
}