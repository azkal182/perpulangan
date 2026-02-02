import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
  }),
  korwil: ac.newRole({
    user: ["create", "list", "get", "update", "set-role", "set-password", "ban"],
    session: ["list", "revoke"],
  }),
  korda: ac.newRole({
    user: ["list", "get", "set-password"],
    session: ["list"],
  }),
};

export const roleOptions = ["admin", "korwil", "korda"] as const;
export type AppRole = (typeof roleOptions)[number];
