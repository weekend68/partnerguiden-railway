import type { Metadata } from "next";
import { QuizContent } from "./QuizContent";

export const metadata: Metadata = {
  title: "Quiz",
  robots: { index: false, follow: false },
};

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <QuizContent slug={slug} />;
}
