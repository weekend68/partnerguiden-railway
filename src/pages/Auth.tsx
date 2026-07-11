import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, BarChart3, GraduationCap, Shield, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithMagicLink } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  // Form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call our custom magic link edge function
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: { email, name: name || undefined, redirectTo: "/" },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Något gick fel");
      }

      setEmailSent(true);
      setSubmittedEmail(email);
      track("magic_link_requested", { is_new_user: !!data.isNewUser });
    } catch (error: any) {
      console.error("Magic link error:", error);
      track("magic_link_failed", {
        reason: error instanceof TypeError ? "network" : "server",
      });
      toast({
        title: "Något gick fel",
        description: error.message || "Kunde inte skicka inloggningslänk",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const benefits = [
    {
      icon: Mail,
      title: "Dagligt mail",
      description: "Få nästa artikel direkt i din inbox – vi hjälper dig hålla kursen"
    },
    {
      icon: BarChart3,
      title: "Följ dina framsteg",
      description: "Se hur långt du kommit och vad som återstår"
    },
    {
      icon: GraduationCap,
      title: "Diplom",
      description: "Få ett diplom när du klarat alla quiz"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back link */}
      <div className="container pt-4">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Tillbaka till startsidan
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-4xl">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left side - Sales copy */}
            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl font-medium text-foreground mb-3">
                  Få kursen levererad till din inbox
                </h1>
                <p className="text-lg text-muted-foreground">
                  Ange din e-post så skickar vi en inloggningslänk. 
                  Inga lösenord att komma ihåg!
                </p>
              </div>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust signals */}
              <div className="flex items-start gap-3 pt-4 border-t border-border">
                <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Vi säljer aldrig dina uppgifter. Du kan avregistrera dig när som helst med ett klick.
                </p>
              </div>
            </div>

            {/* Right side - Form */}
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                {emailSent ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-medium text-foreground">
                      Kolla din e-post!
                    </h2>
                    <p className="text-muted-foreground">
                      Vi har skickat en inloggningslänk till<br />
                      <strong className="text-foreground">{submittedEmail}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Klicka på länken i mailet för att logga in. 
                      Länken är giltig i 1 timme.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEmailSent(false);
                        setEmail("");
                      }}
                      className="mt-4"
                    >
                      Använd annan e-post
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Namn (valfritt)</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Ditt namn"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-post</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="din@email.se"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Skicka inloggningslänk
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Genom att fortsätta godkänner du vår{" "}
                      <Link to="/integritetspolicy" className="underline hover:text-foreground">
                        integritetspolicy
                      </Link>
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
