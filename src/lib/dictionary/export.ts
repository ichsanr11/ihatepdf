import type { Token } from "./tokenize";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Rich HTML with real <i> tags — pastes as actual italic formatting into Word/Docs/Slack/etc. */
export function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map((t) => {
      const escaped = escapeHtml(t.text).replace(/\n/g, "<br>");
      if (t.isWord && t.cls === "en") return `<i>${escaped}</i>`;
      return escaped;
    })
    .join("");
}

/** Markdown-style *word* italics, for places that don't accept rich HTML paste. */
export function tokensToMarkdown(tokens: Token[]): string {
  return tokens.map((t) => (t.isWord && t.cls === "en" ? `*${t.text}*` : t.text)).join("");
}

/** Plain text with formatting stripped, i.e. the original input reconstructed verbatim. */
export function tokensToPlainText(tokens: Token[]): string {
  return tokens.map((t) => t.text).join("");
}

/**
 * Copies both a rich-HTML and a plain-text representation to the
 * clipboard in one write, so pasting into a word processor keeps the
 * italics but pasting into a plain text field still gets clean text.
 * Falls back to plain text if the browser can't do multi-format writes.
 */
export async function copyRichText(html: string, plain: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // Some browsers support the API but reject certain MIME combos —
    // fall through to a plain-text copy rather than failing outright.
  }
  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}
