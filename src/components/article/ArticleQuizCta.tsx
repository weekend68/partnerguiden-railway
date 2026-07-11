"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BookCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgress } from "@/hooks/useProgress";
import type { ArticleSummary } from "@/lib/data";

export function ArticleQuizCta({
  articleId,
  slug,
  currentIndex,
  totalArticles,
  nextArticle,
}: {
  articleId: string;
  slug: string;
  currentIndex: number;
  totalArticles: number;
  nextArticle?: ArticleSummary;
}) {
  const router = useRouter();
  const { getArticleProgress } = useProgress();
  const progress = getArticleProgress(articleId);

  return (
    <div
      className={`mt-12 rounded-xl border-2 overflow-hidden ${
        progress?.quiz_completed
          ? "border-primary/30 bg-primary/5"
          : "border-primary/40 bg-gradient-to-br from-primary/5 via-background to-accent/10"
      }`}
    >
      <div className="p-6 md:p-8">
        {progress?.quiz_completed ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg font-medium text-foreground">Steg {currentIndex + 1} avklarat ✓</h3>
              <p className="text-sm text-muted-foreground">
                Du fick {progress.quiz_score} av 3 rätt.{" "}
                <button onClick={() => router.push(`/quiz/${slug}`)} className="text-primary hover:underline">
                  Gör om quizet
                </button>
              </p>
            </div>
            {nextArticle && (
              <Button onClick={() => router.push(`/artikel/${nextArticle.slug}`)} size="sm">
                Nästa artikel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80 mb-3">
              <span className="w-8 h-px bg-primary/30" />
              Nästa steg
              <span className="w-8 h-px bg-primary/30" />
            </div>
            <h3 className="font-serif text-xl md:text-2xl font-medium mb-3 text-foreground">Dags att reflektera 💡</h3>
            <p className="text-muted-foreground mb-6 text-sm md:text-base">
              Tre korta frågor som hjälper dig omsätta det du läst till praktiken. Svara rätt på minst en – sedan är
              du redo för nästa artikel!
            </p>
            <Button onClick={() => router.push(`/quiz/${slug}`)} size="lg" className="rounded-full px-8">
              <BookCheck className="mr-2 h-5 w-5" />
              Starta reflektionen
            </Button>
          </div>
        )}
      </div>

      {!progress?.quiz_completed && (
        <div className="bg-muted/30 border-t border-border/50 px-6 py-3">
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: totalArticles }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < currentIndex ? "w-6 bg-primary/60" : i === currentIndex ? "w-8 bg-primary" : "w-4 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
