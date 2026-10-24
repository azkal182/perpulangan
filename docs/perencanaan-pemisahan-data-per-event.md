# Perencanaan Pencatatan Master dan Operasional per Event

**Status:** Draft perencanaan, belum ada perubahan schema atau migration.
**Tanggal:** 24 Oktober 2026
**Tujuan:** Membuat pencatatan event terisolasi dan mudah dibaca tanpa mengubah master Santri menjadi data per event.

## 1. Keputusan produk

- `Student` tetap master global dan tidak memiliki `eventId`.
- Satu santri dapat mengikuti banyak event melalui `Registration` yang berbeda.
- Halaman Master Data, Peserta Eksternal, Titik Turun, dan Riwayat Penghapusan selalu berada dalam konteks event terpilih.
- Data dari event lain dapat digunakan kembali secara eksplisit; sistem tidak menyalin data hanya karena nama terlihat mirip.
- Mode “Semua event” hanya untuk pembacaan, audit, dan laporan. Mode ini harus menampilkan event pada setiap baris atau grouping.
- Event `DRAFT` dan `COMPLETED` dapat dibaca sesuai hak akses, tetapi transaksi baru hanya boleh dilakukan pada event `ACTIVE`.

## 2. Hasil kajian repo saat ini

### Sudah event-bound

`Registration`, `Journey` melalui `Registration`, `Payment`, `Bus`, `OutboundDisposition`, `RegistrationPurge`, dan sebagian `FinancialCorrection` sudah mempunyai jalur event.

### Masih global atau belum aman untuk agregasi event

- `Student` adalah master global dan harus tetap demikian.
- `ExternalParticipant` adalah profil global, tetapi halaman saat ini mengambil antrean tanpa filter event.
- `DropPoint` adalah master global per Korda dan `price` masih global; konfigurasi harga/status belum per event.
- `KordaBalanceEntry` belum memiliki `eventId`; event dapat diturunkan dari sumber pada sebagian besar baris, tetapi tidak ideal untuk query dan integritas.
- `TreasuryDisbursement` belum memiliki `eventId`; pencairan lama tidak selalu dapat dipetakan secara aman.
- `getTreasuryPosition()` dan `getKordaFinanceDetail()` masih mengagregasi beberapa event sekaligus.
- `riwayat-penghapusan` memiliki event pada model audit, tetapi UI dan query harus mengikuti event terpilih atau mode semua-event yang eksplisit.
- Hak akses event saat ini sebagian diturunkan dari status event dan keberadaan registrasi, bukan keanggotaan event yang eksplisit.

## 3. Model target

Gunakan tiga lapisan, bukan menggandakan seluruh master pada setiap event.

```text
Master canonical/global
        ↓ dipakai atau diaktifkan pada event
Konfigurasi event-specific
        ↓ menjadi sumber transaksi
Registrasi, perjalanan, pembayaran, refund, koreksi, dan pencairan
```

### 3.1 Santri

Tetap global. Halaman Santri tidak difilter event. Keterkaitan event ditampilkan melalui registrasi, statistik, atau tautan “lihat pada event”. Import dan perbaikan wilayah tidak diberi `eventId`.

### 3.2 Master wilayah dan Korda

Provinsi, kabupaten, kecamatan, desa, Korwil, dan Korda tetap canonical/global karena menjadi referensi organisasi dan wilayah. Jika suatu event membutuhkan cakupan berbeda, tambahkan konfigurasi event, bukan duplikasi wilayah.

### 3.3 Peserta eksternal

Profil `ExternalParticipant` dapat digunakan ulang lintas event. Halaman event menampilkan peserta yang memiliki `Registration` pada event tersebut.

Alur tambah peserta:

1. Cari peserta global berdasarkan identitas dengan hasil yang jelas.
2. Pilih peserta yang sudah ada dan buat registrasi pada event aktif.
3. Jika tidak ada, buat profil baru lalu buat registrasi event.
4. Jika atribut tertentu berbeda per event, simpan pada relasi/registrasi event, bukan menimpa profil global tanpa konfirmasi.

### 3.4 Titik turun

Pertahankan `DropPoint` sebagai lokasi canonical, lalu tambahkan konfigurasi event, misalnya `EventDropPoint`:

- `eventId`
- `dropPointId`
- `price`
- `active`
- `capacity` atau batas operasional bila diperlukan
- `notes`
- audit pembuat/perubahan

Satu titik turun dapat dipakai banyak event dengan tarif dan status berbeda. `Journey.tariffSnapshot` tetap menjadi sumber historis transaksi lama.

### 3.5 Riwayat penghapusan

Query default memakai event terpilih. Admin dapat memilih “Semua event” untuk audit lintas event. Snapshot event tetap disimpan agar riwayat tidak kehilangan konteks apabila nama event berubah.

### 3.6 Keuangan

Semua pembayaran, alokasi, refund, koreksi, saldo Korda, dan pencairan harus dapat ditelusuri ke event. Untuk saldo yang sumbernya pasti, event dapat diturunkan dari sumber. Untuk query dan validasi jangka panjang, event perlu disimpan secara eksplisit.

Rekomendasi bisnis: satu `TreasuryDisbursement` wajib milik satu event. Jika bisnis membutuhkan satu pencairan untuk beberapa event, jangan menambahkan satu `eventId` yang ambigu; buat tabel alokasi pencairan per event.

## 4. Perubahan schema yang direncanakan

### Tahap additive

Tambahkan secara nullable di development:

- `KordaBalanceEntry.eventId` dan relasi/index ke `Event`.
- `TreasuryDisbursement.eventId` dan relasi/index ke `Event`.
- Model konfigurasi titik turun per event.
- Jika diperlukan setelah audit, model akses user ke event, misalnya relasi `UserEventAccess`.

`Refund` tidak wajib langsung diberi `eventId` jika event selalu dapat divalidasi dari `PaymentAllocation` atau `KordaBalanceEntry`; keputusan final dibuat setelah audit data lokal.

### Backfill

- Isi `KordaBalanceEntry.eventId` dari payment allocation, refund source, atau correction source bila hanya menghasilkan satu event.
- Baris tanpa sumber atau dengan lebih dari satu kemungkinan event diberi laporan unresolved; jangan ditebak.
- `TreasuryDisbursement` lama tidak di-backfill otomatis bila tidak memiliki event pada sumbernya. Data tersebut dipetakan manual atau diberi status legacy-unmapped.
- Jangan mengubah atau menghapus data lama selama backfill.

### Constraint akhir

Setelah seluruh data unresolved diselesaikan di lokal dan staging, ubah kolom yang memang wajib menjadi non-null, tambahkan foreign key, unique constraint, dan index yang diperlukan. Constraint tidak diterapkan sebelum data lama siap.

## 5. Perubahan aplikasi

### Context dan query

- Jadikan event context wajib untuk empat halaman target.
- Pisahkan helper query `selected event` dan `all accessible events`.
- Pastikan mode semua-event tidak dipakai oleh form transaksi.
- Tampilkan event pada hasil agregasi, export, detail Korda, dan audit.
- Perbaiki `getTreasuryPosition()` serta `getKordaFinanceDetail()` agar menerima scope event secara eksplisit.

### Server action

- Semua action tulis menerima `eventId` dari server-validated context.
- Validasi akses event sebelum membaca atau menulis.
- Validasi bahwa titik turun/konfigurasi master berasal dari event yang sama.
- Refund, koreksi, dan pencairan harus menolak sumber dari event lain.
- Hindari mempercayai event dari hidden input tanpa memvalidasi cookie/context dan hak akses.

### UI/UX

- Header selalu menampilkan event aktif.
- Tambahkan tombol “Gunakan dari event lain” dan “Buat baru” pada Master Data.
- Saat memakai data event lain, tampilkan preview sumber, lalu minta konfirmasi.
- Bedakan “master global”, “tersedia pada event ini”, dan “konfigurasi event”.
- Event nonaktif menjadi baca-saja.
- Jika mode semua-event dipilih, tampilkan label yang jelas bahwa input transaksi dinonaktifkan.

## 6. Urutan implementasi

### Fase A — Audit read-only lokal

1. Pastikan container memakai database lokal.
2. Inventaris jumlah event, registrasi, peserta eksternal, titik turun, transaksi, ledger, pencairan, dan riwayat purge.
3. Cari orphan, sumber ledger tanpa event, pencairan ambigu, duplicate master, dan konfigurasi tarif yang tidak konsisten.
4. Simpan laporan audit tanpa mengubah data.

### Fase B — Fondasi event context

1. Perbaiki query halaman Peserta Eksternal dan Riwayat Penghapusan.
2. Tambahkan contract untuk selected-event dan all-events read-only.
3. Tambahkan test akses event dan event nonaktif.

### Fase C — Konfigurasi Master Data

1. Tambahkan konfigurasi titik turun per event.
2. Ubah halaman Titik Turun agar memilih, mengaktifkan, menyalin, atau membuat konfigurasi.
3. Terapkan pola reuse yang sama pada master event-specific lain bila audit membuktikannya diperlukan.

### Fase D — Keuangan per event

1. Tambahkan `eventId` ledger yang dapat dibuktikan.
2. Tentukan dan implementasikan aturan pencairan satu-event atau multi-event.
3. Filter seluruh posisi Keuangan Pusat berdasarkan event terpilih.
4. Sediakan ringkasan semua-event yang tidak mencampur detail antar-event.

### Fase E — Migrasi data lokal dan QA

1. Jalankan migration hanya di lokal.
2. Uji backfill dan daftar unresolved.
3. Uji transaksi lintas event, reuse master, event nonaktif, akses Korda/Korwil/Admin, export, dan purge.
4. Uji rollback pada database salinan lokal.

### Fase F — Persiapan production

1. Backup dan preflight read-only production.
2. Cocokkan hasil preflight dengan laporan lokal.
3. Tinjau unresolved dan mapping manual.
4. Jalankan migration deploy hanya setelah persetujuan eksplisit.
5. Verifikasi query, akses, dan laporan tanpa membuat transaksi bisnis.

## 7. Kriteria selesai

- Santri tetap global dan dapat dipakai di banyak event.
- Empat halaman target tidak pernah menampilkan data campuran tanpa label event.
- Master dari event lain dapat digunakan ulang tanpa duplikasi tidak terkendali.
- Tarif dan konfigurasi titik turun dapat berbeda antar-event.
- Semua transaksi keuangan dapat ditelusuri ke satu event atau ditandai unresolved.
- Pencairan tidak lagi bercampur antar-event.
- Mode semua-event hanya read-only dan selalu memiliki identitas event.
- Event nonaktif tidak menerima transaksi baru.
- Tidak ada migration atau backfill production sebelum audit lokal, backup, dan persetujuan.

## 8. Risiko yang harus diselesaikan sebelum coding

1. Apakah satu pencairan boleh mencakup beberapa event? Rekomendasi awal: tidak; satu pencairan satu event.
2. Apakah tarif titik turun dapat berbeda menurut arah perjalanan? Schema saat ini menyimpan tarif pada `Journey`, sehingga konfigurasi event sebaiknya juga menyimpan arah bila memang berbeda.
3. Apakah akses user terhadap event harus eksplisit? Rekomendasi: ya untuk kontrol jangka panjang; mekanisme inferensi saat ini dapat dipertahankan sementara sebagai fallback.
4. Bagaimana menangani data pencairan lama tanpa event? Pilihan aman: mapping manual atau label legacy-unmapped; jangan mengarang event.

Dokumen ini sengaja tidak menjalankan query database, mengubah schema, membuat migration, atau mengubah data production.
