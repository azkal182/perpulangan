# Perencanaan Revisi Flow Perpulangan

**Status:** FINAL — perencanaan ditutup pada 18 Oktober 2026; fase implementasi 1–7 selesai dalam lingkup development yang disepakati.  
**Tanggal pembaruan:** 18 Oktober 2026  
**Cakupan:** Keputusan bisnis, alur operasional, hak akses, UI/UX, kebutuhan data, serta rekam jejak audit dan implementasi. Perubahan setelah penutupan mengikuti proses revisi baru dan dicatat pada tracker.

> **Penutupan perencanaan:** Tidak ada keputusan bisnis utama yang menunggu. Dokumen ini menjadi baseline final untuk pengembangan yang disepakati. Status pekerjaan dan hasil QA terakhir ada di [tracker implementasi](progress-implementasi-perpulangan.md) dan [catatan QA Fase 7](kesiapan-rilis-fase7.md). Butir yang menyebut kondisi repo atau tahapan “diusulkan” di bawah adalah baseline/rencana historis, bukan status implementasi terkini.

> **Revisi setelah penutupan:** Revisi 1 mencakup Fase 8–11. Perubahan tarif paket dan penyatuan submit registrasi/pembayaran ditetapkan terpisah sebagai [Revisi 2 — Tarif Paket dan Registrasi dengan Pembayaran](perencanaan-revisi-tarif-dan-registrasi-pembayaran.md), disetujui final pada 18 Oktober 2026; baseline historis di bawah tidak ditulis ulang.

## 1. Tujuan

Menyelaraskan aplikasi dengan kegiatan manajemen perpulangan/liburan pondok pesantren, dari penyiapan data santri sampai keberangkatan, kepulangan ke pondok, dan evaluasi event.

Prinsip utama rancangan:

1. Registrasi peserta dan perencanaan armada dapat berjalan beriringan.
2. Armada mulai direncanakan saat data dianggap cukup mewakili keadaan, lalu dapat diperbarui selama masih ada perubahan peserta.
3. Korda domisili santri menjadi referensi awal. Tujuan perjalanan dipilih untuk masing-masing perjalanan dan dapat berbeda dari domisili.
4. Pembayaran dicatat per kewajiban perjalanan, dengan bukti transfer dan riwayat transaksi.
5. Data region yang tidak cocok ditinjau dan diperbaiki, bukan hilang dari pencarian atau proses operasional.
6. Setiap perubahan penting menyimpan siapa yang mengubah dan kapan.

## 2. Istilah yang digunakan

- **Pulang:** perjalanan pondok menuju rumah.
- **Perjalanan Kembali:** perjalanan dari rumah kembali ke pondok. Registrasi satu arah ini tidak disebut pulang-pergi.
- **Korda domisili:** Korda hasil pemetaan wilayah alamat santri.
- **Korda perjalanan:** Korda tujuan operasional pada satu perjalanan.
- **Armada:** kendaraan untuk event dan perjalanan tertentu.
- **Mulai menyusun armada:** keputusan operasional saat petugas menilai data cukup valid dan tujuan perjalanan stabil. Aplikasi tidak menghitung ambang kesiapan atau menetapkan gerbangnya.

Label pada UI: **Pulang-pergi**, **Perjalanan Pulang**, dan **Perjalanan Kembali**. Untuk pulang-pergi, Korda tujuan harus sama pada kedua arah; titik penjemputan otomatis mengikuti lokasi titik turun dan dapat diubah.

## 3. Baseline repo saat perencanaan dimulai

> Bagian ini merekam kondisi awal saat audit perencanaan, bukan kondisi repo saat ini. Temuan-temuannya menjadi alasan dan jejak keputusan pengembangan. Status implementasi terkini ada di tracker.

- Prisma sudah memiliki `Event`, `Student`, `Registration`, `Korwil`, `Korda`, `DropPoint`, `Bus`, dan `BusKorda`.
- Registrasi menyimpan Korda, titik turun, tanggal, dan pembayaran pulang/kembali secara terpisah.
- UI registrasi saat ini mendukung pulang-kembali dan kembali saja. Pilihan pulang saja belum tersedia.
- Pembayaran saat ini berupa boolean lunas/belum lunas; belum ada unggah bukti, status verifikasi, atau riwayat transaksi.
- Penumpang dapat ditetapkan ke bus per perjalanan. Belum ada alur kesiapan armada atau penanda alokasi yang perlu diperiksa akibat perubahan registrasi.
- Halaman rombongan sudah dapat mencetak PDF daftar/absensi per bus dan perjalanan; aplikasi belum mencatat kehadiran digital.
- Kapasitas bus tersedia di schema dan ditampilkan di UI, tetapi nilai 0 diperlakukan UI sebagai tidak dibatasi dan aksi server penempatan peserta belum memvalidasi jumlah kursi.
- Bus dapat dikaitkan dengan beberapa Korda melalui `BusKorda`; tidak ada konsep pemilik tunggal atau status rencana/siap/selesai. Status bus saat ini hanya `isActive`.
- Pembuatan bus saat ini mensyaratkan event telah tersinkron ke Tracker API.
- Pemetaan alamat API bergantung pada pencocokan nama provinsi/kabupaten. Data yang tidak cocok dapat belum mempunyai relasi wilayah; scope santri untuk Korda/Korwil memakai relasi tersebut.
- Role aplikasi saat ini adalah `admin`, `korwil`, dan `korda`. `admin` dapat berperan sebagai Pusat secara operasional, tetapi belum ada role bernama Pusat.
- Dashboard masih menampilkan angka contoh. Pembayaran, laporan, dan pengaturan masih placeholder.

### Hasil audit kesesuaian dengan repo

Aturan di dokumen ini adalah **target perubahan**, bukan gambaran bahwa fitur sudah berjalan. Kondisi repo yang perlu diperhitungkan:

- Cakupan santri Korda/Korwil saat ini diturunkan dari `Student.regency.korda`. Korda tujuan belum bisa mencari santri dari Korda asal lain, dan data tanpa pemetaan kabupaten/kota tidak masuk scope operasional Korda/Korwil.
- Untuk santri, Korda asal yang jelas tetap wajib sebelum finalisasi agar dapat ditampilkan pada riwayat kelebihan pembayaran. Saldo Lain dimiliki Korda tujuan untuk semua peserta. Profil peserta eksternal hanya memuat nama, jenis kelamin, alamat, dan Korda tujuan; Korda asalnya tidak tersedia dan ditampilkan sebagai "—"/"Tidak ada (peserta eksternal)".
- `Registration` adalah satu record per santri per event (`@@unique([eventId, studentId])`) dengan dua perjalanan dalam record yang sama. Scope registrasi saat ini memberi akses ke seluruh record jika salah satu tujuan cocok dengan scope akun. Hak baca/perubahan per perjalanan belum terisolasi ketika perjalanan pulang dan kembali dikelola Korda berbeda.
- `Registration` belum menyimpan snapshot Korda asli atau foreign key Korda/akun pencatat. Korda asli hanya dapat diturunkan dari relasi alamat/regency yang dapat berubah; `registrarName` dan `registrarPhone` hanya teks.
- Hak pembentukan, perubahan, dan penghapusan bus saat ini mengikuti scope bus, bukan pembatasan role “hanya Pusat/Korwil”. Akun Korda yang memiliki akses ke bus dapat melakukan aksi tersebut.
- Aksi server penempatan peserta memeriksa event dan kecocokan Korda tujuan dengan Korda yang ditautkan ke bus, tetapi belum memeriksa kapasitas kursi. UI menganggap kapasitas 0 sebagai tidak terbatas. Target baru perlu memvalidasi kapasitas secara transaksional di server serta melarang kapasitas kosong/0 dipakai sebagai tanpa batas.
- Pembuatan bus bergantung pada sinkronisasi event dan pembuatan tracker eksternal; ini bertentangan dengan target perencanaan armada lokal tanpa menunggu Tracker.
- Pembayaran sekarang boolean per perjalanan. Aksi refund hanya mengubah status lunas menjadi belum lunas; belum ada nominal pembayaran/refund atau buku saldo yang dapat diaudit.
- Pencetakan daftar bus sudah tersedia sebagai PDF. Kebutuhan yang disepakati adalah daftar cetak, bukan absensi digital; pekerjaan selanjutnya perlu menjaga/menyempurnakan cetak, bukan membangunnya dari nol.
- Master `DropPoint` sekarang menyimpan nama dan satu harga per Korda, lalu dipakai pada perjalanan pulang maupun kembali. Form dan manifest masih menyebut titik pada kedua arah sebagai **Titik Turun**; belum ada label/konsep khusus untuk penjemputan atau tarif berbeda per arah.
- Form registrasi saat ini memungkinkan Korda pulang dan kembali berbeda dalam satu pengajuan, padahal aturan yang disepakati mensyaratkan satu Korda tujuan untuk pengajuan pulang-pergi.

Keputusan desain untuk implementasi: satu pengajuan yang berisi pulang-pergi hanya boleh memakai **satu Korda tujuan yang sama**. Jika dua arah menuju Korda berbeda, petugas membuat dua pengajuan terpisah, satu perjalanan per pengajuan. Di penyimpanan, satu peserta tetap memiliki satu data induk per event dengan rincian perjalanan sebagai entitas terpisah; setiap pengajuan menambah/mengisi perjalanan yang dipilih. Setiap perjalanan menyimpan Korda tujuan, lokasi sesuai arah, tanggal, snapshot tarif, pembayaran, dan armada. Hak baca/perubahan perjalanan diberikan kepada Korda tujuan perjalanan; Korwil/Pusat mengikuti cakupannya. Pemeriksaan ini dilakukan di server.

## 4. Peran dan batas akses yang disepakati

| Peran | Tanggung jawab utama | Cakupan yang diusulkan |
|---|---|---|
| Pusat (menggunakan role `admin` yang ada) | Menjalankan operasional Pusat sekaligus mengelola akun/konfigurasi, melakukan registrasi, menyiapkan event dan master wilayah, menangani data lintas wilayah, memantau pembayaran/refund, membuat armada, dan menempatkan peserta | Semua Korwil dan Korda |
| Korwil | Melakukan registrasi untuk tujuan dalam cakupannya, memantau data wilayah, mencatat pembayaran/refund dalam cakupannya, membuat armada untuk cakupannya, dan menempatkan peserta | Registrasi dan pembayaran/refund mengikuti Korda tujuan dalam Korwil; alokasi mengikuti armada dalam cakupan Korwil |
| Korda | Melakukan registrasi peserta yang menuju Kordanya, mencatat pembayaran/refund, dan menempatkan peserta ke armada Kordanya | Dapat mencari santri lintas asal untuk mendaftarkan perjalanan dengan tujuan Kordanya; dapat menempatkan siapa pun dan memproses pembayaran/refund untuk perjalanan dalam cakupan Kordanya |

Kasus santri dari Korda A yang pulang menuju Korda B dicatat sebagai lintas Korda. UI menampilkan penanda yang jelas, misalnya **Lintas Korda — Asal: Korda A · Tujuan: Korda B**. Persetujuan dilakukan secara administrasi offline dan tidak menjadi langkah persetujuan di aplikasi. Untuk santri, aplikasi menyimpan domisili/asli peserta, akun/Korda pencatat, dan Korda tujuan perjalanan secara terpisah. Profil peserta eksternal tidak memiliki Korda asal; akses dan registrasinya hanya mengikuti Korda tujuan.

### Aturan akses untuk registrasi dan lintas Korda

1. Semua peran (Pusat/admin, Korwil, Korda) dapat membuat registrasi.
2. Registrasi untuk suatu perjalanan dilakukan oleh Korda tujuan. Contoh: peserta asli Korda A yang menuju Korda B didaftarkan oleh akun Korda B. Untuk Pusat/Korwil, tujuan harus berada dalam cakupan operasional akun tersebut.
3. Pusat dapat mendaftarkan peserta untuk semua tujuan. Korwil dapat mendaftarkan peserta dari Korda asal mana pun untuk tujuan Korda dalam cakupan Korwilnya. Akun Korda dapat mendaftarkan peserta dari Korda asal mana pun untuk perjalanan yang tujuannya adalah Korda akun tersebut.
4. Korda tujuan dan Korwil tujuan dapat mencari santri dari Korda asal mana pun yang akan melakukan perjalanan ke cakupan tujuannya; Pusat dapat mencari lintas wilayah. Hasil pencarian lintas cakupan hanya menampilkan informasi minimal untuk identifikasi (misalnya nama, NIS, jenis kelamin, dan Korda asli). Ini tidak memberi hak mengubah profil/alamat santri atau membuka daftar lengkap data pribadi wilayah asal.
5. Server memvalidasi sesi, tujuan perjalanan terhadap cakupan akun, event, serta keberadaan Korda dan titik turun. Untuk akun Korda, Korda tujuan harus Korda milik akun tersebut; untuk Korwil, tujuan harus berada dalam Korwil tersebut. Korda asli peserta tidak membatasi pendaftaran ke Korda tujuan.
6. Santri harus memiliki Korda asal sebelum registrasi difinalisasi; registrasinya menyimpan snapshot Korda asal. Peserta eksternal hanya menyimpan identitas pencatat dan Korda tujuan, tanpa Korda asal. Saldo Lain untuk kelebihan semua peserta dimiliki Korda tujuan; riwayat menunjukkan peserta, pengirim ditandai “Tidak dicatat”, Korda asal santri jika ada, dan Korda tujuan.
7. Satu pengajuan pulang-pergi mensyaratkan Korda tujuan kedua perjalanan sama. Jika berbeda, Korda tujuan masing-masing mendaftarkan perjalanannya melalui pengajuan terpisah. Setiap Korda hanya membaca/mengubah perjalanan yang menjadi tujuannya; Pusat/Korwil mengikuti cakupan masing-masing.

### Aturan akses untuk membuat armada dan menempatkan peserta

1. Hanya Pusat dan Korwil yang dapat membuat, mengubah, atau menghapus data armada. Ini berbeda dari kondisi repo saat ini: aksi bus belum melarang role Korda jika bus berada dalam scope-nya.
2. Semua peran dapat menempatkan peserta ke armada yang sudah tersedia.
3. Pusat dapat menempatkan peserta pada armada mana pun. Korwil dapat menempatkan peserta pada armada di cakupan Korwilnya. Korda dapat menempatkan peserta mana pun ke armada yang dimiliki/dikelola Korda akun tersebut; kewenangan mengikuti pemilik armada, bukan Korda asli peserta.
4. Contoh: peserta asli Korda B terdaftar menuju Korda A dan akan menaiki armada Korda A. Akun Korda A tetap dapat memasukkan peserta itu ke armada A. Korda B tidak mendapat hak mengubah penempatan armada A hanya karena peserta berasal dari B.
5. Aksi server memeriksa event, perjalanan/tanggal, kapasitas kursi sebagai batas mutlak, relasi bus-Korda tujuan, dan bahwa akun Korda pengalokasi berwenang atas armada tujuan tersebut. Pusat/Korwil tetap memiliki hak sesuai cakupannya. Repo saat ini belum menegakkan kapasitas di server.
6. Hak mengelola penempatan tidak otomatis membuka semua data pribadi atau perjalanan lain milik peserta. Query/tampilan hanya mengembalikan informasi yang diperlukan untuk perjalanan dan armada dalam cakupan petugas.

## 5. Alur ujung ke ujung

### A. Penyiapan data santri

1. Pusat mengimpor data dari API atau membuat/mengimpor santri manual.
2. Sistem menyimpan sumber data dan alamat mentah dari API bila tersedia.
3. Sistem mencoba mencocokkan alamat ke master provinsi/kabupaten/kecamatan/desa.
4. Data dengan hasil cocok ditampilkan bersama tingkat/status verifikasinya.
5. Data tidak cocok, ambigu, atau belum lengkap masuk ke **Perlu verifikasi region**.
6. Petugas memilih region yang benar, menyimpan alasan bila perlu, lalu menandai data telah diperiksa.
7. Data yang belum lengkap tidak dapat didaftarkan. Sistem menolak penyimpanan dan menampilkan data apa yang kurang serta bahwa admin perlu memperbaruinya. Setelah admin melengkapi dan menyimpan data, pendaftaran dapat dilanjutkan.
8. Santri yang belum ada dalam master santri ditambahkan/diperbaiki oleh admin terlebih dahulu. Untuk orang non-santri, semua role yang berwenang pada Korda tujuan dapat memilih **Tambah peserta eksternal** dan mengisi profilnya. Nama, jenis kelamin, alamat, dan Korda tujuan wajib lengkap sebelum profil disimpan; jika ada yang kurang, sistem menolak penyimpanan dengan daftar field yang belum diisi. Profil yang berhasil disimpan langsung berstatus **Lengkap** dan dapat dipakai untuk registrasi tanpa persetujuan admin.

### B. Penyiapan event

1. Pusat membuat event, jadwal perpulangan, jadwal kembali, dan informasi operasional.
2. Pusat membuka registrasi. Registrasi dapat ditutup atau dibuka kembali sebagai keputusan operasional, tetapi status ini tidak otomatis mengunci atau membuka perencanaan armada.
3. Event menampilkan ringkasan jumlah peserta, perjalanan, pembayaran, data region, serta armada.

### Alur global event liburan

1. Pondok menetapkan event liburan dan membuka pendaftaran perjalanan.
2. Pada pendaftaran awal, peserta dapat didaftarkan pulang-pergi dengan satu Korda tujuan yang sama, hanya perjalanan pulang, atau hanya perjalanan kembali. Untuk mode pulang-pergi, titik penjemputan otomatis memakai lokasi titik turun yang sama sebagai nilai awal; petugas dapat menggantinya jika lokasi penjemputan berbeda.
3. Jika pulang-pergi menggunakan Korda tujuan berbeda, petugas mengirim dua pengajuan terpisah: satu perjalanan pulang dan satu perjalanan kembali. Satu pengajuan tidak mencampur dua Korda tujuan.
4. Saat liburan berlangsung dan menjelang peserta kembali ke pondok, petugas memeriksa siapa yang belum memiliki perjalanan kembali. Untuk peserta tersebut, petugas mendaftarkan perjalanan kembali secara terpisah melalui Korda tujuan yang berwenang.
5. Pengajuan perjalanan kembali melengkapi perjalanan yang belum ada pada peserta/event yang sama. Sistem tidak membuat identitas peserta atau event duplikat, dan mencegah perjalanan kembali yang sama didaftarkan dua kali.
6. Setelah perjalanan yang diperlukan tersedia, petugas menyusun/memperbarui armada per perjalanan dan mencetak daftar peserta terbaru.

### C. Registrasi peserta

1. Akun Pusat, Korwil, atau Korda memilih event dan perjalanan tujuan. Registrasi Korda dilakukan oleh akun Korda tujuan; Korwil dibatasi pada tujuan dalam cakupan Korwilnya. Pencarian berdasarkan identitas dapat menemukan peserta asal mana pun.
2. Petugas mencari santri berdasarkan nama/NIS. Hasil lintas wilayah hanya menampilkan data identifikasi minimal dan Korda asli jika diketahui.
3. Jika santri tidak ditemukan, alur membedakan **santri yang belum tercatat** dari **peserta non-santri**. Santri yang belum tercatat harus ditambahkan/diperbaiki oleh admin terlebih dahulu. Semua role yang berwenang pada Korda tujuan dapat mengisi profil peserta eksternal langsung dalam form registrasi; bila satu field wajib kurang, sistem menolak penyimpanan dan menjelaskan kekurangannya. Jika semua field terisi, profil langsung berstatus **Lengkap** dan dapat dipilih untuk registrasi. Profil eksternal terpisah dari daftar master santri.
4. Sebelum registrasi, sistem memvalidasi semua informasi wajib. Santri harus memiliki Korda asal/penanggung jawab untuk atribusi saldo; data santri yang kurang/tidak valid membuat registrasi ditolak sampai admin memperbaruinya. Peserta eksternal wajib memiliki nama, jenis kelamin, dan alamat. Jika ada yang kurang, profil dan registrasi tidak disimpan; jika lengkap, profil langsung final tanpa peninjauan admin. Peserta eksternal tidak memiliki Korda asal.
5. Petugas memilih pengajuan **Pulang-pergi**, **Perjalanan Pulang**, atau **Perjalanan Kembali**. Pada mode pulang-pergi, pilihan Korda tujuan harus satu Korda dan lokasi penjemputan terisi otomatis sama dengan titik turun; petugas boleh mengganti lokasi penjemputan. Form satu arah kembali hanya menggunakan istilah **Perjalanan Kembali**, bukan pulang-pergi. Peserta yang hanya didaftarkan pulang dapat ditambahkan perjalanan kembalinya nanti sebagai pengajuan terpisah.
6. Untuk perjalanan pulang, petugas memilih Korda tujuan, **titik turun**, tanggal, dan tarif. Untuk perjalanan kembali, petugas memilih Korda tujuan, **titik penjemputan**, tanggal, dan tarif. Jika lokasi fisiknya sama, master lokasi yang sama dapat digunakan; jika berbeda, petugas memilih lokasi yang berbeda.
7. Dalam satu pengajuan pulang-pergi, kedua perjalanan harus menuju Korda yang sama. Jika tujuan pulang dan kembali berbeda, petugas mengirim dua pengajuan terpisah, satu untuk tiap perjalanan dan Korda tujuan. Korda hanya dapat mengelola pengajuan yang tujuannya Korda akun tersebut. Bila Korda tujuan berbeda dari Korda asli, UI menampilkan label **Lintas Korda** berikut asal dan tujuan.
8. Petugas memeriksa ringkasan perjalanan dan menyimpan pengajuan.
9. Sistem mencatat petugas yang melakukan input, bukan nama statis.
10. Untuk menambahkan perjalanan kembali setelah liburan, petugas mencari peserta/event yang sudah ada lalu memilih **Daftarkan perjalanan kembali**. Sistem menambahkan perjalanan ke data peserta/event tersebut, bukan membuat peserta atau event duplikat, dan mencegah duplikasi perjalanan yang sama.

### D. Pembayaran dan saldo Korda

1. Pembayaran dapat dicatat saat registrasi atau dari detail peserta setelahnya.
2. Nilai kewajiban pulang dan kembali ditampilkan terpisah.
3. Tarif/kewajiban setiap perjalanan dicatat sebagai pendapatan Korda tujuan perjalanan tersebut. Tarif mengikuti arah dan lokasi yang dipilih, lalu dibekukan saat pendaftaran; tarif pulang dan kembali tidak diasumsikan selalu sama. Saldo Lain dari kelebihan pembayaran dimiliki Korda tujuan; Korda asal santri tetap dicatat sebagai informasi atribusi/penelusuran, bukan pemilik saldo.
4. Status pembayaran yang terlihat hanya **Belum bayar**, **Partial**, dan **Sudah bayar**. Status berlaku per kewajiban perjalanan dan diturunkan dari nominal yang sudah dialokasikan dibanding nominal yang harus dibayar.
5. Saat pembayaran diinput, petugas mengisi nominal transfer. Nilai awal otomatis sebesar total sisa tagihan yang dipilih; tanggal menggunakan waktu pencatatan dan metode default Transfer. Nama pengirim tidak diminta dan disimpan sebagai “Tidak dicatat”. Form menyediakan unggah bukti transfer; pembayaran tetap dapat dicatat tanpa menunggu pemeriksaan bukti. File bukti menjadi arsip/acuan bila kemudian ada hal yang janggal.
6. Pembayaran partial menyimpan nominal yang sudah diterima dan sisa kewajiban.
7. Wali santri dapat membayar beberapa anak sekaligus. Satu transaksi pembayaran keluarga dapat ditautkan ke beberapa registrasi dan perjalanan anak-anaknya dengan satu bukti transfer yang sama.
8. Di form pembayaran keluarga, petugas memilih event dan perjalanan peserta yang dibayar. Nominal transfer default mengikuti total sisa tagihan pilihan, dapat disesuaikan, lalu sistem menampilkan alokasi dan selisih secara otomatis. Jika transfer kurang, sistem mengalokasikan dana berurutan sesuai daftar tagihan yang terlihat; jika melebihi tagihan, selisih masuk ke Saldo Lain. Sistem membuat rincian otomatis yang menunjukkan peserta/perjalanan dan nominal alokasinya; catatan ini tidak diketik manual. Nama pengirim tidak diminta.
9. Sistem mengalokasikan nominal ke tagihan yang dipilih. Jika nominal melebihi tagihan, kewajiban tetap berstatus Sudah bayar dan kelebihannya dicatat sebagai **Saldo Lain pada Korda tujuan perjalanan** untuk santri maupun peserta eksternal.
10. Setiap saldo lain memiliki transaksi sumber, nominal, waktu, peserta, penanda pembayar “Tidak dicatat”, Korda tujuan pemilik saldo, serta Korda asal santri bila tersedia. Untuk peserta eksternal, Korda asal ditandai tidak tersedia. Jika kelebihan pembayaran keluarga mencakup lebih dari satu peserta/perjalanan, petugas memilih peserta/perjalanan pemilik alokasi Saldo Lain; Korda tujuan saldo mengikuti pilihan tersebut.
11. Saldo Lain hanya dicatat dan direkonsiliasi; saldo ini tidak dapat dipakai untuk membayar kewajiban lain. Jika perjalanan dibatalkan, dana terkait dapat dikembalikan sebagai refund.
12. Semua role (Pusat/admin, Korwil, Korda) dapat memproses refund, tetapi hanya atas perjalanan atau saldo yang berada dalam cakupannya. Korda tujuan dapat memproses refund alokasi tagihan dan Saldo Lain milik Korda tujuan. Pusat dapat memproses semua cakupan, dan Korwil cakupan wilayahnya.
13. Refund dicatat sebagai transaksi baru yang merujuk ke pembayaran/alokasi sumber. Catatan awal tidak dihapus atau ditimpa. Sistem menyimpan nominal refund, tanggal, alasan, akun dan role pelaksana, ruang lingkup Korda, pembayaran/alokasi yang dikembalikan, serta bukti refund bila tersedia. Koreksi dilakukan dengan transaksi koreksi/pembalik yang juga tercatat.
14. Untuk satu pembayaran keluarga, refund hanya mengurangi alokasi anak/perjalanan yang dibatalkan; alokasi anak/perjalanan lain dan bukti transfer asal tetap utuh. Jika saldo lebih ikut dikembalikan, refund saldo dicatat terpisah dari refund tagihan.

### E. Kesiapan dan perencanaan armada

1. Selama registrasi berlangsung, dashboard menampilkan jumlah peserta menurut perjalanan, tanggal, Korwil/Korda tujuan, titik turun, dan Korda pencatat.
2. Perencanaan armada dimulai ketika petugas operasional/Pusat menilai data pendaftar sudah cukup valid dan tujuan perjalanan sudah stabil. Ini keputusan operasional, bukan metrik, status, atau gerbang di sistem.
3. Pada tahap alokasi armada, diperkirakan tidak ada lagi perubahan tujuan perjalanan atau pembatalan. Penambahan peserta masih mungkin; peserta baru dapat dimasukkan ke armada setelah terdaftar.
4. Petugas membuat armada dan mengisi informasi yang diperlukan, seperti label, kapasitas kursi, jadwal, cakupan Korda, dan detail kendaraan bila dipakai. Kapasitas kursi adalah batas mutlak; sistem menolak alokasi yang melampaui kapasitas.
5. Sistem menampilkan peserta yang memenuhi syarat dan belum ditempatkan per perjalanan. Pembayaran tidak otomatis mengecualikan peserta dari daftar armada.
6. Pusat dan Korwil dapat menempatkan peserta sesuai cakupan armada yang menjadi kewenangannya. Akun Korda dapat menempatkan peserta pada armada Korda tujuan yang menjadi kewenangannya; hak ini mengikuti Korda tujuan/pemilik armada, bukan Korda asal peserta. Sistem menolak alokasi jika kapasitas terlampaui dan memberi peringatan jika tanggal, perjalanan, Korda tujuan, atau titik turun tidak sesuai.
7. Status armada dapat diubah kapan saja tanpa menunggu atau memicu penutupan registrasi. Perubahan status tidak mengunci pendaftaran maupun pembaruan rencana armada; nama dan detail status ditetapkan saat perancangan UI.
8. Pendaftaran baru tetap diperbolehkan. Peserta baru muncul sebagai belum dialokasikan dan dapat dialokasikan ke armada tujuan yang sesuai.
9. Jika terjadi perubahan tujuan atau pembatalan yang tidak diperkirakan pada tahap ini, sistem menandai penempatan terkait untuk ditinjau. Petugas mengonfirmasi atau menghapus/memindahkan alokasi sesuai perubahan.
10. Sinkronisasi GPS dilakukan terpisah dari pembuatan rencana armada, sehingga integrasi Tracker tidak menghalangi perencanaan.
11. Daftar cetak menampilkan waktu pembaruan dan versi/identitas rencana agar petugas tahu apakah daftar yang digunakan masih terbaru.

### F. Hari pelaksanaan dan pasca-event

1. Petugas membuka dan mencetak daftar peserta terbaru per armada dan perjalanan untuk digunakan saat pelaksanaan.
2. Kebutuhan saat ini adalah daftar cetak; pencatatan absensi atau pemindaian naik bus di aplikasi tidak termasuk versi pertama.
3. Jika tracker tersedia, posisi bus ditampilkan melalui integrasi GPS.
4. Sesudah event, Pusat meninjau realisasi penumpang, pembayaran/refund, perubahan alokasi, dan data yang perlu diperbaiki.
5. Hasil event menjadi referensi estimasi dan rencana event berikutnya.

## 6. Rancangan area UI/UX

1. **Ringkasan Event:** jumlah pendaftar per perjalanan, pembayaran menurut status, peserta belum dialokasikan, armada, dan perubahan terbaru. Tidak ada metrik atau ambang 90% yang diwajibkan sistem.
2. **Data Santri/Peserta Eksternal:** daftar biasa, antrian Perlu verifikasi region, serta pengelolaan profil peserta eksternal yang bukan santri. Data wajib yang belum lengkap menampilkan peringatan dan tidak dapat didaftarkan.
3. **Form Registrasi:** pencarian peserta, jalur santri atau peserta eksternal, validasi kelengkapan dengan pesan yang jelas, pilihan **Pulang-pergi / Perjalanan Pulang / Perjalanan Kembali**, tujuan/tanggal, titik turun untuk pulang, titik penjemputan untuk kembali, tarif per arah, pembayaran, dan ringkasan sebelum simpan. Pada pulang-pergi, titik penjemputan terisi otomatis sama dengan titik turun dan dapat diganti.
4. **Daftar Peserta:** pencarian/filter, detail perjalanan per orang, penanda lintas Korda, status pembayaran, bukti transfer, status armada, serta riwayat perubahan.
5. **Pembayaran:** riwayat uang masuk per peserta/perjalanan dan transaksi keluarga; pencatatan penerimaan ke rekening pusat, alokasi per anak/perjalanan, satu bukti transfer keluarga, serta status/sisa tagihan. Petugas hanya melihat rincian dalam cakupannya.
6. **Refund:** halaman tersendiri untuk mencatat uang yang benar-benar dikembalikan dari kas pusat, dengan sumber, batas nominal, bukti opsional, aktor, alasan, tanggal, dan riwayat. Semua role memproses refund dalam cakupan yang telah disepakati.
6. **Perencana Armada:** Pusat/Korwil membuat armada; alokasi mengikuti kewenangan atas armada. Akun Korda tujuan dapat mengalokasikan peserta lintas Korda ke armada tujuan tersebut tanpa dibatasi Korda asal peserta, melihat kapasitas, memakai filter wilayah/tanggal/perjalanan, menangani peringatan perubahan, dan mencetak manifest.
7. **Operasional:** daftar cetak terbaru untuk pelaksanaan dan peta bus jika GPS disiapkan. Absensi digital tidak termasuk versi pertama.

## 7. Perubahan data yang diperlukan

Butir berikut adalah arah schema dan aturan validasi untuk implementasi. Nama fisik model/field dapat mengikuti konvensi repo, tetapi kardinalitas, snapshot, dan batas akses harus dipertahankan.

- Pisahkan status event, status registrasi, dan status perencanaan armada.
- Tambahkan status verifikasi region dan simpan nilai alamat sumber API untuk audit/perbaikan.
- Tambahkan tipe/profil peserta eksternal yang terpisah dari master santri agar orang non-santri dapat ikut tanpa dipalsukan sebagai data santri. Semua role yang berwenang pada Korda tujuan dapat mengisi profil saat registrasi. Wajibkan nama, jenis kelamin, alamat, dan Korda tujuan; tolak penyimpanan bila ada yang kurang dengan pesan field yang spesifik. Setelah lengkap, profil langsung berstatus Lengkap dan dapat diregistrasikan tanpa peninjauan admin.
- Simpan snapshot tarif pada registrasi/perjalanan agar perubahan harga master tidak mengubah tagihan yang sudah tercatat.
- Kembangkan master `DropPoint` menjadi master lokasi perjalanan per Korda yang dapat dipakai sebagai titik turun untuk pulang, titik penjemputan untuk kembali, atau keduanya. Tarif terkait dengan arah dan lokasi; jangan menganggap tarif kedua arah selalu sama. Simpan snapshot lokasi dan tarif pada setiap perjalanan.
- Ganti boolean pembayaran dengan entitas pembayaran dan alokasi pembayaran yang mendukung bukti, metode, nominal, tiga status (Belum bayar/Partial/Sudah bayar), refund, dan riwayat.
- Simpan refund sebagai entitas/entri ledger append-only yang menunjuk ke alokasi pembayaran asal atau saldo lain. Setiap entri memiliki nominal, waktu efektif/pencatatan, alasan, pelaksana (`userId` dan snapshot role/Korda), metode pengembalian, referensi transaksi sumber, serta metadata bukti refund opsional. Jangan mengedit atau menghapus pembayaran/refund yang sudah tercatat; sediakan transaksi pembalik/koreksi dengan referensi ke entri awal.
- Tambahkan relasi pembayaran keluarga ke beberapa peserta/perjalanan beserta alokasi nominal yang eksplisit. Buat rincian cakupan bukti secara otomatis dari alokasi agar jelas anak dan perjalanan mana yang dibayar; jangan meminta catatan cakupan manual.
- Catat pendapatan/tagihan perjalanan pada Korda tujuan. Tambahkan buku transaksi **Saldo Lain per Korda tujuan perjalanan** untuk mencatat kelebihan nominal semua peserta. Simpan peserta, pengirim dengan penanda “Tidak dicatat”, Korda asal santri jika ada, Korda tujuan pemilik saldo, sumber pembayaran, nominal, dan waktu agar asal kelebihan dapat ditelusuri.
- Simpan snapshot Korda asal santri serta `createdByUserId`/Korda pencatat secara terpisah dari Korda tujuan per perjalanan. Korda asal menjadi informasi penelusuran; pencatat mengidentifikasi pelaku; Korda tujuan menentukan pemilik tarif dan Saldo Lain.
- Terapkan cakupan registrasi berdasarkan Korda tujuan dan peran pencatat. Korda tujuan boleh mencari peserta lintas Korda dengan data identifikasi minimal; akses ini tidak membuka profil penuh atau hak mengubah data santri asal. Untuk non-santri, sediakan input peserta eksternal langsung pada form registrasi. Periksa izin pada Server Action.
- Terapkan izin pembuatan armada terpisah dari izin alokasi peserta: pembuatan armada untuk Pusat/Korwil; Korda tujuan dapat mengalokasikan peserta mana pun ke armada Korda tujuan tersebut, tanpa memandang Korda asal peserta, sementara Korwil/Pusat mengikuti cakupan armada yang dikelolanya.
- Tambahkan jejak audit untuk perubahan registrasi, pembayaran, region, dan armada.
- Pisahkan `Registration` sebagai induk peserta-event dari entitas perjalanan pulang/kembali. Satu pengajuan gabungan pulang-pergi hanya valid bila tujuan kedua perjalanannya sama; tujuan berbeda harus dikirim sebagai dua pengajuan satu-perjalanan. Relasi perjalanan menyimpan Korda tujuan dan hak kelolanya sendiri, titik turun atau titik penjemputan sesuai arah, tanggal, snapshot tarif, status/alokasi pembayaran, dan armada. Hubungkan alokasi armada ke perjalanan agar hak Korda tujuan dapat ditegakkan dan perubahan tercatat. Cegah duplikasi perjalanan sejenis pada peserta/event yang sama.
- Pisahkan pembuatan bus lokal dari sinkronisasi Tracker dan status GPS.

## 8. Tahapan implementasi — seluruh fase selesai

Tahapan berikut adalah urutan yang dipakai untuk melaksanakan rencana. Fase 1 sampai 7 telah ditutup selesai untuk cakupan development yang disepakati. Rincian hasil dan verifikasi per fase berada di tracker implementasi.

### Tahap 0 — Rancangan layar dan spesifikasi teknis

Turunkan keputusan bisnis di dokumen ini menjadi wireframe dan spesifikasi teknis, termasuk skema induk peserta/event dan rincian perjalanan, matriks akses per perjalanan/armada, serta form registrasi, verifikasi region, pembayaran keluarga, dan perencana armada. Waktu mulai alokasi armada mengikuti penilaian operasional bahwa data cukup valid dan tujuan perjalanan sudah stabil; tidak ada ambang atau metrik 90% di sistem.

### Tahap 1 — Kualitas data santri dan region

Buat status region, antrian data bermasalah, perbaikan mapping, dan akses operasional yang aman. Registrasi dengan data wajib yang belum lengkap harus ditolak dengan pesan kekurangan yang jelas sampai admin memperbarui data.

### Tahap 2 — Registrasi tiga mode perjalanan

Lengkapi tiga mode perjalanan, pisahkan pilihan Korda per perjalanan, tampilkan ringkasan tujuan, dan simpan identitas petugas input. Santri yang belum tercatat dibedakan dari peserta eksternal non-santri. Profil eksternal baru hanya tersimpan jika semua field wajib lengkap; setelah lengkap, profil langsung final untuk role berwenang. Data santri yang belum lengkap ditolak dengan peringatan yang menyebut data yang harus diperbaiki.

### Tahap 3 — Pembayaran dan bukti

Tambahkan penyimpanan bukti yang aman, transaksi/alokasi pembayaran keluarga, Saldo Lain milik Korda tujuan, refund yang dapat dilakukan semua role dalam cakupan masing-masing, riwayat pembayaran/refund, koreksi melalui transaksi pembalik, dan audit pembayaran.

### Tahap 4 — Pemisahan Pembayaran, Refund, Laporan, dan Keuangan

Fase ini merapikan empat fungsi yang memakai data ledger yang sama, tetapi mempunyai tujuan dan hak aksi berbeda:

1. **Pembayaran (`/pembayaran`) — catat uang masuk.** Semua peserta/wali mentransfer ke satu rekening bendahara/pusat. Petugas mencatat uang yang telah diterima, bukti transfer, dan alokasinya ke tagihan satu atau beberapa peserta/perjalanan. Saldo dan status pembayaran mengikuti alokasi. Pembayaran yang direkam menjadi penerimaan kas pusat; sistem tidak terhubung langsung ke bank.
2. **Refund (`/refund`) — catat uang keluar untuk pengembalian.** Refund dicatat saat pengembalian dana benar-benar dilakukan dari rekening pusat. Semua role yang berwenang dapat mencatatnya dalam cakupan masing-masing sesuai keputusan refund; sistem menyimpan sumber, peserta, nominal, alasan, metode, tanggal, bukti opsional, pelaksana, dan riwayat append-only.
3. **Laporan (`/laporan`) — baca dan analisis.** Halaman read-only merangkum tagihan, penerimaan aktual, refund, koreksi alokasi, Saldo Lain, sisa kewajiban peserta, serta rincian per event/periode/Korda tujuan/arah. Laporan membantu membandingkan aktivitas dan alokasi; tidak menambah atau mengubah transaksi.
4. **Keuangan (`/keuangan`) — kontrol kas pusat dan pencairan.** Tampilkan saldo kas pusat yang tercatat, dana bersih yang menjadi bagian tiap Korda, nominal yang sudah dicairkan, serta sisa dana Korda yang masih berada di pusat. Pusat/admin mencatat pencairan setelah uang benar-benar diserahkan kepada Korda. Ini bukan permintaan penarikan Korda, tidak memberi instruksi transfer, dan tidak meminta metode penyerahan.

**Aturan alur kas:** saldo kas pusat = total pembayaran yang tercatat masuk − refund yang benar-benar dibayarkan − pencairan aktual yang sudah dicatat. Koreksi alokasi mengubah atribusi dana ke peserta/Korda, bukan pergerakan uang, sehingga tidak mengurangi kas pusat. Selisih antara saldo pusat dan total sisa dana yang diatribusikan ke Korda harus ditampilkan sebagai kas belum teralokasi/selisih rekonsiliasi, bukan disembunyikan.

**Aturan posisi Korda:** dana tercatat untuk Korda berasal dari alokasi pembayaran perjalanan dan kredit Saldo Lain tujuan Korda, setelah refund serta koreksi yang terkait. Sisa dana Korda di pusat = dana bersih yang diatribusikan ke Korda − pencairan aktual ke Korda. Pencairan ditolak jika nominal melampaui kas pusat atau sisa dana Korda tersebut.

**Akses:** Pusat/admin dapat melihat saldo pusat global dan semua Korda serta mencatat pencairan. Korwil melihat laporan dan posisi Korda dalam cakupannya. Korda hanya melihat laporan/posisi Korda tujuan dalam cakupannya; Korda tidak melihat saldo pusat global dan tidak membuat permintaan pencairan. Aksi pembayaran mengikuti kewenangan pencatatan yang sudah berlaku; aksi refund mengikuti cakupan yang telah disepakati.

### Tahap 5 — Perencanaan armada fleksibel

Tambahkan alokasi dan validasi kapasitas mutlak di server, peserta belum teralokasi, penandaan perubahan, serta cetak manifest terbaru. Batasi pengelolaan armada ke Pusat/Korwil dan lepaskan ketergantungan pembuatan armada dari Tracker.

### Tahap 6 — Operasional dan evaluasi

Sediakan manifest/daftar cetak terbaru per armada dan perjalanan, ringkasan realisasi, dan perbaikan dashboard yang saat ini memakai angka contoh. Dashboard operasional memisahkan jumlah pendaftar, kelengkapan, pembayaran, dan alokasi armada; laporan keuangan rinci berada di Tahap 4. Pencatatan naik bus/absensi digital berada di luar kebutuhan versi pertama.

### Tahap 7 — Rekonsiliasi dan QA development (selesai)

Rekonsiliasi agregat ledger dev, migrasi, akses dan bukti, serta QA browser untuk lingkup development. Fase ini selesai; catatan hasilnya ada di dokumen QA Fase 7. PDF manifest dikecualikan sesuai arahan pengguna. Pemeriksaan backup produksi, pembandingan uang nyata, status bucket/retensi produksi, dan kesiapan rilis produksi secara eksplisit berada di luar cakupan perencanaan ini dan bukan gap fase.

## 9. Kriteria penerimaan tingkat produk

- Petugas dapat mendaftarkan pulang-pergi dalam satu pengajuan jika tujuan Korda kedua perjalanan sama; titik penjemputan otomatis sama dengan titik turun, tetapi dapat diganti. Jika tujuan pulang dan kembali berbeda, keduanya diajukan terpisah. Pengajuan kembali satu arah menggunakan label **Perjalanan Kembali**, tanpa istilah pulang-pergi. Perjalanan kembali dapat ditambahkan kemudian untuk peserta/event yang sama tanpa membuat duplikasi peserta/event atau perjalanan.
- Santri yang region-nya belum lengkap tetap dapat ditemukan, tetapi pendaftaran ditolak sampai admin melengkapi informasi wajib dan sistem menampilkan kekurangan secara jelas.
- Registrasi ditolak dengan peringatan spesifik jika data wajib santri/peserta eksternal belum lengkap; admin dapat memperbarui data, setelah itu petugas tujuan dapat melanjutkan.
- Korda dapat memasukkan orang non-santri saat registrasi melalui profil eksternal yang terpisah dari master santri/API. Profil tersebut muncul di armada dan manifest; jika data wajib kurang, sistem menolak finalisasi dengan rincian kekurangan untuk dilengkapi admin.
- Status pembayaran per perjalanan hanya Belum bayar, Partial, atau Sudah bayar; nominal terbayar dan sisa kewajiban konsisten dengan status.
- Semua role dapat memproses refund dalam cakupan datanya. Setiap refund memiliki riwayat yang mengikat transaksi sumber, nominal, alasan, tanggal, pelaksana dan Korda cakupan; transaksi awal tidak dihapus atau ditimpa. Refund pembayaran keluarga hanya mengurangi alokasi anak/perjalanan yang dipilih.
- Satu bukti transfer dapat dikaitkan ke pembayaran keluarga untuk beberapa anak/perjalanan. Sistem otomatis menampilkan rincian anak, perjalanan, dan nominal alokasi yang tercakup dalam bukti; rincian tidak diisi manual. Bukti dapat ditelusuri tanpa workflow pemeriksaan wajib. Selisih bayar masuk ke Saldo Lain Korda tujuan dan riwayat mencantumkan peserta, Korda asal (jika santri), tujuan, serta penanda pengirim “Tidak dicatat”.
- Registrasi menyimpan Korda pencatat, domisili santri, dan tujuan perjalanan tanpa mencampur ketiganya.
- Kasus lintas Korda menampilkan Korda asli dan tujuan dengan jelas; tidak ada approval digital.
- Registrasi dilakukan oleh Korda tujuan. Korda dapat mencari peserta dari Korda asli lain dengan informasi identifikasi minimal dan mendaftarkannya menuju Kordanya sendiri; ini tidak membuka akses untuk mengubah profil santri asal.
- Satu transaksi wali santri dapat dialokasikan ke beberapa anak dan perjalanan. Petugas membagi kelebihan per anak/perjalanan bila satu pembayaran mencakup beberapa Korda tujuan; sistem mengkreditkan tiap kelebihan ke Korda tujuan terkait.
- Pusat/Korwil dapat membuat armada; akun Korda tujuan dapat mengalokasikan peserta lintas Korda ke armada Korda tujuan tanpa dibatasi Korda asli peserta. Korwil dan Pusat mengalokasikan sesuai cakupan armada masing-masing.
- Armada dapat direncanakan sebelum registrasi berakhir; proses registrasi tidak terkunci oleh perencanaan armada.
- Peserta baru, batal, atau berubah tujuan setelah perencanaan terlihat sebagai perubahan yang perlu ditangani.
- Sistem membedakan jumlah pendaftar, kelengkapan data, status pembayaran, dan status alokasi armada.
- Peran Pusat/Korwil/Korda hanya dapat melihat dan mengubah data dalam cakupan yang disepakati.
- Manifest menunjukkan perjalanan, tujuan, titik turun untuk pulang atau titik penjemputan untuk kembali, armada, kapasitas, dan waktu pembaruan.
- Menu Pembayaran mencatat penerimaan peserta ke rekening pusat serta alokasi/bukti; menu Refund mencatat pengembalian aktual dari rekening pusat; menu Laporan bersifat baca-saja; menu Keuangan mengontrol saldo kas pusat dan pencairan aktual ke Korda.
- Laporan penerimaan pendaftaran membedakan jumlah tagihan dari uang yang benar-benar diterima, refund, koreksi, dan penerimaan bersih; filter minimal mencakup event, periode, Korda tujuan, dan arah perjalanan.
- Semua transfer peserta masuk ke rekening pusat/bendahara; aplikasi mencatat penerimaan tersebut.
- Aplikasi menampilkan kas pusat dan sisa dana tiap Korda di pusat; Pusat/admin mencatat pencairan aktual ke Korda dengan riwayat audit. Tidak ada permintaan penarikan Korda atau instruksi transfer.

## 10. Ringkasan keputusan bisnis yang disepakati

1. **Keputusan: disepakati.** Tidak ada metrik atau tampilan 90% di sistem. Pusat/operasional memulai alokasi saat menilai data cukup valid dan tujuan perjalanan stabil. Pada tahap itu perubahan tujuan/pembatalan tidak diperkirakan, meski pendaftar baru masih dapat bertambah dan dialokasikan kemudian.
2. Satu bukti transfer dapat digunakan untuk satu transaksi keluarga yang mencakup beberapa anak/perjalanan; sistem membuat rincian cakupannya otomatis berdasarkan alokasi pembayaran. **Keputusan: disepakati.**
3. **Keputusan: disepakati.** Saldo Lain tidak dapat dipakai untuk kewajiban lain; refund dapat dilakukan jika perjalanan dibatalkan.
4. **Keputusan: disepakati.** Hak alokasi akun Korda mengikuti Korda tujuan/pemilik armada, bukan Korda asal peserta. Status armada dapat diubah tanpa penutupan registrasi; registrasi dan pembaruan armada tetap berjalan.
5. **Keputusan: disepakati.** Kapasitas kursi bus adalah batas mutlak dan tidak dapat dilewati.
6. **Keputusan: disepakati.** Tarif perjalanan dibekukan pada saat registrasi; perubahan tarif master tidak mengubah tagihan yang sudah tercatat.
7. **Keputusan: disepakati.** Kebutuhan operasional versi pertama adalah daftar peserta yang dapat dicetak; absensi/scan digital tidak diperlukan.
8. **Keputusan: disepakati.** Role `admin` yang digunakan Pusat menjalankan operasional Pusat sekaligus pengelolaan akun/konfigurasi; tidak perlu role operasional Pusat yang terpisah.
9. **Aturan operasional:** informasi wajib, termasuk Korda asal santri, harus dilengkapi sebelum registrasi difinalisasi. Tarif perjalanan dan Saldo Lain kelebihan pembayaran dicatat pada Korda tujuan. Korda asal santri tetap disimpan untuk ditampilkan sebagai informasi penelusuran.
10. **Keputusan: disepakati.** Semua role boleh memproses refund dalam cakupan kewenangannya dan sistem harus menyimpan riwayat refund yang dapat ditelusuri.
11. **Keputusan: disepakati.** Penambahan peserta eksternal oleh semua role yang berwenang langsung berstatus Lengkap/final; nama, jenis kelamin, alamat, dan Korda tujuan wajib diisi. Jika ada yang kurang, penyimpanan ditolak dengan peringatan spesifik. Profil lengkap tidak memerlukan penyelesaian atau persetujuan admin.
12. **Keputusan: disepakati.** Semua kelebihan pembayaran masuk ke Saldo Lain Korda tujuan perjalanan, baik untuk santri maupun peserta eksternal. Riwayat saldo wajib menampilkan peserta, penanda pengirim tidak dicatat, Korda asal santri bila tersedia (peserta eksternal ditandai tanpa Korda asal), dan Korda tujuan pemilik saldo. Bila pembayaran mencakup beberapa peserta/perjalanan dan ada kelebihan, petugas memilih peserta/perjalanan pemilik saldo agar Korda tujuan penerima jelas. Nama pengirim tidak diminta saat input.
13. **Keputusan: diperjelas 17 Okt 2026.** Semua pembayaran peserta masuk ke satu rekening bendahara/pusat, lalu dana dicairkan ke Korda. Sistem harus mengontrol saldo kas pusat dan memperlihatkan dana per Korda yang masih berada di pusat dibandingkan dengan dana yang telah dicairkan. Pusat/admin mencatat pencairan yang sudah dilakukan; Korda tidak mengajukan penarikan melalui sistem dan tidak ada instruksi/metode transfer.

## 11. Rincian teknis lanjutan

Rincian berikut menerjemahkan keputusan bisnis menjadi spesifikasi awal. Nama tabel/field adalah konsep dan boleh disesuaikan dengan pola Prisma/repo, selama relasi, aturan akses, dan riwayat tidak berubah.

### 11.1 Rancangan entitas dan relasi data

- **Event:** pertahankan entitas yang ada; tambahkan atau rapikan field pembukaan/penutupan registrasi secara terpisah dari status event. Status event tidak mengunci alokasi armada.
- **ExternalParticipant:** profil non-santri dengan nama, jenis kelamin, alamat, Korda tujuan, status kelengkapan, dan pencatat. Tidak memiliki Korda asal atau kontak wali. Jangan menulisnya ke `Student` atau mengarang NIS.
- **Registration:** jadikan induk unik per event dan peserta. Dapat menunjuk tepat satu dari `studentId` atau `externalParticipantId`; simpan snapshot `originKordaId` untuk santri saja, serta `createdByUserId` dan snapshot identitas pencatat untuk semua peserta. Aturan satu-sumber-peserta ditegakkan melalui validasi server dan constraint database.
- **Journey:** rincian satu arah, unik per Registration dan arah `OUTBOUND`/`RETURN`. Simpan Korda tujuan, titik/lokasi arah, tanggal, tarif snapshot, status perjalanan (aktif/batal), pembuat/perubahan terakhir dan alasan perubahan. Pulang-pergi membuat dua Journey di dalam satu transaksi database dan memvalidasi Korda tujuan sama.
- **JourneyBusAssignment:** hubungan Journey ke Bus dengan pembuat, waktu penempatan, dan waktu penghapusan/riwayat. Ini menggantikan kolom bus per arah di Registration dan menjadi dasar manifest serta pemeriksaan akses.
- **Bus / BusKorda:** pertahankan pola bus dan cakupan Korda yang ada. Tegakkan bahwa kapasitas adalah bilangan positif; hanya Pusat/Korwil membuat dan mengelola bus, sedangkan semua role boleh mengalokasikan sesuai cakupan armada.
- **DropPoint/Location:** pertahankan master lokasi per Korda, tambahkan kemampuan dipakai untuk arah pulang, kembali, atau keduanya, serta tarif per arah. Journey menyimpan snapshot nama lokasi dan tarif agar perubahan master tidak mengubah histori.
- **Payment:** satu penerimaan uang masuk, termasuk pembayaran keluarga yang dapat mencakup banyak peserta/perjalanan; menyimpan event, nominal, metode default Transfer, waktu transaksi, pembuat, bukti, dan referensi eksternal bila ada. Nama pengirim tidak diminta; `payerName` berisi penanda “Tidak dicatat” untuk kompatibilitas dan kejelasan riwayat.
- **PaymentAllocation:** setiap baris mengalokasikan satu Payment ke satu Journey atau ke pemilik Saldo Lain dengan identitas peserta. Satu Payment boleh memiliki banyak alokasi; satu Journey boleh menerima alokasi dari banyak Payment. Validasi menjaga total alokasi tidak melebihi penerimaan bersih.
- **KordaBalanceEntry (Saldo Lain):** ledger append-only per Korda tujuan perjalanan; memiliki entri kredit yang bersumber dari PaymentAllocation ke Saldo Lain atau debit refund. Catat relasi/snapshot peserta, penanda pengirim “Tidak dicatat”, Korda asal santri bila ada, dan Korda tujuan pemilik saldo. Untuk peserta eksternal, Korda asal bernilai null dan UI menandainya jelas. Saldo dihitung dari total entri, bukan kolom nominal yang dapat diedit.
- **Refund:** transaksi uang keluar yang merujuk ke PaymentAllocation atau KordaBalanceEntry sumber. Mendukung refund parsial atau seluruh sisa dana sumber; jumlah kumulatif tidak boleh melebihi nilai sumber setelah koreksi sebelumnya.
- **FinancialCorrection:** pembalik append-only untuk membatalkan nominal alokasi perjalanan atau kredit Saldo Lain yang salah dicatat. Menyimpan tepat satu sumber, nominal, tanggal, alasan, pelaksana, scope Korda/event, dan audit. Koreksi bukan refund; jika uang benar-benar dikembalikan, catat Refund. Pembalik saldo membuat debit koreksi di ledger.
- **EvidenceFile:** metadata bukti pembayaran/refund dan object key privat. Satu bukti pembayaran dapat terkait Payment keluarga; bukti refund terkait Refund.
- **FinancialAuditEntry:** jejak append-only untuk pembayaran, alokasi, refund, pembalik, dan perubahan data keuangan; simpan pelaku, waktu, role/Korda cakupan saat aksi, jenis aksi, entitas/referensi, alasan, serta nominal sebelum/sesudah yang relevan.
- **TreasuryDisbursement:** catatan append-only pencairan aktual dari rekening pusat ke Korda. Simpan Korda penerima, nominal, tanggal, pencatat, dan catatan opsional; tidak menyimpan metode transfer. Batasi secara atomik pada kas pusat dan dana bersih yang tercatat untuk Korda.
- **Laporan:** halaman baca-saja dari Payment/PaymentAllocation, Refund, FinancialCorrection, dan KordaBalanceEntry. Tampilkan tagihan, penerimaan, refund/koreksi, status/sisa kewajiban, dan Saldo Lain dengan filter analitis.
- **Keuangan:** hitung dari Payment.amount, Refund, dan TreasuryDisbursement untuk kas pusat; gunakan PaymentAllocation, refund/koreksi terkait, KordaBalanceEntry, dan TreasuryDisbursement untuk posisi setiap Korda. Pisahkan total penerimaan, uang yang sudah keluar, dana Korda yang belum dicairkan, dan kas yang belum teralokasi.
- **ExternalParticipantCompletion:** jika tetap diperlukan untuk menampilkan data Draf historis, antrean menampilkan field yang kurang, status, pembuat, serta pelaksana dan waktu pembaruan. Pembuatan profil baru yang tidak lengkap ditolak; profil baru yang lengkap langsung dapat digunakan. Item Draf historis belum menjadi Registration dan belum memiliki tagihan/perjalanan.

Usulan field inti (nama dapat menyesuaikan konvensi Prisma):

| Model | Field inti yang disarankan |
|---|---|
| `ExternalParticipant` | `id`, `fullName`, `gender`, `addressText`, `intendedKordaId`, `completionStatus`, `createdByUserId`, `updatedByUserId`, `createdAt`, `updatedAt` |
| `Registration` | `id`, `eventId`, `studentId?`, `externalParticipantId?`, `originKordaIdSnapshot?` (santri saja), `registrarKordaId?`, `createdByUserId`, `createdAt`, `updatedAt` |
| `Journey` | `id`, `registrationId`, `direction`, `destinationKordaId`, `locationId?`, `locationNameSnapshot`, `date`, `fareSnapshot`, `status`, `cancelledAt?`, `cancelReason?`, `createdByUserId`, `updatedAt` |
| `Payment` | `id`, `eventId`, `payerName`, `payerPhone?`, `amount`, `method`, `paidAt`, `createdByUserId`, `evidenceFileId?`, `externalReference?` |
| `PaymentAllocation` | `id`, `paymentId`, `journeyId?`, `balanceOwnerKordaId?` (Korda tujuan), `participantStudentId?`, `externalParticipantId?`, `amount`, `createdByUserId`, `createdAt`; baris perjalanan mengisi `journeyId`, baris Saldo Lain mengisi Korda tujuan pemilik saldo dan satu identitas peserta |
| `KordaBalanceEntry` | `id`, `ownerKordaId` (Korda tujuan), `originKordaIdSnapshot?`, `destinationKordaIdSnapshot`, `participantStudentId?`, `externalParticipantId?`, `payerNameSnapshot?`, `sourcePaymentAllocationId?`, `sourceRefundId?`, `sourceBalanceEntryId?`, `entryType` (credit/refund/correction), `amount`, `createdByUserId`, `createdAt` |
| `Refund` | `id`, `paymentAllocationId?`, `kordaBalanceEntryId?`, `amount`, `reasonCode`, `reasonText?`, `method`, `refundedAt`, `createdByUserId`, `evidenceFileId?`, `reversesRefundId?` |
| `EvidenceFile` | `id`, `objectKey`, `originalName`, `detectedMimeType`, `sizeBytes`, `checksum`, `uploadedByUserId`, `uploadedAt`, `purgedAt?`, `purgeStatus` |
| `FinancialAuditEntry` | `id`, `eventId`, `scopeKordaId?`, `actorUserId`, `actorRoleSnapshot`, `action`, `entityType`, `entityId`, `beforeData?`, `afterData?`, `amountBefore?`, `amountAfter?`, `reason?`, `createdAt` |

Gunakan integer rupiah (bukan floating point) untuk uang. Untuk foreign key polymorphic yang ditandai `?`, tambahkan constraint database agar sumber atau identitas peserta yang diwajibkan terisi tepat satu. Nilai role/owner Korda pada audit adalah snapshot historis; izin tetap diperiksa dari relasi aktif saat aksi dilakukan.

Model `Registration` saat ini memakai `studentId` wajib dan menyimpan kolom pulang/kembali langsung. Migrasi perlu membuat Journey untuk setiap perjalanan lama, memindahkan bus assignment ke Journey, lalu menambahkan relasi peserta eksternal. Boolean pembayaran lama tidak membuktikan nominal uang yang benar-benar diterima; jangan membuat transaksi tunai historis atau bukti palsu dari nilai boolean. Migrasi perlu menandai data lama sebagai `LEGACY_RECONCILIATION` dan mempertahankan nilainya untuk ditinjau/dicocokkan sebelum laporan saldo baru dianggap final.

Status **Belum bayar / Partial / Sudah bayar** dihitung dari kewajiban perjalanan dikurangi alokasi pembayaran bersih setelah refund. Perjalanan yang dibatalkan mempunyai status pembatalan terpisah; sistem tidak menampilkan kewajiban aktif yang masih harus ditagih untuk perjalanan tersebut. Laporan tetap menyimpan nilai tarif snapshot, pembayaran masuk, refund, dan nilai bersih untuk rekonsiliasi.

### 11.2 Aturan refund dan riwayat

1. Aksi **Refund** tersedia untuk seluruh role dengan pengecekan cakupan di server: Pusat untuk semua; Korwil untuk perjalanan/saldo pada wilayahnya; Korda untuk perjalanan tujuan Kordanya serta Saldo Lain yang tercatat pada Korda tersebut.
2. Refund dipakai ketika perjalanan dibatalkan. Form meminta sumber dana, peserta/perjalanan atau saldo, nominal aktual yang dikembalikan (maksimum sisa dana sumber yang belum dikembalikan), alasan pembatalan, tanggal, metode, dan referensi/bukti pengembalian bila tersedia. Sistem mendukung pengembalian sebagian atau seluruh sisa dana sesuai nominal yang benar-benar dikembalikan; sistem tidak menetapkan biaya pembatalan atau persentase refund.
3. Riwayat menampilkan pembayaran asal dan refund sebagai baris terpisah, dengan filter event, peserta, arah perjalanan, Korda tujuan/asli, tanggal, dan pelaksana. Baris detail menampilkan nominal sebelum/sesudah, alasan, metode, tautan bukti yang tetap memiliki akses terkontrol, serta koreksi/pembalik yang merujuk transaksi awal.
4. Riwayat tidak dapat dihapus oleh role operasional. Jika salah input, petugas berwenang membuat pembalik/koreksi dan mencatat alasan; saldo bersih dihitung dari transaksi awal ditambah transaksi koreksi/refund.
5. Pada pembayaran keluarga, setiap Korda melihat alokasi anak/perjalanan dalam cakupannya. Petugas yang berwenang atas satu alokasi dapat melihat bukti transfer bersama karena bukti itu melekat pada satu transaksi keluarga; layar tetap menyembunyikan rincian alokasi anak lain. Refund atas satu alokasi tidak membatalkan atau menyamarkan pembayaran anggota keluarga lainnya.
6. Refund kelebihan Saldo Lain mengurangi saldo milik Korda tujuan secara langsung dan dicatat sebagai refund saldo, bukan perubahan nominal tarif atau pembayaran perjalanan.

### 11.3 Field peserta eksternal dan aturan kelengkapan

Profil peserta eksternal hanya berisi nama, jenis kelamin, dan alamat. Korda tujuan perjalanan tetap dipilih saat pendaftaran dan menjadi cakupan pengelolaan profil. Tidak ada field Korda asal, nomor telepon, nama/hubungan wali, NIS, atau data identitas tambahan pada profil ini.

Nama, jenis kelamin, alamat, dan Korda tujuan wajib diisi oleh role yang berwenang sebelum profil eksternal disimpan. Jika ada yang kosong atau tidak valid, sistem menolak penyimpanan dan menampilkan field yang harus diperbaiki; profil tidak dibuat. Jika lengkap, profil langsung final (status `COMPLETE`) untuk semua role, termasuk Korda/Korwil, dan dapat dipakai pada registrasi tanpa peninjauan admin. Draf yang sudah ada dari data lama dapat dilengkapi oleh role yang berwenang pada Korda tujuan; setelah semua field valid, status menjadi Lengkap. Sistem memberi peringatan kemungkinan duplikat berdasarkan nama + alamat; petugas memastikan apakah profilnya sama atau orang berbeda. Kelebihan pembayaran peserta eksternal dicatat sebagai Saldo Lain Korda tujuan; pada riwayatnya Korda asal ditandai tidak tersedia.

### 11.4 Penyimpanan dan retensi bukti pembayaran/refund

- **Penyimpanan:** gunakan **Supabase Storage dengan bucket privat**. Jangan simpan bukti pada direktori publik aplikasi. Database menyimpan `objectKey`, nama asli yang disanitasi, MIME yang terdeteksi, ukuran byte, checksum, waktu unggah, dan `uploadedByUserId`. Service-role key hanya berada di server.
- **Unggah langsung dari browser:** server memeriksa sesi, hak akses pada perjalanan/alokasi, ukuran, dan format; server menentukan object key acak lalu membuat signed upload URL khusus satu object. Browser mengunggah langsung ke Supabase memakai URL tersebut. Signed upload URL Supabase berlaku sampai 2 jam, sehingga aplikasi membuatnya sesaat sebelum upload. Bucket privat membatasi ukuran dan MIME; setelah upload, server memeriksa object dan metadata sebelum menautkan bukti ke Payment.
- **Akses:** preview/unduh dimulai melalui aplikasi yang memeriksa hak akses transaksi terlebih dahulu, kemudian server membuat signed download URL berumur pendek (rekomendasi 5 menit). Signed URL adalah bearer link dan dapat digunakan pemegangnya sampai kedaluwarsa. Korda yang berwenang atas setidaknya satu alokasi pada pembayaran keluarga dapat membuka bukti transfer bersama; layar aplikasi tetap hanya memperlihatkan alokasi anak/perjalanan dalam cakupannya. Bukti dapat memuat nilai total transfer sehingga file diperlakukan sebagai dokumen keluarga yang dibagikan kepada Korda terkait.
- **Unggah:** terima PDF, JPG/JPEG, PNG, dan WebP; batas awal 10 MB per file. Verifikasi MIME berdasarkan isi file sebelum URL dibuat dan cek metadata setelah upload, gunakan object key acak, enkripsi transport/storage, dan jangan menulis nama, NIS, URL bertanda tangan, atau isi bukti ke log aplikasi. Batas 10 MB dan daftar MIME ditetapkan pada konfigurasi bucket.
- **Keterkaitan:** bukti transfer ditempel pada Payment keluarga; catatan alokasi otomatis menunjukkan perjalanan yang dibayar. Bukti refund ditempel pada Refund secara opsional. Bukti asli tidak diganti ketika refund/koreksi dibuat.
- **Retensi yang direkomendasikan:** simpan bukti pembayaran/refund selama **5 tahun setelah event selesai**, lalu hapus file biner melalui proses terjadwal dan catat `purgedAt`/hasil penghapusan. Pertahankan metadata transaksi dan audit tanpa file bukti agar jejak histori tetap ada. Terapkan legal hold jika ada sengketa/audit, yang menunda penghapusan; periode ini adalah rekomendasi operasional, bukan klaim masa retensi yang diwajibkan hukum.
- **Kegagalan penghapusan:** simpan status purge gagal dan coba ulang; jangan menandai bukti terhapus sebelum object storage mengonfirmasi penghapusan.

### 11.5 Spesifikasi interaksi layar

1. **Daftar dan pencarian peserta:** filter event, nama/NIS/kontak, Korda asli, Korda tujuan, arah, dan status data. Hasil santri lintas asal menampilkan identitas minimum; tombol membuka profil penuh hanya jika role punya cakupan atas profil tersebut. Hasil eksternal menunjukkan badge lengkap/perlu dilengkapi.
2. **Wizard registrasi:** (a) pilih/cari peserta atau tambah eksternal; (b) pilih mode Perjalanan Pulang, Perjalanan Kembali, atau Pulang-pergi; (c) lengkapi tujuan, lokasi, tanggal dan tarif; (d) tinjau ringkasan termasuk Korda asli/tujuan dan label lintas Korda; (e) opsional catat pembayaran; (f) simpan. Pulang-pergi menampilkan satu kontrol Korda tujuan untuk dua arah dan menyalin lokasi pulang ke lokasi kembali sebagai nilai awal. Bila Korda tujuan ingin berbeda, UI meminta membuat pengajuan satu arah terpisah.
3. **Antrean kelengkapan admin:** tampilkan peserta eksternal, data kurang per field, sumber/pembuat, Korda yang mengajukan, dan aksi admin untuk melengkapi. Setelah diperbarui, item kembali ke Korda tujuan dengan penanda siap dilanjutkan; tidak ada tagihan atau perjalanan sebelum finalisasi.
4. **Detail peserta dalam event:** satu halaman induk dengan kartu Pulang dan Kembali terpisah. Tiap kartu menampilkan tujuan/lokasi/tanggal, tarif snapshot, status perjalanan, total masuk/refund/neto/sisa, penempatan bus dan riwayat. Hak aksi diterapkan per kartu perjalanan, bukan hanya pada induk.
5. **Pembayaran keluarga:** pilih satu atau beberapa perjalanan yang dibayar. Isi nominal transfer dengan default total sisa tagihan; petugas dapat menyesuaikannya. Tampilkan alokasi otomatis per baris, jumlah yang diterapkan ke tagihan, sisa tagihan, dan Saldo Lain. Transfer parsial dialokasikan berurutan sesuai daftar; jika ada kelebihan pada beberapa perjalanan, petugas memilih peserta/perjalanan pemilik Saldo Lain. Nama pengirim tidak diminta; sistem menyimpan “Tidak dicatat”. Bukti transfer opsional.
6. **Riwayat transaksi dan refund:** detail pembayaran menampilkan Payment/alokasi/bukti; detail Refund menampilkan refund dan sumber asal; koreksi tampil sebagai transaksi pembalik. Baris sumber tidak dihapus atau ditimpa. Form refund berada di `/refund`, menampilkan sumber, penerima, maksimum yang dapat dikembalikan, nominal aktual yang dikembalikan, metode, alasan, tanggal, dan bukti opsional. Semua aksi dievaluasi server berdasarkan scope.
7. **Perencana armada:** kelompokkan perjalanan berdasarkan tanggal, arah, Korda tujuan, dan titik; tunjukkan belum dialokasikan, kapasitas terpakai/total, serta peserta lintas Korda. Aksi tambah/hapus alokasi berlaku pada Journey. Perubahan tujuan/pembatalan setelah penempatan muncul sebagai perlu ditinjau. Buat/edit armada hanya tampil untuk Pusat/Korwil; semua role dapat mengalokasikan sesuai cakupan armada.
8. **Pembayaran:** fokus pada peserta, sisa tagihan per perjalanan, pencatatan penerimaan ke rekening pusat, bukti, dan alokasi pembayaran keluarga.
9. **Refund:** fokus pada pemilihan sumber yang dapat direfund, batas nominal, pencatatan pengembalian aktual dari pusat, alasan/bukti, dan histori.
10. **Laporan:** halaman read-only dengan filter event, periode, Korda tujuan, dan arah; pisahkan tagihan, uang masuk, refund, koreksi, Saldo Lain, status pembayaran, serta penerimaan bersih.
11. **Keuangan:** fokus pada saldo rekening pusat, dana bersih per Korda yang masih tertahan di pusat, jumlah pencairan, selisih belum teralokasi, pencatatan pencairan aktual oleh Pusat/admin, dan riwayat audit. Tidak menyediakan permintaan penarikan atau instruksi/metode transfer.
12. **Manifest:** cetak satu daftar per armada dan perjalanan dengan waktu cetak, tujuan, titik turun/penjemputan, kontak operasional yang memang diperlukan, nomor kursi bila dipakai, dan jumlah kursi. Tidak menampilkan bukti pembayaran atau nominal keuangan pada dokumen operasional.

Sketsa susunan layar inti:

```text
REGISTRASI PESERTA
[Cari santri: nama / NIS]                 [Tambah peserta eksternal]
Peserta: Nama — NIS — Asal Korda: A      [Lintas Korda bila tujuan ≠ asal]

Jenis perjalanan: ( ) Pulang-pergi  ( ) Perjalanan Pulang  ( ) Perjalanan Kembali
Tujuan Korda: [Korda B ▼]   Tarif tujuan: Rp ... (snapshot)
Pulang:  Tanggal [...]  Titik turun [Lokasi ▼]
Kembali: Tanggal [...]  Titik jemput [ikut lokasi pulang ▼]
         * Tujuan sama pada mode pulang-pergi

Pembayaran (opsional saat daftar)
[Belum bayar / input nominal] [Metode ▼] [Unggah bukti]
[Ringkasan tujuan, lokasi, biaya dan pembayaran]        [Simpan registrasi]
```

```text
PEMBAYARAN KELUARGA
Pembayar: [Nama wali] [Kontak]       Bukti transfer: [Unggah satu file]
Anak/perjalanan | Korda tujuan | Tagihan | Sudah masuk | Alokasi sekarang | Sisa
Nama A / Pulang | Korda B     | Rp ...  | Rp ...      | [Rp ...]          | Rp ...
Nama A / Kembali| Korda B     | Rp ...  | Rp ...      | [Rp ...]          | Rp ...
Nama B / Pulang | Korda C     | Rp ...  | Rp ...      | [Rp ...]          | Rp ...
Total transfer [Rp ...]   Total alokasi [Rp ...]   Selisih [Rp ...]
Jika lebih dan mencakup beberapa Korda tujuan: pilih alokasi per anak/perjalanan; saldo dikreditkan ke Korda tujuan terkait. Riwayat menampilkan Korda asal santri dan Korda tujuan.
                                                        [Simpan pembayaran]
```

```text
REFUND
Sumber: Pembayaran #... → Nama peserta / Perjalanan Pulang [Korda B]
Maksimum dapat dikembalikan: Rp ...     Sudah pernah direfund: Rp ...
Nominal refund [Rp ...]   Alasan [Pembatalan ▼]   Tanggal [....]
Metode [Transfer ▼]       Referensi [........]     Bukti opsional [Unggah]
Dampak setelah refund: status perjalanan [...], sisa tagihan [...], saldo [...]
[Batal]                                                [Konfirmasi refund]
```

### 11.6 Migrasi dan urutan pembangunan teknis (rencana historis, development selesai)

1. Inventaris dan backup data produksi; hitung registrasi lama, perjalanan terisi, pembayaran boolean, refund lama, dan assignment bus.
2. Tambahkan tabel/kolom baru secara kompatibel terlebih dahulu. Buat Journey dari kolom pulang/kembali lama dan pertahankan ID/referensi legacy untuk penelusuran.
3. Migrasikan assignment bus ke JourneyBusAssignment dan cocokkan Korda tujuan bus. Catat konflik kapasitas atau data tidak konsisten ke laporan rekonsiliasi; jangan menghapus assignment otomatis.
4. Pertahankan boolean pembayaran lama sebagai status legacy. Karena nominal aktual tidak diketahui dari boolean, jangan menganggap harga master kini sebagai uang diterima; admin merekonsiliasi nominal sebelum ledger baru dipakai untuk laporan saldo.
5. Setelah pembacaan aplikasi menggunakan struktur baru dan hasil rekonsiliasi diterima, hentikan penulisan kolom lama; penghapusan kolom lama dilakukan pada migrasi terpisah setelah masa verifikasi.
6. Implementasikan berurutan: profil/kelengkapan peserta eksternal; Registration/Journey dan scope akses; payment/proof/allocation; saldo/refund/audit; bus assignment/capacity; laporan dan manifest.

Supabase Storage dengan signed URL telah dipilih dan digunakan pada implementasi development. Retensi 5 tahun, batas awal file 10 MB, serta daftar MIME adalah nilai rancangan/configuration awal. Penetapan konfigurasi produksi tidak termasuk lingkup penutupan ini.

## 12. Penutupan perencanaan

Pada 18 Oktober 2026 perencanaan dinyatakan final dan ditutup. Keputusan bisnis yang tercatat di Bagian 10 menjadi baseline; rincian teknis pada Bagian 11 menjabarkan implementasinya. Fase 1–7 selesai untuk lingkup development yang disepakati. Tidak ada gap keputusan yang perlu menahan implementasi tersebut. Perubahan kebutuhan baru setelah tanggal ini dicatat sebagai revisi terpisah, beserta dampaknya pada hak akses, data, keuangan, dan QA.
