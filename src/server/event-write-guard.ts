import type { Prisma } from "@/generated/prisma/client";

/** Re-check event write eligibility inside the same transaction as its mutation. */
export async function assertEventWritable(tx: Prisma.TransactionClient, eventId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; status: "DRAFT" | "ACTIVE" | "COMPLETED" }>>`
    SELECT "id", "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE
  `;
  const event = rows[0];
  if (!event) throw new Error("Event tidak ditemukan.");
  if (event.status !== "ACTIVE") {
    throw new Error(`Event tidak aktif (${event.status === "COMPLETED" ? "selesai" : "draf"}) dan hanya dapat dibaca atau diekspor.`);
  }
  return event;
}
