import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { auth } from "../src/server/auth";
import { buildDummyEmailFromUsername, validateUsername } from "../src/lib/username-auth";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL wajib diatur.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
type RegionType = "korwil" | "korda";

function generatedUsername(type: RegionType, name: string, id: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefix = `${type}_`;
  const full = `${prefix}${slug}`;
  if (full.length <= 30) return full;
  const suffix = id.replace(/-/g, "").slice(0, 6).toLowerCase();
  return `${prefix}${slug.slice(0, 30 - prefix.length - suffix.length - 1)}_${suffix}`;
}

function readHidden(question: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Password harus dimasukkan melalui terminal interaktif agar tidak tampil di layar.");
  }

  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") return finish(new Error("Dibatalkan."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    input.on("data", onData);
  });
}

function getType(args: string[]): RegionType {
  const value = args[args.indexOf("--type") + 1];
  if (value !== "korwil" && value !== "korda") {
    throw new Error("Pilih --type korwil atau --type korda.");
  }
  return value;
}

async function listRegions() {
  const [korwils, kordas] = await Promise.all([
    prisma.korwil.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, picUser: { select: { username: true } } },
    }),
    prisma.korda.findMany({
      orderBy: [{ korwil: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, korwil: { select: { name: true } }, picUser: { select: { username: true } } },
    }),
  ]);

  console.log("KORWIL");
  for (const region of korwils) {
    console.log(`${region.id}\t${region.name}\t${region.picUser?.username ?? "belum ada akun"}\t${generatedUsername("korwil", region.name, region.id)}`);
  }
  console.log("\nKORDA");
  for (const region of kordas) {
    console.log(`${region.id}\t${region.korwil?.name ?? "Tanpa Korwil"}\t${region.name}\t${region.picUser?.username ?? "belum ada akun"}\t${generatedUsername("korda", region.name, region.id)}`);
  }
}

async function seedOne(args: string[]) {
  const type = getType(args);
  const id = args[args.indexOf("--id") + 1];
  if (!id) throw new Error("ID wajib diisi. Ambil ID dari perintah --list.");

  const region = type === "korwil"
    ? await prisma.korwil.findUnique({ where: { id }, select: { id: true, name: true, picName: true, picUserId: true, picUser: { select: { username: true } } } })
    : await prisma.korda.findUnique({ where: { id }, select: { id: true, name: true, picName: true, picUserId: true, picUser: { select: { username: true } } } });
  if (!region) throw new Error(`${type} dengan ID tersebut tidak ditemukan.`);
  if (region.picUserId) {
    throw new Error(`${type} ${region.name} sudah memiliki akun PIC (${region.picUser?.username ?? region.picUserId}).`);
  }

  const username = generatedUsername(type, region.name, region.id);
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(`Username otomatis tidak valid: ${usernameError}`);
  const email = buildDummyEmailFromUsername(username);
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true, username: true } });
  if (existing) throw new Error(`Username ${username} sudah dipakai oleh akun lain (${existing.username ?? existing.id}).`);

  console.log(`Wilayah: ${type} ${region.name}`);
  console.log(`Username: ${username}`);
  const suppliedPassword = process.env.REGIONAL_ACCOUNT_PASSWORD;
  const password = suppliedPassword ?? await readHidden("Password baru (minimal 8 karakter): ");
  if (password.length < 8) throw new Error("Password minimal 8 karakter.");
  if (!suppliedPassword) {
    const confirmation = await readHidden("Ulangi password: ");
    if (password !== confirmation) throw new Error("Konfirmasi password tidak sama.");
  }

  const displayName = region.picName?.trim() || `${region.name} (${type === "korwil" ? "Korwil" : "Korda"})`;
  const created = await auth.api.createUser({
    body: {
      name: displayName,
      email,
      password,
      role: type,
      data: { username, displayUsername: username },
    },
  });

  try {
    if (type === "korwil") {
      await prisma.korwil.update({ where: { id }, data: { picUserId: created.user.id } });
    } else {
      await prisma.korda.update({ where: { id }, data: { picUserId: created.user.id } });
    }
  } catch (error) {
    await prisma.user.delete({ where: { id: created.user.id } }).catch(() => undefined);
    throw error;
  }

  console.log(`Akun ${type} berhasil dibuat dan ditautkan ke ${region.name}. Simpan username ${username} dengan aman.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) return listRegions();
  if (args.includes("--type") && args.includes("--id")) return seedOne(args);
  throw new Error("Gunakan --list, atau --type korwil|korda --id <ID> untuk membuat satu akun.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Gagal membuat akun wilayah.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
