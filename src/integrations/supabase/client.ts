import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Browser client - use in Client Components. Sessions are stored in cookies
// (via @supabase/ssr) so the server can read auth state during SSR.
//
// flowType is explicitly "implicit" because our magic links are generated
// server-side via supabase.auth.admin.generateLink() (see send-magic-link
// edge function), which returns hash-fragment (#access_token=...) links,
// not PKCE (?code=...) ones. @supabase/ssr defaults to "pkce", which would
// silently ignore the hash fragment and never establish a session.
export const supabase = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "implicit" },
});
