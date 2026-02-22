"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/auth-access";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), usernameClient()],
});

export const { signIn, signUp, signOut, useSession, admin } = authClient;
