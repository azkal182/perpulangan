"use client";

import dynamic from "next/dynamic";

// Leaflet accesses `window` at module level — must be loaded client-only
const TrackingPage = dynamic(() => import("./TrackingPage.client"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-muted-foreground">
      Memuat peta...
    </div>
  ),
});

export default function TrackingPageLoader() {
  return <TrackingPage />;
}
