"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { Progress } from "@/components/ui/progress";
import type { ArticleSummary } from "@/lib/data";

export function HomeProgressBanner({ articles }: { articles: ArticleSummary[] }) {
  const { user } = useAuth();
  const { articlesRead, quizzesCompleted, totalArticles, overallProgress, getArticleProgress } = useProgress();

  if (!user) return null;

  const nextArticle =
    articles.find((article) => {
      const progress = getArticleProgress(article.id);
      return !progress?.quiz_completed;
    }) || articles[0];

  const isFullyComplete = quizzesCompleted === totalArticles && totalArticles > 0;

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
          {isFullyComplete ? (
            <div className="text-center sm:text-left">
              <p className="text-sm">
                <span className="font-medium text-primary">🎉 Grattis! Du har klarat hela kursen!</span>{" "}
                <Link href="/grattis" className="text-primary hover:underline">
                  Se ditt diplom →
                </Link>
              </p>
            </div>
          ) : (
            nextArticle && (
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Nästa:</span>{" "}
                  <Link
                    href={`/artikel/${nextArticle.slug}`}
                    className="text-primary hover:underline truncate inline-block max-w-[250px] sm:max-w-none align-bottom"
                  >
                    {nextArticle.title}
                  </Link>
                  {getArticleProgress(nextArticle.id)?.article_read && (
                    <CheckCircle className="inline-block ml-1.5 h-4 w-4 text-primary align-text-bottom" />
                  )}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
