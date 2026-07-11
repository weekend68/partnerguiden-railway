import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeContent } from "./UnsubscribeContent";

export const metadata: Metadata = {
  title: "Avregistrering",
  robots: { index: false, follow: false },
  alternates: { canonical: "/avregistrera" },
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <UnsubscribeContent />
    </Suspense>
  );
}
