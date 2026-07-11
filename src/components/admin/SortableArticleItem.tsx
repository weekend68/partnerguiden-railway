"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, GripVertical } from "lucide-react";
import type { Article } from "./ArticleList";

interface SortableArticleItemProps {
  article: Article;
  onEdit: (article: Article) => void;
}

export function SortableArticleItem({ article, onEdit }: SortableArticleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/50 transition-colors ${isDragging ? "shadow-lg" : ""}`}
    >
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
            aria-label="Dra för att ändra ordning"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          
          <div className="flex-1 min-w-0" onClick={() => onEdit(article)}>
            <div className="flex items-center gap-2 mb-1 cursor-pointer">
              <Badge variant="outline" className="shrink-0">
                #{article.sort_order + 1}
              </Badge>
              <h3 className="font-medium truncate">{article.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {article.excerpt}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Slug: {article.slug} • Uppdaterad:{" "}
              {new Date(article.updated_at).toLocaleDateString("sv-SE")}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onEdit(article)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}