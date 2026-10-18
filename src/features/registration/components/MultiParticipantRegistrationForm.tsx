"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Autocomplete } from "@/components/AutoComplete";
import type { Korda } from "../types";
import type { DropPoint } from "@/features/drop-points/types";
import {
  checkStudentAlreadyRegistered,
  cleanupRegistrationEvidenceUploadAction,
  createRegistrationEvidenceUploadAction,
  finalizeRegistrationBatchAction,
} from "../actions/registration.action";
import {
  searchStudents,
  type StudentBasic,
} from "@/features/santri/actions/students.action";
import { createExternalParticipantFromRegistration, searchCompleteExternalParticipants } from "@/features/santri/actions/external-participant.actions";
import { getJourneyTariff } from "@/features/drop-points/domain/package-tariff";
import { toast } from "sonner";

type Props = {
  eventId: string;
  eventName: string;
  kordas: Korda[];
  dropPoints: DropPoint[];
  defaultMode?: "both" | "outbound_only" | "return_only"; // Initial mode
  lockMode?: boolean; // If true, hide mode selector
  enableUnsavedGuard?: boolean; // Prevent accidental navigation while draft exists
  defaultKordaId?: string | null;
};

type ParticipantDraft = {
  draftKey?: string;
  student: StudentBasic;
  externalParticipantId?: string;
  outboundDropPoint: DropPoint | null; // Nullable for return-only
  returnDropPoint: DropPoint | null;
  paymentStatus: "unpaid" | "outbound_only" | "paid_both" | "paid_return";
};

const UNSAVED_WARNING_MESSAGE =
  "Perubahan belum disimpan. Yakin ingin meninggalkan halaman ini?";

function useUnsavedChangesGuard(params: {
  enabled: boolean;
  shouldBlock: boolean;
  message: string;
}) {
  const { enabled, shouldBlock, message } = params;
  const shouldBlockRef = React.useRef(shouldBlock);
  const bypassRef = React.useRef(false);

  React.useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  }, [shouldBlock]);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const STATE_KEY = "__registration_unsaved_guard";
    const state = (window.history.state as Record<string, unknown> | null) ?? {};

    if (!state[STATE_KEY]) {
      window.history.pushState(
        {
          ...state,
          [STATE_KEY]: true,
        },
        "",
        window.location.href,
      );
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current || !shouldBlockRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    const onClickCapture = (event: MouseEvent) => {
      if (
        bypassRef.current ||
        !shouldBlockRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.includes("external")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      const current = new URL(window.location.href);
      const isSameDestination =
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash;

      if (isSameDestination) {
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      bypassRef.current = true;
      shouldBlockRef.current = false;
    };

    const onPopState = () => {
      if (bypassRef.current || !shouldBlockRef.current) {
        window.removeEventListener("beforeunload", onBeforeUnload);
        document.removeEventListener("click", onClickCapture, true);
        window.removeEventListener("popstate", onPopState);
        window.history.back();
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        window.history.pushState(
          {
            ...((window.history.state as Record<string, unknown> | null) ?? {}),
            [STATE_KEY]: true,
          },
          "",
          window.location.href,
        );
        return;
      }

      bypassRef.current = true;
      shouldBlockRef.current = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      window.history.back();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled, message]);

}

export function MultiParticipantRegistrationForm({
  eventId,
  kordas,
  dropPoints,
  defaultMode = "both",
  lockMode = false,
  enableUnsavedGuard = false,
  defaultKordaId = null,
}: Props) {
  // Registration mode: 'both' or 'return_only'
  const [registrationMode, setRegistrationMode] = React.useState<
    "both" | "outbound_only" | "return_only"
  >(defaultMode);

  const [selectedKordaId, setSelectedKordaId] = React.useState<string | null>(defaultKordaId);
  const [selectedStudentId, setSelectedStudentId] = React.useState<
    string | null
  >(null);
  const [selectedStudent, setSelectedStudent] =
    React.useState<StudentBasic | null>(null);
  const [participantDrafts, setParticipantDrafts] = React.useState<ParticipantDraft[]>([]);
  const [participantType, setParticipantType] = React.useState<"student" | "external">("student");
  const [showExternalDraft, setShowExternalDraft] = React.useState(false);
  const [externalDraftName, setExternalDraftName] = React.useState("");
  const [externalDraftGender, setExternalDraftGender] = React.useState("");
  const [externalDraftAddress, setExternalDraftAddress] = React.useState("");

  // Separate korda for outbound and return
  const [selectedOutboundKordaId, setSelectedOutboundKordaId] = React.useState<string | null>(defaultKordaId);
  const [selectedReturnKordaId, setSelectedReturnKordaId] = React.useState<string | null>(defaultKordaId);

  const [selectedOutboundDropPointId, setSelectedOutboundDropPointId] =
    React.useState<string | null>(null);
  const [selectedReturnDropPointId, setSelectedReturnDropPointId] =
    React.useState<string | null>(null);
  const [recordPaymentNow, setRecordPaymentNow] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentAmountEdited, setPaymentAmountEdited] = React.useState(false);
  const [paymentEvidence, setPaymentEvidence] = React.useState<File | null>(null);
  const [balanceOwnerKey, setBalanceOwnerKey] = React.useState("");
  const [customizePaymentAllocation, setCustomizePaymentAllocation] = React.useState(false);
  const [customPaymentAllocations, setCustomPaymentAllocations] = React.useState<Record<string, string>>({});
  const [lastSubmissionSummary, setLastSubmissionSummary] = React.useState<{ names: string[]; paid: boolean; amount: number } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const studentSelectionRequestRef = React.useRef(0);
  const draftKeyCounterRef = React.useRef(0);

  const hasDraftInput = React.useMemo(() => {
    const hasSelectionDraft =
      !!selectedStudentId ||
      !!selectedStudent ||
      !!selectedOutboundDropPointId ||
      !!selectedReturnDropPointId;

    const hasParticipantDrafts = participantDrafts.length > 0;
    return hasSelectionDraft || hasParticipantDrafts;
  }, [
    participantDrafts.length,
    selectedOutboundDropPointId,
    selectedReturnDropPointId,
    selectedStudent,
    selectedStudentId,
  ]);

  useUnsavedChangesGuard({
    enabled: enableUnsavedGuard,
    shouldBlock: hasDraftInput && !submitting,
    message: UNSAVED_WARNING_MESSAGE,
  });

  // Reset student selection when Korda changes
  React.useEffect(() => {
    setSelectedStudentId(null);
    setSelectedStudent(null);
  }, [selectedKordaId]);

  // Reset outbound drop point when outbound korda changes
  React.useEffect(() => {
    if (registrationMode === "both" || registrationMode === "outbound_only") {
      setSelectedOutboundDropPointId(null);
    }
  }, [selectedOutboundKordaId, registrationMode]);

  // Reset return drop point when return korda changes
  React.useEffect(() => {
    setSelectedReturnDropPointId(null);
  }, [selectedReturnKordaId]);


  // Filter drop points for outbound journey
  const outboundDropPoints = React.useMemo(() => {
    if (!selectedOutboundKordaId) return dropPoints;
    return dropPoints.filter((dp) => dp.kordaId === selectedOutboundKordaId);
  }, [dropPoints, selectedOutboundKordaId]);

  // Filter drop points for return journey
  const returnDropPoints = React.useMemo(() => {
    if (!selectedReturnKordaId) return dropPoints;
    return dropPoints.filter((dp) => dp.kordaId === selectedReturnKordaId);
  }, [dropPoints, selectedReturnKordaId]);

  const selectedOutboundDropPoint = React.useMemo(
    () =>
      dropPoints.find((dp) => dp.id === selectedOutboundDropPointId) || null,
    [dropPoints, selectedOutboundDropPointId],
  );

  const selectedReturnDropPoint = React.useMemo(
    () => dropPoints.find((dp) => dp.id === selectedReturnDropPointId) || null,
    [dropPoints, selectedReturnDropPointId],
  );

  const selectDestinationKorda = (kordaId: string | null) => {
    const nextKordaId = kordaId || null;
    if (nextKordaId !== selectedKordaId) {
      setSelectedStudentId(null);
      setSelectedStudent(null);
      setSelectedOutboundDropPointId(null);
      setSelectedReturnDropPointId(null);
      setShowExternalDraft(false);
      setExternalDraftName(""); setExternalDraftGender(""); setExternalDraftAddress("");
      setRecordPaymentNow(false); setPaymentEvidence(null); setPaymentAmount(""); setPaymentAmountEdited(false); setBalanceOwnerKey(""); setCustomizePaymentAllocation(false); setCustomPaymentAllocations({});
      setParticipantDrafts([]);
    }
    setSelectedKordaId(nextKordaId);
    setSelectedOutboundKordaId(nextKordaId);
    setSelectedReturnKordaId(nextKordaId);
  };

  const handleStudentSelection = React.useCallback(
    async (student: StudentBasic | null) => {
      if (!student) {
        setSelectedStudent(null);
        return;
      }

      if (student.externalParticipantId) {
        setSelectedStudent(student);
        return;
      }

      const requestId = ++studentSelectionRequestRef.current;
      const checkResult = await checkStudentAlreadyRegistered({
        eventId,
        studentId: student.id,
      });

      if (requestId !== studentSelectionRequestRef.current) {
        return;
      }

      if (!checkResult.success) {
        setSelectedStudent(student);
        toast.error(
          checkResult.error || "Gagal memeriksa status registrasi santri",
        );
        return;
      }

      const alreadyHasRequestedJourney = registrationMode === "both"
        ? checkResult.registered
        : registrationMode === "outbound_only"
          ? checkResult.hasOutbound
          : checkResult.hasReturn;
      if (alreadyHasRequestedJourney) {
        setSelectedStudentId(null);
        setSelectedStudent(null);
        toast.error(
          `${student.name} sudah terdaftar pada perjalanan ini untuk event tersebut.`,
        );
        return;
      }

      setSelectedStudent(student);
    },
    [eventId, registrationMode],
  );

  const handleCreateExternalDraft = async () => {
    if (!selectedKordaId) {
      toast.error("Pilih Korda tujuan terlebih dahulu.");
      return;
    }
    const result = await createExternalParticipantFromRegistration({
      intendedKordaId: selectedKordaId,
      name: externalDraftName,
      gender: externalDraftGender,
      address: externalDraftAddress,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setShowExternalDraft(false);
    setExternalDraftName("");
    setExternalDraftGender("");
    setExternalDraftAddress("");
    const item: StudentBasic = {
      id: `external:${result.data.id}`,
      externalParticipantId: result.data.id,
      name: result.data.name,
      nis: null,
      gender: result.data.gender ?? undefined,
      address: result.data.address,
      regencyId: null,
      regency: null,
    };
    setParticipantType("external");
    setSelectedStudent(item);
    setSelectedStudentId(item.id);
    toast.success("Profil eksternal lengkap dan siap ditambahkan ke registrasi.");
  };

  const canAddParticipant = selectedStudent &&
    (registrationMode === "both"
      ? selectedOutboundDropPoint && selectedReturnDropPoint
      : registrationMode === "outbound_only" ? selectedOutboundDropPoint : selectedReturnDropPoint);

  const currentDraft = React.useMemo<ParticipantDraft | null>(() => selectedStudent && canAddParticipant ? ({
    student: selectedStudent,
    ...(selectedStudent.externalParticipantId ? { externalParticipantId: selectedStudent.externalParticipantId } : {}),
    outboundDropPoint: registrationMode !== "return_only" ? selectedOutboundDropPoint : null,
    returnDropPoint: registrationMode !== "outbound_only" ? selectedReturnDropPoint : null,
    paymentStatus: "unpaid",
  }) : null, [selectedStudent, canAddParticipant, registrationMode, selectedOutboundDropPoint, selectedReturnDropPoint]);

  const paymentTargets = participantDrafts;
  const paymentJourneys = paymentTargets.flatMap((participant, index) => [
    ...(participant.outboundDropPoint ? [{ key: `${participant.draftKey ?? index}:OUTBOUND`, participant, direction: "OUTBOUND" as const, tariff: getJourneyTariff(participant.outboundDropPoint.price, "OUTBOUND"), destination: kordas.find((korda) => korda.id === participant.outboundDropPoint!.kordaId)?.name ?? "Korda tujuan" }] : []),
    ...(participant.returnDropPoint ? [{ key: `${participant.draftKey ?? index}:RETURN`, participant, direction: "RETURN" as const, tariff: getJourneyTariff(participant.returnDropPoint.price, "RETURN"), destination: kordas.find((korda) => korda.id === participant.returnDropPoint!.kordaId)?.name ?? "Korda tujuan" }] : []),
  ]);
  const paymentDue = paymentJourneys.reduce((sum, journey) => sum + journey.tariff, 0);
  const manualAllocationTotal = paymentJourneys.reduce((sum, journey) => sum + (Number(customPaymentAllocations[journey.key]) || 0), 0);
  const transferAmount = Number(paymentAmount) || 0;
  const unallocatedPayment = customizePaymentAllocation ? Math.max(0, transferAmount - manualAllocationTotal) : Math.max(0, transferAmount - paymentDue);
  React.useEffect(() => {
    if (!paymentAmountEdited) setPaymentAmount(paymentDue ? String(paymentDue) : "");
  }, [paymentDue, paymentAmountEdited]);

  const addCurrentParticipant = () => {
    if (!currentDraft) return toast.error("Lengkapi peserta dan pilihan perjalanan terlebih dahulu.");
    const duplicate = participantDrafts.some((draft) => draft.student.id === currentDraft.student.id);
    if (duplicate) return toast.error(`${currentDraft.student.name} sudah ada di daftar registrasi ini.`);
    const draftKey = `participant-${++draftKeyCounterRef.current}`;
    const nextDraft = { ...currentDraft, draftKey };
    setParticipantDrafts((current) => [...current, nextDraft]);
    if (customizePaymentAllocation) {
      setCustomPaymentAllocations((current) => ({
        ...current,
        ...(nextDraft.outboundDropPoint ? { [`${draftKey}:OUTBOUND`]: String(getJourneyTariff(nextDraft.outboundDropPoint.price, "OUTBOUND")) } : {}),
        ...(nextDraft.returnDropPoint ? { [`${draftKey}:RETURN`]: String(getJourneyTariff(nextDraft.returnDropPoint.price, "RETURN")) } : {}),
      }));
    }
    setSelectedStudentId(null);
    setSelectedStudent(null);
  };

  const removeParticipant = (draft: ParticipantDraft) => {
    const remainingDrafts = participantDrafts.filter((item) => item.draftKey !== draft.draftKey);
    setParticipantDrafts(remainingDrafts);
    if (!remainingDrafts.length) { setPaymentAmount(""); setPaymentAmountEdited(false); setRecordPaymentNow(false); setPaymentEvidence(null); setCustomizePaymentAllocation(false); setCustomPaymentAllocations({}); setBalanceOwnerKey(""); }
    setCustomPaymentAllocations((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${draft.draftKey}:`))));
    if (balanceOwnerKey.startsWith(`${draft.draftKey}:`)) setBalanceOwnerKey("");
  };

  const handleSubmit = async () => {
    const targetParticipants = participantDrafts;
    if (!targetParticipants.length) return toast.error("Tambahkan setidaknya satu peserta ke daftar registrasi.");
    if (recordPaymentNow) {
      if (!Number.isSafeInteger(Number(paymentAmount)) || Number(paymentAmount) <= 0) return toast.error("Masukkan nominal pembayaran yang valid.");
      if (!paymentEvidence) return toast.error("Unggah bukti transfer untuk mencatat pembayaran.");
      if (customizePaymentAllocation && manualAllocationTotal > transferAmount) return toast.error("Total alokasi perjalanan melebihi nominal transfer.");
      if (unallocatedPayment > 0 && !balanceOwnerKey) return toast.error("Pilih pemilik Saldo Lain untuk kelebihan transfer.");
    }
    setSubmitting(true);
    let uploadedEvidenceKey: string | null = null;
    let evidenceCleanupToken = "";
    try {
      let evidence: { id: string; storageKey: string; name: string; mimeType: string; sizeBytes: number } | null = null;
      if (recordPaymentNow && paymentEvidence) {
        const upload = await createRegistrationEvidenceUploadAction({ name: paymentEvidence.name, mimeType: paymentEvidence.type, sizeBytes: paymentEvidence.size });
        if (!upload.success) throw new Error(upload.error);
        uploadedEvidenceKey = upload.storageKey;
        evidenceCleanupToken = upload.cleanupToken;
        const uploaded = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": paymentEvidence.type }, body: paymentEvidence });
        if (!uploaded.ok) { await cleanupRegistrationEvidenceUploadAction(upload.storageKey, evidenceCleanupToken); uploadedEvidenceKey = null; throw new Error("Upload bukti ke Supabase gagal. Coba unggah kembali."); }
        evidence = { id: upload.id, storageKey: upload.storageKey, name: paymentEvidence.name, mimeType: paymentEvidence.type, sizeBytes: paymentEvidence.size };
      }
      const result = await finalizeRegistrationBatchAction({
        registrations: targetParticipants.map((p, index) => ({
            eventId,
            studentId: p.externalParticipantId ? null : p.student.id,
            externalParticipantId: p.externalParticipantId ?? null,
            outboundKordaId: p.outboundDropPoint?.kordaId || null,
            outboundDropPointId: p.outboundDropPoint?.id || null,
            returnKordaId: p.returnDropPoint?.kordaId || null,
            returnDropPointId: p.returnDropPoint?.id || null,
            registrarName: "",
            registrarPhone: "",
            kordaChanged: false,
            kordaChangeConfirmed: true,
            outboundPaid: false,
            returnPaid: false,
            participantKey: String(index),
          })),
        payment: recordPaymentNow ? {
          amount: Number(paymentAmount),
          balanceOwnerKey: (() => { const owner = paymentJourneys.find((journey) => journey.key === balanceOwnerKey); return owner ? `${paymentTargets.indexOf(owner.participant)}:${owner.direction}` : null; })(),
          evidence,
          ...(customizePaymentAllocation ? { allocations: paymentJourneys.map((journey) => ({ participantKey: String(paymentTargets.indexOf(journey.participant)), direction: journey.direction, journeyAmount: Number(customPaymentAllocations[journey.key]) || 0 })) } : {}),
        } : null,
      });
      if (!result.success) { if (uploadedEvidenceKey) await cleanupRegistrationEvidenceUploadAction(uploadedEvidenceKey, evidenceCleanupToken); uploadedEvidenceKey = null; toast.error(result.error); return; }
      setLastSubmissionSummary({ names: targetParticipants.map((participant) => participant.student.name), paid: recordPaymentNow, amount: recordPaymentNow ? Number(paymentAmount) : 0 });
      toast.success(recordPaymentNow ? "Registrasi dan pembayaran berhasil disimpan." : "Registrasi berhasil disimpan.");
      setPaymentEvidence(null); setRecordPaymentNow(false); setPaymentAmount(""); setPaymentAmountEdited(false); setBalanceOwnerKey(""); setCustomizePaymentAllocation(false); setCustomPaymentAllocations({});
      setParticipantDrafts([]);
      setSelectedStudentId(null); setSelectedStudent(null); setSelectedOutboundKordaId(selectedKordaId); setSelectedReturnKordaId(selectedKordaId); setSelectedOutboundDropPointId(null); setSelectedReturnDropPointId(null);
    } catch (error) {
      if (uploadedEvidenceKey) await cleanupRegistrationEvidenceUploadAction(uploadedEvidenceKey, evidenceCleanupToken);
      toast.error(error instanceof Error ? error.message : "Gagal menyelesaikan registrasi.");
    } finally {
      setSubmitting(false);
    }
  };

  // Validation based on registration mode
  return (
    <div className="space-y-6">
      {lastSubmissionSummary && <Card className="border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/20"><CardContent className="space-y-1 p-4"><p className="font-semibold text-emerald-800 dark:text-emerald-300">Registrasi berhasil disimpan</p><p className="text-sm">{lastSubmissionSummary.names.join(", ")}</p><p className="text-sm text-muted-foreground">{lastSubmissionSummary.paid ? `Pembayaran Rp${lastSubmissionSummary.amount.toLocaleString("id-ID")} juga dicatat.` : "Belum ada pembayaran yang dicatat."} Form siap untuk registrasi berikutnya.</p><Button type="button" variant="ghost" size="sm" onClick={() => setLastSubmissionSummary(null)}>Tutup ringkasan</Button></CardContent></Card>}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Peserta Baru</CardTitle>
          <CardDescription>
            Tambahkan satu atau beberapa peserta untuk Korda tujuan yang sama, lalu simpan sekaligus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          {!lockMode && (
            <div className="border-b pb-4">
              <Label className="mb-2 block">Mode Registrasi</Label>
              <RadioGroup
                value={registrationMode}
                  onValueChange={(value) =>
                  setRegistrationMode(value as "both" | "outbound_only" | "return_only")
                }
              >
                <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="mode-both" disabled={participantDrafts.length > 0} />
                  <label htmlFor="mode-both" className="text-sm cursor-pointer">
                    Pulang & Kembali (Normal)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="outbound_only" id="mode-outbound" disabled={participantDrafts.length > 0} />
                  <label htmlFor="mode-outbound" className="text-sm cursor-pointer">
                    Perjalanan Pulang saja
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="return_only" id="mode-return" disabled={participantDrafts.length > 0} />
                  <label
                    htmlFor="mode-return"
                    className="text-sm cursor-pointer"
                  >
                    Kembali Saja (Anak dijemput ortu, hanya ikut bus kembali)
                  </label>
                </div>
              </RadioGroup>
              {participantDrafts.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Hapus seluruh peserta dari daftar terlebih dahulu jika ingin mengganti mode perjalanan.</p>}
            </div>
          )}

          {/* Step 1: Select required destination Korda */}
          <div>
            <Label className="mb-1">1. Korda tujuan *</Label>
            <Autocomplete
              items={kordas}
              value={selectedKordaId}
              onValueChange={selectDestinationKorda}
              keyField="id"
              getLabel={(korda) => korda.name}
              placeholder="Pilih Korda tujuan"
              searchPlaceholder="Cari korda..."
              emptyText="Tidak ada korda"
              disabled={!!defaultKordaId || participantDrafts.length > 0}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {defaultKordaId ? "Korda tujuan mengikuti cakupan akun Anda." : participantDrafts.length > 0 ? "Korda tujuan terkunci selama peserta masih ada di daftar." : "Pilih Korda tujuan sebelum mengisi data peserta dan perjalanan."} Pulang dan Kembali dalam satu registrasi menggunakan Korda tujuan ini. Pencarian santri lintas Korda hanya menampilkan identitas minimum dan Korda asal.
            </p>
          </div>

          {selectedKordaId ? <>
          {/* Step 2: Search Student (Async) */}
          <div>
            <Label className="mb-1">2. Jenis peserta</Label>
            <RadioGroup value={participantType} onValueChange={(value) => {
              setParticipantType(value as "student" | "external");
              setSelectedStudent(null);
              setSelectedStudentId(null);
            }} className="mb-2 flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="student" id="participant-student" /><label htmlFor="participant-student" className="text-sm">Santri</label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="external" id="participant-external" /><label htmlFor="participant-external" className="text-sm">Peserta eksternal</label></div>
            </RadioGroup>
            <Label className="mb-1">Cari & Pilih {participantType === "student" ? "Santri" : "Peserta eksternal"} *</Label>
            <Autocomplete
              key={`${participantType}:${selectedKordaId || "all"}`} // Reset cache when destination or type changes
              async={{
                loadOptions: (query) => participantType === "student"
                  ? searchStudents(query, selectedKordaId || undefined)
                  : selectedKordaId
                    ? searchCompleteExternalParticipants(query, selectedKordaId)
                    : Promise.resolve([]),
                debounceMs: 300,
                cache: {
                  enabled: true,
                  staleTimeMs: 60_000,
                },
              }}
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              onSelectRaw={(student) => {
                void handleStudentSelection(student as StudentBasic | null);
              }}
              keyField="id"
              getLabel={(student) => `${student.name}${student.nis ? ` (${student.nis})` : ""}${student.regency?.korda?.name ? ` · Asal ${student.regency.korda.name}` : ""}`}
              placeholder={participantType === "student" ? "Cari santri..." : "Cari peserta eksternal yang sudah lengkap..."}
              searchPlaceholder={participantType === "student" ? "Ketik nama atau NIS..." : "Ketik nama atau alamat..."}
              emptyText={participantType === "external" && !selectedKordaId ? "Pilih Korda tujuan terlebih dahulu" : "Tidak ada hasil"}
              virtualized={{ enabled: true }}
            />
            {participantType === "external" && (
              <div className="mt-3 space-y-2">
                {!showExternalDraft ? (
                  <div className="space-y-1">
                    <Button type="button" variant="outline" size="sm" disabled={!selectedKordaId} onClick={() => setShowExternalDraft(true)}>
                      Buat profil peserta eksternal
                    </Button>
                    {!selectedKordaId && (
                      <p className="text-xs text-muted-foreground" role="status">
                        Pilih Korda tujuan terlebih dahulu. Profil eksternal akan disimpan untuk Korda tujuan tersebut.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Profil baru untuk Korda tujuan</p>
                    <Input required value={externalDraftName} onChange={(event) => setExternalDraftName(event.target.value)} placeholder="Nama peserta *" />
                    <Select value={externalDraftGender || "none"} onValueChange={(value) => setExternalDraftGender(value === "none" ? "" : value)}>
                      <SelectTrigger><SelectValue placeholder="Jenis kelamin *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum diisi</SelectItem>
                        <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                        <SelectItem value="Perempuan">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input required value={externalDraftAddress} onChange={(event) => setExternalDraftAddress(event.target.value)} placeholder="Alamat *" />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!externalDraftName.trim() || !externalDraftGender || !externalDraftAddress.trim()} onClick={() => void handleCreateExternalDraft()}>Simpan profil lengkap</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowExternalDraft(false)}>Batal</Button>
                    </div>
                    {selectedKordaId && <p className="text-xs text-muted-foreground">Nama, jenis kelamin, dan alamat wajib diisi. Setelah disimpan, profil langsung berstatus Lengkap dan siap diregistrasikan oleh role yang berwenang pada Korda tujuan.</p>}
                  </div>
                )}
              </div>
            )}
              {selectedKordaId && participantType === "student" && (
                <p className="text-sm text-muted-foreground mt-1">
                Pencarian dibatasi pada Korda tujuan ini; santri dari Korda asal lain dapat ditemukan.
                </p>
              )}
              {selectedKordaId && participantType === "external" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Hanya profil Lengkap pada Korda tujuan ini yang dapat dipilih. Profil lama yang masih Draf perlu dilengkapi melalui halaman Peserta eksternal sebelum registrasi.
                </p>
              )}
          </div>

          {/* Step 3: Perjalanan Pulang (Outbound) - Only for 'both' mode */}
          {(registrationMode === "both" || registrationMode === "outbound_only") && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <h3 className="font-semibold text-sm">
                3. Perjalanan Pulang (Outbound)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1">Korda tujuan</Label>
                  <div className="rounded-md border bg-background px-3 py-2 text-sm">{kordas.find((korda) => korda.id === selectedKordaId)?.name}</div>
                </div>

                <div>
                  <Label className="mb-1">Pilih Titik Turun *</Label>
                  <Select
                    value={selectedOutboundDropPointId || ""}
                    onValueChange={(value) => {
                      setSelectedOutboundDropPointId(value);
                      setSelectedReturnDropPointId(value);
                    }}
                    disabled={!selectedOutboundKordaId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedOutboundKordaId
                            ? "Pilih titik turun"
                            : "Pilih korda terlebih dahulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {outboundDropPoints.map((dp) => (
                        <SelectItem key={dp.id} value={dp.id}>
                          {dp.name} - tarif Pulang Rp {getJourneyTariff(dp.price, "OUTBOUND").toLocaleString("id-ID")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOutboundDropPoint && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Tarif Pulang per peserta: Rp{" "}
                      {getJourneyTariff(selectedOutboundDropPoint.price, "OUTBOUND").toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Perjalanan Kembali (Return) */}
          {registrationMode !== "outbound_only" && <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">
              4. Perjalanan Kembali (Return)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1">Korda tujuan *</Label>
                  <div className="rounded-md border bg-background px-3 py-2 text-sm">{kordas.find((korda) => korda.id === selectedKordaId)?.name}</div>
                  {registrationMode === "both" && <p className="mt-1 text-xs text-muted-foreground">Pulang-pergi hanya dapat memakai satu Korda tujuan.</p>}
                </div>

              <div>
                <Label className="mb-1">Pilih Titik Penjemputan *</Label>
                <Select
                  value={selectedReturnDropPointId || ""}
                  onValueChange={setSelectedReturnDropPointId}
                  disabled={!selectedReturnKordaId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedReturnKordaId
                          ? "Pilih titik penjemputan"
                          : "Pilih korda terlebih dahulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {returnDropPoints.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id}>
                        {dp.name} - tarif Kembali Rp {getJourneyTariff(dp.price, "RETURN").toLocaleString("id-ID")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedReturnDropPoint && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Tarif Kembali per peserta: Rp{" "}
                    {getJourneyTariff(selectedReturnDropPoint.price, "RETURN").toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </div>
          </div>}

          {participantDrafts.length > 0 && <section className="space-y-3 rounded-lg border bg-background p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Daftar peserta ({participantDrafts.length})</h3><p className="text-sm text-muted-foreground">Peserta akan diregistrasikan bersama dalam satu submit.</p></div><span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs">{registrationMode === "both" ? "Pulang & Kembali" : registrationMode === "outbound_only" ? "Pulang" : "Kembali"}</span></div>
            <ul className="divide-y rounded-md border">
              {participantDrafts.map((draft) => <li key={draft.draftKey} className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><p className="font-medium">{draft.student.name}</p><p className="text-xs text-muted-foreground">{draft.externalParticipantId ? "Peserta eksternal" : draft.student.nis ? `NIS ${draft.student.nis}` : "Santri"}</p><p className="mt-1 text-sm text-muted-foreground">{[draft.outboundDropPoint && `Pulang: ${draft.outboundDropPoint.name}`, draft.returnDropPoint && `Kembali: ${draft.returnDropPoint.name}`].filter(Boolean).join(" · ")}</p></div><Button type="button" size="sm" variant="ghost" disabled={submitting} onClick={() => removeParticipant(draft)} aria-label={`Hapus ${draft.student.name} dari daftar`}>Hapus</Button></li>)}
            </ul>
            {participantDrafts.length > 0 && <p className="text-xs text-muted-foreground">Pilih orang berikutnya di atas untuk menambahkannya. Korda tujuan tetap sama untuk seluruh daftar.</p>}
          </section>}

          {paymentTargets.length > 0 && <section className="space-y-4 rounded-lg border bg-background p-4">
            <div><h3 className="font-semibold">Pembayaran (opsional)</h3><p className="text-sm text-muted-foreground">Centang jika pembayaran sudah dilakukan. Jika dilewati, pembayaran dapat dicatat nanti melalui menu Pembayaran.</p></div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-muted/40 p-3"><input type="checkbox" checked={recordPaymentNow} onChange={(event) => setRecordPaymentNow(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><span className="block text-sm font-medium">Pembayaran sudah dilakukan</span><span className="mt-0.5 block text-xs text-muted-foreground">Centang untuk mengisi nominal dan mengunggah bukti transfer sekarang.</span></span></label>
            {recordPaymentNow && <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Nominal transfer <span className="text-destructive">*</span><input required type="number" min="1" step="1" value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value); setPaymentAmountEdited(true); }} className="mt-1.5 w-full rounded-md border bg-background px-3 py-2.5" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Default sebesar total tagihan: Rp{paymentDue.toLocaleString("id-ID")}. Nominal lebih kecil dicatat sebagai partial.</span></label>
                <label className="text-sm font-medium">Bukti transfer <span className="text-destructive">*</span><span className="mt-1.5 block text-xs font-normal text-muted-foreground">PDF/JPG/PNG/WebP · maks. 10 MB</span><input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setPaymentEvidence(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-md border bg-background p-2 text-sm" /></label>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={customizePaymentAllocation} onChange={(event) => { const checked = event.target.checked; setCustomizePaymentAllocation(checked); if (checked) setCustomPaymentAllocations(Object.fromEntries(paymentJourneys.map((journey) => [journey.key, String(journey.tariff)]))); }} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Atur pembayaran partial per perjalanan</span><span className="block text-xs text-muted-foreground">Tentukan perjalanan dan nominal yang menerima alokasi.</span></span></label>
              {customizePaymentAllocation && <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Alokasi tagihan</p>{paymentJourneys.map((journey) => <label key={journey.key} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{journey.participant.student.name} · {journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"} · {journey.destination}<span className="block text-xs text-muted-foreground">Tagihan Rp{journey.tariff.toLocaleString("id-ID")}</span></span><input type="number" min="0" max={journey.tariff} step="1" value={customPaymentAllocations[journey.key] ?? String(journey.tariff)} onChange={(event) => setCustomPaymentAllocations((current) => ({ ...current, [journey.key]: event.target.value }))} className="w-full rounded-md border bg-background px-3 py-2 sm:w-44" /></label>)}</div>}
              {unallocatedPayment > 0 && <label className="block text-sm font-medium">Pemilik Saldo Lain <span className="text-destructive">*</span><select value={balanceOwnerKey} onChange={(event) => setBalanceOwnerKey(event.target.value)} className="mt-1.5 w-full rounded-md border bg-background px-3 py-2.5"><option value="">Pilih peserta dan arah perjalanan</option>{paymentJourneys.map((journey) => <option key={journey.key} value={journey.key}>{journey.participant.student.name} · {journey.direction === "OUTBOUND" ? "Pulang" : "Kembali"} · {journey.destination}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Kelebihan masuk ke Korda tujuan perjalanan yang dipilih.</span></label>}
              <div className="rounded-md bg-muted/50 p-3 text-sm"><div className="flex justify-between gap-3"><span>Total tagihan</span><strong>Rp{paymentDue.toLocaleString("id-ID")}</strong></div><div className="mt-1 flex justify-between gap-3"><span>Dialokasikan ke tagihan</span><strong>Rp{(customizePaymentAllocation ? manualAllocationTotal : Math.min(transferAmount, paymentDue)).toLocaleString("id-ID")}</strong></div><div className="mt-1 flex justify-between gap-3"><span>Sisa tagihan</span><strong>Rp{Math.max(0, paymentDue - (customizePaymentAllocation ? manualAllocationTotal : Math.min(transferAmount, paymentDue))).toLocaleString("id-ID")}</strong></div><div className="mt-1 flex justify-between gap-3 border-t pt-2"><span>Kelebihan ke Saldo Lain</span><strong>Rp{unallocatedPayment.toLocaleString("id-ID")}</strong></div></div>
            </div>}
          </section>}

          <Button type="button" variant={participantDrafts.length > 0 ? "outline" : "default"} onClick={addCurrentParticipant} disabled={!canAddParticipant || submitting || participantDrafts.some((draft) => draft.student.id === selectedStudent?.id)} className="w-full">
            {participantDrafts.some((draft) => draft.student.id === selectedStudent?.id) ? "Peserta sudah ada di daftar" : "Tambah peserta ke daftar"}
          </Button>

          {participantDrafts.length > 0 && <div className="space-y-2 border-t pt-4">
            {!recordPaymentNow && <p className="text-sm text-muted-foreground">Total tagihan semua peserta: <strong className="text-foreground">Rp{paymentDue.toLocaleString("id-ID")}</strong></p>}
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="w-full">
              {submitting ? "Menyimpan..." : `Simpan ${participantDrafts.length} peserta${recordPaymentNow ? " dan pembayaran" : ""}`}
            </Button>
          </div>}
          </> : <div className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground" role="status">Pilih Korda tujuan terlebih dahulu untuk membuka isian peserta, perjalanan, dan pembayaran.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
