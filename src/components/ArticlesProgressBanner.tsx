"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { Progress } from "@/components/ui/progress";

export function ArticlesProgressBanner() {
  const { user } = useAuth();
  const { articlesRead, quizzesCompleted, totalArticles, overallProgress } = useProgress();

  if (!user) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/10 py-4">
      <div className="container">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-heading text-primary">{articlesRead}</p>
                <p className="text-xs text-muted-foreground">av {totalArticles} artiklar</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-heading text-primary">{quizzesCompleted}</p>
                <p className="text-xs text-muted-foreground">av {totalArticles} quiz</p>
              </div>
            </div>
            <div className="flex-1 max-w-xs w-full">
              <div className="flex items-center justify-between text-sm mb-2 gap-4">
                <span className="text-muted-foreground">Din kunskapsresa:</span>
                <span className="font-medium text-foreground">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthPromptLink() {
  const { user } = useAuth();
  if (user) return null;

  return (
    <Link href="/auth" className="block mt-2 text-primary hover:underline">
      Logga in för att spara dina framsteg.
    </Link>
  );
}
