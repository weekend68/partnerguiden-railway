"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ArrowRight, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProgress } from "@/hooks/useProgress";
import { supabase } from "@/integrations/supabase/client";
import { Footer } from "@/components/Footer";
import { Fireworks } from "@/components/Fireworks";
import { track } from "@/lib/analytics";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface ArticleForQuiz {
  id: string;
  slug: string;
  title: string;
  content: string;
}

export function QuizContent({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { markQuizCompleted, progress, totalArticles, refetch } = useProgress();

  const [article, setArticle] = useState<ArticleForQuiz | null>(null);
  const [allArticles, setAllArticles] = useState<ArticleForQuiz[]>([]);
  const [loadingArticle, setLoadingArticle] = useState(true);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const [justCompletedCourse, setJustCompletedCourse] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, slug, title, content")
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setAllArticles(data);
        const currentArticle = data.find((a) => a.slug === slug);
        setArticle(currentArticle || null);
      }
      setLoadingArticle(false);
    };

    fetchArticle();
  }, [slug]);

  useEffect(() => {
    if (!article || loadingArticle) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-quiz`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            articleTitle: article.title,
            articleContent: article.content,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 429) {
            setError("För många förfrågningar. Vänta en stund och försök igen.");
            return;
          }
          throw new Error(data.error || "Kunde inte generera quiz");
        }

        const data = await response.json();
        setQuestions(data.questions);
        track("quiz_started", { article_slug: slug ?? "" });
      } catch (err) {
        console.error("Quiz error:", err);
        setError(err instanceof Error ? err.message : "Något gick fel");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [article, loadingArticle, slug]);

  const currentArticleIndex = allArticles.findIndex((a) => a.slug === slug);
  const nextArticle = allArticles[currentArticleIndex + 1];
  const passed = score >= 1;
  const isLastArticle = currentArticleIndex === allArticles.length - 1 && allArticles.length > 0;

  useEffect(() => {
    const saveResultAndCheckCompletion = async () => {
      if (!quizComplete || !article || !passed || savingResult) return;

      track("quiz_completed", { article_slug: slug ?? "", score, passed: true });

      if (user) {
        const wasAlreadyCompleted = progress.some((p) => p.article_id === article.id && p.quiz_completed);

        if (!wasAlreadyCompleted) {
          setSavingResult(true);

          try {
            const result = await markQuizCompleted(article.id, score);

            if (!result.error) {
              await refetch();
            }
          } catch (err) {
            console.error("Error saving quiz result:", err);
          } finally {
            setSavingResult(false);
          }
        }
      }

      if (isLastArticle && passed) {
        if (user) {
          const otherQuizzesCompleted = progress.filter(
            (p) => p.quiz_completed && p.article_id !== article.id
          ).length;

          const allOthersComplete = otherQuizzesCompleted >= totalArticles - 1;

          if (allOthersComplete) {
            track("course_completed", { logged_in: true });
            setJustCompletedCourse(true);
          }
        } else {
          track("course_completed", { logged_in: false });
          setJustCompletedCourse(true);
        }
      }
    };

    saveResultAndCheckCompletion();
    // NOTE: We intentionally exclude 'progress' from deps to avoid re-running when it updates
  }, [quizComplete, article, passed, savingResult, user, markQuizCompleted, score, refetch, isLastArticle, totalArticles, slug]);

  if (loadingArticle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading text-foreground mb-4">Artikeln hittades inte</h1>
          <Button onClick={() => router.push("/artiklar")} variant="outline">
            Tillbaka till artiklarna
          </Button>
        </div>
      </div>
    );
  }

  const handleAnswer = () => {
    if (selectedAnswer === null) return;

    const isCorrect = parseInt(selectedAnswer) === questions[currentQuestion].correctIndex;
    if (isCorrect) {
      setScore(score + 1);
    }
    setHasAnswered(true);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (score < 1) {
        track("quiz_failed", { article_slug: slug ?? "", score });
      }
      setQuizComplete(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Link
            href={`/artikel/${slug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till artikeln
          </Link>

          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground font-body">Genererar quiz baserat på artikeln...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Link
            href={`/artikel/${slug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till artikeln
          </Link>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-heading text-foreground mb-2">Något gick fel</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push(`/artikel/${slug}`)}>
                  Tillbaka till artikeln
                </Button>
                <Button onClick={() => window.location.reload()}>Försök igen</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const completedQuizzes = progress.filter((p) => p.quiz_completed).length;
    const displayProgress = user ? Math.round((completedQuizzes / totalArticles) * 100) : 0;

    return (
      <div className="min-h-screen bg-background">
        {justCompletedCourse && <Fireworks duration={5000} />}

        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card className={`bg-card border-border ${justCompletedCourse ? "relative overflow-hidden" : ""}`}>
            {justCompletedCourse && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
            )}

            <CardContent className="p-8 text-center relative">
              {justCompletedCourse ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-scale-in">
                    <Trophy className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-3xl font-serif text-foreground mb-4 animate-fade-in">
                    🎉 Grattis! Du har klarat hela kursen! 🎉
                  </h2>
                  <p className="text-4xl font-heading text-primary mb-2">
                    {score} / {questions.length}
                  </p>
                  <p className="text-muted-foreground mb-8 animate-fade-in">
                    Fantastiskt! Du har läst alla artiklar och klarat alla quiz. Du har tagit ett viktigt steg för att
                    förstå och stötta din partner.
                  </p>

                  <div className="flex flex-col gap-4 justify-center">
                    <Button
                      size="lg"
                      onClick={() => router.push("/grattis")}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Se ditt diplom och dela din prestation
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                        Till startsidan
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => router.push("/artiklar")}>
                        Läs artiklarna igen
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {passed ? (
                    <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
                  ) : (
                    <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
                  )}
                  <h2 className="text-2xl font-heading text-foreground mb-4">
                    {passed ? "Quiz godkänt!" : "Inte godkänt"}
                  </h2>
                  <p className="text-4xl font-heading text-primary mb-2">
                    {score} / {questions.length}
                  </p>
                  <p className="text-muted-foreground mb-8">
                    {passed
                      ? percentage === 100
                        ? "Perfekt! Du hade alla rätt – imponerande!"
                        : "Bra jobbat! Du klarade quizet."
                      : "Du behöver minst 1 rätt för att klara quizet. Läs artikeln igen och försök på nytt!"}
                  </p>

                  {user && passed && (
                    <p className="text-sm text-muted-foreground mb-6">
                      Din framsteg: {displayProgress}% av kursen avklarad
                    </p>
                  )}

                  {!user && (
                    <Link href="/auth" className="text-sm text-primary hover:underline mb-6 block">
                      Logga in för att spara dina framsteg
                    </Link>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {!passed ? (
                      <>
                        <Button variant="outline" onClick={() => router.push(`/artikel/${slug}`)}>
                          Läs artikeln igen
                        </Button>
                        <Button onClick={() => window.location.reload()}>
                          Försök igen
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => router.push("/")}>
                          Till startsidan
                        </Button>
                        <Button variant="outline" onClick={() => router.push(`/artikel/${slug}`)}>
                          Läs artikeln igen
                        </Button>
                        {nextArticle ? (
                          <Button onClick={() => router.push(`/artikel/${nextArticle.slug}`)}>
                            Nästa artikel
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button onClick={() => router.push("/artiklar")}>Alla artiklar</Button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        <Link
          href={`/artikel/${slug}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till artikeln
        </Link>

        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-2">
            Fråga {currentQuestion + 1} av {questions.length}
          </p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <h2 className="text-xl font-heading text-foreground mb-6">{question.question}</h2>

            <RadioGroup
              value={selectedAnswer ?? ""}
              onValueChange={setSelectedAnswer}
              disabled={hasAnswered}
              className="space-y-3"
            >
              {question.options.map((option, index) => {
                const isCorrect = index === question.correctIndex;
                const isSelected = parseInt(selectedAnswer ?? "-1") === index;

                return (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                      hasAnswered
                        ? isCorrect
                          ? "bg-success/10 border-success"
                          : isSelected
                          ? "bg-destructive/10 border-destructive"
                          : "bg-muted/50 border-border"
                        : selectedAnswer === String(index)
                        ? "bg-accent border-primary"
                        : "bg-muted/30 border-border hover:bg-accent/50"
                    }`}
                  >
                    <RadioGroupItem value={String(index)} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer font-body text-foreground">
                      {option}
                    </Label>
                    {hasAnswered && isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
                    {hasAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" />}
                  </div>
                );
              })}
            </RadioGroup>

            {hasAnswered && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground font-body">{question.explanation}</p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              {!hasAnswered ? (
                <Button onClick={handleAnswer} disabled={selectedAnswer === null}>
                  Svara
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  {currentQuestion < questions.length - 1 ? "Nästa fråga" : "Se resultat"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
