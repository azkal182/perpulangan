# Perpulangan

## Struktur Folder

- `src/app` — routes dan UI entry point (App Router)
- `src/client` — modul client-only (hooks/auth client)
- `src/server` — modul server-only (auth, env, logger, db)
- `src/features` — modul per fitur/domain
- `src/services` — integrasi eksternal (email, payment, storage)
- `src/validators` — schema validasi (Zod)
- `src/types` — tipe bersama lintas layer
- `src/lib` — utilitas umum yang bisa dipakai lintas layer
- `prisma` — schema dan migrations

## Logging

- Logger utama ada di `src/server/logger.ts` (Pino).
- Konteks request ada di `src/server/request-context.ts` untuk requestId, method, path, ip.
- Atur `LOG_LEVEL` dan `APP_NAME` di environment.

Contoh penggunaan di route handler:

```ts
import { createRequestContext } from "@/server/request-context";

export async function GET(req: Request) {
  const { log } = createRequestContext(req);
  log.info("fetching data");
  return Response.json({ ok: true });
}
```

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
