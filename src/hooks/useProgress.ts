"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Progress {
  article_id: string;
  article_read: boolean;
  quiz_completed: boolean;
  quiz_score: number | null;
}

export function useProgress() {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProgress = useCallback(async () => {
    // Don't fetch until auth is resolved
    if (authLoading) {
      return;
    }

    if (!user) {
      setProgress([]);
      setLoading(false);
      setHasFetched(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("article_id, article_read, quiz_completed, quiz_score")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching progress:", error);
      } else {
        setProgress(data || []);
      }
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Reset state when auth loading starts (user might be changing)
    if (authLoading) {
      setLoading(true);
      setHasFetched(false);
      return;
    }
    
    fetchProgress();
  }, [fetchProgress, authLoading]);

  const markArticleRead = async (articleId: string) => {
    if (!user) return { error: new Error("Not logged in") };

    const existing = progress.find((p) => p.article_id === articleId);

    if (existing) {
      const { error } = await supabase
        .from("user_progress")
        .update({ article_read: true })
        .eq("user_id", user.id)
        .eq("article_id", articleId);

      if (!error) {
        setProgress((prev) =>
          prev.map((p) =>
            p.article_id === articleId ? { ...p, article_read: true } : p
          )
        );
      }
      return { error };
    } else {
      const { error } = await supabase.from("user_progress").insert({
        user_id: user.id,
        article_id: articleId,
        article_read: true,
        quiz_completed: false,
      });

      if (!error) {
        setProgress((prev) => [
          ...prev,
          { article_id: articleId, article_read: true, quiz_completed: false, quiz_score: null },
        ]);
      }
      return { error };
    }
  };

  const markQuizCompleted = async (articleId: string, score: number) => {
    if (!user) return { error: new Error("Not logged in") };

    const existing = progress.find((p) => p.article_id === articleId);

    if (existing) {
      const { error } = await supabase
        .from("user_progress")
        .update({ quiz_completed: true, quiz_score: score })
        .eq("user_id", user.id)
        .eq("article_id", articleId);

      if (!error) {
        setProgress((prev) =>
          prev.map((p) =>
            p.article_id === articleId
              ? { ...p, quiz_completed: true, quiz_score: score }
              : p
          )
        );
      }
      return { error };
    } else {
      const { error } = await supabase.from("user_progress").insert({
        user_id: user.id,
        article_id: articleId,
        article_read: true,
        quiz_completed: true,
        quiz_score: score,
      });

      if (!error) {
        setProgress((prev) => [
          ...prev,
          { article_id: articleId, article_read: true, quiz_completed: true, quiz_score: score },
        ]);
      }
      return { error };
    }
  };

  const getArticleProgress = (articleId: string) => {
    return progress.find((p) => p.article_id === articleId) || null;
  };

  const totalArticles = 13;
  const articlesRead = progress.filter((p) => p.article_read).length;
  const quizzesCompleted = progress.filter((p) => p.quiz_completed).length;
  const overallProgress = Math.round(
    ((articlesRead + quizzesCompleted) / (totalArticles * 2)) * 100
  );

  return {
    progress,
    loading,
    markArticleRead,
    markQuizCompleted,
    getArticleProgress,
    articlesRead,
    quizzesCompleted,
    totalArticles,
    overallProgress,
    refetch: fetchProgress,
  };
}