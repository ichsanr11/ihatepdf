"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/error-banner";
import { addWatermark } from "@/lib/pdf/watermark";
import { toArrayBuffer } from "@/lib/utils";
import type { WorkflowStepProps } from "./types";

export function WatermarkStep({ workingBytes, onApply, onCancel }: WorkflowStepProps) {
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(30);
  const [fontSize, setFontSize] = useState(48);
  const [rotation, setRotation] = useState(-45);
  const [layout, setLayout] = useState<"center" | "tile">("center");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const out = await addWatermark(toArrayBuffer(workingBytes), {
        text: text.trim(),
        opacity: opacity / 100,
        fontSize,
        rotationDeg: rotation,
        color: { r: 0.55, g: 0.55, b: 0.55 },
        layout,
      });
      onApply(out, `Watermark "${text.trim()}"`);
    } catch {
      setError("Gagal menambahkan watermark.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div>
        <Label htmlFor="wf-text">Teks watermark</Label>
        <Input id="wf-text" className="mt-1.5" value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="wf-layout">Tata letak</Label>
          <Select
            id="wf-layout"
            className="mt-1.5"
            value={layout}
            onChange={(e) => setLayout(e.target.value as "center" | "tile")}
          >
            <option value="center">Tengah halaman</option>
            <option value="tile">Berulang (tile)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="wf-rotation">Rotasi (derajat)</Label>
          <Input
            id="wf-rotation"
            type="number"
            className="mt-1.5"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="wf-opacity">Transparansi ({opacity}%)</Label>
          <input
            id="wf-opacity"
            type="range"
            min={5}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="mt-3 w-full accent-primary"
          />
        </div>
        <div>
          <Label htmlFor="wf-fontsize">Ukuran font (pt)</Label>
          <Input
            id="wf-fontsize"
            type="number"
            className="mt-1.5"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} disabled={!text.trim() || busy}>
          {busy ? "Menerapkan..." : "Terapkan"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
