// import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/server/db/prisma";
import { admin, username } from "better-auth/plugins";
import { ac, roles } from "@/lib/auth-access";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
    admin({
      ac,
      roles,
      adminRoles: ["admin"],
      defaultRole: "korda",
    }),
  ],
});
