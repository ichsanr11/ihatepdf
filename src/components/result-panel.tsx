import { CheckCircle2, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

export function ResultPanel({
  fileName,
  sizeBytes,
  onDownload,
  onReset,
}: {
  fileName: string;
  sizeBytes: number;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 border-primary/30 bg-primary/5 p-10 text-center animate-slide-up">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <div>
        <p className="font-semibold">Selesai! File siap diunduh.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fileName} · {formatBytes(sizeBytes)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onDownload} size="lg">
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button onClick={onReset} variant="outline" size="lg">
          <RotateCcw className="h-4 w-4" />
          Proses file lain
        </Button>
      </div>
    </Card>
  );
}
