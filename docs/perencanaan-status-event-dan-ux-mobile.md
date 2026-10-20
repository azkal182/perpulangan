# Perencanaan Terpadu: Status Event dan UX Mobile

**Status dokumen:** Final dan disetujui pengguna pada 19 Oktober 2026. Aturan produk status event dan tahap A–C disetujui; rencana UX mobile juga disetujui. Implementasi Tahap A sedang berjalan; fase sesudahnya belum dimulai.

Dokumen ini menjadi satu sumber perencanaan untuk pemilihan/status event global serta penyesuaian navigasi dan responsivitas mobile. Kedua konteks dimonitor dalam dokumen dan tracker yang sama, dengan urutan fase serta status persetujuan masing-masing tetap dipertahankan.

---

## Konteks 1 — Status Event dan Pemilihan Global

Dokumen ini menetapkan bagaimana status event mengatur konteks dan hak operasi lintas halaman. Status event adalah acuan administrasi aplikasi. Tanggal event hanya informasi jadwal/konteks lapangan; tanggal tidak menentukan event pilihan, hak tulis, atau apakah event dianggap aktif.

## Aturan produk

1. Maksimal satu event berstatus `ACTIVE` pada satu waktu. Aktivasi event baru menonaktifkan event `ACTIVE` sebelumnya dengan mengubahnya ke `COMPLETED`.
2. Pemilihan event awal di seluruh aplikasi mengutamakan event berstatus `ACTIVE`, tanpa melihat tanggal mulai, tanggal selesai, atau kapan event dibuat.
3. Jika tidak ada event `ACTIVE`, aplikasi tidak memilih event operasional secara otomatis berdasarkan tanggal. Pengguna dapat memilih event terdahulu secara eksplisit untuk membaca data atau mengekspor PDF.
4. Event yang bukan `ACTIVE`, termasuk `DRAFT` dan `COMPLETED`, bersifat baca-saja untuk data operasional. Operasi create, update, delete, pencatatan pembayaran, refund, koreksi, penambahan perjalanan susulan, perubahan armada, dan penempatan peserta harus ditolak.
5. Tidak ada pengecualian perjalanan Kembali susulan atau refund pada event nonaktif. Perubahan tersebut hanya dapat dilakukan saat event berstatus `ACTIVE`.
6. Pemilihan event direncanakan tersedia secara global di header/navbar agar konteks pilihan konsisten lintas halaman. Halaman yang menampilkan data event harus mengikuti event terpilih; event nonaktif tetap dapat dibuka untuk baca dan ekspor PDF.
7. Read-only bukan hanya keadaan UI. Setiap server action/API yang menulis data event wajib memeriksa status event di server. Tombol/form pada UI juga harus disembunyikan atau dinonaktifkan dengan keterangan bahwa event tidak aktif.
8. Pengecualian operasional: halaman pengelolaan event tetap memberi admin kemampuan mengubah metadata/status event dan mengaktifkan event berikutnya. Pengelolaan master event bukan perubahan data operasional pada event yang sedang dipilih.
9. Fitur global yang tidak dimiliki oleh satu event—misalnya master santri, akun, hierarki wilayah, dan pencatatan keuangan pusat—tidak dikunci oleh pilihan event.

## Konsekuensi implementasi

- Sentralisasikan daftar dan pilihan event agar Dashboard, Registrasi, Pembayaran, Laporan, Refund, Data Pulang, Armada, dan Cetak memakai event terpilih yang sama, dengan tetap menerapkan scope akses role.
- Pertahankan filter dan tampilan baca untuk event nonaktif serta izinkan ekspor dokumen yang memang tersedia untuk event tersebut.
- Tambahkan pemeriksaan status `ACTIVE` pada semua mutasi yang terkait event, bukan hanya pada formulir atau tombol.
- Jaga invariant satu event aktif juga pada level database/transaksi agar dua aktivasi bersamaan tidak menghasilkan lebih dari satu event aktif.
- Pastikan transaksi keuangan yang terkait event mengikuti status event. Pencairan kas pusat yang tidak terikat ke satu event tetap mengikuti kewenangan modul keuangan pusat.
- Bila database tidak memiliki event `ACTIVE`, tampilkan keadaan kosong yang jelas untuk operasi event dan minta pengguna memilih event lama jika ingin membaca atau mencetak data.

## Cakupan halaman dan operasi

| Kelompok | Halaman/modul yang diaudit | Perilaku yang direncanakan |
|---|---|---|
| Ringkasan | Dashboard | Event aktif menjadi pilihan awal; metrik dan tautan memakai event global terpilih. Event lama hanya menampilkan data. |
| Registrasi | Registrasi baru, peserta terdaftar, perjalanan Kembali, data Pulang/pengecualian | Hanya event aktif yang menerima registrasi, perjalanan baru, pembatalan, perubahan registrasi, atau perubahan pengecualian. Event lama dapat dilihat. |
| Pembayaran | Pembayaran, rekonsiliasi pembayaran lama | Hanya event aktif yang menerima pembayaran atau perubahan rekonsiliasi. Untuk event lama, rincian transaksi tetap dapat dibaca. |
| Keuangan peserta | Refund, koreksi keuangan | Refund dan koreksi untuk event nonaktif ditolak. Riwayat transaksi dan bukti yang sudah ada tetap dapat dibaca. |
| Operasional armada | Rombongan/bus, alokasi peserta, tracking terkait event | Buat/ubah/hapus bus dan alokasi peserta hanya saat event aktif. Data event lama tetap tersedia untuk ditinjau. |
| Cetak | Kartu, tiket, absensi, manifest dan ekspor PDF | Boleh membaca dan mengekspor event aktif maupun nonaktif. Tidak mengubah data event. |
| Pelaporan | Laporan keuangan dan ringkasan per event | Tetap baca-saja; event yang dipilih membatasi laporan. Perubahan filter laporan bukan mutasi data. |
| Master global | Santri, akun, Korda/Korwil, titik turun dan hierarki wilayah | Tidak dikunci oleh event terpilih karena bukan data milik event tertentu. |
| Keuangan pusat | Kas pusat dan pencairan tercatat | Tidak dikunci oleh pilihan event bila pencairan adalah pencatatan kas global. Jika suatu entri benar-benar terkait event, server tetap harus menerapkan status event. |
| Pengelolaan event | Membuat/mengubah status dan metadata event | Admin tetap dapat mengelola event melalui halaman khusus. Aktivasi event baru menonaktifkan event aktif sebelumnya. Penghapusan event lama mengikuti validasi relasi dan kebijakan hapus yang sudah ada. |

Daftar ini menjadi peta audit implementasi. Sebelum menutup setiap slice, perlu mencari seluruh server action terkait karena nama halaman saja tidak menunjukkan semua titik mutasi.

## Tahapan implementasi yang disetujui

### Tahap A — Fondasi status dan pemilih event global

**Status:** Sedang berjalan. Implementasi, migration development, serta pemeriksaan browser pada pemilihan event global telah dilakukan. Header memilih satu event aktif sebagai default tanpa bergantung pada tanggal; QA kondisi tanpa event aktif dan aktivasi event kedua/serentak belum dilakukan.

- Inventarisasi seluruh pembacaan event dan mutasi yang terkait event; tetapkan satu helper server untuk mengambil event aktif/terpilih dan memvalidasi hak akses.
- Tambahkan pemilih event di header/navbar yang konsisten pada semua halaman. Daftar pilihan tidak disusun dengan tanggal untuk menentukan default.
- Simpan pilihan global secara aman dan validasi ulang terhadap daftar event yang dapat diakses pengguna. Setiap aksi tulis tetap mengirim/menentukan eventId dan memeriksa status terbaru di server.
- Jika ada satu event `ACTIVE`, pilih itu sebagai default walaupun tanggalnya sudah berlalu atau belum tiba. Jika tidak ada, jangan memilih event berdasarkan tanggal; tampilkan keadaan tanpa event operasional sampai pengguna memilih event lama untuk baca/cetak atau admin mengaktifkan event.
- Pastikan aktivasi event baru menutup event aktif sebelumnya dan tambahkan batasan PostgreSQL agar maksimal satu baris `ACTIVE`, termasuk untuk dua permintaan bersamaan.
- Tangani URL lama yang menyertakan filter event: event terpilih harus tervalidasi, dan UI global mengikuti konteks tersebut atau menjelaskan jika parameternya tidak valid.

**Kriteria selesai:** event aktif tunggal ditegakkan oleh aplikasi dan database; semua halaman utama menampilkan pilihan global yang sama; tanggal tidak memengaruhi pilihan; keadaan tanpa event aktif jelas.

### Tahap B — Pembatasan mutasi dan mode baca-saja

**Status:** Sedang berjalan. Guard server dan kontrol UI utama telah diterapkan. Pemeriksaan browser admin dan Korda telah mengonfirmasi tampilan read-only untuk event selesai serta akses operasional event aktif. Guard server diuji untuk event aktif dan selesai; belum seluruh variasi operasi tulis diuji langsung pada event nonaktif.

- Terapkan guard server pada aksi registrasi, perjalanan, pembatalan, pengecualian Pulang, pembayaran, refund, koreksi, rekonsiliasi, bus, dan penempatan peserta.
- Guard menolak operasi untuk `DRAFT` dan `COMPLETED` dengan pesan yang menjelaskan bahwa event tidak aktif. Cek harus terjadi di dalam transaksi atau sedekat mungkin dengan penulisan untuk menghindari perubahan status di antara pemeriksaan dan commit.
- Sembunyikan atau nonaktifkan kontrol mutasi pada UI saat event terpilih bukan `ACTIVE`, dan tampilkan banner/status read-only. Server tetap menjadi penjaga utama.
- Terapkan konsistensi kepada operasi batch, server action yang tidak punya halaman langsung, endpoint API, dan upload bukti yang menunggu finalisasi.
- Pastikan perubahan metadata master dan aktivasi event melalui halaman pengelolaan event tidak terhalang oleh mode read-only event operasional.

**Progres implementasi 19 Oktober 2026:** Guard transaksi `assertEventWritable` memeriksa status event di dalam transaksi dan mengunci row event selama mutasi. Guard digunakan pada registrasi satuan/batch, rekonsiliasi pembayaran, pembayaran keluarga, refund, koreksi, pengecualian Pulang, pembatalan/penghapusan registrasi, bus, dan alokasi peserta. Registrasi pada event nonaktif—termasuk Kembali susulan—ditolak. Endpoint persiapan upload bukti untuk pembayaran/refund/registrasi memerlukan event aktif dan event yang dapat diakses. UI menampilkan banner baca-saja global, menyembunyikan form registrasi/refund/koreksi/rekonsiliasi, serta meniadakan kontrol pembayaran, pengecualian, dan armada pada event nonaktif. QA browser admin/Korda menunjukkan kontrol sesuai status dan scope; probe guard server untuk event aktif/nonaktif lulus tanpa menulis data. `tsc --noEmit`, ESLint file perubahan, Prisma validate, `git diff --check`, dan production build lulus. Uji langsung seluruh variasi write action pada event nonaktif masih menjadi bagian QA tahap C.

**Kriteria selesai:** semua operasi tulis event nonaktif gagal di server tanpa membuat data parsial; pada event aktif, alur dan pembatasan scope per role tetap berfungsi.

### Tahap C — Konsistensi halaman, baca historis, ekspor, dan QA

**Status:** Sedang berjalan. Selector event lokal di Rombongan dan Tracking telah dihapus, keduanya mengikuti header global. Dialog bus menampilkan event terpilih sebagai informasi tetap. Pagination Data Pulang tidak membawa `eventId` terpisah. Aksi baca armada, GPS, roster Pulang, manifest, daftar/statistik peserta, cetak, dan Excel memvalidasi scope event; GPS dibatasi ke tracker bus yang terlihat oleh role tersebut. QA browser admin dan Korda Demak telah dilakukan untuk event aktif/nonaktif serta halaman operasional terkait; hasil dan keterbatasan dicatat pada tracker. Preview cetak arah aktif berjalan, tetapi tidak memiliki data karena belum ada peserta yang dialokasikan ke bus. `tsc --noEmit`, ESLint file perubahan, Prisma validate, `git diff --check`, dan production build lulus. Full-repository lint tetap menemukan dua error pada file di luar perubahan ini (`ecosystem.config.cjs` dan `DeleteRegistrationDialog.tsx`) serta warning lama. Pemeriksaan tanpa event aktif, aktivasi event kedua/serentak, seluruh variasi mutasi nonaktif, dan PDF berisi roster teralokasi belum selesai.

- Ganti pemilih event lokal yang berbeda-beda agar tersinkron dengan pilihan global; hapus fallback tidak konsisten seperti “semua event” atau pilihan berdasarkan urutan tanggal jika event aktif tersedia.
- Pastikan event nonaktif dapat dibuka untuk membaca tabel/detail dan mengunduh PDF yang tersedia; tidak ada mutasi tersembunyi lewat dialog atau menu sekunder.
- Pastikan event yang dipilih tidak memperluas scope Korda/Korwil. Seleksi event tidak menggantikan otorisasi regional.
- QA dengan kondisi: event aktif normal; aktivasi event kedua; tidak ada event aktif; event historis dipilih; pengguna dengan scope admin/Korwil/Korda; dan operasi create/update/delete/payment/refund/return-susulan ditolak pada event nonaktif.
- QA ekspor PDF untuk event aktif dan historis, serta pastikan report/filter tidak menjalankan mutasi.

**Kriteria selesai:** pemilih event, indikator read-only, data yang terlihat, aksi server, dan hasil ekspor konsisten; tidak ada regresi pada alur event aktif.

## Batasan dan hal yang tidak berubah

- Tanggal mulai/selesai tetap boleh ditampilkan dan dipakai untuk informasi atau pengurutan daftar yang eksplisit, tetapi tidak menentukan event aktif, default event, atau izin menulis.
- Perubahan aturan ini tidak mengubah tarif, pembayaran yang sudah tercatat, snapshot perjalanan, saldo Korda, data santri, atau histori event.
- Mengaktifkan event baru tidak memindahkan atau menyalin peserta/transaksi dari event lama.
- PDF yang sudah diunduh tetap merupakan snapshot; ekspor baru membaca data dan penomoran terkini yang tersimpan pada event tersebut.
- Perencanaan ini tidak mengusulkan penghapusan data event historis. “Tidak bisa delete” berarti data operasional event nonaktif tidak dapat dihapus lewat alur operasional. Penghapusan master event tetap terpisah, dibatasi admin, dan harus mengikuti aturan relasi/histori yang ada.

## Temuan audit awal

Audit 19 Oktober 2026 menemukan bahwa perilaku pemilihan event masih berbeda antarhalaman. Beberapa halaman mengambil event aktif, Pembayaran dapat memilih event selesai berdasarkan urutan tanggal, Laporan mulai dengan semua event, dan halaman lain memiliki fallback sendiri. Sejumlah server action memeriksa keberadaan event tetapi belum memverifikasi bahwa statusnya `ACTIVE` sebelum menulis.

Aturan produk dan pemecahan tahap A–C disetujui pengguna pada 19 Oktober 2026. Implementasi dimulai pada Tahap A. Kerjakan tahap sesuai urutan A → B → C dan catat progresnya pada tracker.

---

## Konteks 2 — Penyesuaian UX Mobile

**Status konteks:** Final dan disetujui pengguna pada 19 Oktober 2026. UXM-1, UXM-2, dan UXM-3 selesai untuk QA yang dapat dilakukan di lingkungan ini. Sesuai arahan pengguna pada 20 Oktober 2026, pengujian Android/Auto Translate diserahkan kepada pengguna secara manual dan bukan kriteria penutupan.

Dokumen ini merencanakan penyesuaian navigasi mobile, pemilihan wilayah di dialog, serta responsivitas fitur keuangan. Lingkupnya berbeda dari aturan status event, tetapi kedua rencana dikelola bersama di dokumen terpadu ini.

## Temuan audit awal

### 1. Sidebar mobile tidak menutup setelah navigasi

Sidebar mobile dirender sebagai `Sheet`. Tautan di `AppSidebar` melakukan navigasi, tetapi tidak memanggil `setOpenMobile(false)`. Akibatnya Sheet dapat tetap terbuka menutupi halaman tujuan.

**Arah perbaikan:** saat tautan sidebar dipilih di mobile, tutup Sheet dan lanjutkan navigasi. Perilaku desktop tidak berubah. Navigasi bawah mobile merupakan komponen terpisah dan tidak termasuk masalah ini.

### 2. Opsi wilayah di dalam dialog sulit dipilih dengan mouse

Dialog berikut memakai autocomplete/combobox untuk data wilayah:

- `/santri` — `UpdateRegionalDialog`: Provinsi → Kabupaten/Kota → Kecamatan.
- `/santri` — `EditStudentDialog`: Provinsi → Kabupaten/Kota.
- `/santri` — `AddManualStudentDialog`: Provinsi → Kabupaten/Kota.
- `/master` — `AddKotaDialog`: pencarian provinsi dan pemilihan beberapa kabupaten/kota.

Tiga dialog Santri memakai komponen bersama `Autocomplete` yang menampilkan daftar dalam Popover portal. Gejala dialog tertutup saat opsi diklik dengan pointer, sementara pemilihan dengan panah dan Enter berfungsi, mengarah pada konflik interaksi antara layer Popover portal dan Dialog induk. Akar masalah ini perlu diverifikasi saat implementasi.

Komponen `Autocomplete` juga digunakan dalam formulir registrasi di luar dialog. Perubahan bersama harus mempertahankan pemilihan mouse, keyboard, dan sentuhan pada konteks tersebut.

### 3. Label bahasa dokumen berpotensi memicu Auto Translate

Layout root saat ini mendeklarasikan `<html lang="en">`, padahal antarmuka aplikasi berbahasa Indonesia. Pada Chrome Android, ketidakcocokan ini dapat membuat bahasa halaman salah dikenali dan memicu tawaran atau penggunaan Auto Translate. Penerjemah otomatis dapat mengubah teks DOM yang dikelola React; ini berpotensi menyebabkan mismatch saat hidrasi atau interaksi komponen.

Ini masih hipotesis untuk laporan error lintas perangkat, belum penyebab yang terkonfirmasi. **Arah perbaikan:** tetapkan bahasa dokumen ke `id` dan tandai root aplikasi `translate="no"` agar antarmuka operasional tidak diterjemahkan otomatis. Verifikasi lewat pengujian Chrome Android dengan kondisi terjemahan aktif/nonaktif dan catat gejala/error yang muncul.

### 4. Responsivitas halaman keuangan tidak merata

| Halaman | Kondisi saat ini | Rencana |
|---|---|---|
| `/pembayaran` | Tabel peserta memiliki tampilan kartu mobile; riwayat transaksi berupa kartu; dialog pembayaran memiliki batas tinggi dan scroll. | Pertahankan pola; QA form keluarga dan dialog pada layar sempit. |
| `/refund` | Riwayat beralih ke kartu mobile; form menumpuk pada layar kecil. | Pertahankan pola; QA isi panjang dan kontrol bukti. |
| `/koreksi-keuangan` | Form responsif dan riwayat berupa kartu bertumpuk. | Pertahankan pola; QA teks alasan panjang dan nominal. |
| `/laporan` | Filter/ringkasan responsif, tetapi dua tabel memakai lebar minimum dan scroll horizontal. | Sediakan kartu mobile yang menampilkan metrik penting per baris; pertahankan tabel desktop. |
| `/keuangan` | Form responsif, tetapi tabel posisi dana dan riwayat pencairan memakai lebar minimum dan scroll horizontal. | Sediakan kartu mobile untuk posisi per Korda dan riwayat pencairan; pertahankan tabel desktop. |

## Fase implementasi dan monitoring

Status fase: `Belum dimulai` · `Sedang berjalan` · `Terblokir` · `Selesai`.

### UXM-1 — Navigasi sidebar mobile dan pemilihan wilayah

**Status:** Selesai.  
**Tujuan:** Memastikan navigasi mobile, pemilihan wilayah di dialog, dan bahasa aplikasi bekerja benar di perangkat mobile.

- Tutup sidebar mobile segera setelah pengguna memilih item navigasi.
- Telusuri mekanisme dismiss/focus/portal pada `Autocomplete` dan `Combobox` di dalam dialog.
- Perbaiki pemilihan opsi dengan pointer tanpa menutup dialog induk secara tidak sengaja. Pengujian sentuhan pada Android diserahkan kepada pengguna.
- Periksa urutan fokus, panah keyboard, Enter, Escape, pencarian, loading async, dan reset pilihan wilayah bertingkat.
- Audit semua dialog yang memakai pola sama, terutama tiga dialog Santri dan `AddKotaDialog` di Master.
- Periksa pemakaian `Autocomplete` pada formulir Registrasi yang tidak berada di dalam dialog agar tidak mengalami regresi.
- Deklarasikan bahasa root sebagai `id` dan cegah terjemahan otomatis pada aplikasi dengan `translate="no"`.

**Kriteria selesai:** memilih item di sidebar menutup Sheet di mobile; opsi wilayah dapat dipilih dengan pointer dan keyboard; dialog hanya tertutup melalui aksi yang semestinya; root menyatakan bahasa Indonesia dan memakai `translate="no"`. Pengujian Android/Auto Translate dan sentuhan perangkat nyata menjadi QA manual pengguna di luar kriteria fase.

**Progres QA:** Link di sidebar mobile menavigasi ke `/pembayaran` dan Sheet tertutup pada lebar 375 px. Pemilihan provinsi menggunakan pointer pada dialog Tambah Santri Manual dan pemilihan Kabupaten/Kota menggunakan pointer serta ArrowDown/Enter pada Update Regional; dialog induk tetap terbuka dan kedua dialog dibatalkan tanpa menyimpan perubahan. Root terverifikasi `lang="id" translate="no"`. Dialog AddKota Master tidak diuji langsung karena data Master QA tidak memiliki Korwil/Korda untuk membuka alur pemilihan; perilaku dismiss ditangani pada komponen dialog bersama. Pengujian Android/Auto Translate dan sentuhan perangkat nyata diserahkan kepada pengguna secara manual sesuai arahan 20 Oktober 2026.

### UXM-2 — Layout mobile Laporan Keuangan dan Keuangan Pusat

**Status:** Selesai.  
**Tujuan:** Menampilkan data keuangan dengan nyaman pada layar ponsel tanpa mewajibkan scroll horizontal.

- Tambahkan tampilan kartu mobile untuk tabel ringkasan laporan dan ledger Saldo Lain di `/laporan`.
- Tambahkan tampilan kartu mobile untuk posisi dana per Korda serta riwayat pencairan di `/keuangan`.
- Hindari overflow halaman; teks nama, catatan, dan Korda panjang harus membungkus dengan baik.
- Tetap pertahankan tabel desktop agar tampilan layar besar dan ekspor/analisis tidak kehilangan kolom.

**Kriteria selesai:** data yang sama tersedia tanpa scroll horizontal wajib di layar ponsel; nominal, label/status, tanggal, dan identitas Korda tetap jelas.

**Progres:** `/laporan` kini menampilkan kartu rincian Korda/perjalanan serta kartu Saldo Lain; `/keuangan` menampilkan kartu posisi per Korda, total, dan riwayat pencairan. Tabel tetap tersedia pada breakpoint desktop. Browser QA menguji halaman ini bersama `/pembayaran`, `/refund`, dan `/koreksi-keuangan` pada lebar 320, 375, 430, 768, 1024, dan 1280 px. Tidak ditemukan horizontal overflow pada dokumen. TypeScript, ESLint file perubahan, Prisma validate, dan production build lulus.

### UXM-3 — QA responsif seluruh fitur keuangan

**Status:** Selesai.  
**Tujuan:** Memverifikasi alur keuangan dan perubahan UXM-1/UXM-2 lintas ukuran layar.

- Periksa pada lebar ponsel sempit dan lebar, tablet, dan desktop.
- Uji sidebar melalui setiap kelompok navigasi dan pastikan halaman tujuan terlihat setelah Sheet tertutup.
- Uji dialog Add/Edit/Update wilayah di Santri serta pemetaan kota di Master dengan pointer dan keyboard jika data QA memungkinkan. Pengujian sentuhan Android diserahkan kepada pengguna.
- Pengujian Chrome Android dengan Auto Translate aktif/nonaktif diserahkan kepada pengguna secara manual. Jika gejala error tetap muncul, catat pesan error dan model/browser perangkat sebagai temuan terpisah.
- QA pembayaran, refund, koreksi, laporan, dan keuangan pusat pada mobile: filter, form, dialog, riwayat, teks panjang, serta tombol utama.
- Verifikasi tidak ada perubahan perilaku desktop atau alur submit data.

**Kriteria selesai:** seluruh halaman dalam cakupan dapat digunakan di mobile tanpa kontrol tertutup overlay, dialog yang tertutup tak sengaja, atau konten penting yang terpotong; desktop tetap bekerja.

**Progres QA:** Seluruh lima halaman keuangan dibuka pada viewport 320, 375, 430, 768, 1024, dan 1280 px; tidak ada scroll horizontal di tingkat dokumen. Link sidebar menutup Sheet setelah navigasi. Dialog Update Regional menerima klik opsi dengan pointer serta ArrowDown/Enter tanpa menutup dialog induk; Add Santri Manual menerima klik provinsi. Aplikasi menunjukkan bahasa `id` dan atribut `translate="no"`. Tidak ada alur bisnis yang disubmit sehingga data tidak berubah. Pengujian Android/Auto Translate dan sentuhan perangkat nyata dilakukan pengguna secara manual dan berada di luar exit criteria fase.

## Status keseluruhan

- [x] UXM-1 — Navigasi sidebar mobile dan pemilihan wilayah.
- [x] UXM-2 — Layout mobile Laporan Keuangan dan Keuangan Pusat.
- [x] UXM-3 — QA responsif seluruh fitur keuangan.

Urutan normal adalah UXM-1 → UXM-2 → UXM-3. UXM-1 dan UXM-2 dapat dikerjakan terpisah, tetapi UXM-3 menunggu keduanya selesai. Tutup fase setelah kriteria keluar dan bukti QA dicatat pada tracker.

## Batasan

- Perencanaan ini tidak mengubah aturan bisnis, izin role, perhitungan keuangan, struktur data, atau proses event.
- Tahap ini memperbaiki pengalaman pengguna; perubahan server action atau database hanya diperlukan jika ditemukan masalah fungsional tambahan saat implementasi.
- Perubahan UXM-1 dan UXM-2 sudah diterapkan; status dan verifikasi terbarunya tercatat pada tiap fase dan tracker proyek.
- Pengujian Chrome Android/Auto Translate dan sentuhan nyata akan dilakukan pengguna secara manual. Perubahan `lang="id"` dan `translate="no"` sudah diterapkan, tetapi penyebab error lintas perangkat tetap hipotesis sampai ada hasil uji/perangkat yang mengonfirmasinya.
