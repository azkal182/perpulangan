# QA dan Rekonsiliasi — Fase 7

**Status:** Selesai untuk lingkup development, 18 Oktober 2026. PDF manifest tidak termasuk pemeriksaan ini sesuai arahan pengguna. Pemeriksaan saldo rekening nyata, backup production, konfigurasi bucket dan retensi production, serta keputusan kesiapan rilis production berada di luar lingkup dan tidak menjadi blocker Fase 7.

## Hasil rekonsiliasi development

Query agregat baca-saja pada database `perpulangan_dev` menghasilkan:

| Area | Hasil |
| --- | ---: |
| Registrasi | 141: 121 santri dan 20 peserta eksternal; tidak ada yang kehilangan peserta |
| Journey | 262 terdaftar; tarif snapshot lengkap; total tagihan Rp61.825.000 |
| Flag lunas lama | 14, cocok dengan 14 antrean Legacy OPEN: 8 Pulang dan 6 Kembali |
| Payment | 84 transaksi; total Rp48.268.750 |
| Alokasi | Rp47.993.750 ke Journey + Rp275.000 ke Saldo Lain = Rp48.268.750; tidak ada selisih Payment terhadap alokasi |
| Refund | 8 transaksi, total Rp388.750 |
| Koreksi | 0 transaksi, Rp0 |
| Saldo Lain | 11 kredit Rp275.000; cocok dengan 11 alokasi BALANCE. Dua refund saldo cocok dengan dua debit Saldo Lain, total Rp20.000 |
| Pencairan | 1 catatan, Rp200.000 |
| Kas pusat | Rp48.268.750 − Rp388.750 − Rp200.000 = **Rp47.680.000** |
| Armada | 260 penempatan; tidak ada bus hilang atau kelebihan kapasitas. Dua Journey belum ditempatkan |

Posisi saldo Korda cocok: penerimaan Journey bersih Rp47.625.000 + Saldo Lain bersih Rp255.000 = Rp47.880.000; dikurangi pencairan Rp200.000 menghasilkan dana tersisa Rp47.680.000. Dashboard dan laporan menunjukkan 141 pendaftar, 262 perjalanan, 2 belum ditempatkan, tagihan Rp61.825.000, penerimaan perjalanan Rp47.993.750, refund perjalanan Rp368.750, dan sisa tagihan Rp14.200.000.

## Perbaikan yang dilakukan

- Kartu event berhenti menghitung penerimaan dari flag lunas legacy dikalikan tarif DropPoint terkini. Sekarang kartu menunjukkan jumlah pendaftar tanpa target contoh.
- Status pembayaran dan statistik registrasi menghitung alokasi setelah refund dan koreksi.
- Endpoint bukti refund Saldo Lain memeriksa scope Korda pemilik Saldo Lain.
- Seed demo membuat antrean rekonsiliasi untuk semua flag lunas yang dibuatnya, dan menghentikan penambahan pembayaran/refund demo jika ledger demo untuk event itu sudah ada.

Saat penyelarasan pertama dijalankan, seed menambahkan 3 pembayaran demo dan 4 refund demo yang sebelumnya belum terbentuk. Angka itu sudah termasuk di tabel dan tetap cocok antar-ledger. Uji seed berikutnya menghasilkan 0 pembayaran dan 0 refund baru.

## Verifikasi aplikasi

QA browser baca-saja dilakukan dengan akun admin dan QA Korda Demak:

- Admin: Event, Dashboard, Pembayaran, Refund, Laporan, dan Keuangan Pusat terbuka.
- Korda Demak: dashboard hanya menampilkan event dan Korda dalam cakupannya; halaman Pembayaran memiliki 5 peserta dengan tagihan terbuka dan riwayat hanya menampilkan alokasi Demak; pilihan refund serta laporan terbatas ke Demak.
- Akses langsung Korda ke `/keuangan` menampilkan **Akses ditolak**.
- Tidak ada form transaksi yang dikirim selama QA.

Pemeriksaan server untuk bukti keluarga memastikan metadata transaksi tidak dikirim ke endpoint unduhan, file hanya dilayani bila ada setidaknya satu alokasi terkait dalam scope akun, dan signed download berlaku 5 menit. Bukti refund Saldo Lain menggunakan scope Korda pemilik saldonya.

`prisma migrate status` melaporkan **31 migrasi ditemukan, database development up to date**. `pnpm exec tsc --noEmit`, ESLint pada file yang diubah, dan `git diff --check` lulus. Tidak ada migrasi yang dijalankan selama Fase 7.

## Catatan

Seed, angka, dan pemeriksaan di dokumen ini mewakili database development; jangan menafsirkannya sebagai angka rekening atau data operasional nyata. Production dan tugas administrasi infrastrukturnya sengaja tidak menjadi kriteria penerimaan fase ini.
