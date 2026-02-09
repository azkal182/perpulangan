import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// import { authClient } from "@/client/auth";
import { auth } from "@/server/auth";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });


/**
 * Placeholder mapping Regency -> Korda (isi nanti)
 * key = nama korda (unique)
 * value = daftar regencyId (Int)
 */
const REGENCY_PLACEHOLDER: Record<string, number[]> = {
  Purwodadi: [30],
  Jepara: [141],
  Demak: [247],
  Kudus: [281],
  Semarang: [41,42],
  Pati: [474],
  Blora: [140],
  "Solo, Jogja, Klaten, Boyolali, Salatiga": [222, 368, 254, 191, 4],

  "Pekalongan, Batang": [478,479, 86],
  "Tegal - Brebes": [299, 300, 196],
  "Magelang, Wonosobo, Temanggung": [372, 373, 365, 304],
  Kendal: [186],
  Pemalang: [482],

  // SELAIN SAMPANG, BANGKALAN, SUMENEP, PAMEKASAN

 "Jawa Timur 1": [
    25, 68, 212, 459
  ],
  "Jawa Timur 2": [
    29, 79, 88, 113, 133, 135, 138, 144, 146, 151, 166, 177, 181, 219, 312, 346, 348, 356, 357, 370, 371, 374, 380, 381, 414, 415, 433, 434, 445, 472, 473, 493, 498, 499
  ],

  KUMACI: [288, 376, 234, 240],
  "IKSAS Bandung": [58, 59, 60, 70, 103, 180, 
  184, 208, 221, 224, 231, 286, 291, 323, 461],
  "IKSAS PUSAKA": [506, 178, 163],
  JABODETABEK: [106, 109, 112, 114, 119, 232, // DKI Jakarta
  148, 145,                     // Bogor
  252,                          // Depok
  260, 262, 263,                // Tangerang
  91, 92                        // Bekasi
  ],
  Banten: [50, 51, 229, 336, 460],

  Lombok: [349, 351, 352, 354],
  Sumatera: [15, 20, 23, 34, 35, 52, 77, 89, 99, 107, 
  122, 123, 128, 152, 155, 157, 167, 197, 220, 241, 
  245, 253, 255, 268, 279, 282, 283, 295, 296, 297, 
  303, 305, 311, 326, 331, 344, 355, 392, 402, 418, 
  424, 425, 426, 435, 436, 437, 438, 440, 441, 442, 
  443, 444, 446, 447, 448, 449, 450, 451, 452, 454, 
  456, 466, 468, 469, 475, 483, 485, 488, 496],
  Kalimantan: [19, 21, 26, 27, 31, 37, 47, 48, 49, 53, 
  71, 72, 73, 80, 81, 82, 83, 98, 102, 116, 
  134, 142, 156, 159, 169, 172, 187, 192, 203, 225, 
  242, 249, 251, 256, 271, 275, 276, 280, 284, 285, 
  292, 293, 294, 307, 329, 375, 382, 403, 404, 423, 
  439, 455, 471, 484, 494, 500],
};


const DATA = [
  {
    korwilName: "Jawa Tengah 1",
    kordas: [
      "Purwodadi",
      "Jepara",
      "Demak",
      "Kudus",
      "Semarang",
      "Pati",
      "Blora",
      "Solo, Jogja, Klaten, Boyolali, Salatiga",
    ],
  },
  {
    korwilName: "Jawa Tengah 2",
    kordas: [
      "Pekalongan, Batang",
      "Tegal - Brebes",
      "Magelang, Wonosobo, Temanggung",
      "Kendal",
      "Pemalang",
    ],
  },
  { korwilName: "Jawa Timur", kordas: ["Jawa Timur 1", "Jawa Timur 2"] },
  {
    korwilName: "Jawa Barat, Jabodetabek & Banten",
    kordas: ["KUMACI", "IKSAS Bandung", "IKSAS PUSAKA", "JABODETABEK", "Banten"],
  },
  { korwilName: "Luar Jawa", kordas: ["Lombok", "Sumatera", "Kalimantan"] },
] as const;

async function upsertKorwilByName(tx: PrismaClient, name: string) {
  const existing = await tx.korwil.findFirst({ where: { name } });
  if (existing) return existing;

  return tx.korwil.create({ data: { name } });
}

/**
 * Asumsi: Korda.name unique
 * - kalau sudah ada: update korwilId (biar konsisten)
 * - kalau belum: create
 */
async function upsertKordaByName(
  tx: PrismaClient,
  name: string,
  korwilId: string
) {
  const existing = await tx.korda.findFirst({ where: { name } });

  if (existing) {
    // pastikan relasinya mengarah ke korwil yang benar
    return tx.korda.update({
      where: { id: existing.id },
      data: { korwilId },
    });
  }

  return tx.korda.create({
    data: { name, korwilId },
  });
}

async function assignRegenciesPlaceholder(
  tx: PrismaClient,
  kordaId: string,
  kordaName: string
) {
  const regencyIds = REGENCY_PLACEHOLDER[kordaName] ?? [];
  if (regencyIds.length === 0) return;

  // Set regency.kordaId = kordaId untuk semua id yang ada di list
  await tx.regency.updateMany({
    where: { id: { in: regencyIds } },
    data: { kordaId },
  });
}

async function main() {
  console.log(process.env.DATABASE_URL!);
  const email = "admin@local.test";
  const name = "Admin";
  const password = "admin123";

  const userAdmin = await prisma.user.findFirst({ where: { email } });
  if (!userAdmin) {
    if (!password) {
    throw new Error(
      "ADMIN_SEED_PASSWORD is required to seed the admin account.",
    );
  }

  await auth.api.createUser({
    body: {
      email: email, // required
      password: password, // required
      name: name, // required
      role: "admin",
    },
  });

  console.log(`Admin seeded: ${email}`);

  }

  
  // seed korwil
  await prisma.$transaction(
    async (tx) => {
      for (const group of DATA) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const korwil = await upsertKorwilByName(tx as any, group.korwilName);

        for (const kordaName of group.kordas) {
          const korda = await upsertKordaByName(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tx as any,
            kordaName,
            korwil.id
          );

          // Placeholder assign regencies (isi REGENCY_PLACEHOLDER nanti)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await assignRegenciesPlaceholder(tx as any, korda.id, kordaName);
        }
      }
    },
    { timeout: 60_000 }
  );

  console.log("Seed Korwil/Korda selesai (Regency masih placeholder).");
}



main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
