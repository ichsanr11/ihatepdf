import { Info } from "lucide-react";

export function InfoBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p>{message}</p>
    </div>
  );
}
