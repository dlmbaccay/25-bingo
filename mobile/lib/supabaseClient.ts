import { createClient } from "@supabase/supabase-js"

// Expo exposes env vars with the EXPO_PUBLIC_ prefix at build time.
// Create a .env file from .env.example and fill in your credentials.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
})
