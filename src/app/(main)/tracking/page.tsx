import { Metadata } from "next";
import TrackingPage from "@/features/tracking/components/TrackingPage.client";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "GPS Tracking",
  description: "Monitor bus locations in real-time",
};

export default function Page() {
  return <TrackingPage />;
}
