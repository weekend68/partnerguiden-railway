"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setAnalyticsLoggedIn } from "@/lib/analytics";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setAnalyticsLoggedIn(!!session);
    });

    // Magic links from send-magic-link/verify-email-token are generated via
    // supabase.auth.admin.generateLink(), which always returns implicit-flow
    // links (#access_token=...&refresh_token=...). @supabase/ssr's browser
    // client hardcodes flowType to "pkce" (see createBrowserClient.js) and
    // silently ignores hash-fragment tokens, so we parse and consume them
    // ourselves here instead of relying on its built-in detectSessionInUrl.
    const hash = window.location.hash;
    if (hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        // Strip the tokens from the URL immediately, before the async setSession
        // call resolves - otherwise analytics scripts (and browser history) can
        // capture the raw JWTs from location.hash in the window before cleanup.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        supabase.auth.setSession({ access_token, refresh_token });
      }
    } else {
      // THEN check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setAnalyticsLoggedIn(!!session);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
