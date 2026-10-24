import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import {
  AlertTriangle,
  Bus,
  ClipboardList,
  FileText,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/features/dashboard/components/StatCard";
import prisma from "@/lib/prisma";
import {
  busScopeWhere,
  getRegionalAccessScope,
} from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";
import { EventScopeBanner } from "@/features/event/components/EventScopeBanner";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFilter = (value: string, end = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date);

const statusLabel = { DRAFT: "Draft", ACTIVE: "Aktif", COMPLETED: "Selesai" } as const;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await getRegionalAccessScope();
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const requestedKorda = value("korda");
  const requestedDirection = value("arah");
  const requestedJourneyStatus = value("status");
  const fromValue = value("dari");
  const toValue = value("sampai");
  const from = dateFilter(fromValue);
  const to = dateFilter(toValue, true);
  const regionalKorda: Prisma.KordaWhereInput = scope.role === "admin"
    ? {}
    : scope.role === "korwil"
      ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
      : { id: scope.kordaId ?? "__NO_ACCESS__" };

  const [eventContext, kordas] = await Promise.all([
    getEventContext(scope),
    prisma.korda.findMany({ where: regionalKorda, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const events = eventContext.events;
  const eventId = eventContext.selectedEvent?.id ?? "__NO_EVENT_SELECTED__";
  const kordaId = kordas.some((korda) => korda.id === requestedKorda) ? requestedKorda : "";
  const direction = ["OUTBOUND", "RETURN"].includes(requestedDirection) ? requestedDirection as "OUTBOUND" | "RETURN" : "";
  const journeyStatus = ["REGISTERED", "CANCELLED"].includes(requestedJourneyStatus) ? requestedJourneyStatus as "REGISTERED" | "CANCELLED" : "REGISTERED";

  const journeyWhere: Prisma.JourneyWhereInput = {
    destinationKorda: { is: regionalKorda },
    ...(eventId ? { registration: { eventId } } : {}),
    ...(kordaId ? { destinationKordaId: kordaId } : {}),
    ...(direction ? { direction } : {}),
    status: journeyStatus,
    ...((from || to) ? { travelDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const journeys = await prisma.journey.findMany({
    where: journeyWhere,
    select: {
      id: true,
      registrationId: true,
      direction: true,
      status: true,
      destinationKordaId: true,
      destinationKordaNameSnapshot: true,
      travelDate: true,
      locationNameSnapshot: true,
      tariffSnapshot: true,
      registration: {
        select: {
        student: { select: { name: true, gender: true, fullAddress: true } },
        externalParticipant: { select: { name: true, gender: true, address: true, status: true } },
        originKordaNameSnapshot: true,
        },
      },
      paymentAllocations: {
        where: { type: "JOURNEY" },
        select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } },
      },
      busAssignment: { select: { busId: true, bus: { select: { label: true } } } },
    },
    orderBy: [{ travelDate: "asc" }, { destinationKordaNameSnapshot: "asc" }],
  });

  const participantIds = new Set(journeys.map((journey) => journey.registrationId));
  const unassigned = journeys.filter((journey) => journey.status === "REGISTERED" && !journey.busAssignment?.busId).length;
  const completenessIssues = journeys.filter((journey) => journey.status === "REGISTERED" && (() => {
    const student = journey.registration.student;
    const external = journey.registration.externalParticipant;
    const missingPersonData = external
      ? external.status !== "COMPLETE" || !external.name.trim() || !external.gender?.trim() || !external.address?.trim()
      : !student?.name.trim() || !student.gender.trim() || !student.fullAddress?.trim() || !journey.registration.originKordaNameSnapshot?.trim();
    return missingPersonData || !journey.travelDate || !journey.locationNameSnapshot.trim() || journey.tariffSnapshot === null;
  })());
  const paymentCounts = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
  for (const journey of journeys) {
    if (journey.status !== "REGISTERED") continue;
    if (journey.tariffSnapshot === null) continue;
    const paid = journey.paymentAllocations.reduce((sum, allocation) => sum + allocation.amount - allocation.refunds.reduce((n, refund) => n + refund.amount, 0) - allocation.corrections.reduce((n, correction) => n + correction.amount, 0), 0);
    const due = journey.tariffSnapshot;
    if (paid >= due) paymentCounts.PAID++;
    else if (paid > 0) paymentCounts.PARTIAL++;
    else paymentCounts.UNPAID++;
  }

  const fleetWhere: Prisma.BusWhereInput = {
    ...(eventId ? { eventId } : {}),
    ...(kordaId ? { kordas: { some: { kordaId } } } : {}),
    ...((from || to) ? {
      journeyAssignments: {
        some: {
          journey: {
            travelDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
          },
        },
      },
    } : {}),
  };
  const buses = await prisma.bus.findMany({
    where: { AND: [fleetWhere, busScopeWhere(scope) ?? {}] },
    select: {
      id: true,
      label: true,
      capacity: true,
      isActive: true,
      journeyAssignments: {
        where: { journey: { status: journeyStatus, destinationKorda: { is: regionalKorda }, ...(direction ? { direction } : {}), ...(kordaId ? { destinationKordaId: kordaId } : {}), ...((from || to) ? { travelDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(eventId ? { registration: { eventId } } : {}) } },
        select: { busId: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { label: "asc" }],
  });
  const activeBuses = buses.filter((bus) => bus.isActive);
  const occupiedSeats = buses.reduce((sum, bus) => sum + bus.journeyAssignments.filter((item) => item.busId === bus.id).length, 0);
  const totalSeats = buses.reduce((sum, bus) => sum + bus.capacity, 0);
  const selectedEvent = events.find((event) => event.id === eventId);

  const reportHref = `/laporan?${new URLSearchParams({ ...(kordaId ? { korda: kordaId } : {}), ...(direction ? { arah: direction } : {}) }).toString()}`;
  const fleetHref = "/rombongan";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ringkasan operasional</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pantau pendaftaran, kelengkapan data, pembayaran, dan penempatan armada sesuai cakupan akses Anda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={fleetHref} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"><Bus className="h-4 w-4" />Buka armada & manifest</Link>
          <Link href="/tracking" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"><MapPin className="h-4 w-4" />GPS armada</Link>
          <Link href={reportHref} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"><Wallet className="h-4 w-4" />Laporan keuangan</Link>
        </div>
      </header>

      <EventScopeBanner eventName={selectedEvent?.name} status={selectedEvent?.status} />

      {!eventContext.selectedEvent && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{events.length ? "Tidak ada event aktif atau event yang dipilih. Pilih event historis dari header untuk membaca data." : "Belum ada event yang tersedia pada cakupan Anda. Admin perlu membuat atau mengaktifkan event."}</p>}

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-8 lg:items-end">
        <label className="grid min-w-0 gap-1 text-sm">Arah<select name="arah" defaultValue={direction} className="min-w-0 rounded-md border bg-background px-3 py-2"><option value="">Pulang & Kembali</option><option value="OUTBOUND">Pulang</option><option value="RETURN">Kembali</option></select></label>
        <label className="grid min-w-0 gap-1 text-sm lg:col-span-2">Korda tujuan<select name="korda" defaultValue={kordaId} className="min-w-0 rounded-md border bg-background px-3 py-2"><option value="">Semua Korda dalam cakupan</option>{kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-sm">Status perjalanan<select name="status" defaultValue={journeyStatus} className="min-w-0 rounded-md border bg-background px-3 py-2"><option value="REGISTERED">Terdaftar</option><option value="CANCELLED">Dibatalkan</option></select></label>
        <label className="grid min-w-0 gap-1 text-sm">Tanggal mulai<input type="date" name="dari" defaultValue={fromValue} className="min-w-0 rounded-md border bg-background px-3 py-2" /></label>
        <label className="grid min-w-0 gap-1 text-sm">Tanggal sampai<input type="date" name="sampai" defaultValue={toValue} className="min-w-0 rounded-md border bg-background px-3 py-2" /></label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:col-span-2 lg:col-span-8">Terapkan filter</button>
      </form>

      {selectedEvent && <p className="text-sm text-muted-foreground">{selectedEvent.name} · {formatDate(selectedEvent.startDate)} – {formatDate(selectedEvent.endDate)} · {statusLabel[selectedEvent.status]}</p>}
      {(fromValue || toValue) && <p className="text-xs text-muted-foreground">Rentang tanggal memfilter tanggal perjalanan. Perjalanan tanpa tanggal tidak masuk saat filter tanggal digunakan.</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Peserta terdaftar" value={participantIds.size.toLocaleString("id-ID")} subtitle={`${journeys.length.toLocaleString("id-ID")} perjalanan pada filter ini`} icon={Users} variant="primary" />
        <StatCard title="Perlu dilengkapi" value={completenessIssues.length.toLocaleString("id-ID")} subtitle="Profil atau rincian perjalanan belum lengkap" icon={AlertTriangle} variant={completenessIssues.length ? "warning" : "success"} />
        <StatCard title="Belum ditempatkan" value={unassigned.toLocaleString("id-ID")} subtitle="Perjalanan terdaftar tanpa armada" icon={ClipboardList} variant={unassigned ? "warning" : "success"} />
        <StatCard title="Armada aktif" value={activeBuses.length.toLocaleString("id-ID")} subtitle={`${occupiedSeats.toLocaleString("id-ID")} dari ${totalSeats.toLocaleString("id-ID")} kursi terisi`} icon={Bus} variant="default" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <article className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">Status pembayaran</h2><p className="mt-1 text-sm text-muted-foreground">Status dihitung per perjalanan dari alokasi pembayaran, refund, koreksi, dan tarif snapshot.</p></div><Link href="/pembayaran" className="text-sm font-medium text-primary hover:underline">Buka pembayaran</Link></div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([["Sudah bayar", paymentCounts.PAID, "text-emerald-700 dark:text-emerald-400"], ["Partial", paymentCounts.PARTIAL, "text-amber-700 dark:text-amber-400"], ["Belum bayar", paymentCounts.UNPAID, "text-destructive"]] as const).map(([label, count, color]) => <div key={label} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold ${color}`}>{count.toLocaleString("id-ID")}</p></div>)}
          </div>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Cetak manifest terbaru</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manifest mengambil penempatan peserta terkini dan mencantumkan waktu cetak. Pilih event dan arah di halaman armada sebelum mencetak.</p>
          <Link href={fleetHref} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><FileText className="h-4 w-4" />Pilih armada dan cetak manifest</Link>
        </article>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold">Perlu ditinjau</h2><p className="text-sm text-muted-foreground">Daftar ini menunjukkan field kosong pada identitas peserta atau rincian perjalanan, bukan hasil pemeriksaan/persetujuan.</p></div>
        {completenessIssues.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-left"><tr>{["Peserta", "Korda tujuan", "Arah", "Kekurangan"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{completenessIssues.slice(0, 20).map((journey) => {
          const person = journey.registration.externalParticipant ?? journey.registration.student;
          const missing = [
            !person?.name.trim() ? "Nama" : null,
            journey.registration.externalParticipant ? (!journey.registration.externalParticipant.gender?.trim() ? "Jenis kelamin" : null) : (!journey.registration.student?.gender.trim() ? "Jenis kelamin" : null),
            journey.registration.externalParticipant ? (!journey.registration.externalParticipant.address?.trim() ? "Alamat" : null) : (!journey.registration.student?.fullAddress?.trim() ? "Alamat" : null),
            !journey.registration.externalParticipant && !journey.registration.originKordaNameSnapshot?.trim() ? "Korda asal" : null,
            !journey.travelDate ? "Tanggal perjalanan" : null,
            !journey.locationNameSnapshot.trim() ? "Titik perjalanan" : null,
            journey.tariffSnapshot === null ? "Tarif snapshot" : null,
          ].filter(Boolean);
          return <tr key={journey.id} className="border-t"><td className="p-3 font-medium">{person?.name ?? "Peserta tanpa nama"}</td><td className="p-3">{journey.destinationKordaNameSnapshot}</td><td className="p-3">{journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"}</td><td className="p-3 text-muted-foreground">{missing.join(", ") || "Data perlu ditinjau"}</td></tr>;
        })}</tbody></table>{completenessIssues.length > 20 && <p className="border-t p-3 text-xs text-muted-foreground">Menampilkan 20 dari {completenessIssues.length.toLocaleString("id-ID")} perjalanan. Gunakan halaman registrasi untuk pencarian lengkap.</p>}</div> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Tidak ada kekurangan data pada filter saat ini.</p>}
      </section>
    </main>
  );
}
