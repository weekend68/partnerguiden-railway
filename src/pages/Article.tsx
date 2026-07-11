import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, BookCheck, CheckCircle, ChevronRight, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { track } from "@/lib/analytics";

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image_url: string | null;
  image_filename: string;
  image_alt: string | null;
  meta_title: string | null;
  published_at: string | null;
  updated_at: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

const Article = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { getArticleProgress, markArticleRead, articlesRead, quizzesCompleted, totalArticles, overallProgress } =
    useProgress();

  const [article, setArticle] = useState<Article | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id, slug, title, excerpt, content, image_url, image_filename, image_alt, meta_title, published_at, updated_at",
        )
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setAllArticles(data);
        const currentArticle = data.find((a) => a.slug === slug);
        setArticle(currentArticle || null);

        // Fetch FAQs for current article
        if (currentArticle) {
          const { data: faqData } = await supabase
            .from("article_faqs")
            .select("id, question, answer, sort_order")
            .eq("article_id", currentArticle.id)
            .order("sort_order", { ascending: true });

          if (faqData) {
            setFaqs(faqData);
          }
        }
      }
      setLoading(false);
    };

    fetchArticles();
  }, [slug]);

  const progress = article ? getArticleProgress(article.id) : null;

  const currentIndex = allArticles.findIndex((a) => a.slug === slug);
  const nextArticle = allArticles[currentIndex + 1];
  const prevArticle = allArticles[currentIndex - 1];

  // Get image URL - prefer image_url from DB, fallback to public folder
  const getImageUrl = (art: Article) => {
    if (art.image_url) return art.image_url;
    return `/images/${art.image_filename}`;
  };

  const imageFullUrl = article ? `https://partnerguiden.se${getImageUrl(article)}` : undefined;

  // Mark article as read when user scrolls to bottom
  useEffect(() => {
    if (!user || !article || progress?.article_read) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;

      // Mark as read when scrolled 80% of the page
      if (scrollPosition >= pageHeight * 0.8) {
        markArticleRead(article.id);
        track("article_read", { article_slug: slug ?? "" });
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [user, article, progress?.article_read, markArticleRead, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Laddar artikel...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl mb-4">Artikeln hittades inte</h1>
          <Button asChild>
            <Link to="/artiklar">Se alla artiklar</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Generate JSON-LD structured data for Article, Breadcrumb, and FAQ schemas
  const structuredDataJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        image: `https://partnerguiden.se${getImageUrl(article)}`,
        datePublished: article.published_at || article.updated_at,
        dateModified: article.updated_at,
        author: {
          "@type": "Organization",
          name: "Partnerguiden",
          url: "https://partnerguiden.se/om",
        },
        publisher: {
          "@type": "Organization",
          name: "Partnerguiden: Klimakteriet",
          url: "https://partnerguiden.se",
          logo: {
            "@type": "ImageObject",
            url: "https://partnerguiden.se/favicon.ico",
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://partnerguiden.se/artikel/${article.slug}`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Hem",
            item: "https://partnerguiden.se",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Artiklar",
            item: "https://partnerguiden.se/artiklar",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `https://partnerguiden.se/artikel/${article.slug}`,
          },
        ],
      },
      // Only include FAQPage if there are FAQs
      ...(faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* SEO meta tags */}
      <SEO
        title={article.title}
        description={article.excerpt}
        image={imageFullUrl}
        url={`/artikel/${article.slug}`}
        type="article"
        publishedTime={article.published_at || article.updated_at}
        modifiedTime={article.updated_at}
      />
      {/* Article & Breadcrumb Schema.org JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredDataJsonLd) }} />
      <Header />

      {/* Progress Banner (if logged in) */}
      {user && (
        <div className="bg-primary/5 border-b border-primary/10 py-3">
          <div className="container">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {articlesRead}/{totalArticles} artiklar
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {quizzesCompleted}/{totalArticles} quiz
                </span>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-[200px]">
                <Progress value={overallProgress} className="h-2" />
                <span className="text-sm font-medium text-foreground">{overallProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Article Header Image */}
      <div className="w-full h-64 md:h-80 lg:h-96 overflow-hidden relative">
        <img
          src={getImageUrl(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover"
        />
        {/* Progress badges */}
        {user && (progress?.article_read || progress?.quiz_completed) && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {progress?.article_read && (
              <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                Läst
              </div>
            )}
            {progress?.quiz_completed && (
              <div className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                Quiz klarat ({progress.quiz_score}/3)
              </div>
            )}
          </div>
        )}
      </div>

      <main className="flex-1 container max-w-3xl py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Brödsmulor" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground transition-colors">
                Hem
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li>
              <Link to="/artiklar" className="hover:text-foreground transition-colors">
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

        {/* Article Content */}
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

        {/* Quiz CTA – Next step in the journey */}
        <div className={`mt-12 rounded-xl border-2 overflow-hidden ${
          progress?.quiz_completed 
            ? 'border-primary/30 bg-primary/5' 
            : 'border-primary/40 bg-gradient-to-br from-primary/5 via-background to-accent/10'
        }`}>
          <div className="p-6 md:p-8">
            {progress?.quiz_completed ? (
              /* Completed state */
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg font-medium text-foreground">
                    Steg {currentIndex + 1} avklarat ✓
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Du fick {progress.quiz_score} av 3 rätt.{" "}
                    <button 
                      onClick={() => navigate(`/quiz/${article.slug}`)}
                      className="text-primary hover:underline"
                    >
                      Gör om quizet
                    </button>
                  </p>
                </div>
                {nextArticle && (
                  <Button onClick={() => navigate(`/artikel/${nextArticle.slug}`)} size="sm">
                    Nästa artikel
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              /* Not completed – encourage as next step */
              <div className="text-center max-w-md mx-auto">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80 mb-3">
                  <span className="w-8 h-px bg-primary/30" />
                  Nästa steg
                  <span className="w-8 h-px bg-primary/30" />
                </div>
                <h3 className="font-serif text-xl md:text-2xl font-medium mb-3 text-foreground">
                  Dags att reflektera 💡
                </h3>
                <p className="text-muted-foreground mb-6 text-sm md:text-base">
                  Tre korta frågor som hjälper dig omsätta det du läst till praktiken. 
                  Svara rätt på minst en – sedan är du redo för nästa artikel!
                </p>
                <Button 
                  onClick={() => navigate(`/quiz/${article.slug}`)} 
                  size="lg"
                  className="rounded-full px-8"
                >
                  <BookCheck className="mr-2 h-5 w-5" />
                  Starta reflektionen
                </Button>
              </div>
            )}
          </div>
          
          {/* Journey progress indicator */}
          {!progress?.quiz_completed && (
            <div className="bg-muted/30 border-t border-border/50 px-6 py-3">
              <div className="flex items-center justify-center gap-1.5">
                {allArticles.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i < currentIndex
                        ? 'w-6 bg-primary/60'
                        : i === currentIndex
                        ? 'w-8 bg-primary'
                        : 'w-4 bg-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA for non-logged-in users */}
        {!user && (
          <div className="mt-8 p-6 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-serif text-lg font-medium mb-2 text-center">Få kursen i din inbox varje dag</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Få ett mail per dag med nästa artikel – så behöver du inte komma ihåg att komma tillbaka.
            </p>
            <div className="text-center">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Börja här – skriv in din e-post
              </Link>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-between">
          {prevArticle ? (
            <Link
              to={`/artikel/${prevArticle.slug}`}
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
              to={`/artikel/${nextArticle.slug}`}
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
};

export default Article;
