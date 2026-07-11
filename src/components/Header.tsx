"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setDisplayName(null);
        return;
      }

      const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();

      setDisplayName(data?.display_name || null);
    };

    fetchProfile();
  }, [user]);

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16">
        <Link href="/" className="font-serif text-lg sm:text-xl font-semibold text-foreground leading-tight">
          <span className="sm:hidden">
            Partnerguiden:
            <br />
            Klimakteriet
          </span>
          <span className="hidden sm:inline">Partnerguiden: Klimakteriet</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/artiklar"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Alla artiklar
          </Link>
          {user ? (
            <div className="flex items-center gap-1.5 border border-border rounded-full pl-3 pr-1 py-1">
              <span className="text-sm text-muted-foreground max-w-[120px] sm:max-w-[160px] truncate">
                {displayName || user.email?.split("@")[0]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-muted"
                onClick={() => signOut()}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/auth" aria-label="Skapa konto">
                <User className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Skapa konto</span>
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;