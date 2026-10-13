"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Undo2, RotateCcw, Download, Check } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { MergeStep } from "@/components/workflow/merge-step";
import { PageOpsStep, type PageOpsMode } from "@/components/workflow/page-ops-step";
import { WatermarkStep } from "@/components/workflow/watermark-step";
import { PageNumbersStep } from "@/components/workflow/page-numbers-step";
import { SignStep } from "@/components/workflow/sign-step";
import { RemoveSignatureStep } from "@/components/workflow/remove-signature-step";
import { DeskewStep } from "@/components/workflow/deskew-step";
import { STEP_TYPES, type StepKind, type WorkflowStepProps } from "@/components/workflow/types";
import { getToolBySlug } from "@/lib/tools";
import { mergePdfs } from "@/lib/pdf/merge";
import { downloadBytes } from "@/lib/download";
import { formatBytes, baseName } from "@/lib/utils";

const tool = getToolBySlug("workflow")!;

const PAGE_OPS_MODES: Partial<Record<StepKind, PageOpsMode>> = {
  reorder: "reorder",
  "remove-pages": "remove-pages",
  "extract-pages": "extract-pages",
  rotate: "rotate",
};

interface HistoryEntry {
  label: string;
  prevBytes: Uint8Array;
}

export default function WorkflowPage() {
  const [workingBytes, setWorkingBytes] = useState<Uint8Array | null>(null);
  const [workingFileName, setWorkingFileName] = useState("document.pdf");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeStep, setActiveStep] = useState<StepKind | null>(null);

  const [initialBusy, setInitialBusy] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);

  async function handleInitialFiles(files: File[]) {
    const pdfFiles = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfFiles.length === 0) {
      setInitialError("Hanya file PDF yang didukung.");
      return;
    }
    setInitialBusy(true);
    setInitialError(null);
    try {
      if (pdfFiles.length === 1) {
        setWorkingBytes(new Uint8Array(await pdfFiles[0].arrayBuffer()));
        setWorkingFileName(pdfFiles[0].name);
      } else {
        const bytes = await mergePdfs(pdfFiles);
        setWorkingBytes(bytes);
        setWorkingFileName("gabungan.pdf");
      }
    } catch {
      setInitialError("Gagal membuka PDF. Pastikan semua file valid.");
    } finally {
      setInitialBusy(false);
    }
  }

  function handleStepApply(newBytes: Uint8Array, label: string) {
    setHistory((prev) => [...prev, { label, prevBytes: workingBytes! }]);
    setWorkingBytes(newBytes);
    setActiveStep(null);
    setAppliedFlash(label);
    setTimeout(() => setAppliedFlash(null), 2500);
  }

  function handleUndo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setWorkingBytes(last.prevBytes);
      return prev.slice(0, -1);
    });
  }

  function handleReset() {
    setWorkingBytes(null);
    setWorkingFileName("document.pdf");
    setHistory([]);
    setActiveStep(null);
    setInitialError(null);
  }

  function handleDownload() {
    if (!workingBytes) return;
    downloadBytes(workingBytes, `${baseName(workingFileName)}_workflow.pdf`, "application/pdf");
  }

  function renderStep(kind: StepKind) {
    const stepProps: WorkflowStepProps = {
      workingBytes: workingBytes!,
      fileName: workingFileName,
      onApply: handleStepApply,
      onCancel: () => setActiveStep(null),
    };
    if (kind === "merge") return <MergeStep {...stepProps} />;
    if (kind === "watermark") return <WatermarkStep {...stepProps} />;
    if (kind === "page-numbers") return <PageNumbersStep {...stepProps} />;
    if (kind === "sign") return <SignStep {...stepProps} />;
    if (kind === "remove-signature") return <RemoveSignatureStep {...stepProps} />;
    if (kind === "deskew") return <DeskewStep {...stepProps} />;
    const mode = PAGE_OPS_MODES[kind];
    if (mode) return <PageOpsStep mode={mode} {...stepProps} />;
    return null;
  }

  return (
    <div className="container max-w-4xl py-12">
      <ToolPageHeader tool={tool} />

      {!workingBytes ? (
        <div className="flex flex-col gap-4">
          {initialError && <ErrorBanner message={initialError} />}
          {initialBusy ? (
            <Spinner label="Membuka PDF..." />
          ) : (
            <FileDropzone
              accept="application/pdf"
              multiple
              onFiles={handleInitialFiles}
              label="Pilih satu atau beberapa PDF untuk mulai"
              hint="Pilih lebih dari satu file untuk otomatis digabung jadi titik awal workflow"
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{workingFileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(workingBytes.byteLength)} · {history.length} langkah diterapkan
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={history.length === 0}>
                <Undo2 className="h-3.5 w-3.5" />
                Urungkan
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Mulai Ulang
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>

          {appliedFlash && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
              <Check className="h-4 w-4" />
              &quot;{appliedFlash}&quot; diterapkan — lanjutkan ke langkah berikutnya atau download kapan saja.
            </div>
          )}

          {history.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {history.map((h, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                >
                  {i + 1}. {h.label}
                </span>
              ))}
            </div>
          )}

          {activeStep ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">{STEP_TYPES.find((s) => s.kind === activeStep)!.name}</h2>
              {renderStep(activeStep)}
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm font-medium">Tambah langkah berikutnya</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STEP_TYPES.map((st) => {
                  const Icon = (Icons[st.icon as keyof typeof Icons] ?? Icons.Wand2) as LucideIcon;
                  return (
                    <button
                      key={st.kind}
                      onClick={() => setActiveStep(st.kind)}
                      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{st.name}</p>
                        <p className="text-xs text-muted-foreground">{st.shortDesc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
