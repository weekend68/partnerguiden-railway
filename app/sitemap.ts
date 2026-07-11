import type { MetadataRoute } from "next";
import { getFullArticles } from "@/lib/data";

const SITE_URL = "https://partnerguiden.se";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getFullArticles();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/artiklar`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/om`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/integritetspolicy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/llms.txt`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/artikel/${article.slug}`,
    lastModified: article.updated_at,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...articleRoutes];
}
