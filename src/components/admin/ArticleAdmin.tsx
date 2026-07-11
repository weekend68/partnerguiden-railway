"use client";

import { useState } from "react";
import { ArticleList, type Article } from "./ArticleList";
import { ArticleEditor } from "./ArticleEditor";

export function ArticleAdmin() {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const handleEditArticle = (article: Article) => {
    setSelectedArticle(article);
  };

  const handleBack = () => {
    setSelectedArticle(null);
  };

  const handleSave = (updatedArticle: Article) => {
    // Stay on editor after save, user can click back when done
  };

  if (selectedArticle) {
    return (
      <ArticleEditor
        article={selectedArticle}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return <ArticleList onEditArticle={handleEditArticle} />;
}