# Perencanaan Hapus Permanen Registrasi dan Pembayaran Keluarga

**Status:** Disetujui pengguna dan sedang diimplementasikan.  
**Tanggal:** 21 Oktober 2026  
**Cakupan:** Purge permanen satu kelompok registrasi yang saling terhubung melalui pembayaran keluarga, pemeriksaan hak dana/pencairan, autentikasi ulang Admin, penghapusan bukti storage, dan audit khusus.

## Aturan produk

1. Hapus permanen hanya tersedia untuk `admin` dari `/daftar-peserta`. Korda/Korwil tidak mendapat aksi purge; aksi penghapusan langsung pada jalur registrasi lama dinonaktifkan. Pembatalan tetap merupakan alur terpisah.
2. Purge hanya boleh dilakukan pada event `ACTIVE`. Status event adalah penentu administrasi; tanggal event tidak membuka kembali operasi.
3. Memilih satu registrasi memulai penelusuran seluruh Payment yang mengalokasikan dana ke registrasi/perjalanannya. Jika satu Payment mencakup beberapa peserta, semua registrasi peserta dalam transaksi itu ikut masuk ke purge. Penelusuran berulang sampai tidak ada lagi transaksi keluarga yang menghubungkan peserta baru.
4. Sebelum konfirmasi, tampilkan cakupan lengkap: peserta, NIS bila tersedia, perjalanan, tujuan/titik turun, tarif, transaksi, alokasi dan nominal, bukti, serta proyeksi kas pusat dan setiap Korda.
5. Konfirmasi berlapis: Admin mengisi alasan, mengetik `HAPUS PERMANEN <jumlah peserta>`, dan memasukkan password akun Admin yang sedang login. Password diverifikasi server menggunakan hash kredensial Better Auth; password mentah tidak disimpan, dimasukkan ke audit, atau dicatat dalam log.
6. Refund atau koreksi yang terhubung ke kelompok transaksi memblokir purge. Riwayat uang nyata/koreksi tidak boleh dihilangkan melalui purge; selesaikan rekonsiliasi terlebih dahulu.
7. Alokasi keuangan lama yang tidak memiliki hubungan peserta yang dapat dipastikan memblokir purge. Sistem tidak menebak pemilik alokasi hanya dari nama.
8. Sebelum penghapusan, hitung ulang posisi setelah purge per Korda dan kas pusat. Tolak jika dana/entitlement Korda sesudah purge tidak cukup untuk mendukung pencairan tercatat atau kas pusat tidak cukup untuk posisi Korda yang tersisa. Nilai yang ditampilkan memisahkan hak bersih setelah fee, penerimaan aktual, Saldo Lain, pencairan, dan sisa dukungan.
9. Penghapusan database dilakukan dalam satu transaksi serializable setelah cakupan dan proyeksi dihitung ulang. Jika daftar berubah setelah pratinjau, minta Admin memuat ulang dan memeriksa lagi.
10. Profil santri, profil peserta eksternal, master Korda/titik turun/bus, dan catatan pengecualian Pulang tidak dihapus. Registrasi, Journey, assignment serta riwayat assignment, rekonsiliasi legacy yang tertaut, seluruh Payment keluarga, alokasi, saldo ledger sumber pembayaran, bukti, dan audit finansial yang terikat Payment dihapus dalam cakupan purge.
11. Bukti Supabase dihapus setelah transaksi database berhasil. Tiap berkas memiliki status pembersihan `PENDING`/`DELETED`/`FAILED`; Admin dapat mengulang pembersihan yang gagal dari halaman riwayat. HTTP 404 dianggap berkas sudah tidak ada.
12. Simpan riwayat purge terpisah yang tidak bergantung pada relasi ke data terhapus: event dan snapshot nama, Admin/pengguna, waktu, alasan, jumlah dan rincian peserta/perjalanan/pembayaran/alokasi, bukti yang dibersihkan, serta posisi keuangan sebelum/sesudah. Halaman `/riwayat-penghapusan` hanya untuk Admin.

## Efek

- Semua peserta dalam kelompok pembayaran terhubung kehilangan registrasi dan perjalanan event tersebut dan dapat didaftarkan ulang.
- Semua transaksi keluarga yang masuk dalam kelompok dihapus dan dapat dicatat ulang dari awal. Tidak ada pembayaran peserta yang tersisa pada kelompok itu.
- Pembayaran, fee, Saldo Lain, laporan, posisi Korda, dan kas pusat dihitung dari catatan yang tersisa. Data peserta/master dan data event lain tetap tersedia.
- Penghapusan yang akan membuat pencairan lebih besar daripada dana/entitlement tersisa ditolak dengan alasan spesifik. Refund/koreksi dan alokasi lama ambigu juga menolak purge.
- Bila penghapusan objek Storage gagal setelah transaksi database, data aplikasi tetap sudah dipurge; riwayat mencatat kegagalan dan menyediakan retry. Status ini terlihat jelas kepada Admin.

## Fase implementasi

### P-1 — Relasi alokasi, audit purge, dan pratinjau

**Status implementasi:** Selesai pada kode; migrasi dev dan pemeriksaan data hasil backfill masih menunggu.

- Tambahkan hubungan PaymentAllocation → Registration dan backfill dari Journey; backfill Saldo Lain hanya bila kandidat peserta unik.
- Tambahkan tabel audit purge dan status pembersihan bukti.
- Bangun penelusuran kelompok payment/registration transitive, validasi event/refund/koreksi/alokasi ambigu, dan proyeksi posisi keuangan.
- Kriteria keluar: cakupan yang sama terhitung ulang di server pada konfirmasi; perubahan sejak pratinjau membatalkan aksi.

### P-2 — Purge atomik, konfirmasi Admin, dan pembersihan bukti

**Status implementasi:** Selesai pada kode; verifikasi runtime menunggu migrasi dev.

- Batasi aksi ke Admin, event aktif, alasan wajib, frasa konfirmasi, dan verifikasi ulang password Better Auth.
- Hapus seluruh baris database yang terkait dalam satu transaksi; jangan hapus master peserta atau event lain.
- Hapus objek Supabase setelah commit dan catat status/error untuk retry.
- Nonaktifkan jalur hapus langsung lama agar tidak menjadi bypass.
- Kriteria keluar: pembersihan parsial tidak mungkin; kegagalan validasi/DB membiarkan semua sumber data tetap utuh.

### P-3 — Halaman riwayat dan verifikasi

**Status implementasi:** UI dan server action selesai pada kode; QA browser belum dilakukan.

- Sediakan `/riwayat-penghapusan` admin-only dengan ringkasan dan rincian audit serta retry bukti gagal.
- Verifikasi migrasi tanpa reset, hak akses, event nonaktif, pembayaran satu/keluarga/transitif, pengaruh multi-Korda, fee/Saldo Lain, insufficient fund, refund/koreksi, password salah/benar, perubahan data setelah preview, dan retry Storage.
- Jangan menjalankan purge pada data bisnis nyata untuk QA. Pakai fixture development yang dapat dibuat dan dibersihkan secara eksplisit.

## Catatan implementasi

Lihat [tracker implementasi](progress-implementasi-perpulangan.md) untuk status migrasi, QA, keterbatasan, dan pekerjaan berikutnya. Fitur ini tidak membuka kembali atau mengubah aturan fase perpulangan sebelumnya.
