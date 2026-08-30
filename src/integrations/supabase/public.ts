import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Plain client for public, non-session-dependent reads (articles, FAQs).
// Not cookie-aware, so it works in build-time contexts like
// generateStaticParams/generateMetadata that have no request scope.
//
// autoRefreshToken is off because this client never holds a session to
// refresh. Left on, auth-js runs a 30s setInterval for the entire life of
// the server process ("in non-browser environments the refresh token ticker
// runs always"), which just allocates and finds no session, every tick.
export const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
