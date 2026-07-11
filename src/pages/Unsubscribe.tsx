import { useSearchParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailX, CheckCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { track } from "@/lib/analytics";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const reason = searchParams.get("reason");

  useEffect(() => {
    track("unsubscribe_result", {
      status: status ?? "none",
      ...(reason ? { reason } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine the message based on status and reason
  const getContent = () => {
    if (status === "success") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />,
        title: "Du är avregistrerad",
        message: "Du kommer inte längre få mejl från Partnerguiden. Du kan fortfarande logga in och läsa artiklarna när som helst.",
      };
    }

    if (status === "error") {
      let errorMessage = "Vi kunde inte avregistrera dig. Försök igen eller kontakta oss för hjälp.";
      
      switch (reason) {
        case "expired":
          errorMessage = "Länken har gått ut. Kontakta oss för hjälp med avregistrering.";
          break;
        case "invalid_token":
          errorMessage = "Ogiltig avregistreringslänk. Signaturen kunde inte verifieras.";
          break;
        case "missing_params":
          errorMessage = "Ogiltig avregistreringslänk. Parametrar saknas.";
          break;
        case "update_failed":
          errorMessage = "Kunde inte uppdatera dina inställningar. Försök igen senare.";
          break;
        case "server_error":
          errorMessage = "Ett serverfel uppstod. Försök igen senare.";
          break;
      }

      return {
        icon: <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />,
        title: "Något gick fel",
        message: errorMessage,
      };
    }

    // Default state - no params (direct visit to page)
    return {
      icon: <MailX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />,
      title: "Avregistrering",
      message: "Använd länken i mejlet du fått för att avregistrera dig från utskicken.",
    };
  };

  const content = getContent();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {content.icon}
            <h1 className="text-2xl font-heading text-foreground mb-2">
              {content.title}
            </h1>
            <p className="text-muted-foreground mb-6">
              {content.message}
            </p>
            <Button asChild>
              <Link to="/">Till startsidan</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
