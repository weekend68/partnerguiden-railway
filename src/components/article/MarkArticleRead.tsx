"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { track } from "@/lib/analytics";

export function MarkArticleRead({ articleId, slug }: { articleId: string; slug: string }) {
  const { user } = useAuth();
  const { getArticleProgress, markArticleRead } = useProgress();
  const progress = getArticleProgress(articleId);

  useEffect(() => {
    if (!user || progress?.article_read) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;

      if (scrollPosition >= pageHeight * 0.8) {
        markArticleRead(articleId);
        track("article_read", { article_slug: slug });
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, articleId, progress?.article_read, markArticleRead, slug]);

  return null;
}
