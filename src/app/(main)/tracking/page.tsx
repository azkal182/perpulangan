import { Metadata } from "next";
import TrackingPageLoader from "@/features/tracking/components/TrackingPageLoader.client";
import { getRegionalAccessScope } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";

export const metadata: Metadata = {
  title: "GPS Tracking",
  description: "Monitor bus locations in real-time",
};

export default async function Page() {
  const scope = await getRegionalAccessScope();
  const { selectedEvent } = await getEventContext(scope);
  return <TrackingPageLoader initialSelectedEventId={selectedEvent?.id ?? ""} initialSelectedEventName={selectedEvent?.name ?? ""} />;
}
