import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, CheckCircle, Heart } from "lucide-react";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeProgressBanner } from "@/components/HomeProgressBanner";
import { getArticles } from "@/lib/data";
import heroBackground from "@/assets/hero-background.jpg";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const articles = await getArticles();

  if (!articles.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  // Server-rendered default: the first article. Logged-in visitors with
  // progress get a personalized "next article" pointer via
  // HomeProgressBanner (client-rendered after hydration) instead.
  const firstArticle = articles[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <HomeProgressBanner articles={articles} />

      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <Image
            src={heroBackground}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-background/75" />

          <div className="container max-w-4xl text-center relative z-10">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium text-foreground mb-6 text-balance animate-fade-in">
              Bli en bättre partner under klimakteriet på två veckor
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-[720px] mx-auto animate-fade-in stagger-1">
              En gratis kurs skapad för dig som partner. Lär dig de biologiska sanningarna, undvik de vanligaste
              kommunikationsfällorna och stärk er relation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in stagger-2">
              <Button asChild size="lg" className="text-base">
                <Link href={`/artikel/${firstArticle.slug}`}>
                  Börja här – läs första artikeln
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base bg-background/80 backdrop-blur-sm">
                <Link href="/artiklar">Se alla 13 artiklar</Link>
              </Button>
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-6 animate-fade-in stagger-3"
            >
              Få kursen i din inbox varje dag – börja här
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="text-center p-6 animate-fade-in stagger-1">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-xl font-medium mb-2">13 artiklar</h2>
                <p className="text-muted-foreground">
                  Väl genomtänkta texter som förklarar vad som händer och hur du kan stötta.
                </p>
              </div>
              <div className="text-center p-6 animate-fade-in stagger-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-xl font-medium mb-2">Quiz efter varje artikel</h2>
                <p className="text-muted-foreground">
                  Testa din förståelse med AI-genererade frågor. Försök igen hur många gånger du vill.
                </p>
              </div>
              <div className="text-center p-6 animate-fade-in stagger-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-serif text-xl font-medium mb-2">Stödjande ton</h2>
                <p className="text-muted-foreground">
                  Skrivet för partners, utan fackspråk. Fokus på förståelse och praktiska verktyg.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preview Article */}
        <section className="py-16 bg-muted/30">
          <div className="container max-w-4xl">
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-center mb-8">
              Första artikeln: {firstArticle.title}
            </h2>
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <img
                src={firstArticle.image_url || `/images/${firstArticle.image_filename}`}
                alt={firstArticle.image_alt || firstArticle.title}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 768px, 896px"
                loading="lazy"
                decoding="async"
                className="w-full h-64 object-cover"
              />
              <div className="p-6 md:p-8">
                <p className="text-muted-foreground mb-6 text-lg">{firstArticle.excerpt}</p>
                <Button asChild>
                  <Link href={`/artikel/${firstArticle.slug}`}>
                    Läs hela artikeln
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
