import type { Metadata } from "next";
import { AuthContent } from "./AuthContent";

export const metadata: Metadata = {
  title: "Skapa konto / logga in",
  description: "Ange din e-post så skickar vi en inloggningslänk. Inga lösenord att komma ihåg!",
  alternates: { canonical: "/auth" },
  openGraph: { url: "/auth" },
};

export default function AuthPage() {
  return <AuthContent />;
}
