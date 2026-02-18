# Perpulangan

Sistem manajemen data kepulangan santri berbasis Next.js.

## Struktur Folder

| Path | Keterangan |
|------|-----------|
| `src/app` | Routes dan UI entry point (App Router) |
| `src/client` | Modul client-only (hooks, auth client) |
| `src/server` | Modul server-only (auth, env, logger, db) |
| `src/features` | Modul per fitur/domain |
| `src/services` | Integrasi eksternal |
| `src/validators` | Schema validasi (Zod) |
| `src/types` | Tipe bersama lintas layer |
| `src/lib` | Utilitas umum |
| `prisma` | Schema dan migrations |

---

## Development dengan Docker (Direkomendasikan)

### Prasyarat

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) terinstall dan berjalan

### Setup Pertama Kali

```bash
# 1. Copy template environment Docker
cp .env.docker .env

# 2. Edit .env — isi nilai yang wajib:
#    - BETTER_AUTH_SECRET  (random string minimal 32 karakter)
#    - NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_API_KEY
#    - TRACK_API_URL, TRACK_ADMIN_API_KEY

# 3. Build image dan jalankan semua service
pnpm docker:build

# 4. Jalankan migrasi database (hanya pertama kali / setelah ada migration baru)
pnpm docker:migrate
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Scripts Docker

| Script | Keterangan |
|--------|-----------|
| `pnpm docker:build` | Build image + jalankan semua service |
| `pnpm docker:up` | Jalankan semua service (tanpa rebuild) |
| `pnpm docker:down` | Stop dan hapus container |
| `pnpm docker:migrate` | Jalankan `prisma migrate deploy` di container |
| `pnpm docker:migrate:dev` | Jalankan `prisma migrate dev` (buat migration baru) |
| `pnpm docker:studio` | Buka Prisma Studio di container |
| `pnpm docker:seed` | Jalankan seed script |

### Hot Reload

Hot reload bekerja otomatis. Source code di host di-mount ke container via bind volume, sehingga perubahan file langsung terdeteksi tanpa restart container.

### Services

| Service | Port | Keterangan |
|---------|------|-----------|
| `app` | `3000` | Next.js dev server |
| `db` | `5432` | PostgreSQL 16 |

Database dapat diakses dari host di `localhost:5432` dengan:
- User: `postgres`
- Password: `postgres`
- Database: `perpulangan`

### Workflow Harian

```bash
# Mulai kerja
pnpm docker:up

# Setelah pull perubahan yang ada migration baru
pnpm docker:migrate

# Buat migration baru setelah ubah schema.prisma
pnpm docker:migrate:dev

# Selesai kerja
pnpm docker:down
```

---

## Development Lokal (Tanpa Docker)

### Prasyarat

- Node.js 20+
- pnpm
- PostgreSQL (lokal atau cloud)

### Setup

```bash
# Install dependencies
pnpm install

# Copy dan isi environment
cp .env.example .env

# Generate Prisma client
pnpm prisma generate

# Jalankan migrasi
pnpm prisma migrate deploy

# Jalankan dev server
pnpm dev
```

---

## Logging

Logger utama ada di `src/server/logger.ts` (Pino). Atur level via environment:

```env
LOG_LEVEL=debug              # server-side
NEXT_PUBLIC_LOG_LEVEL=info   # client-side
```

---

## Seeder Admin

Tambahkan ke `.env` lalu jalankan:

```env
ADMIN_SEED_EMAIL=admin@local.test
ADMIN_SEED_NAME=Admin
ADMIN_SEED_PASSWORD=your-strong-password
```

```bash
# Lokal
pnpm seed:admin

# Docker
pnpm docker:seed
```
