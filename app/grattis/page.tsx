import type { Metadata } from "next";
import { CongratulationsContent } from "./CongratulationsContent";

export const metadata: Metadata = {
  title: "Grattis! Du har klarat kursen",
  description: "Du har slutfört Partnerguiden om klimakteriet – alla 13 artiklar och quiz.",
  robots: { index: false, follow: false },
};

export default function CongratulationsPage() {
  return <CongratulationsContent />;
}
