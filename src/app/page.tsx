import { ShieldCheck, Zap, Trash2 } from "lucide-react";
import { ToolCard } from "@/components/tool-card";
import { tools, categoryLabels, type ToolCategory } from "@/lib/tools";

const categoryOrder: ToolCategory[] = [
  "organize",
  "optimize",
  "convert-to",
  "convert-from",
  "edit",
  "security",
  "language",
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="container flex flex-col items-center gap-6 py-20 text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
            Tool PDF · gratis · tanpa akun
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Setiap tool PDF yang Anda butuhkan,{" "}
            <span className="text-primary">diproses di browser Anda</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Merge, split, convert, watermark, dan lainnya. File Anda tidak pernah
            diunggah ke server — semuanya berjalan lokal di perangkat Anda.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Feature icon={Zap} text="Instan, tanpa antrian server" />
            <Feature icon={ShieldCheck} text="File tidak pernah diunggah" />
            <Feature icon={Trash2} text="Tidak ada jejak tersimpan" />
          </div>
        </div>
      </section>

      <div className="container py-16">
        {categoryOrder.map((category) => {
          const items = tools.filter((t) => t.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} id={category} className="mb-14 scroll-mt-20">
              <h2 className="mb-5 text-xl font-bold tracking-tight">
                {categoryLabels[category]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-primary" />
      {text}
    </span>
  );
}
