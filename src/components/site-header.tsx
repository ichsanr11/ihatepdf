import Link from "next/link";
import { FileStack } from "lucide-react";

const navGroups = [
  { label: "Workflow", href: "/#workflow" },
  { label: "Organize", href: "/#organize" },
  { label: "Optimize", href: "/#optimize" },
  { label: "Convert", href: "/#convert-to" },
  { label: "Edit", href: "/#edit" },
  { label: "Security", href: "/#security" },
  { label: "Bahasa", href: "/#language" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileStack className="h-4.5 w-4.5" />
          </span>
          <span className="text-lg">
            IHate<span className="text-primary">PDF</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {navGroups.map((g) => (
            <Link key={g.href} href={g.href} className="transition-colors hover:text-foreground">
              {g.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:inline-block">
            🔒 File Anda tidak pernah diupload
          </span>
        </div>
      </div>
    </header>
  );
}
