import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";

const SITE_URL = "https://partnerguiden.se";
const DEFAULT_TITLE = "Partnerguiden: Klimakteriet – Bli en bättre partner";
const DEFAULT_DESCRIPTION =
  "En gratis kurs skapad för dig som partner. Lär dig de biologiska sanningarna, undvik de vanligaste kommunikationsfällorna och stärk er relation.";
const DEFAULT_IMAGE = "/images/article-hormon-kartan.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Partnerguiden: Klimakteriet",
  },
  description: DEFAULT_DESCRIPTION,
  authors: [{ name: "Partnerguiden" }],
  openGraph: {
    type: "website",
    url: "/",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_IMAGE],
    locale: "sv_SE",
    siteName: "Partnerguiden: Klimakteriet",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_IMAGE],
  },
  alternates: {
    canonical: "/",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Partnerguiden: Klimakteriet",
      url: SITE_URL,
    },
    {
      "@type": "Course",
      name: "Partnerguiden: Klimakteriet",
      description:
        "En gratis kurs skapad för dig som partner. Lär dig de biologiska sanningarna om klimakteriet, undvik de vanligaste kommunikationsfällorna och stärk er relation.",
      provider: {
        "@type": "Organization",
        name: "Partnerguiden",
        url: SITE_URL,
      },
      educationalLevel: "Beginner",
      isAccessibleForFree: true,
      inLanguage: "sv",
      numberOfCredits: "0",
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: "PT2H",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;

  return (
    <html lang="sv">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <link rel="alternate" type="application/rss+xml" title="Partnerguiden: Klimakteriet" href="/feed.xml" />
      </head>
      <body>
        <Providers>{children}</Providers>
        {umamiWebsiteId && umamiScriptUrl && (
          <Script
            defer
            data-website-id={umamiWebsiteId}
            data-exclude-hash="true"
            src={umamiScriptUrl}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
