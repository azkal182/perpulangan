import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// import { authClient } from "@/client/auth";
import { auth } from "@/server/auth";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(process.env.DATABASE_URL!);
  const email = "admin@local.test";
  const name = "Admin";
  const password = "admin123";

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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
