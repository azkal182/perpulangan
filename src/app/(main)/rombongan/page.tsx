import { Metadata } from "next";
import RombonganPage from "@/features/rombongan/components/RombonganPage.client";
import { getRegionalAccessScope } from "@/server/access-scope";

export const metadata: Metadata = {
  title: "Manajemen Rombongan Bus",
  description: "Kelola rombongan bus dengan GPS tracking",
};

export default async function Page() {
  const scope = await getRegionalAccessScope();
  return <RombonganPage canManageBuses={scope.role === "admin" || scope.role === "korwil"} />;
}
