# Revisi 2 — Tarif Paket dan Registrasi dengan Pembayaran

**Status:** FINAL — perencanaan disetujui pengguna pada 18 Oktober 2026. Fase 12–13 selesai untuk development; Fase 14 sedang QA integrasi development. Pemeriksaan pra-cutover production dikecualikan atas arahan pengguna.
**Tanggal:** 18 Oktober 2026
**Cakupan:** Harga titik turun sebagai paket Pulang–Kembali yang dibagi ke dua arah, penggabungan pencatatan registrasi/pembayaran/bukti transfer dalam satu penyelesaian form, serta reset dan pembuatan ulang data seed demo.
**Terkait:** [Baseline perencanaan perpulangan](perencanaan-revisi-flow-perpulangan.md), [Revisi 1 roster dan cetak](perencanaan-revisi-roster-pulang-dan-cetak.md), dan [tracker implementasi](progress-implementasi-perpulangan.md).

## 1. Keputusan yang disepakati

1. Satu harga pada master titik turun adalah **harga paket Pulang–Kembali**.
2. Tarif tiap arah adalah separuh harga paket. Pulang saja mendapat bagian Pulang; Kembali saja mendapat bagian Kembali. Jika dua arah terdaftar, total tagihannya sama dengan satu harga paket.
3. Jika perjalanan Kembali ditambahkan belakangan, perjalanan itu mendapat bagian Kembali dan tidak membuat tagihan paket baru.
4. Harga master di production **tidak dipecah atau diubah**. Belum ada peserta yang diregistrasikan sehingga belum ada snapshot tarif perjalanan atau alokasi pembayaran yang perlu dikoreksi.
5. Registrasi satu peserta harus bisa selesai dalam satu tindakan akhir tanpa harus lebih dulu menambahkannya ke daftar sementara lalu menekan submit kedua.
6. Form registrasi menyediakan pilihan untuk mencatat pembayaran saat itu juga. Jika dicentang, nominal dan bukti transfer wajib diisi sebelum registrasi dapat disimpan; pengguna tidak perlu pindah ke halaman Pembayaran. Jika belum membayar, pembayaran tetap dapat dicatat belakangan melalui halaman Pembayaran.
7. Satu bukti dapat mendukung satu transfer keluarga yang mencakup beberapa anak/perjalanan. Rincian alokasi dan catatan transaksi dibentuk sistem. Pengguna tidak perlu mengetik nama pengirim secara manual.
8. Pembayaran partial dan kelebihan bayar mengikuti aturan ledger yang sudah disepakati: alokasi perjalanan jelas per peserta/arah; kelebihan masuk ke Saldo Lain Korda tujuan; bila satu transfer meliputi beberapa peserta/Korda dan kepemilikan kelebihan tidak jelas, minta pengguna membagi kelebihan secara eksplisit.

## 2. Temuan repo saat ini

- Master `DropPoint` mempunyai satu kolom integer `price`; tidak ada tarif Pulang dan Kembali terpisah.
- Saat Journey dibuat, server menyalin seluruh `DropPoint.price` ke `Journey.tariffSnapshot` untuk setiap arah. Karena itu pendaftaran Pulang–Kembali saat ini dapat memberi dua tagihan penuh.
- Form multi-peserta menampilkan harga titik pada kedua arah dan menjumlahkannya; setelah daftar peserta dibuat, pembayaran diarahkan ke menu Pembayaran.
- Journey sudah menyimpan snapshot tarif sendiri. Halaman Pembayaran, dashboard, laporan, refund, dan saldo mengandalkan snapshot tersebut.
- Model `Payment`, `PaymentAllocation`, `EvidenceFile`, serta upload Supabase signed URL sudah tersedia. Aksi pembayaran sekarang terpisah dari aksi registrasi.
- Data production saat ini hanya berisi harga master titik turun; belum ada pendaftar.
- Seeder demo saat ini `prisma/seed-demo-registration-payment.ts` bersifat idempotent dan tidak menghapus data. Seeder membuat event serta data demo bertanda `[DEMO SEED]`, dan menolak database yang namanya tidak mengandung `dev` kecuali override eksplisit. Data lokal/dev yang sudah dibuat oleh seeder lama tetap memiliki snapshot tarif lama; menjalankannya ulang saja tidak cukup untuk memperbarui tarif snapshot.

## 3. Aturan perhitungan tarif

Harga master tetap menjadi nilai paket untuk satu titik turun. Helper tarif bersama dipakai oleh preview form dan server, supaya UI tidak dapat menunjukkan harga berbeda dari snapshot yang disimpan.

| Arah | Tarif snapshot |
|---|---:|
| Pulang (`OUTBOUND`) | Bagian Pulang dari harga paket |
| Kembali (`RETURN`) | Bagian Kembali dari harga paket |
| Pulang–Kembali | Jumlah bagian Pulang dan Kembali; sama dengan harga paket |

Harga dibagi ke rupiah integer dengan aturan deterministik yang menjaga jumlah kedua bagian tetap sama dengan harga paket: Pulang memakai pembulatan ke bawah dan Kembali menerima sisa rupiah. Untuk harga genap, kedua bagian sama persis.

Label UI master dan registrasi menyebut **Harga paket Pulang–Kembali**. Pilihan perjalanan menampilkan tarif arah masing-masing, bukan mengulang harga paket pada setiap baris. Tarif yang disimpan ke Journey selalu snapshot bagian arah, sehingga perubahan harga master di masa depan tidak mengubah registrasi yang sudah dibuat.

## 4. Rancangan UX registrasi dan pembayaran

### Registrasi satu peserta

1. Pengguna memilih event, santri/peserta eksternal, arah perjalanan, Korda tujuan, titik turun/penjemputan, dan tanggal yang relevan.
2. UI menampilkan ringkasan perjalanan dan tarif arah. Untuk Pulang–Kembali, tampilkan harga paket dan total dua bagian; titik default tetap mengikuti keputusan yang sudah berlaku.
3. Di bagian penyelesaian, pilih **Belum membayar** atau **Catat pembayaran sekarang**.
4. Jika belum membayar, tombol akhir **Daftarkan peserta** menyimpan registrasi/perjalanan.
5. Jika pembayaran dicatat, tampilkan nominal aktual (default sebesar tagihan yang dipilih), tanggal pembayaran, pilihan perjalanan yang dibayar, serta upload bukti. Nama pengirim tidak diminta manual.
6. Tombol akhir menyimpan registrasi/perjalanan, transaksi pembayaran, alokasi, metadata bukti, dan audit dalam satu alur yang konsisten.

### Registrasi beberapa peserta dan pembayaran keluarga

1. UI registrasi saat ini dibatasi satu peserta per submit atas arahan pengguna; batch registrasi ditangguhkan sementara.
2. Pembayaran keluarga untuk beberapa peserta/perjalanan tetap dicatat melalui halaman Pembayaran dengan satu bukti dan catatan alokasi otomatis.
3. Sistem membuat catatan transaksi berdasarkan alokasi yang tersimpan; tidak ada catatan pembayaran yang harus diketik manual.
4. Validasi dilakukan sebelum penyimpanan; tidak boleh tercipta bukti atau pembayaran tanpa registrasi/alokasi yang sesuai.

### Upload bukti dan kegagalan proses

- Gunakan alur signed upload Supabase yang sudah ada.
- File diunggah sebelum final submit; finalisasi server memeriksa object dan metadata, lalu menyimpan referensi bukti ke transaksi pembayaran.
- Registrasi, Journey, Payment, PaymentAllocation, EvidenceFile, dan audit disimpan dalam transaksi database setelah validasi.
- Jika validasi/penyimpanan final gagal setelah file diunggah, hapus object sementara agar tidak tertinggal sebagai bukti yatim.
- Jika pengguna memilih belum membayar, tidak ada upload bukti maupun Payment record. Jika mencatat pembayaran, nominal dan bukti transfer wajib diisi.

## 5. Fase implementasi

### Fase 12 — Tarif paket per arah

**Status:** Selesai untuk development.

- [x] Buat satu helper murni untuk membagi harga paket ke tarif Pulang dan Kembali, termasuk harga ganjil.
- [x] Tampilkan harga master sebagai harga paket Pulang–Kembali.
- [x] Ubah pilihan titik dan ringkasan form agar menunjukkan tarif arah, bukan harga paket penuh untuk setiap arah.
- [x] Simpan tarif arah sebagai `Journey.tariffSnapshot` saat registrasi atau saat Journey Kembali ditambahkan kemudian.
- [x] Pastikan tampilan status/detail registrasi, Pembayaran, dashboard, laporan, refund, saldo, dan cetak memakai snapshot arah atau ledger yang berasal dari snapshot.
- [x] Pertahankan harga master production tanpa dipecah. Pengguna menyatakan production belum memiliki peserta; pemeriksaan baca-only production dikecualikan dari Fase 14 atas arahan pengguna.
- [x] Tambahkan reset eksplisit untuk **data seed demo saja**. Reset tidak menyentuh seed akun, santri/master data, harga DropPoint, atau data production.
- [x] Jalankan mode rencana reset, reset fixture demo development, seed ulang, dan verifikasi tarif snapshot arah serta kestabilan rerun.

**Kriteria keluar:** Pulang saja dan Kembali saja masing-masing menagih satu bagian; Pulang–Kembali berjumlah tepat satu harga paket; penambahan Kembali susulan hanya menambah bagian Kembali. Perubahan master setelah pendaftaran tidak mengubah snapshot.

**Penyesuaian seed demo (selesai pada Fase 12):** Seeder menyediakan `--plan-reset-demo` untuk menampilkan ringkasan tanpa menulis dan `--reset-demo` untuk reset eksplisit pada database development yang lolos guard. Reset dibatasi ke event `[DEMO SEED]` dan dependensi/transaksi/penempatan seed; akun, master santri/region, tarif DropPoint, dan data di luar fixture dipertahankan. Seeder berhenti jika menemukan data non-seed atau relasi yang perlu dipertahankan. Reset, seed ulang, dan rerun sudah diverifikasi tidak menggandakan data. Seeder menolak database yang bukan development.

### Fase 13 — Registrasi dan pembayaran satu alur

**Status:** Selesai untuk development sesuai scope terbaru; batch registrasi sementara ditangguhkan atas arahan pengguna. QA integrasi dicatat di Fase 14.

- [x] Tambahkan jalur submit langsung untuk satu peserta tanpa entri daftar sementara.
- [x] Batasi UI dan aksi registrasi ke satu peserta per submit sesuai arahan terbaru; pembayaran keluarga tetap tersedia di halaman Pembayaran.
- [x] Tambahkan pilihan catat pembayaran pada tahap akhir registrasi.
- [x] Dukung upload satu bukti untuk satu transaksi keluarga yang mengalokasikan pembayaran ke beberapa anak/perjalanan.
- [x] Reuse aturan pembayaran, scope akses, bukti Supabase, saldo, catatan otomatis, dan audit yang berlaku; tidak membuat aturan finansial paralel.
- [x] Simpan registrasi/perjalanan dan pembayaran/allocation/evidence secara atomik setelah upload berhasil; tangani object yatim jika finalisasi gagal.
- [x] Setelah sukses, tampilkan ringkasan registrasi dan pembayaran, lalu kosongkan form; pembayaran yang dilewati dapat dicatat kemudian di Pembayaran.

**Kriteria keluar:** Implementasi mendukung pendaftaran langsung satu peserta, pembayaran opsional dalam transaksi yang sama, alokasi manual untuk partial, bukti wajib saat pembayaran dicatat, ringkasan sukses, dan cleanup bukti jika finalisasi gagal. Pembayaran keluarga lebih dari satu peserta tetap melalui halaman Pembayaran. Pemeriksaan end-to-end integrasi dilakukan pada Fase 14.

### Fase 14 — QA integrasi development

**Status:** Sedang berjalan — fokus pada QA integrasi development. Pemeriksaan pra-cutover production diabaikan atas arahan pengguna dan bukan gap atau kriteria keluar fase.

**Checkpoint QA development (18 Oktober 2026):** Helper tarif lulus pemeriksaan harga genap/ganjil, harga nol, dan penolakan input tidak valid; UI mode Pulang-Kembali, Pulang saja, dan Kembali saja sudah diperiksa tanpa mengirim data. Uji alur upload/finalisasi yang menulis ke Supabase belum dijalankan.

**Audit kode upload (18 Oktober 2026):** Registrasi, pembayaran keluarga, dan refund mengunggah `File` langsung dari browser ke Supabase melalui signed upload URL; berkas tidak melewati body Server Action Next.js. Batas aplikasi 10 MiB diperiksa saat meminta URL dan diverifikasi lagi dari objek Supabase, termasuk ukuran, MIME, signature file, dan SHA-256. Server tetap mengunduh objek sampai 10 MiB untuk verifikasi; batas request `serverActions.bodySizeLimit` 11 MB tidak mengatur upload langsung ini. Pembayaran keluarga kini mewajibkan bukti seperti pembayaran yang dicatat bersama registrasi. Upload memakai raw binary `PUT` dengan `Content-Type` eksplisit. Cleanup pada kegagalan upload/finalisasi memakai token HMAC yang terikat ke sesi pengguna dan storage key. TypeScript, ESLint file terkait, dan `git diff --check` lulus setelah perubahan. Uji transfer nyata ke bucket dan simulasi kegagalan masih tersisa di QA development.

**Penyesuaian alur multi-peserta (18 Oktober 2026):** Setelah laporan pengguna, form diperluas dari satu peserta menjadi daftar satu atau beberapa peserta dalam satu submit. Setiap peserta menyimpan pilihan perjalanan/titiknya sendiri di Korda tujuan yang dipilih; satu Payment dan satu bukti dapat dialokasikan ke seluruh perjalanan. Backend mengizinkan batch satu event, menolak peserta duplikat, dan memvalidasi alokasi per perjalanan. Selesai setelah verifikasi statis; QA browser serta submit transaksi development masih perlu dilakukan.

- Pemeriksaan baca-saja database development: event `[DEMO SEED] Perpulangan Demo 2026` memiliki 262 perjalanan dan 81 pembayaran; 0 mismatch tarif dan 0 mismatch jumlah alokasi. Dari fixture demo ada 76 pembayaran lintas peserta, 8 pembayaran dengan Saldo Lain, serta alokasi untuk arah Pulang dan Kembali. Tidak ada alokasi yang terbalik melebihi nominalnya pada keseluruhan database development.
- Temuan data legacy: event `testing` memiliki 2 perjalanan (Pulang dan Kembali) dengan snapshot harga paket penuh Rp300.000 pada masing-masing arah. Keduanya tidak cocok dengan aturan tarif baru; datanya tidak diubah karena bukan fixture demo milik seeder. Pembayaran terkait tetap memiliki jumlah alokasi yang cocok.
- Browser QA dengan akun Korda Demak: Korda tujuan otomatis terisi dan terkunci pada `/registrasi` serta `/registrasi-kembali`; `/keuangan` menolak akses langsung; halaman `/pembayaran` hanya menampilkan 5 peserta dalam cakupan tujuan Korda Demak.
- TypeScript, ESLint file terkait, dan `git diff --check` lulus sebelum perbaikan upload saat ini; verifikasi ulang dicatat setelah perubahan. Build development production sebelumnya berhasil. Pemeriksaan pra-cutover production dan deployment bukan bagian Fase 14 sesuai arahan pengguna. Pemeriksaan visual PDF tetap diserahkan kepada pengguna.

- [ ] QA tarif genap/ganjil, Pulang saja, Kembali saja, Pulang–Kembali, dan Journey Kembali susulan.
- [ ] QA belum bayar, bayar penuh, partial pada salah satu/beberapa arah, transfer keluarga, bukti valid/tidak valid, upload gagal, dan finalisasi gagal.
- [ ] QA registrasi beberapa anak dalam satu submit dengan satu transfer dan bukti; pastikan satu Payment memiliki alokasi yang cocok untuk seluruh perjalanan, serta titik turun tetap aktif untuk peserta berikutnya dan setelah submit sukses.
- [ ] QA lintas Korda, peserta eksternal, akses per role, saldo kelebihan, dan sinkronisasi angka pada Pembayaran/Laporan/Keuangan.
- [x] Abaikan pemeriksaan pra-cutover production sesuai arahan pengguna; hal tersebut bukan gap Fase 14.

**Kriteria keluar:** Alur development untuk tarif, payment, bukti, status, saldo, dan laporan konsisten; upload bukti dan finalisasi transaksi lulus QA integrasi development. Production preflight/deploy tidak menjadi syarat penutupan fase.

## 6. Batas cakupan

- Tidak membuat dua baris DropPoint untuk Pulang dan Kembali selama tarif per arah sama-sama setengah harga paket.
- Tidak mengubah harga master production menjadi setengah.
- Tidak mengubah bukti yang sudah diunggah atau membuat verifikasi bukti pembayaran sebagai syarat keabsahan transfer; bukti tetap acuan audit sebagaimana aturan yang ada.
- Tidak membuat ulang modul Pembayaran, refund, laporan, maupun saldo.
- Tidak menambahkan field nama pengirim manual.
- Tidak mengubah aturan tujuan lintas Korda, armada, titik tujuan, atau refund.
- Reset yang direncanakan hanya untuk fixture seed demo di development; bukan reset database menyeluruh dan bukan reset production.

## 7. Risiko dan prasyarat

- Runner GitHub harus dapat terhubung ke database production untuk `prisma migrate deploy` sesuai pipeline yang sekarang. Jika workflow/build hanya memerlukan pembaruan code tanpa migrasi schema, langkah migrate tetap tidak membuat perubahan ketika tidak ada migrasi pending.
- Bukti diunggah sebelum transaksi tersimpan. Cleanup object gagal harus diuji agar tidak menambah object yatim.
- Pembayaran tidak boleh tersimpan jika registrasi/perjalanan target gagal; finalisasi perlu validasi server dan transaksi database.
- Penghapusan data seed perlu mengikuti dependensi foreign key dan ledger audit secara eksplisit; jika sebagian data demo tidak dapat dibuktikan sebagai milik seeder, reset harus berhenti dan melaporkan data yang tersisa, bukan memperluas penghapusan.
- Tidak perlu backfill snapshot atau payment production selama kondisi kosong tetap terverifikasi saat cutover.

## 8. Keputusan tersisa

Tidak ada keputusan bisnis utama yang menunggu. Detail teknis seperti komponen layar, validasi file, helper tarif, pembagian integer rupiah, transaksi server, dan pemulihan upload mengikuti aturan di atas saat implementasi.
