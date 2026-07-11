"use client";

import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { Progress } from "@/components/ui/progress";

export function ArticleTopBanner() {
  const { user } = useAuth();
  const { articlesRead, quizzesCompleted, totalArticles, overallProgress } = useProgress();

  if (!user) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/10 py-3">
      <div className="container">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {articlesRead}/{totalArticles} artiklar
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {quizzesCompleted}/{totalArticles} quiz
            </span>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-[200px]">
            <Progress value={overallProgress} className="h-2" />
            <span className="text-sm font-medium text-foreground">{overallProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
