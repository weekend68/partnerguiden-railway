"use client";

import { BookOpen, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";

export function ArticleProgressBadge({ articleId }: { articleId: string }) {
  const { user } = useAuth();
  const { getArticleProgress } = useProgress();

  if (!user) return null;

  const progress = getArticleProgress(articleId);
  const isRead = progress?.article_read;
  const quizDone = progress?.quiz_completed;

  if (!isRead && !quizDone) return null;

  return (
    <div className="absolute top-3 right-3 flex gap-1.5 z-10">
      {isRead && (
        <div className="bg-primary/90 text-primary-foreground rounded-full p-1.5" title="Artikel läst">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
      )}
      {quizDone && (
        <div className="bg-primary/90 text-primary-foreground rounded-full p-1.5" title="Quiz klarat">
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
