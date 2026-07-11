"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableArticleItem } from "./SortableArticleItem";

export interface Article {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string;
  content: string;
  image_url: string | null;
  image_alt: string | null;
  image_filename: string;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

interface ArticleListProps {
  onEditArticle: (article: Article) => void;
}

export function ArticleList({ onEditArticle }: ArticleListProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error("Error fetching articles:", err);
      toast.error("Kunde inte hämta artiklar");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = articles.findIndex((a) => a.id === active.id);
    const newIndex = articles.findIndex((a) => a.id === over.id);

    const newArticles = arrayMove(articles, oldIndex, newIndex);
    
    // Update local state immediately for responsive UI
    const updatedArticles = newArticles.map((article, index) => ({
      ...article,
      sort_order: index,
    }));
    setArticles(updatedArticles);

    // Save to database
    setSaving(true);
    try {
      const updates = updatedArticles.map((article) => ({
        id: article.id,
        sort_order: article.sort_order,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("articles")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast.success("Artikelordning uppdaterad");
    } catch (err) {
      console.error("Error updating article order:", err);
      toast.error("Kunde inte spara ny ordning");
      // Revert on error
      fetchArticles();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Inga artiklar i databasen</h3>
          <p className="text-muted-foreground mb-4">
            Artiklarna behöver seedas till databasen först.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {articles.length} artiklar i databasen
          {saving && <span className="text-sm text-muted-foreground ml-2">(sparar...)</span>}
        </h2>
        <Button variant="outline" onClick={fetchArticles} className="gap-2" disabled={saving}>
          <RefreshCw className="h-4 w-4" />
          Uppdatera
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Dra och släpp för att ändra ordning på artiklarna.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={articles.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {articles.map((article) => (
              <SortableArticleItem
                key={article.id}
                article={article}
                onEdit={onEditArticle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}