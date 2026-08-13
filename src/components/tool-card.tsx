import Link from "next/link";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ToolMeta } from "@/lib/tools";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = (Icons[tool.icon as keyof typeof Icons] ?? Icons.File) as LucideIcon;

  return (
    <Link href={`/tools/${tool.slug}`}>
      <Card className="group h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-5.5 w-5.5" />
        </div>
        <h3 className="font-semibold">{tool.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tool.shortDesc}</p>
      </Card>
    </Link>
  );
}
