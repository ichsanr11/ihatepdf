"use client";

export type TextFontFamily =
  | "helvetica"
  | "times"
  | "courier"
  | "roboto"
  | "open-sans"
  | "lato"
  | "montserrat"
  | "poppins"
  | "merriweather"
  | "playfair-display"
  | "pt-serif"
  | "source-code-pro"
  | "oswald"
  | "caveat"
  | "nunito";

export interface FontOption {
  value: TextFontFamily;
  label: string;
  /** CSS font stack used only for the on-screen preview approximation. */
  cssFamily: string;
  /** Standard PDF fonts (built into every viewer) support real bold+italic; custom fonts here only ship regular+bold. */
  standard: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  { value: "helvetica", label: "Helvetica (Sans-serif)", cssFamily: "Arial, Helvetica, sans-serif", standard: true },
  { value: "times", label: "Times New Roman (Serif)", cssFamily: "'Times New Roman', Times, serif", standard: true },
  { value: "courier", label: "Courier (Monospace)", cssFamily: "'Courier New', Courier, monospace", standard: true },
  { value: "roboto", label: "Roboto", cssFamily: "Roboto, Arial, sans-serif", standard: false },
  { value: "open-sans", label: "Open Sans", cssFamily: "'Open Sans', Arial, sans-serif", standard: false },
  { value: "lato", label: "Lato", cssFamily: "Lato, Arial, sans-serif", standard: false },
  { value: "montserrat", label: "Montserrat", cssFamily: "Montserrat, Arial, sans-serif", standard: false },
  { value: "poppins", label: "Poppins", cssFamily: "Poppins, Arial, sans-serif", standard: false },
  { value: "nunito", label: "Nunito", cssFamily: "Nunito, Arial, sans-serif", standard: false },
  { value: "merriweather", label: "Merriweather", cssFamily: "Merriweather, Georgia, serif", standard: false },
  { value: "playfair-display", label: "Playfair Display", cssFamily: "'Playfair Display', Georgia, serif", standard: false },
  { value: "pt-serif", label: "PT Serif", cssFamily: "'PT Serif', Georgia, serif", standard: false },
  { value: "source-code-pro", label: "Source Code Pro", cssFamily: "'Source Code Pro', 'Courier New', monospace", standard: false },
  { value: "oswald", label: "Oswald", cssFamily: "Oswald, Arial, sans-serif", standard: false },
  { value: "caveat", label: "Caveat (Tulisan tangan)", cssFamily: "Caveat, cursive", standard: false },
];

export function getFontOption(family: TextFontFamily): FontOption {
  return FONT_OPTIONS.find((f) => f.value === family) ?? FONT_OPTIONS[0];
}

const fontBytesCache = new Map<string, Promise<Uint8Array>>();

/**
 * Fetches (and caches) the raw WOFF bytes for a custom font's regular or
 * bold weight, self-hosted under /public/fonts (see
 * scripts/copy-custom-fonts.mjs). Only regular + bold are bundled — italic
 * isn't available for these, unlike the 3 standard PDF fonts.
 */
export async function loadCustomFontBytes(family: TextFontFamily, bold: boolean): Promise<Uint8Array> {
  const weight = bold ? "700" : "400";
  const key = `${family}-${weight}`;
  let promise = fontBytesCache.get(key);
  if (!promise) {
    promise = fetch(`/fonts/${family}-latin-${weight}-normal.woff`).then(async (res) => {
      if (!res.ok) throw new Error(`Gagal memuat font ${family}`);
      return new Uint8Array(await res.arrayBuffer());
    });
    fontBytesCache.set(key, promise);
  }
  return promise;
}
