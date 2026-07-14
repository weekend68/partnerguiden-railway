import { getFullArticles } from "@/lib/data";

const SITE_URL = "https://partnerguiden.se";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const articles = await getFullArticles();

  const items = articles
    .map((article) => {
      const url = `${SITE_URL}/artikel/${article.slug}`;
      const pubDate = new Date(article.published_at || article.updated_at).toUTCString();
      return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Partnerguiden: Klimakteriet</title>
    <link>${SITE_URL}</link>
    <description>En gratis kurs skapad för dig som partner. Lär dig de biologiska sanningarna, undvik de vanligaste kommunikationsfällorna och stärk er relation.</description>
    <language>sv</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
