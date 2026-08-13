// Stand-in for the optional Node "canvas" dependency that pdfjs-dist's
// legacy build references. We only ever run pdf.js in the browser, where
// the real canvas element is used instead, so this module intentionally
// exports nothing.
export {};
