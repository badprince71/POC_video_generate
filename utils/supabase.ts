import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side operations, you might want to use the service key
export const createServiceClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!serviceKey) {
    throw new Error('Missing Supabase service key')
  }
  
  return createClient(supabaseUrl, serviceKey)
}
