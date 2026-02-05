"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/client/auth";
import { useEffect } from "react";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { RecentEvents } from "@/features/dashboard/components/RecentEvents";
import { RecentSantri } from "@/features/dashboard/components/RecentSantri";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { PaymentOverview } from "@/features/dashboard/components/PaymentOverview";
import { AlertCircle, Calendar, Users, Wallet } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in");
    }
  }, [isPending, session, router]);

  if (isPending)
    return <p className="text-center mt-8 text-white">Loading...</p>;
  if (!session?.user)
    return <p className="text-center mt-8 text-white">Redirecting...</p>;

  const { user } = session;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Santri Terdaftar"
          value="245"
          subtitle="Event aktif saat ini"
          icon={Users}
          variant="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Event Aktif"
          value="1"
          subtitle="Liburan Ramadhan 2026"
          icon={Calendar}
          variant="success"
        />
        <StatCard
          title="Total Pembayaran"
          value="Rp 198.5 Jt"
          subtitle="Dari target Rp 245 Jt"
          icon={Wallet}
          variant="warning"
        />
        <StatCard
          title="Belum Lunas"
          value="65"
          subtitle="Santri perlu follow-up"
          icon={AlertCircle}
          variant="destructive"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <RecentEvents />
          <RecentSantri />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          <QuickActions />
          <PaymentOverview />
        </div>
      </div>
    </div>
    // <main className="max-w-md h-screen flex items-center justify-center flex-col mx-auto p-6 space-y-4 text-white">
    //   <h1 className="text-2xl font-bold">Dashboard</h1>
    //   <p>Welcome, {user.name || "User"}!</p>
    //   <p>Email: {user.email}</p>
    //   <p>Role: {user.role ?? "korda"}</p>
    //   <button
    //     onClick={() => signOut()}
    //     className="w-full bg-white text-black font-medium rounded-md px-4 py-2 hover:bg-gray-200"
    //   >
    //     Sign Out
    //   </button>
    // </main>
  );
}
