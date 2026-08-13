export const metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Kebijakan Privasi</h1>
      <div className="space-y-4 text-muted-foreground">
        <p>
          Semua tool di halaman ini memproses file PDF Anda sepenuhnya di dalam
          browser menggunakan JavaScript (pdf-lib, pdf.js, QPDF, dan Tesseract —
          semuanya WebAssembly/JS yang jalan lokal). File yang Anda pilih
          <strong className="text-foreground"> tidak pernah diunggah</strong> ke
          server manapun — tidak ada request jaringan yang membawa isi file Anda,
          untuk tool apa pun di situs ini, termasuk Compress, Repair, dan OCR PDF.
        </p>
        <p>
          Karena prosesnya berjalan lokal, kami tidak menyimpan salinan file Anda
          dan tidak bisa mengaksesnya. Menutup atau me-refresh tab akan menghapus
          seluruh data yang sedang diproses dari memori.
        </p>
        <p>
          <strong className="text-foreground">Satu pengecualian jujur:</strong>{" "}
          tool OCR PDF mengunduh model bahasa (data publik, bukan data Anda,
          ±5–15MB per bahasa) sekali dari CDN pihak ketiga saat pertama dipakai,
          lalu di-cache browser untuk pemakaian berikutnya. Mesin OCR &amp; worker-nya
          sendiri sudah di-hosting di server kami, bukan ditarik dari CDN — hanya
          data model bahasa yang masih dari CDN eksternal.
        </p>
        <p>
          Fitur yang benar-benar butuh server (mis. convert Word/Excel/PPT via
          LibreOffice) belum ada di versi ini dan berada di roadmap Fase 2 —
          akan diberi kebijakan retensi &amp; penghapusan otomatis terpisah saat dirilis.
        </p>
      </div>
    </div>
  );
}
