import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container flex flex-col gap-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} IHatePDF. Semua proses berjalan lokal di browser Anda.</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-foreground">
            Kebijakan Privasi
          </Link>
        </div>
      </div>
    </footer>
  );
}
