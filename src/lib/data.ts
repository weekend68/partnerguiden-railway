import { supabasePublic as supabase } from "@/integrations/supabase/public";

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image_filename: string;
  image_url: string | null;
  image_alt: string | null;
}

export interface ArticleFull extends ArticleSummary {
  content: string;
  meta_title: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface ArticleFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export async function getArticles(): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, image_filename, image_url, image_alt")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
  return data ?? [];
}

export async function getFullArticles(): Promise<ArticleFull[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, content, image_url, image_filename, image_alt, meta_title, published_at, updated_at"
    )
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }
  return data ?? [];
}

export async function getArticleBySlug(slug: string): Promise<ArticleFull | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, content, image_url, image_filename, image_alt, meta_title, published_at, updated_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error fetching article by slug:", error);
    return null;
  }
  return data ?? null;
}

export async function getArticleFaqs(articleId: string): Promise<ArticleFaq[]> {
  const { data, error } = await supabase
    .from("article_faqs")
    .select("id, question, answer, sort_order")
    .eq("article_id", articleId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching FAQs:", error);
    return [];
  }
  return data ?? [];
}
