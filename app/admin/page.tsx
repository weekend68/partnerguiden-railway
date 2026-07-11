import type { Metadata } from "next";
import { AdminContent } from "./AdminContent";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminContent />;
}
