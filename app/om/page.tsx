import type { Metadata } from "next";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Om Partnerguiden",
  description:
    "Partnerguiden: Klimakteriet är skapad för dig som vill förstå och stötta din partner genom klimakteriet.",
  alternates: { canonical: "/om" },
  openGraph: { url: "/om" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-8">Om Partnerguiden</h1>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <p className="text-lg">
            Partnerguiden: Klimakteriet är skapad för dig som vill förstå och stötta din partner genom klimakteriet.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Varför Partnerguiden?</h2>
          <p>
            Klimakteriet är en naturlig del av livet, men det kan vara en utmanande tid – både för den som går igenom
            det och för partnern. Många partners känner sig osäkra på hur de bäst kan vara ett stöd.
          </p>
          <p>
            Partnerguiden ger dig kunskap och konkreta verktyg för att förstå vad som händer, hur det kan påverka er
            relation, och hur du kan vara det bästa stödet för din partner.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Hur fungerar det?</h2>
          <p>
            Guiden består av artiklar som täcker olika aspekter av klimakteriet – från fysiska förändringar och hormoner
            till känslomässiga utmaningar och relationen. Du kan läsa artiklarna i ordning eller hoppa till det ämne som
            känns mest relevant.
          </p>
          <p>
            Efter varje artikel finns ett kort quiz som hjälper dig att befästa det du lärt dig. Skapa ett konto för att
            spara dina framsteg och få artiklarna skickade till din mejl.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Vem står bakom Partnerguiden?</h2>
          <p>
            Jag heter Johan Möller och har skapat och redigerar Partnerguiden. Jag är inte läkare eller
            klimakterieexpert – artiklarna är AI-genererade utifrån etablerad forskning och medicinsk litteratur om
            klimakteriet, och jag har läst igenom och redigerat varje artikel för att de ska vara tydliga, empatiska
            och praktiskt användbara. Innehållet är alltså inte faktagranskat av vårdpersonal, så använd det som ett
            komplement till – inte en ersättning för – samtal med läkare eller barnmorska.
          </p>

          <h2 className="text-xl font-heading font-semibold mt-8 mb-4">Kontakt</h2>
          <p>
            Partnerguiden är ett ideellt projekt skapat med målet att öka förståelsen för klimakteriet och stärka
            relationer under denna livsfas.
          </p>
          <p>
            Kontakta gärna{" "}
            <a
              href="https://moller-co.se/johan"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Johan Möller
            </a>{" "}
            om du har feedback på tjänsten.
          </p>

          <hr className="my-8 border-border" />

          <p>Tack för att du tar dig tid att lära dig mer. Det är ett av de finaste sätten att visa att du bryr dig.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
