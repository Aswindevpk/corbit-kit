import { createClient } from "@supabase/supabase-js"

// Falls back to a placeholder project instead of throwing, so the app always
// boots and shows its dummy-data screens even before .env.local is filled in.
// Fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (copy .env.example) to connect
// a real project — auth then works immediately; everything else stays on dummy
// data until its own feature adds real tables and queries (see src/features/).
const url = import.meta.env.VITE_SUPABASE_URL || "https://demo-project.supabase.co"
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "demo-anon-key"

export const supabase = createClient(url, anonKey)
