"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ArticleGuestCta() {
  const { user } = useAuth();
  if (user) return null;

  return (
    <div className="mt-8 p-6 bg-primary/5 rounded-lg border border-primary/20">
      <h3 className="font-serif text-lg font-medium mb-2 text-center">Få kursen i din inbox varje dag</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">
        Få ett mail per dag med nästa artikel – så behöver du inte komma ihåg att komma tillbaka.
      </p>
      <div className="text-center">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Börja här – skriv in din e-post
        </Link>
      </div>
    </div>
  );
}
