import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureKordaInScope, getRegionalAccessScope } from "@/server/access-scope";
import { createSignedEvidenceDownload } from "@/features/payment/services/supabase-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getRegionalAccessScope();
    const evidence = await prisma.evidenceFile.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            allocations: {
              include: {
                journey: { select: { destinationKordaId: true } },
                balanceOwnerKorda: { select: { id: true } },
              },
            },
          },
        },
        refund: {
          include: {
            paymentAllocation: {
              include: {
                journey: { select: { destinationKordaId: true } },
                balanceOwnerKorda: { select: { id: true } },
              },
            },
            balanceSourceEntry: { select: { ownerKordaId: true } },
          },
        },
      },
    });
    if (!evidence || evidence.purgedAt) return NextResponse.json({ error: "Bukti tidak ditemukan" }, { status: 404 });
    const kordaIds = new Set<string>();
    for (const allocation of evidence.payment?.allocations ?? []) {
      const kordaId = allocation.journey?.destinationKordaId ?? allocation.balanceOwnerKorda?.id;
      if (kordaId) kordaIds.add(kordaId);
    }
    const refundJourneyKorda = evidence.refund?.paymentAllocation?.journey?.destinationKordaId;
    if (refundJourneyKorda) kordaIds.add(refundJourneyKorda);
    const refundBalanceKorda = evidence.refund?.balanceSourceEntry?.ownerKordaId
      ?? evidence.refund?.paymentAllocation?.balanceOwnerKorda?.id;
    if (refundBalanceKorda) kordaIds.add(refundBalanceKorda);
    if (!kordaIds.size) return NextResponse.json({ error: "Akses bukti ditolak" }, { status: 403 });
    let authorized = false;
    for (const kordaId of kordaIds) {
      try { await ensureKordaInScope(scope, kordaId); authorized = true; break; } catch { /* check other allocations */ }
    }
    if (!authorized) return NextResponse.json({ error: "Akses bukti ditolak" }, { status: 403 });
    // Keep historical dev uploads readable during migration; all new object keys use Supabase.
    if (!evidence.storageKey.startsWith("evidence/")) {
      const filePath = path.join(path.resolve(process.env.PAYMENT_EVIDENCE_DIR || path.join(process.cwd(), ".private/payment-evidence")), path.basename(evidence.storageKey));
      const body = await readFile(filePath);
      return new Response(body, { headers: { "Content-Type": evidence.mimeType, "Content-Length": String(evidence.sizeBytes), "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(evidence.originalName)}`, "Cache-Control": "private, no-store" } });
    }
    const signedUrl = await createSignedEvidenceDownload(evidence.storageKey);
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Bukti tidak tersedia atau akses ditolak" }, { status: 403 });
  }
}
