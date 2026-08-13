export const metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Kebijakan Privasi</h1>
      <div className="space-y-4 text-muted-foreground">
        <p>
          Semua tool di halaman ini memproses file PDF Anda sepenuhnya di dalam
          browser menggunakan JavaScript (pdf-lib &amp; pdf.js). File yang Anda pilih
          <strong className="text-foreground"> tidak pernah diunggah</strong> ke
          server manapun — tidak ada request jaringan yang membawa isi file Anda.
        </p>
        <p>
          Karena prosesnya berjalan lokal, kami tidak menyimpan salinan file Anda
          dan tidak bisa mengaksesnya. Menutup atau me-refresh tab akan menghapus
          seluruh data yang sedang diproses dari memori.
        </p>
        <p>
          Fitur yang membutuhkan proses server (mis. compress dengan Ghostscript,
          convert Office, OCR) berada di roadmap Fase 2/3 dan akan diberi
          kebijakan retensi &amp; penghapusan otomatis terpisah saat dirilis.
        </p>
      </div>
    </div>
  );
}
