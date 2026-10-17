import "dotenv/config";
import { randomUUID } from "node:crypto";
import { JourneyDirection, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL wajib diatur.");
const databaseName = new URL(databaseUrl).pathname.replace(/^\/+/, "").split("?")[0] ?? "";
if (!/(^|[_-])dev([_-]|$)/i.test(databaseName) && process.env.DEMO_SEED_ALLOW_NON_DEV !== "true") {
  throw new Error(`Seed demo ditolak untuk database "${databaseName}". Gunakan database bernama *dev*; override hanya dengan DEMO_SEED_ALLOW_NON_DEV=true.`);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const SEED_TAG = "[DEMO SEED]";
const EVENT_NAME = `${SEED_TAG} Perpulangan Demo 2026`;
const requestedCount = Number.parseInt(process.env.DEMO_SEED_STUDENT_COUNT ?? "120", 10);
if (!Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > 2000) {
  throw new Error("DEMO_SEED_STUDENT_COUNT harus berupa bilangan 1–2000.");
}

type SeedJourney = {
  id: string;
  registrationId: string;
  studentId: string | null;
  externalParticipantId: string | null;
  participantName: string;
  originKordaId: string | null;
  originName: string | null;
  destinationId: string;
  destinationName: string;
  direction: JourneyDirection;
  tariff: number;
};

async function getActorUserId() {
  const requestedId = process.env.DEMO_SEED_ACTOR_USER_ID;
  const user = await prisma.user.findFirst({
    where: requestedId ? { id: requestedId } : undefined,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, role: true },
  });
  if (!user) throw new Error("Belum ada user. Buat admin/user terlebih dahulu, lalu jalankan seed ini kembali.");
  if (requestedId && user.id !== requestedId) throw new Error("DEMO_SEED_ACTOR_USER_ID tidak ditemukan.");
  if (user.role !== "admin") throw new Error("Seed demo keuangan lintas Korda memerlukan akun admin sebagai pencatat. Atur DEMO_SEED_ACTOR_USER_ID ke admin jika ada beberapa user.");
  return { id: user.id, role: user.role };
}

async function ensureDemoKorda() {
  let kordas = await prisma.korda.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, korwilId: true } });
  if (kordas.length) return kordas;
  let korwil = await prisma.korwil.findFirst({ where: { name: `${SEED_TAG} Wilayah Demo` } });
  if (!korwil) korwil = await prisma.korwil.create({ data: { name: `${SEED_TAG} Wilayah Demo`, picName: "Koordinator Demo" } });
  const korda = await prisma.korda.create({ data: { name: `${SEED_TAG} Korda Demo`, korwilId: korwil.id, picName: "Petugas Demo" } });
  kordas = [{ id: korda.id, name: korda.name, korwilId: korda.korwilId }];
  return kordas;
}

async function ensureDropPoint(korda: { id: string; name: string }, index: number) {
  const name = `${SEED_TAG} Terminal ${index % 2 === 0 ? "Utama" : "Alternatif"} · ${korda.name}`;
  const existing = await prisma.dropPoint.findFirst({ where: { kordaId: korda.id, name }, select: { id: true, name: true, price: true } });
  if (existing) return existing;
  const price = 150_000 + (index % 8) * 25_000;
  return prisma.dropPoint.create({ data: { name, kordaId: korda.id, price }, select: { id: true, name: true, price: true } });
}

async function ensureBus(eventId: string, korda: { id: string; name: string; korwilId: string | null }, direction: JourneyDirection, ordinal: number) {
  const directionLabel = direction === "OUTBOUND" ? "Pulang" : "Kembali";
  const label = `${SEED_TAG} ${directionLabel} ${String(ordinal + 1).padStart(2, "0")} · ${korda.name}`;
  let bus = await prisma.bus.findFirst({ where: { eventId, label }, select: { id: true } });
  if (!bus) bus = await prisma.bus.create({ data: { eventId, label, capacity: 45 + (ordinal % 3) * 5, korwilId: korda.korwilId, isActive: true }, select: { id: true } });
  await prisma.busKorda.upsert({ where: { busId_kordaId: { busId: bus.id, kordaId: korda.id } }, create: { busId: bus.id, kordaId: korda.id }, update: {} });
  return bus.id;
}

async function ensureEvent() {
  const existing = await prisma.event.findFirst({ where: { name: EVENT_NAME }, select: { id: true } });
  if (existing) return prisma.event.update({ where: { id: existing.id }, data: { status: "ACTIVE" }, select: { id: true } });
  const startDate = new Date("2026-11-01T00:00:00+07:00");
  const endDate = new Date("2026-11-15T23:59:59+07:00");
  return prisma.event.create({ data: { name: EVENT_NAME, startDate, endDate, status: "ACTIVE" }, select: { id: true } });
}

async function ensureExternalParticipants(actorId: string, kordas: Array<{ id: string; name: string }>) {
  const participants: Array<{ id: string; name: string; destinationId: string; destinationName: string }> = [];
  for (let index = 0; index < 20; index += 1) {
    const korda = kordas[index % kordas.length]!;
    const name = `${SEED_TAG} Peserta Eksternal ${String(index + 1).padStart(2, "0")}`;
    const address = `Alamat contoh untuk data demo ${String(index + 1).padStart(2, "0")}`;
    let participant = await prisma.externalParticipant.findFirst({ where: { name, address, intendedKordaId: korda.id }, select: { id: true } });
    if (!participant) participant = await prisma.externalParticipant.create({ data: { name, gender: index % 2 ? "Perempuan" : "Laki-laki", address, intendedKordaId: korda.id, status: "COMPLETE", createdByUserId: actorId, updatedByUserId: actorId }, select: { id: true } });
    participants.push({ id: participant.id, name, destinationId: korda.id, destinationName: korda.name });
  }
  return participants;
}

async function main() {
  const actor = await getActorUserId();
  const event = await ensureEvent();
  const allKordas = await ensureDemoKorda();
  const destinationKordas = allKordas.slice(0, 12);
  const pointByKorda = new Map<string, Array<{ id: string; name: string; price: number }>>();
  const buses = new Map<string, string>();
  for (let index = 0; index < destinationKordas.length; index += 1) {
    const korda = destinationKordas[index]!;
    pointByKorda.set(korda.id, [await ensureDropPoint(korda, index * 2), await ensureDropPoint(korda, index * 2 + 1)]);
    for (const direction of [JourneyDirection.OUTBOUND, JourneyDirection.RETURN]) {
      buses.set(`${korda.id}:${direction}`, await ensureBus(event.id, korda, direction, index));
    }
  }

  const regionalStudents = await prisma.student.findMany({
    where: { status: true, regionalStatus: { in: ["AUTO_MAPPED", "VERIFIED"] }, provinceId: { not: null }, regencyId: { not: null }, regency: { is: { kordaId: { not: null } } } },
    orderBy: [{ name: "asc" }],
    take: requestedCount,
    select: { id: true, name: true, gender: true, regency: { select: { korda: { select: { id: true, name: true } } } } },
  });
  if (!regionalStudents.length) throw new Error("Tidak ada santri aktif dengan region dan Korda asal valid. Perbaiki data wilayah/import santri terlebih dahulu.");

  const journeysToPay: SeedJourney[] = [];
  const registrationIds: string[] = [];
  for (let index = 0; index < regionalStudents.length; index += 1) {
    const student = regionalStudents[index]!;
    const destination = destinationKordas[index % destinationKordas.length]!;
    const points = pointByKorda.get(destination.id)!;
    let registration = await prisma.registration.findFirst({ where: { eventId: event.id, studentId: student.id }, select: { id: true } });
    const outboundOnly = index % 11 === 0;
    const returnOnly = index % 13 === 0 && !outboundOnly;
    if (!registration) {
      registration = await prisma.registration.create({ data: {
        eventId: event.id, studentId: student.id, status: "CONFIRMED",
        originKordaId: student.regency?.korda?.id ?? null,
        originKordaNameSnapshot: student.regency?.korda?.name ?? null,
        registrarUserId: actor.id, registrarName: "Seed Demo", registrarPhone: "0000000000",
        kordaChanged: !!student.regency?.korda && student.regency.korda.id !== destination.id,
        kordaChangeConfirmed: true,
        outboundKordaId: returnOnly ? null : destination.id,
        outboundDropPointId: returnOnly ? null : points[0]!.id,
        outboundDate: returnOnly ? null : new Date("2026-11-01T00:00:00+07:00"),
        returnKordaId: outboundOnly ? null : destination.id,
        returnDropPointId: outboundOnly ? null : points[0]!.id,
        returnDate: outboundOnly ? null : new Date("2026-11-15T00:00:00+07:00"),
        outboundBusId: returnOnly ? null : buses.get(`${destination.id}:${JourneyDirection.OUTBOUND}`),
        returnBusId: outboundOnly ? null : buses.get(`${destination.id}:${JourneyDirection.RETURN}`),
        outboundPaid: index % 17 === 0 && !returnOnly,
        returnPaid: index % 19 === 0 && !outboundOnly,
        notes: `${SEED_TAG} Data demo; jangan dipakai sebagai data operasional.`,
      }, select: { id: true } });
    }
    registrationIds.push(registration.id);
    const directions = outboundOnly ? [JourneyDirection.OUTBOUND] : returnOnly ? [JourneyDirection.RETURN] : [JourneyDirection.OUTBOUND, JourneyDirection.RETURN];
    for (const direction of directions) {
      const exists = await prisma.journey.findUnique({ where: { registrationId_direction: { registrationId: registration.id, direction } }, select: { id: true } });
      if (exists) continue;
      const point = points[direction === JourneyDirection.OUTBOUND ? 0 : 1]!;
      const journey = await prisma.journey.create({ data: {
        registrationId: registration.id,
        direction,
        destinationKordaId: destination.id,
        destinationKordaNameSnapshot: destination.name,
        dropPointId: point.id,
        locationNameSnapshot: point.name,
        travelDate: direction === JourneyDirection.OUTBOUND ? new Date("2026-11-01T00:00:00+07:00") : new Date("2026-11-15T00:00:00+07:00"),
        tariffSnapshot: point.price,
        status: "REGISTERED",
      }, select: { id: true } });
      journeysToPay.push({ id: journey.id, registrationId: registration.id, studentId: student.id, externalParticipantId: null, participantName: student.name, originKordaId: student.regency?.korda?.id ?? null, originName: student.regency?.korda?.name ?? null, destinationId: destination.id, destinationName: destination.name, direction, tariff: point.price });
    }
  }

  const externalParticipants = await ensureExternalParticipants(actor.id, destinationKordas);
  for (let index = 0; index < externalParticipants.length; index += 1) {
    const participant = externalParticipants[index]!;
    let registration = await prisma.registration.findFirst({ where: { eventId: event.id, externalParticipantId: participant.id }, select: { id: true } });
    if (!registration) registration = await prisma.registration.create({ data: {
      eventId: event.id, externalParticipantId: participant.id, status: "CONFIRMED", registrarUserId: actor.id,
      registrarName: "Seed Demo", registrarPhone: "0000000000", kordaChanged: false, kordaChangeConfirmed: true,
      outboundKordaId: participant.destinationId, outboundDropPointId: pointByKorda.get(participant.destinationId)![0]!.id,
      outboundDate: new Date("2026-11-01T00:00:00+07:00"), returnKordaId: participant.destinationId,
      returnDropPointId: pointByKorda.get(participant.destinationId)![0]!.id, returnDate: new Date("2026-11-15T00:00:00+07:00"),
      outboundBusId: buses.get(`${participant.destinationId}:${JourneyDirection.OUTBOUND}`), returnBusId: buses.get(`${participant.destinationId}:${JourneyDirection.RETURN}`),
      notes: `${SEED_TAG} Peserta eksternal demo.`,
    }, select: { id: true } });
    registrationIds.push(registration.id);
    for (const direction of [JourneyDirection.OUTBOUND, JourneyDirection.RETURN]) {
      if (await prisma.journey.findUnique({ where: { registrationId_direction: { registrationId: registration.id, direction } }, select: { id: true } })) continue;
      const point = pointByKorda.get(participant.destinationId)![0]!;
      const journey = await prisma.journey.create({ data: { registrationId: registration.id, direction, destinationKordaId: participant.destinationId, destinationKordaNameSnapshot: participant.destinationName, dropPointId: point.id, locationNameSnapshot: point.name, travelDate: direction === JourneyDirection.OUTBOUND ? new Date("2026-11-01T00:00:00+07:00") : new Date("2026-11-15T00:00:00+07:00"), tariffSnapshot: point.price }, select: { id: true } });
      journeysToPay.push({ id: journey.id, registrationId: registration.id, studentId: null, externalParticipantId: participant.id, participantName: participant.name, originKordaId: null, originName: null, destinationId: participant.destinationId, destinationName: participant.destinationName, direction, tariff: point.price });
    }
  }

  // Rebuild the deterministic worklist from the dedicated event so a rerun can
  // safely resume after a partial previous execution.
  journeysToPay.length = 0;
  const seededJourneys = await prisma.journey.findMany({
    where: { registration: { eventId: event.id }, status: "REGISTERED" },
    include: { registration: { include: { student: { select: { name: true } }, externalParticipant: { select: { name: true } } } }, destinationKorda: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "asc" }, { direction: "asc" }],
  });
  for (const journey of seededJourneys) {
    journeysToPay.push({
      id: journey.id, registrationId: journey.registrationId, studentId: journey.registration.studentId,
      externalParticipantId: journey.registration.externalParticipantId,
      participantName: journey.registration.student?.name ?? journey.registration.externalParticipant?.name ?? "Peserta demo",
      originKordaId: journey.registration.originKordaId, originName: journey.registration.originKordaNameSnapshot,
      destinationId: journey.destinationKordaId, destinationName: journey.destinationKorda.name,
      direction: journey.direction, tariff: journey.tariffSnapshot ?? 0,
    });
  }

  // Seed a few legacy flags as unresolved history; never infer their paid amount from tariff.
  // Every demo legacy-paid flag needs a matching reconciliation row. Limiting
  // this to only the first few registrations leaves seeded true flags orphaned.
  const legacyCandidates = await prisma.registration.findMany({ where: { id: { in: registrationIds } }, select: { id: true, outboundPaid: true, returnPaid: true, journeys: { select: { direction: true } } } });
  for (const registration of legacyCandidates) for (const [direction, marked] of [[JourneyDirection.OUTBOUND, registration.outboundPaid], [JourneyDirection.RETURN, registration.returnPaid]] as const) {
    if (!marked || !registration.journeys.some((journey) => journey.direction === direction)) continue;
    await prisma.legacyPaymentReconciliation.upsert({ where: { registrationId_direction: { registrationId: registration.id, direction } }, create: { registrationId: registration.id, direction, legacyMarkedPaid: true, status: "OPEN", note: `${SEED_TAG} Tanda lunas lama; nominal belum diverifikasi.` }, update: {} });
  }

  // Group up to three participant journeys per transfer to exercise family payment allocations.
  const batches: SeedJourney[][] = [];
  for (let index = 0; index < journeysToPay.length; index += 3) batches.push(journeysToPay.slice(index, index + 3));
  let paymentCount = 0;
  const hasSeededLedger = await prisma.payment.findFirst({
    where: { eventId: event.id, noteSnapshot: { startsWith: SEED_TAG } },
    select: { id: true },
  });
  for (let batchIndex = 0; !hasSeededLedger && batchIndex < batches.length; batchIndex += 1) {
    const batch: SeedJourney[] = [];
    for (const journey of batches[batchIndex]!) {
      const existingAllocation = await prisma.paymentAllocation.findFirst({ where: { journeyId: journey.id, type: "JOURNEY" }, select: { id: true } });
      if (!existingAllocation) batch.push(journey);
    }
    if (!batch.length) continue;
    const paidRatio = batchIndex % 9 === 0 ? 0 : batchIndex % 5 === 0 ? 0.45 : 1;
    const allocations = batch.map((journey, index) => ({ journey, amount: Math.floor(journey.tariff * paidRatio), index }));
    const overpayment = batchIndex % 12 === 0 ? 25_000 : 0;
    const total = allocations.reduce((sum, row) => sum + row.amount, 0) + overpayment;
    if (total <= 0) continue;
    const paymentId = randomUUID();
    const note = allocations.map(({ journey, amount }) => `${journey.participantName} / ${journey.direction === JourneyDirection.OUTBOUND ? "Pulang" : "Kembali"} — tagihan Rp${amount.toLocaleString("id-ID")} (${journey.destinationName})`).join("; ") + (overpayment ? `; Saldo Lain Rp${overpayment.toLocaleString("id-ID")} (${batch.at(-1)!.destinationName})` : "");
    await prisma.payment.create({ data: { id: paymentId, eventId: event.id, payerName: "Tidak dicatat", amount: total, method: "Transfer", paidAt: new Date("2026-10-10T10:00:00+07:00"), noteSnapshot: `${SEED_TAG} ${note}`, createdByUserId: actor.id } });
    for (const { journey, amount } of allocations) {
      if (amount > 0) await prisma.paymentAllocation.create({ data: { paymentId, type: "JOURNEY", journeyId: journey.id, participantNameSnapshot: journey.participantName, originKordaNameSnapshot: journey.originName, destinationKordaNameSnapshot: journey.destinationName, payerNameSnapshot: "Tidak dicatat", amount, createdByUserId: actor.id } });
    }
    if (overpayment) {
      const owner = batch.at(-1)!;
      const allocation = await prisma.paymentAllocation.create({ data: { paymentId, type: "BALANCE", balanceOwnerKordaId: owner.destinationId, participantNameSnapshot: owner.participantName, originKordaNameSnapshot: owner.originName, destinationKordaNameSnapshot: owner.destinationName, payerNameSnapshot: "Tidak dicatat", amount: overpayment, createdByUserId: actor.id } });
      await prisma.kordaBalanceEntry.create({ data: { ownerKordaId: owner.destinationId, originKordaNameSnapshot: owner.originName, destinationKordaNameSnapshot: owner.destinationName, participantNameSnapshot: owner.participantName, payerNameSnapshot: "Tidak dicatat", sourcePaymentAllocationId: allocation.id, entryType: "CREDIT", amount: overpayment, reason: `${SEED_TAG} Kelebihan transfer demo`, createdByUserId: actor.id } });
    }
    await prisma.financialAuditEntry.create({ data: { action: "PAYMENT_RECORDED", entityType: "Payment", entityId: paymentId, eventId: event.id, actorUserId: actor.id, actorRoleSnapshot: actor.role, amount: total, paymentId } });
    paymentCount += 1;
  }

  // Seed immutable refund history once per source allocation.
  const refundCandidates = await prisma.paymentAllocation.findMany({ where: { type: "JOURNEY", journey: { registration: { eventId: event.id } }, amount: { gt: 0 } }, include: { journey: { include: { registration: { select: { eventId: true } }, destinationKorda: { select: { id: true, name: true } } } }, refunds: { select: { id: true } } }, orderBy: { createdAt: "asc" }, take: 12 });
  let refundCount = 0;
  for (const allocation of (hasSeededLedger ? [] : refundCandidates.filter((row) => row.refunds.length === 0).slice(0, 3))) {
    if (!allocation.journey) continue;
    const refundId = randomUUID();
    const refundAmount = Math.max(1, Math.min(allocation.amount, Math.floor(allocation.amount / 4)));
    await prisma.refund.create({ data: { id: refundId, paymentAllocationId: allocation.id, amount: refundAmount, reason: `${SEED_TAG} Refund parsial contoh`, method: "BANK_TRANSFER", refundedAt: new Date("2026-10-12T12:00:00+07:00"), createdByUserId: actor.id } });
    await prisma.financialAuditEntry.create({ data: { action: "REFUND_RECORDED", entityType: "Refund", entityId: refundId, eventId: event.id, kordaScopeId: allocation.journey.destinationKordaId, actorUserId: actor.id, actorRoleSnapshot: actor.role, amount: refundAmount, reason: `${SEED_TAG} Refund parsial contoh`, refundId } });
    refundCount += 1;
  }
  const balanceCredit = await prisma.kordaBalanceEntry.findFirst({ where: { ownerKordaId: { in: destinationKordas.map((korda) => korda.id) }, entryType: "CREDIT", sourcePaymentAllocation: { payment: { eventId: event.id } }, refundsFromSource: { none: {} } }, orderBy: { createdAt: "asc" } });
  if (!hasSeededLedger && balanceCredit) {
    const refundId = randomUUID();
    const amount = Math.min(balanceCredit.amount, 10_000);
    await prisma.refund.create({ data: { id: refundId, balanceSourceEntryId: balanceCredit.id, amount, reason: `${SEED_TAG} Refund Saldo Lain contoh`, method: "CASH", refundedAt: new Date("2026-10-13T12:00:00+07:00"), createdByUserId: actor.id } });
    await prisma.kordaBalanceEntry.create({ data: { ownerKordaId: balanceCredit.ownerKordaId, originKordaNameSnapshot: balanceCredit.originKordaNameSnapshot, destinationKordaNameSnapshot: balanceCredit.destinationKordaNameSnapshot, participantNameSnapshot: balanceCredit.participantNameSnapshot, payerNameSnapshot: balanceCredit.payerNameSnapshot, sourceRefundId: refundId, entryType: "REFUND", amount, reason: `${SEED_TAG} Refund Saldo Lain contoh`, createdByUserId: actor.id } });
    await prisma.financialAuditEntry.create({ data: { action: "REFUND_RECORDED", entityType: "Refund", entityId: refundId, eventId: event.id, kordaScopeId: balanceCredit.ownerKordaId, actorUserId: actor.id, actorRoleSnapshot: actor.role, amount, reason: `${SEED_TAG} Refund Saldo Lain contoh`, refundId } });
    refundCount += 1;
  }

  const registrationCount = await prisma.registration.count({ where: { eventId: event.id } });
  const journeyCount = await prisma.journey.count({ where: { registration: { eventId: event.id } } });
  console.log(`${SEED_TAG} Selesai.`);
  console.log(`Event: ${EVENT_NAME}`);
  console.log(`Santri dipilih: ${regionalStudents.length}; peserta eksternal: ${externalParticipants.length}; registrasi event: ${registrationCount}; journey: ${journeyCount}.`);
  console.log(`Pembayaran baru dibuat: ${paymentCount}; refund baru: ${refundCount}; Korda tujuan: ${destinationKordas.length}; titik turun dan armada: siap.`);
  console.log(hasSeededLedger
    ? "Ledger demo sudah ada; pembayaran/refund tidak ditambahkan ulang. Registrasi, data operasional, dan antrean legacy tetap diselaraskan."
    : "Ledger demo dibuat satu kali dan ditandai [DEMO SEED]. Registrasi serta antrean legacy aman diselaraskan ulang.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed demo gagal.");
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
