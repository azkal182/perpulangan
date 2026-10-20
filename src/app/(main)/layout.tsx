import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MainHeader } from "@/components/main-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRegionalAccessScope } from "@/server/access-scope";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { getEventContext } from "@/server/event-context";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [scope, session] = await Promise.all([
    getRegionalAccessScope(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  const eventContext = await getEventContext(scope);
  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "-",
    image: session?.user?.image || "",
  };
  return (
    <SidebarProvider>
      <AppSidebar role={scope.role} user={user} />
      <SidebarInset>
        <MainHeader
          user={user}
          events={eventContext.events.map(({ id, name, status }) => ({ id, name, status }))}
          selectedEventId={eventContext.selectedEvent?.id ?? ""}
        />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pb-24 md:pb-6 lg:gap-6 lg:p-6">
          {eventContext.selectedEvent && eventContext.selectedEvent.status !== "ACTIVE" && (
            <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <strong>Mode baca-saja:</strong> event “{eventContext.selectedEvent.name}” berstatus {eventContext.selectedEvent.status === "COMPLETED" ? "selesai" : "draf"}. Operasi data event dinonaktifkan; data event tetap dapat dilihat dan diekspor.
            </div>
          )}
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
