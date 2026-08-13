import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolMeta } from "@/lib/tools";

export function ToolPageHeader({ tool }: { tool: ToolMeta }) {
  const Icon = (Icons[tool.icon as keyof typeof Icons] ?? Icons.File) as LucideIcon;

  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
        <p className="mt-1 text-muted-foreground">{tool.shortDesc}</p>
      </div>
    </div>
  );
}
