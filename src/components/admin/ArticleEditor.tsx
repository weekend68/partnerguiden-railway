"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Eye, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FAQEditor, type FAQ } from "./FAQEditor";

interface Article {
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

interface ArticleEditorProps {
  article: Article;
  onBack: () => void;
  onSave: (article: Article) => void;
}

export function ArticleEditor({ article, onBack, onSave }: ArticleEditorProps) {
  const [formData, setFormData] = useState<Article>(article);
  const [savedData, setSavedData] = useState<Article>(article);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [savedFaqs, setSavedFaqs] = useState<FAQ[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const isPublished = !!article.published_at;

  // Fetch FAQs on mount
  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase
        .from("article_faqs")
        .select("id, question, answer, sort_order")
        .eq("article_id", article.id)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const faqData = data.map((f) => ({ ...f, isNew: false, isDeleted: false }));
        setFaqs(faqData);
        setSavedFaqs(faqData);
      }
      setLoadingFaqs(false);
    };

    fetchFaqs();
  }, [article.id]);

  // Check if FAQs have changed
  const faqsChanged = useMemo(() => {
    const visibleFaqs = faqs.filter((f) => !f.isDeleted);
    const visibleSavedFaqs = savedFaqs.filter((f) => !f.isDeleted);
    
    if (visibleFaqs.length !== visibleSavedFaqs.length) return true;
    
    return visibleFaqs.some((faq, index) => {
      const saved = visibleSavedFaqs[index];
      if (!saved) return true;
      return (
        faq.id !== saved.id ||
        faq.question !== saved.question ||
        faq.answer !== saved.answer ||
        faq.sort_order !== saved.sort_order
      );
    });
  }, [faqs, savedFaqs]);

  // Check if there are unsaved changes (compare to last saved state)
  const hasUnsavedChanges = useMemo(() => {
    const articleChanged = 
      formData.title !== savedData.title ||
      formData.slug !== savedData.slug ||
      formData.excerpt !== savedData.excerpt ||
      formData.content !== savedData.content ||
      formData.image_filename !== savedData.image_filename ||
      formData.image_alt !== savedData.image_alt;
    
    return articleChanged || faqsChanged;
  }, [formData, savedData, faqsChanged]);

  // Warn before closing browser/tab with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleChange = (field: keyof Article, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save article
      const { error: articleError } = await supabase
        .from("articles")
        .update({
          title: formData.title,
          slug: formData.slug,
          excerpt: formData.excerpt,
          content: formData.content,
          image_alt: formData.image_alt,
          image_filename: formData.image_filename,
        })
        .eq("id", article.id);

      if (articleError) throw articleError;

      // Handle FAQ operations
      const faqsToDelete = faqs.filter((f) => f.isDeleted && !f.isNew);
      const faqsToInsert = faqs.filter((f) => f.isNew && !f.isDeleted);
      const faqsToUpdate = faqs.filter((f) => !f.isNew && !f.isDeleted);

      // Delete FAQs
      if (faqsToDelete.length > 0) {
        const { error } = await supabase
          .from("article_faqs")
          .delete()
          .in("id", faqsToDelete.map((f) => f.id));
        if (error) throw error;
      }

      // Insert new FAQs
      if (faqsToInsert.length > 0) {
        const { error } = await supabase.from("article_faqs").insert(
          faqsToInsert.map((f) => ({
            article_id: article.id,
            question: f.question,
            answer: f.answer,
            sort_order: f.sort_order,
          }))
        );
        if (error) throw error;
      }

      // Update existing FAQs
      for (const faq of faqsToUpdate) {
        const { error } = await supabase
          .from("article_faqs")
          .update({
            question: faq.question,
            answer: faq.answer,
            sort_order: faq.sort_order,
          })
          .eq("id", faq.id);
        if (error) throw error;
      }

      // Refresh FAQs from database
      const { data: refreshedFaqs } = await supabase
        .from("article_faqs")
        .select("id, question, answer, sort_order")
        .eq("article_id", article.id)
        .order("sort_order", { ascending: true });

      if (refreshedFaqs) {
        const faqData = refreshedFaqs.map((f) => ({ ...f, isNew: false, isDeleted: false }));
        setFaqs(faqData);
        setSavedFaqs(faqData);
      }

      setSavedData(formData);
      toast.success("Artikeln sparad!");
      onSave(formData);
    } catch (err) {
      console.error("Error saving article:", err);
      toast.error("Kunde inte spara artikeln");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till listan
          {hasUnsavedChanges && <span className="text-amber-500">•</span>}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Dölj förhandsgranskning" : "Förhandsgranska"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Spara
          </Button>
        </div>
      </div>

      <div className={showPreview ? "grid grid-cols-2 gap-6" : ""}>
        <div className="space-y-6">
          {/* Titel, Slug & Ingress */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                />
                {isPublished && formData.slug !== article.slug && (
                  <div className="flex items-center gap-2 text-amber-600 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Att ändra slug på en publicerad artikel kan bryta befintliga länkar
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="excerpt">Ingress</Label>
                <Input
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => handleChange("excerpt", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Visas i artikellistor, mejl och som meta-beskrivning
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bild */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bild</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="image_filename">Filnamn</Label>
                <Input
                  id="image_filename"
                  value={formData.image_filename}
                  onChange={(e) => handleChange("image_filename", e.target.value)}
                  placeholder="article-exempel.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Filen ska ligga i public/images/
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image_alt">Alt-text</Label>
                <Input
                  id="image_alt"
                  value={formData.image_alt || ""}
                  onChange={(e) => handleChange("image_alt", e.target.value)}
                  placeholder="Beskriv bilden för tillgänglighet och SEO"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brödtext */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brödtext</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.content}
                onChange={(e) => handleChange("content", e.target.value)}
                rows={25}
                className="font-mono text-sm"
                placeholder="Skriv artikeln i Markdown-format..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Markdown: ## Rubrik, **fetstil**, *kursiv*, [länk](url)
              </p>
            </CardContent>
          </Card>

          {/* FAQ Editor */}
          {!loadingFaqs && (
            <FAQEditor faqs={faqs} onChange={setFaqs} />
          )}
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <Card className="sticky top-4 h-fit max-h-[calc(100vh-8rem)] overflow-auto">
            <CardHeader>
              <CardTitle className="text-lg">Förhandsgranskning</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <h1>{formData.title}</h1>
              <p className="lead text-muted-foreground">{formData.excerpt}</p>
              <ReactMarkdown>{formData.content}</ReactMarkdown>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Osparade ändringar</AlertDialogTitle>
            <AlertDialogDescription>
              Du har ändringar som inte sparats. Vill du lämna ändå?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stanna kvar</AlertDialogCancel>
            <AlertDialogAction onClick={onBack}>Lämna utan att spara</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}