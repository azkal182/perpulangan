import { Metadata } from "next";
import TrackingPageLoader from "@/features/tracking/components/TrackingPageLoader.client";

export const metadata: Metadata = {
  title: "GPS Tracking",
  description: "Monitor bus locations in real-time",
};

export default function Page() {
  return <TrackingPageLoader />;
}
