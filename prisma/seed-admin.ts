import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { auth } from "../src/server/auth";
import { buildDummyEmailFromUsername, normalizeUsername, validateUsername } from "../src/lib/username-auth";

const databaseUrl = process.env.DATABASE_URL;
const username = normalizeUsername(process.env.ADMIN_SEED_USERNAME ?? "");
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME?.trim() || username;

if (!databaseUrl) throw new Error("DATABASE_URL wajib diatur.");
if (!username || !password) throw new Error("ADMIN_SEED_USERNAME dan ADMIN_SEED_PASSWORD wajib diatur.");
const usernameError = validateUsername(username);
if (usernameError) throw new Error(usernameError);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: buildDummyEmailFromUsername(username) }] },
    select: { id: true, username: true, email: true, role: true },
  });

  if (existing) {
    console.log(`Akun admin tidak dibuat karena akun ${existing.username ?? existing.email} sudah ada (role: ${existing.role}).`);
    return;
  }

  await auth.api.createUser({
    body: {
      name,
      email: buildDummyEmailFromUsername(username),
      password,
      role: "admin",
      data: { username, displayUsername: username },
    },
  });

  console.log(`Akun admin ${username} berhasil dibuat.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Gagal membuat akun admin.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
