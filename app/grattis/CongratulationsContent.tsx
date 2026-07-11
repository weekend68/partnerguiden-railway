"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { Trophy, Share2, Twitter, Facebook, Linkedin, Copy, Check, Home, Heart, Users, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Footer } from "@/components/Footer";
import { Fireworks } from "@/components/Fireworks";
import { track } from "@/lib/analytics";

export function CongratulationsContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { quizzesCompleted, totalArticles, loading: progressLoading, refetch } = useProgress();
  const [copied, setCopied] = useState(false);
  const [showFireworks, setShowFireworks] = useState(true);
  const [hasVerifiedAccess, setHasVerifiedAccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isComplete = quizzesCompleted >= totalArticles && totalArticles > 0;

  useEffect(() => {
    if (!authLoading && user) {
      refetch();
    }
  }, [authLoading, user, refetch]);

  useEffect(() => {
    if (authLoading || progressLoading) {
      return;
    }

    if (!user) {
      setIsRedirecting(true);
      router.replace("/auth");
      return;
    }

    if (isComplete) {
      setHasVerifiedAccess(true);
    } else {
      const timer = setTimeout(() => {
        if (!isComplete) {
          setIsRedirecting(true);
          router.replace("/artiklar");
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [authLoading, progressLoading, user, isComplete, router, quizzesCompleted, totalArticles]);

  useEffect(() => {
    const timer = setTimeout(() => setShowFireworks(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  const shareText =
    "Jag har slutfört Partnerguiden om klimakteriet! 13 artiklar och quiz för att bättre förstå och stötta min partner. 💪❤️ Ta kursen du också:";
  const shareUrl = "https://partnerguiden.se";

  const handleCopyLink = async () => {
    const textToCopy = `${shareText}\n\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      track("diploma_link_copied");
      toast.success("Länk kopierad!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunde inte kopiera länken");
    }
  };

  const handleShare = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };

    track("diploma_shared", { platform });
    window.open(urls[platform], "_blank", "width=600,height=400");
  };

  if (authLoading || progressLoading || isRedirecting || !hasVerifiedAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showFireworks && <Fireworks duration={5000} />}

      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="font-serif text-lg sm:text-xl font-semibold text-foreground leading-tight">
            <span className="sm:hidden">
              Partnerguiden:
              <br />
              Klimakteriet
            </span>
            <span className="hidden sm:inline">Partnerguiden: Klimakteriet</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/artiklar" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Alla artiklar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-2xl py-8 md:py-16 px-4">
        <Card className="bg-card border-2 border-primary/20 overflow-hidden shadow-xl">
          <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-primary/15 p-8 md:p-12 text-center relative">
            <div className="absolute top-4 left-4 text-4xl opacity-20">🎓</div>
            <div className="absolute top-4 right-4 text-4xl opacity-20">🏆</div>
            <div className="absolute bottom-4 left-8 text-3xl opacity-20">⭐</div>
            <div className="absolute bottom-4 right-8 text-3xl opacity-20">💪</div>

            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-scale-in border-4 border-primary/30">
              <Trophy className="h-12 w-12 text-primary" />
            </div>

            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2 animate-fade-in">Diplom</p>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium text-foreground mb-4 animate-fade-in">
              Grattis! 🎉
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 animate-fade-in max-w-md mx-auto">
              Du har slutfört hela <span className="font-medium text-primary">Partnerguiden: Klimakteriet</span>
            </p>
          </div>

          <CardContent className="p-6 md:p-10">
            <div className="flex justify-center gap-6 md:gap-12 mb-8 animate-fade-in">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl font-heading text-primary">{totalArticles}</p>
                <p className="text-sm text-muted-foreground">artiklar lästa</p>
              </div>
              <div className="h-20 w-px bg-border self-center" />
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl font-heading text-primary">{totalArticles}</p>
                <p className="text-sm text-muted-foreground">quiz klarade</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-xl p-6 md:p-8 mb-8 text-center animate-fade-in">
              <Heart className="h-8 w-8 text-primary/60 mx-auto mb-4" />
              <p className="text-foreground/90 leading-relaxed mb-4">
                Du har tagit dig igenom alla 13 artiklar och quiz. Det kräver engagemang och vilja att förstå.
                Din partner har tur som har dig vid sin sida.
              </p>
              <p className="text-foreground/90 leading-relaxed mb-4">
                Klimakteriet är en resa, och nu har du verktygen för att vara ett ännu bättre stöd.{" "}
                <strong className="text-foreground">Fortsätt prata med varandra</strong>, var nyfiken och kom ihåg:
                ni är ett team.
              </p>
              <p className="text-lg font-serif text-primary mt-6">Kram! ❤️</p>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 md:p-8 mb-8 text-center animate-fade-in border border-primary/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-6 w-6 text-primary" />
                <h3 className="font-serif text-xl font-medium">Tipsa en vän!</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                Känner du någon annan som skulle ha nytta av kursen? Dela din prestation och inspirera fler.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Button
                  variant="outline"
                  onClick={() => handleShare("twitter")}
                  className="gap-2 h-12 bg-background hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/50"
                >
                  <Twitter className="h-5 w-5" />
                  <span className="hidden sm:inline">Twitter</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare("facebook")}
                  className="gap-2 h-12 bg-background hover:bg-[#4267B2]/10 hover:border-[#4267B2]/50"
                >
                  <Facebook className="h-5 w-5" />
                  <span className="hidden sm:inline">Facebook</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare("linkedin")}
                  className="gap-2 h-12 bg-background hover:bg-[#0077B5]/10 hover:border-[#0077B5]/50"
                >
                  <Linkedin className="h-5 w-5" />
                  <span className="hidden sm:inline">LinkedIn</span>
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="gap-2 h-12 bg-background">
                  {copied ? (
                    <>
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="hidden sm:inline">Kopierad!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" />
                      <span className="hidden sm:inline">Kopiera</span>
                    </>
                  )}
                </Button>
              </div>

              <Button size="lg" onClick={handleCopyLink} className="w-full sm:hidden gap-2 bg-primary text-primary-foreground">
                <Share2 className="h-5 w-5" />
                {copied ? "Länk kopierad!" : "Dela kursen"}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Button variant="outline" onClick={() => router.push("/artiklar")}>
                <BookOpen className="mr-2 h-4 w-4" />
                Läs artiklarna igen
              </Button>
              <Button onClick={() => router.push("/")} className="gap-2">
                <Home className="h-4 w-4" />
                Till startsidan
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
