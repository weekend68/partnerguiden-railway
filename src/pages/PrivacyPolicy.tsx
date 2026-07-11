import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Integritetspolicy" 
        description="Läs om hur Partnerguiden: Klimakteriet samlar in, använder och skyddar dina personuppgifter."
        url="/integritetspolicy"
      />
      <Header />
      <main className="flex-1 container py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-8">
          Integritetspolicy
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <p>
            Partnerguiden: Klimakteriet värnar om din personliga integritet. Denna policy 
            beskriver hur vi samlar in, använder och skyddar dina personuppgifter.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Vilka uppgifter vi samlar in</h2>
          <p>
            När du skapar ett konto hos oss samlar vi in följande uppgifter:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>E-postadress (för inloggning och eventuella mejlutskick)</li>
            <li>Valfritt visningsnamn</li>
            <li>Din läsframsteg och quizresultat</li>
          </ul>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Hur vi använder dina uppgifter</h2>
          <p>
            Dina uppgifter används för att:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Möjliggöra inloggning och spara dina framsteg</li>
            <li>Skicka mejl med artiklar om du har valt att prenumerera</li>
            <li>Förbättra tjänsten baserat på hur den används</li>
          </ul>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Lagring och säkerhet</h2>
          <p>
            Dina uppgifter lagras säkert och skyddas med modern kryptering. Vi delar inte 
            dina uppgifter med tredje part utan ditt samtycke.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Dina rättigheter</h2>
          <p>
            Du har rätt att:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Begära information om vilka uppgifter vi har om dig</li>
            <li>Begära rättelse av felaktiga uppgifter</li>
            <li>Begära radering av dina uppgifter</li>
            <li>Avsluta din prenumeration när som helst</li>
          </ul>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Cookies</h2>
          <p>
            Vi använder endast nödvändiga cookies för att tjänsten ska fungera,
            till exempel för att hålla dig inloggad.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Statistik</h2>
          <p>
            Vi använder Umami, en cookielös analystjänst, för att förstå hur sajten
            används i stort. Umami sätter inga cookies och sparar ingen data som kan
            kopplas till dig personligen – vi ser till exempel aldrig din e-postadress
            eller ditt namn i statistiken.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Kontakt</h2>
          <p>
            Om du har frågor om hur vi hanterar dina personuppgifter är du välkommen 
            att kontakta oss.
          </p>

          <p className="text-sm text-muted-foreground mt-12">
            Senast uppdaterad: Juli 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
