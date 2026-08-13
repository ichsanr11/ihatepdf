"use client";

import { useCallback, useState } from "react";
import { renderThumbnails } from "@/lib/pdf/render";
import type { PageItem } from "@/components/page-thumbnail-grid";

/**
 * Loads a PDF file, renders a thumbnail per page, and hands back editable
 * `PageItem[]` state shared by every page-management tool (remove, extract,
 * reorder, rotate).
 */
export function usePdfThumbnails() {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await f.arrayBuffer();
      const thumbs = await renderThumbnails(bytes, { maxWidth: 220 });
      setFile(f);
      setItems(
        thumbs.map((t) => ({
          id: `${t.pageNumber}`,
          originalIndex: t.pageNumber - 1,
          thumbnail: t.dataUrl,
          rotation: 0,
          selected: false,
        }))
      );
    } catch {
      setError("Gagal membaca PDF. Pastikan file valid, tidak rusak, dan tidak terkunci password.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setItems([]);
    setError(null);
  }, []);

  return { file, items, setItems, loading, error, load, reset };
}
