"use client";

import { useMemo, useState } from "react";
import { Languages, Sparkles, Copy, Check, PencilLine, RotateCcw } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { tokenize, type Token } from "@/lib/dictionary/tokenize";
import { tokensToHtml, tokensToMarkdown, copyRichText } from "@/lib/dictionary/export";
import { cn } from "@/lib/utils";

const tool = getToolBySlug("dictionary-id-en")!;

const SAMPLE =
  "Tim kami sedang meeting untuk membahas strategi marketing dan deadline project bulan ini. Semua orang harus submit laporan sebelum jam 5 sore.";

type EditableToken = Token & { reviewed: boolean };

export default function DictionaryIdEnPage() {
  const [stage, setStage] = useState<"input" | "result">("input");
  const [rawText, setRawText] = useState("");
  const [tokens, setTokens] = useState<EditableToken[]>([]);
  const [copied, setCopied] = useState<"rich" | "markdown" | null>(null);

  function handleGenerate() {
    if (!rawText.trim()) return;
    const t = tokenize(rawText).map((tk) => ({ ...tk, reviewed: false }));
    setTokens(t);
    setStage("result");
  }

  function toggleWord(id: number) {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === id && t.isWord
          ? { ...t, cls: t.cls === "en" ? "id" : "en", reviewed: true }
          : t
      )
    );
  }

  const stats = useMemo(() => {
    const words = tokens.filter((t) => t.isWord);
    const en = words.filter((t) => t.cls === "en").length;
    const unreviewedUnknown = words.filter((t) => t.cls === "unknown" && !t.reviewed).length;
    return { total: words.length, en, unreviewedUnknown };
  }, [tokens]);

  async function handleCopy(format: "rich" | "markdown") {
    if (format === "rich") {
      const ok = await copyRichText(tokensToHtml(tokens), tokensToMarkdown(tokens));
      if (ok) {
        setCopied("rich");
        setTimeout(() => setCopied(null), 2000);
      }
    } else {
      try {
        await navigator.clipboard.writeText(tokensToMarkdown(tokens));
        setCopied("markdown");
        setTimeout(() => setCopied(null), 2000);
      } catch {
        // clipboard write can fail without a user gesture / permission —
        // nothing more we can do client-side, button just won't confirm.
      }
    }
  }

  function reset() {
    setStage("input");
    setRawText("");
    setTokens([]);
  }

  return (
    <div className="container max-w-3xl py-12">
      <ToolPageHeader tool={tool} />

      {stage === "input" ? (
        <div className="flex flex-col gap-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Tempel atau ketik paragraf di sini..."
            rows={10}
            className="w-full resize-y rounded-lg border border-input bg-background p-4 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setRawText(SAMPLE)}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Pakai contoh teks
            </button>
            <Button size="lg" disabled={!rawText.trim()} onClick={handleGenerate}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Kata bahasa Inggris akan dicetak miring otomatis, kata Indonesia dibiarkan apa
            adanya — dicek dari daftar 10.000 kata tersering tiap bahasa. Kata yang tidak
            dikenali (nama orang, istilah teknis, dll.) akan ditandai garis putus-putus supaya
            bisa Anda putuskan sendiri.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStage("input")}>
              <PencilLine className="h-3.5 w-3.5" />
              Edit teks
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Teks baru
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleCopy("rich")}>
                {copied === "rich" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "rich" ? "Tersalin!" : "Salin (format italic)"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopy("markdown")}>
                {copied === "markdown" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "markdown" ? "Tersalin!" : "Salin (*markdown*)"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 text-[15px] leading-8 whitespace-pre-wrap">
            {tokens.map((t) =>
              t.isWord ? (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleWord(t.id)}
                  title={
                    t.cls === "unknown" && !t.reviewed
                      ? "Tidak dikenali — klik untuk ubah miring/tidak"
                      : "Klik untuk ubah miring/tidak"
                  }
                  className={cn(
                    "rounded px-0.5 transition-colors hover:bg-primary/10",
                    t.cls === "en" && "italic",
                    t.cls === "unknown" && !t.reviewed && "underline decoration-dotted decoration-amber-500 underline-offset-4"
                  )}
                >
                  {t.text}
                </button>
              ) : (
                <span key={t.id}>{t.text}</span>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="italic">miring</span> = Inggris ({stats.en} kata)
            </span>
            <span>biasa = Indonesia</span>
            <span className="flex items-center gap-1.5">
              <span className="underline decoration-dotted decoration-amber-500 underline-offset-4">
                titik-titik
              </span>
              = belum dikenali ({stats.unreviewedUnknown} kata)
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" />
              {stats.total} kata total
            </span>
          </div>
          {stats.unreviewedUnknown > 0 && (
            <p className="text-xs text-muted-foreground">
              Klik kata bergaris titik-titik untuk menandainya sebagai Inggris (miring) atau
              Indonesia (biasa) — tool ini tidak menebak untuk kata yang tidak ada di kamusnya
              supaya tidak salah cetak miring.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
