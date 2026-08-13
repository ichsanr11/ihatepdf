import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-16 text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
