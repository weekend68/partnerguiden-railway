import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArticleTopBanner } from "@/components/article/ArticleTopBanner";
import { ArticleImageBadges } from "@/components/article/ArticleImageBadges";
import { ArticleQuizCta } from "@/components/article/ArticleQuizCta";
import { ArticleGuestCta } from "@/components/article/ArticleGuestCta";
import { MarkArticleRead } from "@/components/article/MarkArticleRead";
import { getArticles, getArticleBySlug, getArticleFaqs, type ArticleFull } from "@/lib/data";

const SITE_URL = "https://partnerguiden.se";

function getImageUrl(article: ArticleFull) {
  if (article.image_url) return article.image_url;
  return `/images/${article.image_filename}`;
}

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const imageUrl = `${SITE_URL}${getImageUrl(article)}`;

  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/artikel/${article.slug}` },
    openGraph: {
      type: "article",
      url: `/artikel/${article.slug}`,
      title: article.title,
      description: article.excerpt,
      images: [imageUrl],
      publishedTime: article.published_at || article.updated_at,
      modifiedTime: article.updated_at,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [imageUrl],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [allArticles, article] = await Promise.all([getArticles(), getArticleBySlug(slug)]);

  if (!article) {
    notFound();
  }

  const faqs = await getArticleFaqs(article.id);

  const currentIndex = allArticles.findIndex((a) => a.slug === slug);
  const nextArticle = allArticles[currentIndex + 1];
  const prevArticle = allArticles[currentIndex - 1];

  const structuredDataJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        image: `${SITE_URL}${getImageUrl(article)}`,
        datePublished: article.published_at || article.updated_at,
        dateModified: article.updated_at,
        author: {
          "@type": "Organization",
          name: "Partnerguiden",
          url: `${SITE_URL}/om`,
        },
        publisher: {
          "@type": "Organization",
          name: "Partnerguiden: Klimakteriet",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/favicon.ico`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE_URL}/artikel/${article.slug}`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Hem", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Artiklar", item: `${SITE_URL}/artiklar` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${SITE_URL}/artikel/${article.slug}` },
        ],
      },
      ...(faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredDataJsonLd) }} />
      <MarkArticleRead articleId={article.id} slug={article.slug} />
      <Header />
      <ArticleTopBanner />

      <div className="w-full h-64 md:h-80 lg:h-96 overflow-hidden relative">
        <img
          src={getImageUrl(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover"
        />
        <ArticleImageBadges articleId={article.id} />
      </div>

      <main className="flex-1 container max-w-3xl py-12">
        <nav aria-label="Brödsmulor" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Hem
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li>
              <Link href="/artiklar" className="hover:text-foreground transition-colors">
                Artiklar
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li>
              <span
                className="text-foreground font-medium truncate max-w-[200px] inline-block align-bottom"
                title={article.title}
              >
                {article.title}
              </span>
            </li>
          </ol>
        </nav>

        <div className="text-sm text-muted-foreground mb-4">
          Artikel {currentIndex + 1} av {allArticles.length}
        </div>

        <h1 className="font-serif text-3xl md:text-4xl font-medium mb-6 text-balance">{article.title}</h1>

        <article className="prose-relateify text-lg leading-relaxed">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="font-serif text-2xl font-semibold mt-10 mb-4 text-foreground">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-serif text-xl font-medium mt-8 mb-3 text-foreground">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-5 text-foreground/90">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="my-5 pl-6 space-y-2 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-5 pl-6 space-y-2 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="text-foreground/90">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/30 pl-5 my-6 italic text-muted-foreground">
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              hr: () => <hr className="my-8 border-border" />,
            }}
          >
            {article.content}
          </ReactMarkdown>
        </article>

        <ArticleQuizCta
          articleId={article.id}
          slug={article.slug}
          currentIndex={currentIndex}
          totalArticles={allArticles.length}
          nextArticle={nextArticle}
        />

        <ArticleGuestCta />

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-between">
          {prevArticle ? (
            <Link
              href={`/artikel/${prevArticle.slug}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Föregående: {prevArticle.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextArticle && (
            <Link
              href={`/artikel/${nextArticle.slug}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors sm:text-right"
            >
              <span className="text-sm">Nästa: {nextArticle.title}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
