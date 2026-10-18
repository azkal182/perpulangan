# Perencanaan Revisi 1: Roster Pulang, Alokasi Armada, dan Cetak Dokumen

**Status:** FINAL — disetujui pengguna pada 18 Oktober 2026  
**Dibuat:** 18 Oktober 2026  
**Baseline:** Fase 1–7 tetap final dan tertutup. Revisi ini melanjutkan pekerjaan sebagai Fase 8–11; tidak membuka atau mengubah riwayat fase sebelumnya.

## 1. Tujuan

Memudahkan petugas mengelola siapa yang belum didaftarkan untuk perjalanan Pulang, mencatat santri yang memang tidak ikut Pulang, menemukan perjalanan yang belum mendapat bus, serta mencetak kartu/tiket dan absensi dengan susunan roster yang konsisten.

## 2. Cakupan revisi

### 2.1 Pendataan santri yang belum terdaftar untuk Pulang

Sediakan data per event yang memisahkan:

1. **Belum terdaftar Pulang:** santri aktif di master yang belum memiliki Journey `OUTBOUND` untuk event tersebut dan tidak memiliki catatan pengecualian Pulang.
2. **Tidak ikut Pulang:** santri yang dikecualikan dari daftar calon Pulang karena alasan yang dicatat, misalnya wisuda, partisipan, atau sedang pulang.
3. **Sudah terdaftar Pulang:** santri yang telah memiliki Journey `OUTBOUND`.

Pengecualian berlaku hanya untuk Perjalanan Pulang. Pengecualian tidak membuat Registration/Journey atau tagihan, dan tidak menghalangi santri didaftarkan untuk Perjalanan Kembali. Karena itu, santri yang hanya memiliki Journey `RETURN` tetap masuk daftar calon Pulang kecuali telah dicatat tidak ikut Pulang.

Catatan pengecualian perlu memuat event, santri, alasan pilihan terstruktur, pembuat, waktu pembuatan/pembaruan, dan riwayat perubahan. Pilihan alasan awal: **Wisuda**, **Partisipan**, dan **Sedang Pulang**. Alasan wajib dipilih; tidak ada input alasan bebas. Jika santri kemudian didaftarkan untuk Pulang, catatan pengecualian perlu ditandai selesai/dibatalkan dengan jejak audit agar tidak ada dua status operasional yang bertentangan.

**Model teknis sementara:** entitas disposisi santri-event untuk arah Pulang dengan keunikan satu catatan aktif per event-santri. Daftar calon dihitung dari data `Student` berstatus aktif (`status = true`) dan keberadaan Journey, bukan dengan membuat Registration semu.

**Hak akses:** hanya admin/Pusat yang dapat mencatat, mengubah, atau membatalkan pengecualian. Aksi harus menyimpan pelaku dan riwayat perubahan.

### 2.2 Peringatan perjalanan yang belum mendapat bus

Tambahkan banner kontekstual di halaman `/rombongan` untuk event dan filter yang sedang aktif, dengan jumlah Journey `OUTBOUND` dan `RETURN` yang berstatus terdaftar tetapi belum memiliki bus. Banner menyediakan akses ke daftar peserta yang bisa dialokasikan. Dashboard sudah menghitung total perjalanan tanpa bus, tetapi halaman armada belum memberi peringatan seperti ini.

Perhitungan mengikuti scope akses pengguna. Journey yang dibatalkan tidak masuk jumlah tertunda. Pengecualian “Tidak ikut Pulang” tidak dihitung sebagai perjalanan tanpa bus karena tidak mempunyai Journey Pulang.

### 2.3 Cetak kartu, tiket, dan absensi

- Filter perjalanan wajib dipilih sebelum preview atau cetak; nilai awal kosong, bukan Semua.
- Hanya Journey aktif yang sudah mendapat alokasi bus yang dapat dicetak.
- Gunakan Journey dan `JourneyBusAssignment` sebagai sumber data utama cetak, bukan field bus legacy pada Registration.
- Urutan roster kanonik: **Korwil → Korda tujuan → bus → titik turun/penjemputan sesuai arah → nama**.
- Gunakan urutan kanonik dan nomor roster yang sama pada kartu barang, tiket, serta absensi untuk event dan arah perjalanan yang sama.
- Nomor roster bersifat **dinamis**, bukan nomor registrasi persisten. Nomor diurutkan ulang per Korda tujuan ketika roster yang menjadi sumber cetak berubah.
- Nomor dimulai dari 1 pada setiap kelompok Korda tujuan. Di dalam Korda, urutannya mengikuti bus, titik perjalanan, lalu nama. Penambahan peserta atau perubahan bus/titik yang menyisipkan peserta di tengah urutan dapat mengubah nomor peserta setelah posisi tersebut.
- Nomor dihitung dari roster lengkap yang memenuhi syarat untuk event dan arah terpilih, sebelum filter tampilan tambahan diterapkan, agar preview kartu/tiket dan absensi memakai nomor yang sama.
- Susun kartu lintas Korda secara berurutan ke halaman berikutnya tanpa menyisakan satu halaman per Korda. Identitas Korda tujuan tetap terlihat pada tiap kartu/tiket.
- Tambahkan ukuran kertas A3+ selain A4, F4, dan A3, dengan dimensi **329 × 483 mm** (32,9 × 48,3 cm; sekitar 13 × 19 inci).
- Kartu barang menampilkan NIS seperti saat ini. Tiket tidak menampilkan NIS. Absensi menampilkan NIS; NIS peserta eksternal kosong.

**Dampak nomor dinamis:** jika pendaftar baru belum mendapat bus, ia tidak memengaruhi roster cetak. Setelah dialokasikan, ia masuk ke roster; apabila posisi urutnya berada di tengah, nomor sesudahnya berubah. PDF lama tetap snapshot lama. Untuk mencegah kartu lama dan absensi baru berbeda, kartu/tiket/absensi harus dibuat dari susunan roster yang sama dan dicetak ulang setelah perubahan yang memengaruhi roster.

## 3. Temuan repo yang menjadi dasar

- Daftar peserta registrasi saat ini sudah menampilkan bus Pulang dan Kembali. Nilainya berasal dari field bus legacy yang disinkronkan oleh aksi alokasi; sumber alokasi yang lebih baru adalah `JourneyBusAssignment`.
- Dashboard telah memiliki angka Journey tanpa bus. Halaman `/rombongan` belum menampilkan banner jumlah yang belum dialokasikan untuk event/filter terpilih.
- Filter perjalanan pada cetak kartu/tiket default ke Semua. Query cetak belum mewajibkan perjalanan pilihan dan belum membatasi hasil hanya pada Journey dengan bus.
- Data cetak kartu/tiket belum memakai urutan Korwil → Korda → bus → titik perjalanan → nama. Pengelompokan halaman per Korda dapat menyisakan ruang kosong.
- Ukuran yang tersedia pada konfigurasi cetak adalah A4, F4, dan A3; A3+ belum ada.
- PDF absensi sudah memiliki nomor baris per bus, tetapi nomor tersebut bukan nomor roster Korda yang dibagi dengan kartu/tiket. Data manifest juga perlu menyediakan Korda tujuan agar nomor yang di-reset per Korda mudah dibaca saat satu bus membawa beberapa Korda.
- `Student` dan Registration/Journey terpisah sehingga daftar calon Pulang dapat menghitung santri yang belum mempunyai Journey `OUTBOUND`, termasuk santri yang sudah memiliki perjalanan Kembali.

## 4. Tidak termasuk revisi ini

Sesuai arahan pengguna, berikut tidak dimasukkan:

- WhatsApp dan tracking mobile/GPS.
- Pengurutan titik turun untuk operasi rute di luar urutan dokumen cetak ini.
- Rute berbeda antarbus, susunan titik turun operasional, dan fitur lanjutan lain yang sebelumnya diminta untuk diabaikan.
- Pembatalan, pindah Korda, validasi data, peserta eksternal, pendaftaran umum, dan fitur keuangan yang sudah tersedia atau sudah dikecualikan.
- Tema kartu/tiket statis yang dipilih admin, label arah baru pada kartu/tiket, target jumlah peserta, jadwal perpulangan, dan laporan jumlah fee.

## 5. Kriteria penerimaan

- Petugas dapat melihat daftar santri aktif yang belum memiliki perjalanan Pulang untuk event terpilih.
- Petugas dapat mencatat santri tidak ikut Pulang beserta alasan; santri tersebut hilang dari daftar calon Pulang dan muncul pada daftar pengecualian. Perjalanan Kembali tidak ikut dikecualikan.
- Santri dengan Journey Kembali saja tetap tampil sebagai calon Pulang bila belum didaftarkan atau dikecualikan untuk Pulang.
- Halaman armada menunjukkan jumlah Journey Pulang/Kembali yang belum dialokasikan dalam scope event dan filter aktif, serta memberi akses untuk menanganinya.
- Cetak menolak preview dan pembuatan dokumen sebelum arah perjalanan dipilih.
- Hasil cetak hanya berisi Journey terdaftar yang sudah memiliki bus.
- Kartu/tiket dan absensi mengurutkan peserta menurut Korwil → Korda tujuan → bus → titik perjalanan → nama.
- Nomor roster dinamis di-reset per Korda tujuan dan konsisten antara kartu/tiket dan absensi pada roster yang sama.
- Penambahan atau perubahan alokasi yang memengaruhi urutan menghasilkan nomor roster terbaru pada dokumen yang dibuat ulang; dokumen lama tidak berubah.
- Kartu/tiket lintas Korda menggunakan ruang halaman secara berurutan tanpa pemisahan halaman wajib per Korda. A3+ tersedia sebagai ukuran cetak.
- Tiket tidak menampilkan NIS; NIS peserta eksternal kosong pada dokumen yang menampilkan NIS.

## 6. Keputusan yang telah disepakati

Tidak ada keputusan bisnis utama yang tersisa sebelum implementasi. Keputusan yang menjadi aturan revisi ini:

- Pencatatan pengecualian Pulang hanya dapat dilakukan admin. Alasan wajib dipilih dari enum: Wisuda, Partisipan, atau Sedang Pulang.
- NIS tampil di kartu barang dan absensi; NIS peserta eksternal dikosongkan. Tiket tidak menampilkan NIS.
- A3+ menggunakan dimensi 329 × 483 mm.
- Nomor roster dinamis dan dihitung ulang untuk dokumen baru. Dokumen PDF yang sudah dibuat merupakan snapshot dan tidak berubah.
- Pemeriksaan visual PDF dilakukan pengguna secara manual, sesuai arahan sebelumnya.

Rincian teknis seperti bentuk komponen, query, skema migrasi, dan susunan UI ditetapkan saat pengerjaan fase terkait tanpa mengubah aturan produk di atas.

## 7. Fase implementasi revisi

Fase 8–11 adalah kelanjutan resmi setelah Fase 7. Setiap fase dicatat pada tracker; fase berikutnya dimulai setelah kriteria keluar fase sebelumnya terpenuhi.

### Fase 8 — Daftar Pulang dan pengecualian

**Tujuan:** Petugas dapat menindaklanjuti santri aktif yang belum memiliki perjalanan Pulang dan mencatat yang memang tidak ikut.

- Buat daftar per event yang mencakup santri aktif tanpa Journey `OUTBOUND`; santri dengan `RETURN` saja tetap masuk.
- Catat pengecualian per event-santri dengan alasan enum yang diwajibkan.
- Batasi buat, ubah, dan batalkan pengecualian kepada admin; simpan aktor, waktu, dan audit perubahan.
- Pengecualian tidak membuat Registration/Journey/tagihan dan tidak mengecualikan Journey `RETURN`.
- Saat Journey `OUTBOUND` didaftarkan, selesaikan pengecualian aktif secara terlacak.

**Kriteria keluar:** daftar calon dan daftar pengecualian akurat per event; seluruh perubahan pengecualian terlacak; aturan Pulang tidak mengubah Kembali atau keuangan.

### Fase 9 — Peringatan perjalanan tanpa armada

**Tujuan:** Halaman `/rombongan` menyoroti perjalanan terdaftar yang belum ditempatkan ke bus.

- Tampilkan banner kontekstual berdasarkan event dan filter Korwil/Korda aktif.
- Pisahkan jumlah `OUTBOUND` dan `RETURN`, dan sediakan navigasi ke daftar yang dapat dialokasikan.
- Hormati scope akses; perjalanan batal dan pengecualian Pulang tidak dihitung.

**Kriteria keluar:** jumlah banner cocok dengan daftar yang bisa ditindaklanjuti pada scope dan filter yang sama.

### Fase 10 — Sumber roster dan nomor dinamis

**Tujuan:** Semua dokumen memakai data perjalanan dan urutan yang identik.

- Wajib pilih arah perjalanan sebelum preview atau cetak; tidak ada default Semua.
- Ambil hanya Journey aktif yang telah memiliki `JourneyBusAssignment`; relasi Journey/alokasi menjadi sumber kebenaran.
- Terapkan urutan `Korwil → Korda tujuan → bus → titik perjalanan sesuai arah → nama`.
- Nomori mulai 1 per Korda tujuan. Hitung dari seluruh roster cetak yang memenuhi syarat sebelum filter tampilan tambahan.
- Sediakan satu hasil roster/nomor bersama untuk kartu barang, tiket, dan absensi.

**Kriteria keluar:** nomor dan urutan sama untuk ketiga dokumen pada event/arah/roster sama; perubahan roster tercermin saat dokumen baru dibuat.

### Fase 11 — Layout cetak dan QA integrasi

**Tujuan:** Kartu barang, tiket, dan absensi mudah dicetak dan konsisten dengan roster Fase 10.

- Kemas kartu/tiket lintas Korda secara berurutan tanpa page break wajib per Korda; identitas Korda tetap terlihat pada tiap item.
- Sediakan A3+ 329 × 483 mm bersama A4, F4, dan A3.
- Tampilkan NIS pada kartu barang dan absensi, kosongkan NIS eksternal, serta jangan tampilkan NIS pada tiket.
- QA fungsional: pengecualian hanya Pulang, akses admin, scope banner, lintas Korda/bus, nomor dinamis setelah penambahan/perubahan roster, serta konsistensi ketiga dokumen.
- Pengguna memeriksa visual PDF secara manual; pemeriksaan tersebut bukan gerbang QA teknis agen.

**Kriteria keluar:** seluruh kriteria penerimaan bagian 5 terpenuhi dan dicatat di tracker; hasil fungsional QA tersedia; pengguna dapat memeriksa PDF yang dihasilkan.

**Dependensi:** Fase 8 dan 9 dapat dikerjakan terpisah. Fase 10 menjadi dasar Fase 11. Pengecualian Pulang tidak menjadi prasyarat teknis untuk roster cetak, tetapi perlu diselesaikan sebelum revisi dinyatakan lengkap.
