import { Metadata } from "next";
import RombonganPage from "@/features/rombongan/components/RombonganPage.client";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";

export const metadata: Metadata = {
  title: "Manajemen Rombongan Bus",
  description: "Kelola rombongan bus dengan GPS tracking",
};

export default async function Page() {
  const scope = await getRegionalAccessScope();
  const { selectedEvent } = await getEventContext(scope);
  return <RombonganPage canManageBuses={scope.role === "admin" || scope.role === "korwil"} initialSelectedEventId={selectedEvent?.id ?? ""} initialSelectedEventStatus={selectedEvent?.status ?? null} initialSelectedEventName={selectedEvent?.name ?? ""} />;
}
