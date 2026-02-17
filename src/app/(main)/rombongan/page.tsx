import { Metadata } from "next";
import RombonganPage from "@/features/rombongan/components/RombonganPage.client";

export const metadata: Metadata = {
  title: "Manajemen Rombongan Bus",
  description: "Kelola rombongan bus dengan GPS tracking",
};

export default function Page() {
  return <RombonganPage />;
}
