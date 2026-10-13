"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/error-banner";
import { addPageNumbers, type NumberPosition } from "@/lib/pdf/pageNumbers";
import { toArrayBuffer } from "@/lib/utils";
import type { WorkflowStepProps } from "./types";

const formats = {
  "n-of-total": { label: "1 / 10", fn: (p: number, t: number) => `${p} / ${t}` },
  "n-only": { label: "1", fn: (p: number) => `${p}` },
  "page-n": { label: "Halaman 1", fn: (p: number) => `Halaman ${p}` },
} as const;

export function PageNumbersStep({ workingBytes, onApply, onCancel }: WorkflowStepProps) {
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [formatKey, setFormatKey] = useState<keyof typeof formats>("n-of-total");
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setBusy(true);
    setError(null);
    try {
      const out = await addPageNumbers(toArrayBuffer(workingBytes), {
        position,
        fontSize,
        startAt,
        format: formats[formatKey].fn,
        marginPt: 28,
      });
      onApply(out, "Nomor halaman");
    } catch {
      setError("Gagal menambahkan nomor halaman.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pn-position">Posisi</Label>
          <Select
            id="pn-position"
            className="mt-1.5"
            value={position}
            onChange={(e) => setPosition(e.target.value as NumberPosition)}
          >
            <option value="bottom-center">Bawah tengah</option>
            <option value="bottom-right">Bawah kanan</option>
            <option value="bottom-left">Bawah kiri</option>
            <option value="top-center">Atas tengah</option>
            <option value="top-right">Atas kanan</option>
            <option value="top-left">Atas kiri</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="pn-format">Format</Label>
          <Select
            id="pn-format"
            className="mt-1.5"
            value={formatKey}
            onChange={(e) => setFormatKey(e.target.value as keyof typeof formats)}
          >
            {Object.entries(formats).map(([key, f]) => (
              <option key={key} value={key}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pn-start">Mulai dari</Label>
          <Input
            id="pn-start"
            type="number"
            min={1}
            className="mt-1.5"
            value={startAt}
            onChange={(e) => setStartAt(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="pn-fontsize">Ukuran font (pt)</Label>
          <Input
            id="pn-fontsize"
            type="number"
            className="mt-1.5"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} disabled={busy}>
          {busy ? "Menerapkan..." : "Terapkan"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
