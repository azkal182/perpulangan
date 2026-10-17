import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MainHeader } from "@/components/main-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getRegionalAccessScope } from "@/server/access-scope";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [scope, session] = await Promise.all([
    getRegionalAccessScope(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "-",
    image: session?.user?.image || "",
  };
  return (
    <SidebarProvider>
      <AppSidebar role={scope.role} user={user} />
      <SidebarInset>
        <MainHeader user={user} />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pb-24 md:pb-6 lg:gap-6 lg:p-6">
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
