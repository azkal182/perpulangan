import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PaymentParticipantRow, PaymentJourneyRow } from "../components/PaymentParticipantsTable";

const MARGIN = 15;
const NAVY: [number, number, number] = [30, 64, 120];
const BLUE: [number, number, number] = [37, 99, 180];
const PURPLE: [number, number, number] = [124, 58, 160];

type JourneyDetail = {
  participant: PaymentParticipantRow;
  journey: PaymentJourneyRow;
};

export type PaymentPdfFilter = "ALL" | "PAID" | "UNPAID";

type KordaGroup = {
  name: string;
  rows: JourneyDetail[];
};

type KorwilGroup = {
  name: string;
  kordas: KordaGroup[];
};

type OriginKordaGroup = {
  name: string;
  participants: PaymentParticipantRow[];
};

type OriginKorwilGroup = {
  name: string;
  kordas: OriginKordaGroup[];
};

function money(value: number | null) {
  return value === null ? "-" : `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function statusFilterLabel(value: PaymentPdfFilter) {
  const labels: Record<string, string> = {
    ALL: "Semua status pembayaran",
    PAID: "Sudah bayar (termasuk sebagian)",
    UNPAID: "Belum bayar (masih memiliki tagihan)",
  };
  return labels[value];
}

function filterRows(rows: PaymentParticipantRow[], filter: PaymentPdfFilter): PaymentParticipantRow[] {
  if (filter === "ALL") return rows;
  return rows.filter((row) => filter === "PAID"
    ? row.journeys.some((journey) => journey.paid > 0)
    : row.dueTotal > 0);
}

function groupByDestination(rows: PaymentParticipantRow[]): KorwilGroup[] {
  const korwilMap = new Map<string, Map<string, JourneyDetail[]>>();
  for (const participant of rows) {
    for (const journey of participant.journeys) {
      const korwilName = journey.korwil || "Tanpa Korwil";
      const kordaName = journey.destination || "Korda tujuan tidak tersedia";
      if (!korwilMap.has(korwilName)) korwilMap.set(korwilName, new Map());
      const kordaMap = korwilMap.get(korwilName)!;
      if (!kordaMap.has(kordaName)) kordaMap.set(kordaName, []);
      kordaMap.get(kordaName)!.push({ participant, journey });
    }
  }

  return [...korwilMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "id", { sensitivity: "base" }))
    .map(([name, kordaMap]) => ({
      name,
      kordas: [...kordaMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "id", { sensitivity: "base" }))
        .map(([kordaName, details]) => ({
          name: kordaName,
          rows: details.sort((a, b) => a.participant.name.localeCompare(b.participant.name, "id", { sensitivity: "base" }) || a.journey.direction.localeCompare(b.journey.direction)),
        })),
    }));
}

function groupByOrigin(rows: PaymentParticipantRow[]): OriginKorwilGroup[] {
  const korwilMap = new Map<string, Map<string, PaymentParticipantRow[]>>();
  for (const participant of rows) {
    const korwilName = participant.originKorwil || "Tanpa Korwil";
    const kordaName = participant.origin || "Asal tidak tersedia";
    if (!korwilMap.has(korwilName)) korwilMap.set(korwilName, new Map());
    const kordaMap = korwilMap.get(korwilName)!;
    if (!kordaMap.has(kordaName)) kordaMap.set(kordaName, []);
    kordaMap.get(kordaName)!.push(participant);
  }

  return [...korwilMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "id", { sensitivity: "base" }))
    .map(([name, kordaMap]) => ({
      name,
      kordas: [...kordaMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "id", { sensitivity: "base" }))
        .map(([kordaName, participants]) => ({
          name: kordaName,
          participants: participants.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" })),
        })),
    }));
}

function participantTotalCell(participant: PaymentParticipantRow) {
  return money(participant.journeys.reduce((sum, journey) => sum + (journey.tariff ?? 0), 0));
}

function participantStatus(participant: PaymentParticipantRow) {
  if (participant.journeys.some((journey) => journey.tariff === null)) return "Tarif belum lengkap";
  if (participant.journeys.every((journey) => journey.due === 0)) return "Lunas";
  return participant.journeys.some((journey) => journey.paid > 0) ? "Bayar sebagian" : "Belum bayar";
}

function drawPageNumbers(doc: jsPDF) {
  const count = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(215, 222, 230);
    doc.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 130);
    doc.text("Perpulangan · Laporan pembayaran peserta", MARGIN, pageHeight - 7);
    doc.text(`Halaman ${page} dari ${count}`, pageWidth - MARGIN, pageHeight - 7, { align: "right" });
  }
}

export function buildPaymentsPDF(
  rows: PaymentParticipantRow[],
  eventName: string,
  search: string,
  paymentFilter: PaymentPdfFilter,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const filteredRows = filterRows(rows, paymentFilter);
  const groups = groupByDestination(filteredRows);
  const journeys = filteredRows.flatMap((row) => row.journeys);
  const totalBilled = journeys.reduce((sum, journey) => sum + (journey.tariff ?? 0), 0);
  const totalPaid = journeys.reduce((sum, journey) => sum + journey.paid, 0);
  const totalDue = journeys.reduce((sum, journey) => sum + (journey.due ?? 0), 0);
  const participantsWithDue = filteredRows.filter((participant) => participant.dueTotal > 0).length;
  const generatedDate = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("REKAPITULASI PEMBAYARAN PESERTA", pageWidth / 2, MARGIN, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 100);
  doc.text(eventName, pageWidth / 2, MARGIN + 6, { align: "center" });
  doc.text(`Dicetak: ${generatedDate}`, pageWidth / 2, MARGIN + 11, { align: "center" });
  doc.setTextColor(0);

  let y = MARGIN + 20;
  const boxGap = 3;
  const boxWidth = (pageWidth - MARGIN * 2 - boxGap * 3) / 4;
  const boxes = [
    { label: "Peserta", value: String(filteredRows.length), color: NAVY },
    { label: "Peserta masih ada tagihan", value: String(participantsWithDue), color: PURPLE },
    { label: "Total tagihan", value: money(totalBilled), color: BLUE },
    { label: "Total sisa tagihan", value: money(totalDue), color: PURPLE },
  ];
  boxes.forEach((box, index) => {
    const x = MARGIN + index * (boxWidth + boxGap);
    doc.setFillColor(...box.color);
    doc.roundedRect(x, y, boxWidth, 21, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text(box.label, x + boxWidth / 2, y + 6, { align: "center", maxWidth: boxWidth - 3 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(box.value.length > 14 ? 8 : 12);
    doc.text(box.value, x + boxWidth / 2, y + 16, { align: "center", maxWidth: boxWidth - 3 });
  });
  doc.setTextColor(0);
  y += 27;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 90);
  const participantStatuses = filteredRows.map(participantStatus);
  const filterLines = [`Kategori export: ${statusFilterLabel(paymentFilter)}`, `Jumlah peserta: ${filteredRows.length} · Lunas: ${participantStatuses.filter((status) => status === "Lunas").length} · Bayar sebagian: ${participantStatuses.filter((status) => status === "Bayar sebagian").length} · Belum bayar: ${participantStatuses.filter((status) => status === "Belum bayar").length} · Tarif belum lengkap: ${participantStatuses.filter((status) => status === "Tarif belum lengkap").length}`, `Jumlah perjalanan tercatat: ${journeys.length} · Total pembayaran tercatat: ${money(totalPaid)}`, ...(search ? [`Pencarian: ${search}`] : [])];
  for (const line of filterLines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - MARGIN * 2);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4 + 1;
  }
  y += 2;
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Ringkasan per Korwil tujuan", MARGIN, y);
  y += 4;
  const korwilSummary = groups.map((korwil) => {
    const details = korwil.kordas.flatMap((korda) => korda.rows);
    return [korwil.name, korwil.kordas.length, details.length, money(details.reduce((sum, item) => sum + (item.journey.tariff ?? 0), 0)), money(details.reduce((sum, item) => sum + item.journey.paid, 0)), money(details.reduce((sum, item) => sum + (item.journey.due ?? 0), 0))];
  });
  autoTable(doc, {
    startY: y,
    head: [["Korwil tujuan", "Korda", "Perjalanan", "Tagihan", "Terbayar", "Sisa"]],
    body: [...korwilSummary, ["TOTAL", groups.reduce((sum, group) => sum + group.kordas.length, 0), journeys.length, money(totalBilled), money(totalPaid), money(totalDue)]],
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, bottom: 17 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1, textColor: [35, 45, 55], lineColor: [215, 222, 229], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 16, halign: "center" }, 2: { cellWidth: 21, halign: "center" }, 3: { cellWidth: 31, halign: "right" }, 4: { cellWidth: 31, halign: "right" }, 5: { cellWidth: 31, halign: "right" } },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === korwilSummary.length) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fillColor = [220, 230, 245];
      }
    },
  });

  const afterKorwil = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let kordaHeadingY = afterKorwil + 8;
  if (kordaHeadingY + 20 > pageHeight - 17) {
    doc.addPage();
    kordaHeadingY = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Ringkasan per Korda tujuan", MARGIN, kordaHeadingY);
  const kordaSummary = groups.flatMap((korwil) => korwil.kordas.map((korda) => [korwil.name, korda.name, korda.rows.length, money(korda.rows.reduce((sum, item) => sum + (item.journey.tariff ?? 0), 0)), money(korda.rows.reduce((sum, item) => sum + item.journey.paid, 0)), money(korda.rows.reduce((sum, item) => sum + (item.journey.due ?? 0), 0))]));
  autoTable(doc, {
    startY: kordaHeadingY + 4,
    head: [["Korwil", "Korda tujuan", "Perjalanan", "Tagihan", "Terbayar", "Sisa"]],
    body: kordaSummary.length ? kordaSummary : [["-", "Tidak ada data pembayaran", 0, money(0), money(0), money(0)]],
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, bottom: 17 },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1, textColor: [35, 45, 55], lineColor: [215, 222, 229], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 36 }, 2: { cellWidth: 22, halign: "center" }, 3: { cellWidth: 26, halign: "right" }, 4: { cellWidth: 26, halign: "right" }, 5: { cellWidth: 24, halign: "right" } },
  });

  const originGroups = groupByOrigin(filteredRows);
  for (const korwil of originGroups) {
    doc.addPage();
    let detailY = MARGIN;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text("RINCIAN PEMBAYARAN PESERTA", pageWidth / 2, detailY, { align: "center" });
    detailY += 7;
    doc.setFontSize(12);
    doc.text(`Korwil asal: ${korwil.name}`, pageWidth / 2, detailY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 95);
    doc.text(`${eventName} · Kategori export: ${statusFilterLabel(paymentFilter)}`, pageWidth / 2, detailY + 5, { align: "center" });
    detailY += 14;

    for (const [kordaIndex, korda] of korwil.kordas.entries()) {
      if (kordaIndex > 0) {
        doc.addPage();
        detailY = MARGIN;
      }
      const kordaJourneys = korda.participants.flatMap((participant) => participant.journeys);
      const kordaBilled = kordaJourneys.reduce((sum, journey) => sum + (journey.tariff ?? 0), 0);
      const kordaPaid = kordaJourneys.reduce((sum, journey) => sum + journey.paid, 0);
      const kordaDue = kordaJourneys.reduce((sum, journey) => sum + (journey.due ?? 0), 0);
      doc.setFillColor(240, 244, 252);
      doc.roundedRect(MARGIN, detailY, pageWidth - MARGIN * 2, 13, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      doc.text(korda.name, MARGIN + 4, detailY + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 70, 80);
      const kordaParticipantsWithDue = korda.participants.filter((participant) => participant.dueTotal > 0).length;
      doc.text(`Peserta: ${korda.participants.length} · Masih ada tagihan: ${kordaParticipantsWithDue} · Perjalanan: ${kordaJourneys.length} · Tagihan: ${money(kordaBilled)} · Terbayar: ${money(kordaPaid)} · Sisa: ${money(kordaDue)}`, pageWidth - MARGIN - 4, detailY + 5.5, { align: "right", maxWidth: pageWidth - MARGIN * 2 - 70 });
      detailY += 17;

      autoTable(doc, {
        startY: detailY,
        head: [["No", "Peserta / identitas", "Korda tujuan Pulang", "Pulang", "Korda tujuan Kembali", "Kembali", "Total tagihan", "Sisa tagihan", "Status"]],
        body: korda.participants.map((participant, index) => [
          index + 1,
          `${participant.name}\n${participant.identifier}`,
          participant.journeys.find((journey) => journey.direction === "OUTBOUND")?.destination ?? "-",
          money(participant.journeys.find((journey) => journey.direction === "OUTBOUND")?.tariff ?? null),
          participant.journeys.find((journey) => journey.direction === "RETURN")?.destination ?? "-",
          money(participant.journeys.find((journey) => journey.direction === "RETURN")?.tariff ?? null),
          participantTotalCell(participant),
          money(participant.dueTotal),
          participantStatus(participant),
        ]),
        theme: "grid",
        margin: { left: MARGIN, right: MARGIN, bottom: 17 },
        styles: { font: "helvetica", fontSize: 6.3, cellPadding: { top: 1.2, right: 0.7, bottom: 1.2, left: 0.7 }, textColor: [35, 45, 55], lineColor: [215, 222, 229], lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center", minCellHeight: 8, fontSize: 6.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 5, halign: "center" }, 1: { cellWidth: 29 }, 2: { cellWidth: 23 }, 3: { cellWidth: 18, halign: "right" }, 4: { cellWidth: 23 }, 5: { cellWidth: 18, halign: "right" }, 6: { cellWidth: 21, halign: "right" }, 7: { cellWidth: 23, halign: "right" }, 8: { cellWidth: 18 } },
      });
      detailY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? detailY;
    }
  }

  drawPageNumbers(doc);
  return doc;
}

export function generatePaymentsPDF(
  rows: PaymentParticipantRow[],
  eventName: string,
  search: string,
  paymentFilter: PaymentPdfFilter,
) {
  const doc = buildPaymentsPDF(rows, eventName, search, paymentFilter);
  const datePart = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Pembayaran_${datePart}.pdf`);
}
