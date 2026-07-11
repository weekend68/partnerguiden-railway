"use client";

import { CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";

export function ArticleImageBadges({ articleId }: { articleId: string }) {
  const { user } = useAuth();
  const { getArticleProgress } = useProgress();

  if (!user) return null;

  const progress = getArticleProgress(articleId);
  if (!progress?.article_read && !progress?.quiz_completed) return null;

  return (
    <div className="absolute bottom-4 right-4 flex gap-2">
      {progress?.article_read && (
        <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4" />
          Läst
        </div>
      )}
      {progress?.quiz_completed && (
        <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4" />
          Quiz klarat ({progress.quiz_score}/3)
        </div>
      )}
    </div>
  );
}
