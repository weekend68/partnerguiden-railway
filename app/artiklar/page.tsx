import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArticlesProgressBanner, AuthPromptLink } from "@/components/ArticlesProgressBanner";
import { ArticleProgressBadge } from "@/components/ArticleProgressBadge";
import { getArticles } from "@/lib/data";

export const metadata: Metadata = {
  title: "Alla artiklar",
  description:
    "Läs artiklarna i ordning eller hoppa direkt till det ämne som känns mest relevant. 13 artiklar om klimakteriet för partners.",
  alternates: { canonical: "/artiklar" },
  openGraph: { url: "/artiklar" },
};

const SITE_URL = "https://partnerguiden.se";

function getImageUrl(article: { image_url: string | null; image_filename: string }) {
  if (article.image_url) return article.image_url;
  return `/images/${article.image_filename}`;
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  const structuredDataJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Alla artiklar",
    url: `${SITE_URL}/artiklar`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: `${SITE_URL}/artikel/${article.slug}`,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredDataJsonLd) }} />
      <Header />
      <ArticlesProgressBanner />

      <main className="flex-1 container py-12">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka till start
        </Link>

        <h1 className="font-serif text-3xl md:text-4xl font-medium mb-4">Alla {articles.length} artiklar</h1>
        <p className="text-muted-foreground mb-12 max-w-2xl">
          Läs artiklarna i ordning eller hoppa direkt till det ämne som känns mest relevant just nu.
          <AuthPromptLink />
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <Link
              key={article.id}
              href={`/artikel/${article.slug}`}
              className="group bg-card rounded-lg shadow-card overflow-hidden card-hover relative"
            >
              <ArticleProgressBadge articleId={article.id} />
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={getImageUrl(article)}
                  alt={article.image_alt || article.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <div className="text-sm text-muted-foreground mb-2">
                  Artikel {index + 1} av {articles.length}
                </div>
                <h2 className="font-serif text-lg font-medium mb-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
