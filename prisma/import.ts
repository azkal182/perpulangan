import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Import JSON data
import Provinces from "./json/provinsi.json";
import Regencies from "./json/kabupaten.json";
import Districts from "./json/kecamatan.json";
import Villages from "./json/kelurahan.json";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Define a type for the village data structure
type VillageData = {
  id: number;
  name: string;
  code: string;
  full_code: string;
  pos_code: string;
  kecamatan_id: number;
};
// Fungsi untuk membersihkan karakter aneh (UTF-8 replacement character dll)
function sanitizeString(str: string): string {
  if (!str) return str;
  // Menghapus karakter non-ASCII atau karakter yang sering bermasalah di WIN1252
  // 0xEF 0xBF 0xBD adalah karakter "replacement"
  return str.replace(/\uFFFD/g, "").trim();
}

export async function main() {
  console.log("--- Memulai Proses Seeding Database ---");

  try {
    // --- Seeding Geographic Data ---
    console.log("\n--- Memulai Seeding Data Geografis ---");

    // 1. Seed Provinces
    console.log("  [1/4] Memulai seeding data Provinsi...");

    const formattedProvinces = Provinces.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
    }));

    await prisma.province.createMany({
      data: formattedProvinces,
      skipDuplicates: true, // Added skipDuplicates for idempotency
    });
    console.log(
      `  [1/4] Seeding ${formattedProvinces.length} data Provinsi selesai.`,
    );

    // 2. Seed Regencies
    console.log("  [2/4] Memulai seeding data Kabupaten/Kota...");

    const formattedRegencies = Regencies.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      label: `${item.type === "Kota" ? "Kota." : "Kab."} ${item.name}`,
      type: item.type,
      fullCode: item.full_code,
      provinceId: item.provinsi_id,
    }));

    await prisma.regency.createMany({
      data: formattedRegencies,
      skipDuplicates: true, // Added skipDuplicates for idempotency
    });
    console.log(
      `  [2/4] Seeding ${formattedRegencies.length} data Kabupaten/Kota selesai.`,
    );

    // 3. Seed Districts
    console.log("  [3/4] Memulai seeding data Kecamatan...");

    const formattedDistricts = Districts.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      fullCode: item.full_code,
      regencyId: item.kabupaten_id,
    }));

    await prisma.district.createMany({
      data: formattedDistricts,
      skipDuplicates: true, // Added skipDuplicates for idempotency
    });
    console.log(
      `  [3/4] Seeding ${formattedDistricts.length} data Kecamatan selesai.`,
    );

    // 4. Seed Villages
    console.log("  [4/4] Memulai seeding data Kelurahan/Desa...");

    const formattedVillages = (Villages as VillageData[]).map((item) => ({
      id: item.id,
      name: sanitizeString(item.name),
      code: item.code,
      fullCode: item.full_code,
      postalCode: item.pos_code,
      districtId: item.kecamatan_id,
    }));

    await prisma.village.createMany({
      data: formattedVillages,
      skipDuplicates: true,
    });
    console.log(
      `  [4/4] Seeding ${formattedVillages.length} data Kelurahan/Desa selesai.`,
    );
    console.log("--- Seeding Data Geografis Selesai ---");

    console.log(
      "\n--- Semua Proses Seeding Database Selesai dengan Sukses! ---",
    );
  } catch (error) {
    console.error("\n--- Terjadi Kesalahan Selama Proses Seeding ---");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    console.log("--- Koneksi Prisma Client Terputus ---");
  }
}

// Execute the main seeding function
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
