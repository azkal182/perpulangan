import { Metadata } from "next";
import TrackingPageLoader from "@/features/tracking/components/TrackingPageLoader.client";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";
import { EventScopeBanner } from "@/features/event/components/EventScopeBanner";

export const metadata: Metadata = {
  title: "Tracking Armada",
  description: "Pantau lokasi armada sesuai cakupan akses Anda",
};

export default async function Page() {
  const scope = await getRegionalAccessScope();
  const { selectedEvent } = await getEventContext(scope);
  return <><EventScopeBanner eventName={selectedEvent?.name} status={selectedEvent?.status} /><TrackingPageLoader initialSelectedEventId={selectedEvent?.id ?? ""} initialSelectedEventName={selectedEvent?.name ?? ""} /></>;
}
