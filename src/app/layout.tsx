import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "IHatePDF — Tool PDF Online Gratis & Privat",
    template: "%s · IHatePDF",
  },
  description:
    "Merge, split, compress, convert, dan edit PDF langsung di browser Anda. Tanpa upload ke server, tanpa instalasi, gratis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
